'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileText, ShieldCheck, Camera, Upload, Trash2, CheckCircle2,
  Loader2, MapPin, Award, ArrowRight, UserCheck, AlertTriangle, RefreshCw,
  ScrollText, Building2, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatarMoeda, formatarCPF, formatarData } from '@/lib/utils/formatters'

interface SignatureWizardProps {
  id: string
  token: string
  contrato: any
  cliente: any
  parcelas: any[]
}

// Redimensiona/recomprime uma imagem antes de embutir no payload da assinatura.
// Necessário porque: (1) câmeras de celular costumam negociar uma resolução
// bem maior do que o `ideal` pedido em getUserMedia, e (2) uma foto escolhida
// da galeria não passa por nenhuma captura controlada — pode vir com vários
// MB direto do rolo de câmera do aparelho. Sem isso, os 3 dados da assinatura
// (selfie + documento + rubrica) somados no corpo da requisição JSON podem
// passar do limite de payload da função serverless em produção, e o
// envio falha com um erro genérico bem na hora de assinar.
function redimensionarImagemBase64(dataUrl: string, maxDimensao: number, qualidade: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimensao || height > maxDimensao) {
        const escala = maxDimensao / Math.max(width, height)
        width = Math.round(width * escala)
        height = Math.round(height * escala)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas indisponível')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', qualidade))
    }
    img.onerror = () => reject(new Error('Falha ao carregar imagem para redimensionar'))
    img.src = dataUrl
  })
}

export default function SignatureWizard({ id, token, contrato, cliente, parcelas }: SignatureWizardProps) {
  const [passo, setPasso] = useState(0)
  const [contratoLido, setContratoLido] = useState(false)
  const [termosAceitos, setTermosAceitos] = useState(false)
  const contratoScrollRef = useRef<HTMLDivElement | null>(null)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [documento, setDocumento] = useState<string | null>(null)
  const [geolocation, setGeolocation] = useState<string | null>(null)
  const [geolocationStatus, setGeolocationStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle')
  const [enviando, setEnviando] = useState(false)
  const [resultadoUrl, setResultadoUrl] = useState<string | null>(null)

  // Live Camera states (selfie)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [carregandoCamera, setCarregandoCamera] = useState(false)
  const [permissaoNegada, setPermissaoNegada] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Document camera states
  const [docCameraStream, setDocCameraStream] = useState<MediaStream | null>(null)
  const [docCameraAtiva, setDocCameraAtiva] = useState(false)
  const [docCarregandoCamera, setDocCarregandoCamera] = useState(false)
  const [docPermissaoNegada, setDocPermissaoNegada] = useState(false)
  const docVideoRef = useRef<HTMLVideoElement | null>(null)

  // Calligraphy signature states
  const [sigType, setSigType] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState<'Great Vibes' | 'Dancing Script' | 'Alex Brush'>('Great Vibes')
  const [hasDrawn, setHasDrawn] = useState(false)

  // Refs for drawing canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const signButtonRef = useRef<HTMLDivElement | null>(null)
  const isDrawing = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)

  // Explicit geolocation capture logic
  const obterLocalizacao = useCallback(async (silencioso = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeolocation('Geolocalização não suportada no navegador')
      setGeolocationStatus('error')
      return
    }

    if (!silencioso) {
      setGeolocationStatus('requesting')
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const coordStr = `Lat: ${lat.toFixed(4)}, Long: ${lon.toFixed(4)}`

        try {
          // OpenStreetMap Nominatim reverse geocode api (pt-BR locale)
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
            headers: {
              'Accept-Language': 'pt-BR',
              'User-Agent': 'Grupo-SRSM-Factoring-Signature/1.0'
            }
          })
          
          if (res.ok) {
            const data = await res.json()
            const addr = data.address || {}
            const road = addr.road || addr.pedestrian || ''
            const suburb = addr.suburb || addr.neighbourhood || ''
            const city = addr.city || addr.town || addr.village || addr.municipality || suburb || 'Localidade'
            const state = addr.state_code || addr.state || ''
            const stateAbbr = state.length > 2 ? state : state
            const parts = [road, city, stateAbbr].filter(Boolean)
            const fullLocation = parts.join(', ')
            setGeolocation(fullLocation)
            setGeolocationStatus('success')
            if (!silencioso) {
              toast.success(`Localização registrada: ${city}`)
            }
          } else {
            setGeolocation(coordStr)
            setGeolocationStatus('success')
          }
        } catch (err) {
          console.error('Erro de reverse geocoding:', err)
          setGeolocation(coordStr)
          setGeolocationStatus('success')
        }
      },
      (err) => {
        console.error('Erro de geolocalização:', err)
        setGeolocation('Permissão de geolocalização negada')
        setGeolocationStatus('error')
        if (!silencioso) {
          toast.error('Não foi possível obter sua localização. Por favor, autorize no navegador.')
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // Auto request on mount silently
  useEffect(() => {
    obterLocalizacao(true)
  }, [obterLocalizacao])

  // After GPS success on step 4, scroll the sign button into view
  useEffect(() => {
    if (geolocationStatus === 'success' && passo === 4 && signButtonRef.current) {
      setTimeout(() => {
        signButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 400)
    }
  }, [geolocationStatus, passo])

  // Control camera session on Step 3
  const iniciarCamera = async () => {
    setCarregandoCamera(true)
    setPermissaoNegada(false)
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })
      
      setCameraStream(stream)
      setCameraAtiva(true)
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(e => console.error("Erro ao reproduzir câmera:", e))
        }
      }, 150)
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err)
      setPermissaoNegada(true)
    } finally {
      setCarregandoCamera(false)
    }
  }

  const pararCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCameraAtiva(false)
  }

  const iniciarCameraDocumento = async () => {
    setDocCarregandoCamera(true)
    setDocPermissaoNegada(false)
    try {
      if (docCameraStream) docCameraStream.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      setDocCameraStream(stream)
      setDocCameraAtiva(true)
      setTimeout(() => {
        if (docVideoRef.current) {
          docVideoRef.current.srcObject = stream
          docVideoRef.current.play().catch(() => {})
        }
      }, 150)
    } catch {
      setDocPermissaoNegada(true)
    } finally {
      setDocCarregandoCamera(false)
    }
  }

  const pararCameraDocumento = () => {
    if (docCameraStream) {
      docCameraStream.getTracks().forEach(t => t.stop())
      setDocCameraStream(null)
    }
    setDocCameraAtiva(false)
  }

  const capturarFotoDocumento = async () => {
    const video = docVideoRef.current
    if (!video) return
    try {
      // Câmeras de celular costumam negociar uma resolução bem maior do que o
      // "ideal" pedido — captura no tamanho nativo e redimensiona em seguida,
      // em vez de confiar que a câmera respeitou o pedido de 1280x960.
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 960
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const bruto = canvas.toDataURL('image/jpeg', 0.9)
        const base64 = await redimensionarImagemBase64(bruto, 1400, 0.85)
        setDocumento(base64)
        pararCameraDocumento()
        toast.success('Documento fotografado com sucesso!')
      }
    } catch {
      toast.error('Erro ao capturar foto do documento.')
    }
  }

  const capturarFoto = async () => {
    const video = videoRef.current
    if (!video) return

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')

      if (ctx) {
        // Mirror the image horizontally
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        const bruto = canvas.toDataURL('image/jpeg', 0.85)
        const base64 = await redimensionarImagemBase64(bruto, 900, 0.85)
        setSelfie(base64)
        pararCamera()
        toast.success('Selfie capturada com sucesso!')
      }
    } catch (err) {
      console.error('Erro ao capturar frame:', err)
      toast.error('Erro ao tirar a foto. Tente novamente.')
    }
  }

  useEffect(() => {
    if (passo === 3 && !selfie) {
      iniciarCamera()
    }
    return () => {
      pararCamera()
    }
  }, [passo, selfie])

  // Load calligraphic fonts dynamically on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script:wght@600&family=Great+Vibes&display=swap'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
      return () => {
        document.head.removeChild(link)
      }
    }
  }, [])

  // Initialize canvas background to white on mount or sigType change
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && sigType === 'draw') {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [sigType])

  // Draw typed name dynamically on canvas when input/font changes
  useEffect(() => {
    if (sigType === 'type') {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(30, canvas.height - 40)
      ctx.lineTo(canvas.width - 30, canvas.height - 40)
      ctx.stroke()

      if (!typedName.trim()) {
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = "italic 15px sans-serif"
        ctx.fillText('Sua assinatura aparecerá aqui...', canvas.width / 2, canvas.height / 2 - 10)
        return
      }

      ctx.fillStyle = '#0f172a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let fontSize = 42
      if (typedName.length > 15) fontSize = 34
      if (typedName.length > 25) fontSize = 24
      
      ctx.font = `${fontSize}px '${selectedFont}', cursive`
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2 - 15)
    }
  }, [typedName, selectedFont, sigType])

  // Canvas Drawing Logic with Coordinate Scaling mapping for perfect mobile signatures
  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    
    let clientX = 0
    let clientY = 0

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      return null
    }

    // Map coordinates scaling appropriately to the internal coordinate space
    const x = clientX - rect.left
    const y = clientY - rect.top
    return {
      x: x * (canvas.width / rect.width),
      y: y * (canvas.height / rect.height)
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (sigType === 'type') return
    if (e.cancelable) e.preventDefault()
    
    const coords = getCoordinates(e.nativeEvent)
    if (!coords) return
    
    isDrawing.current = true
    lastX.current = coords.x
    lastY.current = coords.y
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (sigType === 'type') return
    if (!isDrawing.current) return
    if (e.cancelable) e.preventDefault()

    const coords = getCoordinates(e.nativeEvent)
    const canvas = canvasRef.current
    if (!coords || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#0f172a'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 3

    ctx.beginPath()
    ctx.moveTo(lastX.current, lastY.current)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()

    lastX.current = coords.x
    lastY.current = coords.y
    setHasDrawn(true)
  }

  const stopDrawing = () => {
    isDrawing.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    if (sigType === 'type') {
      setTypedName('')
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      setHasDrawn(false)
    }
  }

  const processImageFile = (file: File, callback: (base64: string) => void) => {
    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado precisa ser uma imagem.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        try {
          // Foto escolhida da galeria não passa por nenhuma captura
          // controlada — pode vir com vários MB direto do rolo de câmera do
          // aparelho. Redimensiona antes de mandar pro servidor.
          const base64 = await redimensionarImagemBase64(e.target.result, 1400, 0.85)
          callback(base64)
        } catch {
          toast.error('Erro ao processar a imagem selecionada. Tente novamente.')
        }
      }
    }
    reader.onerror = () => {
      toast.error('Erro ao ler a imagem. Tente novamente.')
    }
    reader.readAsDataURL(file)
  }

  const handleDocumentCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file, (base64) => {
        setDocumento(base64)
        toast.success('Documento digitalizado com sucesso!')
      })
    }
  }

  const handleSubmitSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (sigType === 'draw' && !hasDrawn) {
      toast.warning('Por favor, desenhe sua assinatura no quadro antes de continuar.')
      return
    }
    if (sigType === 'type' && !typedName.trim()) {
      toast.warning('Por favor, digite seu nome completo para assinar.')
      return
    }

    const signatureBase64 = canvas.toDataURL('image/png')
    
    setEnviando(true)
    setPasso(5)

    try {
      const response = await fetch(`/api/emprestimos/${id}/assinar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          selfie,
          documento,
          assinatura: signatureBase64,
          geolocation: geolocation || 'Não informada',
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.erro || 'Falha ao processar assinatura eletrônica.')
      }

      setResultadoUrl(data.url)
      toast.success('Contrato assinado digitalmente com sucesso!')
    } catch (err: any) {
      console.error('Erro de assinatura:', err)
      toast.error(err.message || 'Erro ao processar assinatura eletrônica no servidor.')
      setPasso(4)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-lg w-full mx-auto p-4 md:py-8 justify-center min-h-[90vh]">
      
      {/* Styles block for scan overlays and premium keyframes */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(180px); }
          100% { transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.3; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.3; }
        }
        .scanner-line {
          animation: scan 3s ease-in-out infinite;
        }
        .pulsing-ring {
          animation: pulse-ring 2s ease-in-out infinite;
        }
      `}</style>

      {/* Wizard Header Status Bar */}
      {passo >= 1 && passo < 5 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Passo {passo} de 4</span>
            <span className="text-indigo-400 font-extrabold">
              {passo === 1 && 'Dados do Contrato'}
              {passo === 2 && 'Captura do Documento'}
              {passo === 3 && 'Selfie Biométrica'}
              {passo === 4 && 'Assinatura Digital'}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-900/90 rounded-full overflow-hidden flex gap-0.5 border border-white/5">
            <div className={`h-full transition-all duration-300 ${passo >= 1 ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 2 ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 3 ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 4 ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-slate-800'} flex-1`} />
          </div>
        </div>
      )}

      {/* STEP 0: CONTRACT READING */}
      {passo === 0 && (() => {
        const primeiroVenc = parcelas[0]?.data_vencimento
          ? new Date(parcelas[0].data_vencimento + 'T12:00:00')
          : null
        const diaVenc = primeiroVenc ? primeiroVenc.getDate() : null
        const mesVenc = primeiroVenc
          ? primeiroVenc.toLocaleDateString('pt-BR', { month: 'long' })
          : null
        const anoVenc = primeiroVenc ? primeiroVenc.getFullYear() : null
        const taxaAnual = contrato.taxa_juros ? (contrato.taxa_juros * 12).toFixed(0) : '12'
        const multaAtraso = contrato.multa_atraso ?? 2
        const jurosMora = contrato.juros_mora_diario ?? 0.033
        const qualificacao = [
          cliente.nacionalidade,
          cliente.estado_civil,
          cliente.profissao,
          cliente.rg ? `RG nº ${cliente.rg}` : null,
          `CPF nº ${formatarCPF(cliente.cpf)}`,
          cliente.endereco,
        ].filter(Boolean).join(', ')

        return (
          <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-in-up">
            {/* Header fixo */}
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                  <ScrollText size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-100 leading-tight">Contrato de Empréstimo</h2>
                  <p className="text-[10px] text-slate-400 font-mono">{contrato.numero_contrato}</p>
                </div>
              </div>
              <p className="text-[11px] text-amber-400/80 font-semibold mt-2 bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2">
                ⚠ Leia o contrato abaixo com atenção antes de prosseguir com a assinatura eletrônica.
              </p>
            </div>

            {/* Texto do contrato — scrollável */}
            <div
              ref={contratoScrollRef}
              onScroll={(e) => {
                const el = e.currentTarget
                const chegouFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 32
                if (chegouFim) setContratoLido(true)
              }}
              className="h-[52vh] overflow-y-auto px-5 py-4 space-y-4 text-[12px] text-slate-300 leading-[1.8]"
            >

              <div className="text-center space-y-1 pb-3 border-b border-white/5">
                <p className="font-extrabold text-[13px] text-slate-100 uppercase tracking-wide leading-tight">
                  CONTRATO PARTICULAR DE EMPRÉSTIMO DE DINHEIRO
                </p>
                <div className="flex items-center justify-center gap-2 text-[10px] text-indigo-400 font-bold">
                  <Building2 size={11} />
                  SRS M FACTORING LTDA — CNPJ 64.479.167/0001-60
                </div>
              </div>

              <p>
                Pelo presente contrato particular de empréstimo de dinheiro, de um lado,{' '}
                <span className="font-bold text-slate-100">SRS M FACTORING LTDA.</span>, CNPJ: 64.479.167/0001-60,
                de ora em diante denominado
                simplesmente por <span className="font-bold text-slate-100">CREDOR</span>, e, de outro lado,{' '}
                <span className="font-bold text-indigo-300">{cliente.nome}</span>
                {qualificacao ? `, ${qualificacao}` : ''},
                de ora em diante denominado simplesmente <span className="font-bold text-slate-100">DEVEDOR</span>,
                têm justo e contratado o seguinte:
              </p>

              <p className="text-slate-400 text-[11px]">
                A mutuária necessita de um aporte de recursos financeiros. A mutuante acredita no potencial econômico
                da mutuária e deseja fazer um aporte de recursos a fim de contribuir para o seu desenvolvimento.
                As partes desejam formalizar tal aporte por meio de um contrato, com as seguintes cláusulas:
              </p>

              <div className="space-y-4">
                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 1ª</p>
                  <p>
                    O presente instrumento tem como objetivo a sujeição das partes aos termos e condições na melhor
                    forma de direito, oportunidade em que o credor se compromete a conceder ao devedor um empréstimo
                    no valor de{' '}
                    <span className="font-extrabold text-emerald-400">{formatarMoeda(contrato.valor_principal)}</span>;
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 2ª</p>
                  <p>O empréstimo não poderá ser liquidado antecipadamente sem o consentimento do credor;</p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 3ª</p>
                  <p>
                    Cada parte arcará com todos os tributos de qualquer natureza porventura incidentes sobre o
                    empréstimo, na medida em que sejam consideradas como contribuintes ou responsável pelo
                    respectivo recolhimento;
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 4ª</p>
                  <p>
                    O CREDOR dá como empréstimo ao DEVEDOR, mediante Nota Promissória, a quantia de{' '}
                    <span className="font-extrabold text-emerald-400">{formatarMoeda(contrato.valor_principal)}</span>,
                    mediante as condições seguintes.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 5ª</p>
                  <p>
                    A quantia acima emprestada vencerá juros de{' '}
                    <span className="font-bold text-indigo-300">{taxaAnual}% ao ano</span> ({contrato.taxa_juros}% a.m.
                    — Tabela Price), devendo ser restituída ao CREDOR no dia{' '}
                    <span className="font-bold text-indigo-300">{diaVenc ?? '__'}</span>, do mês de{' '}
                    <span className="font-bold text-indigo-300">{mesVenc ?? '__'}</span>, de{' '}
                    <span className="font-bold text-indigo-300">{anoVenc ?? '__'}</span>, acrescida dos juros e
                    correção monetária, combinado antecipadamente de{' '}
                    <span className="font-bold text-indigo-300">{contrato.taxa_juros}%</span>, mais o custo de
                    contrato no valor de{' '}
                    <span className="font-bold text-indigo-300">R$ 5.000,00 (Cinco mil reais)</span>, no domicílio
                    do CREDOR ou em local por ele indicado.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 6ª</p>
                  <p>
                    Na falta do pagamento do empréstimo na data aprazada, o DEVEDOR pagará uma multa no percentual
                    de <span className="font-bold text-red-400">{multaAtraso}%</span> mais juro moratório sobre o
                    débito no percentual de{' '}
                    <span className="font-bold text-red-400">{jurosMora}% por dia</span>, acrescido de correção
                    monetária sobre o montante apurado, ficando o CREDOR com direito de ajuizar a nota promissória,
                    conforme determinação das normas legais.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 7ª</p>
                  <p>
                    Todos os encargos que venham a recair durante o período do contrato, continuarão de
                    responsabilidade do DEVEDOR, devendo ser acrescidos na dívida.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 8ª</p>
                  <p>
                    Este instrumento constitui acordo integral entre as partes, não podendo ser alterado ou de
                    outra forma modificado, salvo mediante escrito devidamente assinado pelas partes, sendo que
                    esse instrumento obriga as partes, seus herdeiros, representantes legais e sucessores a
                    qualquer título;
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 9ª</p>
                  <p>
                    Todas as notificações e comunicações decorrentes deste instrumento serão realizadas entre as
                    partes por escrito, através de aviso de recebimento, para os endereços dos preâmbulos deste
                    instrumento e endereços eletrônicos;
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 10ª</p>
                  <p>
                    A devedora reconhece e aceita que este instrumento constitui título executivo extrajudicial,
                    nos termos do artigo 784, III, do Código de Processo Civil Brasileiro, ficando assim facultado
                    ao Credor, a seu exclusivo critério, executar judicialmente o devedor por quaisquer importâncias
                    devidas nos termos deste instrumento, tendo em vista que esse será regido e interpretado de
                    acordo com as leis da República Federativa do Brasil;
                  </p>
                </div>

                <div>
                  <p className="font-bold text-slate-100 text-[11px] uppercase tracking-wide mb-1">CLÁUSULA 11ª</p>
                  <p>
                    Fica eleito o foro desta cidade de <span className="font-bold text-slate-100">Goiânia/GO</span>,
                    para dirimir qualquer dúvida referente a este contrato.
                  </p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 text-[10px] text-slate-500 text-center space-y-1 pb-2">
                <p>
                  E assim, por estarem plenamente contratados na forma acima, assinam o presente contrato na
                  presença de testemunhas que a tudo assistiram e em duas vias de igual teor.
                </p>
                <p className="font-semibold text-slate-400 mt-2">
                  Goiânia/GO, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <User size={12} className="text-indigo-400" />
                  <span className="font-bold text-indigo-300">{cliente.nome}</span>
                </div>
              </div>
            </div>

            {/* Rodapé fixo com resumo financeiro + CTA */}
            <div className="px-5 pb-6 pt-4 border-t border-white/5 space-y-3">
              {/* Resumo dos dados críticos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/80 rounded-xl px-3 py-2.5 border border-white/5">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Valor do Empréstimo</p>
                  <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatarMoeda(contrato.valor_principal)}</p>
                </div>
                <div className="bg-slate-900/80 rounded-xl px-3 py-2.5 border border-white/5">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Parcelas</p>
                  <p className="text-sm font-extrabold text-slate-100 mt-0.5">{contrato.prazo_meses}x {formatarMoeda(contrato.valor_parcela)}</p>
                </div>
              </div>

              {/* Indicador de progresso de leitura */}
              {!contratoLido && (
                <button
                  type="button"
                  onClick={() => {
                    const el = contratoScrollRef.current
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl cursor-pointer hover:bg-amber-500/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                  Role até o fim para liberar a assinatura
                </button>
              )}

              <Button
                className="w-full rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-lg shadow-indigo-950/50 gap-2 text-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:shadow-none"
                style={{ height: '52px' }}
                disabled={!contratoLido}
                onClick={() => setPasso(1)}
              >
                <CheckCircle2 size={17} />
                <span>{contratoLido ? 'Li o Contrato — Prosseguir para Assinatura' : 'Leia o contrato completo para continuar'}</span>
              </Button>
            </div>
          </div>
        )
      })()}

      {/* STEP 1: CONTRACT DETAILS */}
      {passo === 1 && (
        <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/20">
              <FileText size={28} />
            </div>
            <h2 className="text-xl font-black tracking-tight mt-3 text-slate-100">Assinatura do Contrato</h2>
            <p className="text-xs text-slate-400">Revise com atenção as condições do seu empréstimo.</p>
          </div>

          <div className="bg-slate-900/60 rounded-2xl border border-white/5 p-4 space-y-3.5">
            <div className="border-b border-white/5 pb-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400">Nº do Contrato</span>
              <span className="font-mono font-bold text-indigo-400 text-sm tracking-wider">{contrato.numero_contrato}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 mb-0.5">Valor do Mútuo</p>
                <p className="font-extrabold text-base text-slate-100">{formatarMoeda(contrato.valor_principal)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Valor da Parcela</p>
                <p className="font-extrabold text-base text-slate-100">{formatarMoeda(contrato.valor_parcela)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Parcelamento</p>
                <p className="font-bold text-slate-200">{contrato.prazo_meses} Parcelas Mensais</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Taxa Pactuada</p>
                <p className="font-bold text-slate-200">{contrato.taxa_juros}% a.m. (Tabela Price)</p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3.5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Beneficiário / Tomador:</span>
                <span className="font-bold text-slate-100 text-right truncate max-w-[200px]">{cliente.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inscrição CPF:</span>
                <span className="font-bold font-mono text-slate-100">{formatarCPF(cliente.cpf)}</span>
              </div>
              {contrato.garantias && (
                <div className="flex flex-col gap-0.5 pt-2 border-t border-white/5">
                  <span className="text-slate-400">Garantia Prestada:</span>
                  <span className="font-semibold text-indigo-300 italic">{contrato.garantias}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-amber-300/95">
            <ShieldCheck size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5 text-amber-400">Autenticidade e Evidência Digital</p>
              <p className="text-[11px] text-slate-400">
                Este processo coletará coordenadas de geolocalização e fotos comprobatórias para fins de registro e validade legal (Medida Provisória nº 2.200-2/2001).
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={termosAceitos}
                onChange={(e) => setTermosAceitos(e.target.checked)}
                className="mt-1 w-4.5 h-4.5 text-indigo-600 bg-slate-900 border-white/10 rounded focus:ring-indigo-500 focus:ring-offset-slate-955 transition-colors cursor-pointer"
              />
              <span className="text-xs text-slate-450 leading-relaxed font-semibold group-hover:text-slate-300 transition-colors">
                Confirmo que revisei todos os valores e aceito integralmente os termos deste instrumento eletrônico de mútuo financeiro.
              </span>
            </label>

            <Button
              className="w-full h-12 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-950/50 disabled:opacity-40 transition-all duration-150 gap-2 cursor-pointer"
              disabled={!termosAceitos}
              onClick={() => setPasso(2)}
            >
              <span>Ir para Captura de Documento</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: DOCUMENT CAPTURE */}
      {passo === 2 && (
        <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/20">
              <Camera size={28} />
            </div>
            <h2 className="text-xl font-black tracking-tight mt-3 text-slate-100">Foto do Documento</h2>
            <p className="text-xs text-slate-400">Fotografe seu RG ou CNH aberto. Use câmera traseira para melhor qualidade.</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            {documento ? (
              <div className="relative w-full rounded-2xl border border-emerald-500/30 overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center shadow-inner">
                <img src={documento} alt="Documento" className="max-h-full max-w-full object-contain" />
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500/90 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                  <CheckCircle2 size={10} /> Documento Registrado
                </div>
                <button
                  onClick={() => { setDocumento(null); pararCameraDocumento() }}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : docCameraAtiva ? (
              /* Live doc camera */
              <div className="relative w-full rounded-2xl border border-white/10 overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center shadow-inner">
                <video ref={docVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                {/* Document frame guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[85%] h-[60%] border-2 border-indigo-400/80 rounded-xl relative">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-300 rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-300 rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-300 rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-300 rounded-br" />
                    <div className="absolute inset-0 rounded-xl overflow-hidden">
                      <div className="absolute left-0 right-0 h-0.5 bg-indigo-500/50 shadow-[0_0_8px_2px_rgba(99,102,241,0.5)] scanner-line" />
                    </div>
                  </div>
                </div>

                <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
                  <span className="px-3 py-1 bg-slate-950/85 border border-white/5 text-[9px] font-bold tracking-wider uppercase text-slate-300 rounded-full">
                    Posicione o documento dentro do visor
                  </span>
                </div>

                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
                  <button
                    type="button"
                    onClick={pararCameraDocumento}
                    className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow border border-white/10 transition-all active:scale-90 cursor-pointer"
                    title="Cancelar"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={capturarFotoDocumento}
                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-950 transition-all active:scale-90 duration-75 cursor-pointer"
                    title="Fotografar Documento"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              </div>
            ) : docCarregandoCamera ? (
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900 aspect-[4/3] flex flex-col items-center justify-center gap-3">
                <Loader2 size={36} className="animate-spin text-indigo-500" />
                <p className="text-xs font-bold text-slate-400">Ativando câmera...</p>
              </div>
            ) : (
              /* Options: camera or upload */
              <div className="w-full space-y-3">
                {docPermissaoNegada && (
                  <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 flex gap-2 text-xs text-red-400">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>Acesso à câmera bloqueado. Autorize nas configurações do navegador ou use o upload abaixo.</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={iniciarCameraDocumento}
                  className="w-full rounded-2xl border-2 border-indigo-500/40 hover:border-indigo-500/80 bg-indigo-500/5 hover:bg-indigo-500/10 p-5 flex items-center gap-4 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                    <Camera size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-200">Fotografar com Câmera</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Use a câmera traseira para melhor nitidez. Recomendado.</p>
                  </div>
                </button>

                <label className="w-full rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/60 p-5 flex items-center gap-4 cursor-pointer transition-all group">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                    <Upload size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-300">Enviar da Galeria / Arquivo</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Selecione uma foto já tirada do seu RG ou CNH.</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleDocumentCapture} className="hidden" />
                </label>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-400">
            <AlertTriangle size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-200 mb-0.5">Dicas para melhor leitura</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>Documento aberto, frente e verso visíveis (CNH aberta ou RG frente).</li>
                <li>Boa iluminação, sem reflexos ou sombras sobre o documento.</li>
                <li>Remova o plástico protetor para evitar reflexo.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-full font-bold border-white/10 hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
              onClick={() => { pararCameraDocumento(); setPasso(1) }}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 h-12 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 shadow-lg shadow-indigo-950/50 transition-all gap-1.5 cursor-pointer"
              disabled={!documento}
              onClick={() => { pararCameraDocumento(); setPasso(3) }}
            >
              <span>Avançar</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: SELFIE CAPTURE */}
      {passo === 3 && (
        <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/20">
              <UserCheck size={28} />
            </div>
            <h2 className="text-xl font-black tracking-tight mt-3 text-slate-100">Selfie de Reconhecimento</h2>
            <p className="text-xs text-slate-400">Enquadre seu rosto no marcador oval e capture a imagem.</p>
          </div>

          <div className="flex flex-col items-center justify-center w-full">
            {selfie ? (
              <div className="relative w-full rounded-2xl border border-white/10 overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center shadow-inner">
                <img 
                  src={selfie} 
                  alt="Selfie Biométrica" 
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  onClick={() => setSelfie(null)}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-red-655 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : permissaoNegada ? (
              <div className="w-full rounded-2xl border border-red-500/15 bg-red-500/5 aspect-[4/3] flex flex-col items-center justify-center gap-4 p-6 text-center">
                <AlertTriangle size={36} className="text-red-500 animate-bounce" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-red-400">Acesso à câmera bloqueado</p>
                  <p className="text-[10px] text-slate-400 max-w-[240px] mx-auto leading-normal">
                    Precisamos de acesso temporário à câmera para registrar a biometria. Favor autorizar o acesso em seu navegador.
                  </p>
                </div>
                <Button
                  onClick={iniciarCamera}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-5 rounded-full text-xs shadow-md"
                >
                  Permitir Câmera e Reiniciar
                </Button>
              </div>
            ) : carregandoCamera ? (
              <div className="w-full rounded-2xl border border-white/10 bg-slate-900 aspect-[4/3] flex flex-col items-center justify-center gap-3 p-4 text-center">
                <Loader2 size={36} className="animate-spin text-indigo-500" />
                <p className="text-xs font-bold text-slate-400">Ativando câmera biométrica...</p>
              </div>
            ) : (
              <div className="relative w-full rounded-2xl border border-white/10 overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center shadow-inner group">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Oval shape scanner guide */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none flex items-center justify-center overflow-hidden">
                  {/* Glowing pulsing scan ring */}
                  <div className="w-[180px] h-[230px] border-2 border-indigo-500/80 rounded-full bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] relative flex items-center justify-center">
                    <div className="absolute -inset-1 border border-indigo-400/30 rounded-full pulsing-ring" />
                  </div>
                </div>

                {/* Laser scan line overlay */}
                <div className="absolute left-0 right-0 h-0.5 bg-indigo-500/30 shadow-[0_0_8px_1.5px_rgba(99,102,241,0.5)] scanner-line pointer-events-none" />

                <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-10">
                  <span className="px-3 py-1 bg-slate-950/85 border border-white/5 text-[9px] font-bold tracking-wider uppercase text-slate-350 rounded-full shadow-lg">
                    Posicione o rosto no centro do oval
                  </span>
                </div>

                {/* Capturing shutter button */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    onClick={capturarFoto}
                    className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-950 transition-all active:scale-90 duration-75 cursor-pointer"
                    title="Tirar Foto"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-full font-bold border-white/10 hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
              onClick={() => {
                pararCamera()
                setPasso(2)
              }}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 h-12 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 shadow-lg shadow-indigo-950/50 transition-all gap-1.5 cursor-pointer"
              disabled={!selfie}
              onClick={() => {
                pararCamera()
                setPasso(4)
              }}
            >
              <span>Avançar</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: DIGITAL SIGNATURE */}
      {passo === 4 && (
        <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/20">
              <Award size={28} />
            </div>
            <h2 className="text-xl font-black tracking-tight mt-3 text-slate-100">Assinatura Digital</h2>
            <p className="text-xs text-slate-400">Desenhe sua rubrica na tela ou digite seu nome.</p>
          </div>

          {/* Tab Selector between Draw and Type */}
          <div className="flex bg-slate-900/80 p-1 rounded-full border border-white/5 gap-1">
            <button
              type="button"
              onClick={() => {
                setSigType('draw')
                clearCanvas()
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                sigType === 'draw' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Desenhar Rubrica
            </button>
            <button
              type="button"
              onClick={() => {
                setSigType('type')
                clearCanvas()
              }}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                sigType === 'type' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Escrever / Digitar
            </button>
          </div>

          {/* Typed Signature Input & Styles */}
          {sigType === 'type' && (
            <div className="w-full space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Nome do Signatário</label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Nome completo para assinatura..."
                  className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-white/5 focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20 text-slate-100 text-sm font-semibold placeholder:text-slate-655 focus:outline-none transition-colors"
                />
              </div>
              
              {/* Font Options Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Caligrafia Sugerida</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Great Vibes', 'Dancing Script', 'Alex Brush'] as const).map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => setSelectedFont(font)}
                      className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        selectedFont === font
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-500 hover:text-slate-355'
                      }`}
                      style={{ fontFamily: font }}
                    >
                      {font === 'Great Vibes' ? 'Formal' : font === 'Dancing Script' ? 'Moderna' : 'Artística'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-full relative border border-white/10 rounded-2xl overflow-hidden bg-white shadow-2xl">
              <canvas
                ref={canvasRef}
                width={400}
                height={180}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full block touch-none cursor-crosshair bg-white"
              />
              {sigType === 'draw' && (
                <button
                  onClick={clearCanvas}
                  className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 bg-slate-950/90 hover:bg-slate-900 border border-white/5 hover:text-indigo-400 text-slate-350 rounded-full transition-colors active:scale-95 shadow-md cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 font-semibold italic text-center w-full leading-normal">
              Esta assinatura será vinculada e impressa no termo com integridade criptográfica.
            </p>
          </div>

          {/* Geolocation — obrigatória para assinar */}
          <div className={`rounded-2xl p-4 space-y-3 border transition-all duration-300 ${
            geolocationStatus === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/20'
              : 'bg-red-950/30 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.08)]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <MapPin size={14} className={geolocationStatus === 'success' ? 'text-emerald-400' : 'text-red-400'} />
                <span>Localização GPS — Obrigatória</span>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                geolocationStatus === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                geolocationStatus === 'requesting' ? 'bg-indigo-500/15 text-indigo-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                {geolocationStatus === 'success' && '✓ Capturada'}
                {geolocationStatus === 'requesting' && 'Buscando GPS...'}
                {geolocationStatus === 'idle' && '⚠ Necessária'}
                {geolocationStatus === 'error' && '✕ Bloqueada'}
              </span>
            </div>

            {geolocationStatus === 'success' ? (
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold text-emerald-500/70 uppercase tracking-wide">Coordenadas registradas no contrato:</p>
                <p className="text-slate-200 bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/15 select-all font-mono text-[10px] break-all leading-relaxed">
                  📍 {geolocation}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 bg-slate-950/45 p-3 rounded-xl border border-red-500/10">
                <p className="text-[10px] text-red-300/80 font-normal leading-relaxed">
                  ⚠️ <strong>Localização obrigatória.</strong> A geolocalização é exigida para garantir autenticidade jurídica do contrato. Sem ela, não é possível assinar.
                </p>
                <Button
                  type="button"
                  onClick={() => obterLocalizacao(false)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 rounded-lg gap-1.5 self-start cursor-pointer"
                  disabled={geolocationStatus === 'requesting'}
                >
                  {geolocationStatus === 'requesting' ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <MapPin size={13} />
                  )}
                  <span>{geolocationStatus === 'requesting' ? 'Buscando GPS...' : 'Autorizar Localização GPS'}</span>
                </Button>
              </div>
            )}

            <p className="text-[9px] text-slate-500 leading-normal font-normal">
              Conforme ICP-Brasil e MP 2.200-2, vinculamos coordenadas geográficas, IP e navegador para segurança jurídica mútua. Dado impresso no contrato.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-full font-bold border-white/10 hover:bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
              onClick={() => setPasso(3)}
            >
              Voltar
            </Button>
            <div ref={signButtonRef} className="flex-1">
              <Button
                className="w-full h-12 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 shadow-lg shadow-emerald-950/50 transition-all gap-1.5 cursor-pointer"
                disabled={geolocationStatus !== 'success'}
                onClick={handleSubmitSignature}
              >
                <CheckCircle2 size={16} />
                <span>Confirmar & Assinar</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: LOADING / SUCCESS PAGE */}
      {passo === 5 && (
        <div className="bg-slate-950/75 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_50px_rgba(99,102,241,0.15)] relative overflow-hidden animate-fade-in-up">
          {enviando ? (
            <div className="py-8 space-y-6">
              <div className="w-16 h-16 rounded-full border border-indigo-500/10 flex items-center justify-center mx-auto text-indigo-500 relative">
                <Loader2 size={32} className="animate-spin relative z-10" />
                <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-60" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-100">Registrando Mútuo...</h2>
                <p className="text-xs text-slate-450 mt-2 max-w-xs mx-auto leading-relaxed font-semibold">
                  Estamos salvando com segurança as comprovações biométricas e compilando o seu contrato digital assinado. Por favor, aguarde.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-6 space-y-6 animate-scale-up">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 shadow-[0_1px_10px_#10b981]" />
              
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 relative border border-emerald-500/20 shadow-lg">
                <CheckCircle2 size={44} className="relative z-10" />
                <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping opacity-40" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-100 tracking-tight">Mútuo Assinado com Sucesso!</h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  A assinatura do contrato **{contrato.numero_contrato}** foi finalizada. O arquivo PDF já está resguardado no sistema.
                </p>
              </div>

              <div className="bg-slate-900/70 rounded-2xl border border-white/5 p-4.5 text-left text-[11px] font-semibold text-slate-400 space-y-2 max-w-xs mx-auto">
                <p className="text-center font-bold text-slate-300 uppercase tracking-wider text-[9px] mb-1.5">Metadados da Evidência</p>
                <div className="flex justify-between">
                  <span>Signatário:</span>
                  <span className="text-slate-200">{cliente.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data e Hora:</span>
                  <span className="text-slate-200 font-mono">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-extrabold">Autenticidade Verificada</span>
                </div>
              </div>

              {resultadoUrl && (
                <div className="pt-2 max-w-xs mx-auto">
                  <a href={resultadoUrl} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center justify-center w-full h-12 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/40 transition-all text-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                    Visualizar Contrato Assinado
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
