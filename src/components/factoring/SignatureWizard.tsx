'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  FileText, ShieldCheck, Camera, Upload, Trash2, CheckCircle2, 
  Loader2, Smartphone, MapPin, Award, ArrowRight, UserCheck, AlertTriangle 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatarMoeda, formatarCPF, formatarData } from '@/lib/utils/formatters'

interface SignatureWizardProps {
  id: string
  contrato: any
  cliente: any
  parcelas: any[]
}

export default function SignatureWizard({ id, contrato, cliente, parcelas }: SignatureWizardProps) {
  const [passo, setPasso] = useState(1)
  const [termosAceitos, setTermosAceitos] = useState(false)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [documento, setDocumento] = useState<string | null>(null)
  const [geolocation, setGeolocation] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [resultadoUrl, setResultadoUrl] = useState<string | null>(null)

  // Live Camera states
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [carregandoCamera, setCarregandoCamera] = useState(false)
  const [permissaoNegada, setPermissaoNegada] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Calligraphy signature states
  const [sigType, setSigType] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState<'Great Vibes' | 'Dancing Script' | 'Alex Brush'>('Great Vibes')
  const [hasDrawn, setHasDrawn] = useState(false)

  // Refs for drawing canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)

  // Capture user geolocation on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeolocation(`Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)} (precisão: ${pos.coords.accuracy.toFixed(0)}m)`)
        },
        () => {
          setGeolocation('Permissão de geolocalização negada')
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

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
      
      // Allow DOM rendering of video element
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

  const capturarFoto = () => {
    const video = videoRef.current
    if (!video) return
    
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Mirror the image horizontally to match what the user sees in the selfie mirror view
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        
        const base64 = canvas.toDataURL('image/jpeg', 0.85)
        setSelfie(base64)
        pararCamera()
        toast.success('Selfie de biometria capturada com sucesso!')
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

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw background placeholder
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw thin grey signature guideline at bottom
      ctx.strokeStyle = '#e2e8f0' // slate-200
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(30, canvas.height - 40)
      ctx.lineTo(canvas.width - 30, canvas.height - 40)
      ctx.stroke()

      if (!typedName.trim()) {
        // Draw placeholder text if empty
        ctx.fillStyle = '#cbd5e1' // slate-300
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = "italic 16px sans-serif"
        ctx.fillText('A assinatura aparecerá aqui...', canvas.width / 2, canvas.height / 2 - 10)
        return
      }

      // Draw calligraphic text
      ctx.fillStyle = '#0f172a' // slate-900 (ink color)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let fontSize = 42
      if (typedName.length > 15) fontSize = 34
      if (typedName.length > 25) fontSize = 24
      
      ctx.font = `${fontSize}px '${selectedFont}', cursive`
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2 - 15)
    }
  }, [typedName, selectedFont, sigType])

  // Canvas Drawing Logic
  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    
    // Check if touch event
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (sigType === 'type') return // Disable drawing when typing
    // Prevent touch scrolling on mobile
    if (e.cancelable) e.preventDefault()
    
    const coords = getCoordinates(e.nativeEvent)
    if (!coords) return
    
    isDrawing.current = true
    lastX.current = coords.x
    lastY.current = coords.y
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (sigType === 'type') return // Disable drawing when typing
    if (!isDrawing.current) return
    if (e.cancelable) e.preventDefault()

    const coords = getCoordinates(e.nativeEvent)
    const canvas = canvasRef.current
    if (!coords || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#000000'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.5

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

  // Camera file capture handlers
  const processImageFile = (file: File, callback: (base64: string) => void) => {
    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado precisa ser uma imagem.')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        callback(e.target.result)
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
        toast.success('Foto do documento anexada com sucesso!')
      })
    }
  }


  // Submit Signature
  const handleSubmitSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Verify if signature is provided
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
          selfie,
          documento,
          assinatura: signatureBase64,
          geolocation,
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
      setPasso(4) // Fallback to drawing if failed
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-lg w-full mx-auto p-4 md:py-8 justify-center">
      
      {/* Wizard Header Status Bar */}
      {passo < 5 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Passo {passo} de 4</span>
            <span>
              {passo === 1 && 'Dados do Contrato'}
              {passo === 2 && 'Comprovação Documento'}
              {passo === 3 && 'Selfie de Segurança'}
              {passo === 4 && 'Assinatura Digital'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex gap-0.5">
            <div className={`h-full transition-all duration-300 ${passo >= 1 ? 'bg-indigo-500' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 2 ? 'bg-indigo-500' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 3 ? 'bg-indigo-500' : 'bg-slate-800'} flex-1`} />
            <div className={`h-full transition-all duration-300 ${passo >= 4 ? 'bg-indigo-500' : 'bg-slate-800'} flex-1`} />
          </div>
        </div>
      )}

      {/* STEP 1: CONTRACT DETAILS */}
      {passo === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <FileText size={24} />
            </div>
            <h2 className="text-lg font-black tracking-tight mt-3 text-slate-100">Assinatura Eletrônica</h2>
            <p className="text-xs text-slate-400">Revise com atenção as condições do seu contrato de empréstimo.</p>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3.5">
            <div className="border-b border-slate-900 pb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400">Identificação</span>
              <span className="font-mono font-bold text-indigo-400">{contrato.numero_contrato}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 mb-0.5">Valor Financiado</p>
                <p className="font-extrabold text-sm text-slate-200">{formatarMoeda(contrato.valor_principal)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Valor da Parcela</p>
                <p className="font-extrabold text-sm text-slate-200">{formatarMoeda(contrato.valor_parcela)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Parcelamento</p>
                <p className="font-bold text-slate-200">{contrato.prazo_meses}x parcelas fixas</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Taxa de Juros</p>
                <p className="font-bold text-slate-200">{contrato.taxa_juros}% a.m.</p>
              </div>
            </div>

            <div className="border-t border-slate-900 pt-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Nome do Tomador:</span>
                <span className="font-bold text-slate-200 text-right truncate max-w-[180px]">{cliente.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CPF do Tomador:</span>
                <span className="font-bold font-mono text-slate-200">{formatarCPF(cliente.cpf)}</span>
              </div>
              {contrato.garantias && (
                <div className="flex flex-col gap-0.5 pt-1.5 border-t border-slate-900/60">
                  <span className="text-slate-400">Garantias Vinculadas:</span>
                  <span className="font-semibold text-slate-300 italic">{contrato.garantias}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-amber-300/90">
            <ShieldCheck size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Autenticação por Biometria Facial</p>
              <p className="text-[11px] text-slate-400">
                Para prosseguir com a assinatura válida, você precisará capturar a foto do seu documento de identidade e uma selfie do seu rosto para resguardo operacional.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termosAceitos}
                onChange={(e) => setTermosAceitos(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span className="text-xs text-slate-400 leading-relaxed font-semibold">
                Li, compreendo perfeitamente e estou de acordo com as condições estipuladas do empréstimo e termos deste documento.
              </span>
            </label>

            <Button
              className="w-full h-11 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-950/50 disabled:opacity-50 transition-all duration-150 gap-2"
              disabled={!termosAceitos}
              onClick={() => setPasso(2)}
            >
              <span>Prosseguir para Comprovação</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: DOCUMENT CAPTURE */}
      {passo === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <Upload size={24} />
            </div>
            <h2 className="text-lg font-black tracking-tight mt-3 text-slate-100">Foto do Documento</h2>
            <p className="text-xs text-slate-400">Anexe ou tire uma foto legível da frente/verso do seu documento de identidade (RG ou CNH).</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            {documento ? (
              <div className="relative w-full rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-inner">
                <img 
                  src={documento} 
                  alt="Pré-visualização do Documento" 
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  onClick={() => setDocumento(null)}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label className="w-full rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950 aspect-[4/3] flex flex-col items-center justify-center gap-3 cursor-pointer transition-all p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors shadow-sm">
                  <Camera size={26} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">Tirar Foto do Documento</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">
                    Use a câmera traseira em local bem iluminado ou selecione um arquivo.
                  </p>
                </div>
                {/* Mobile capture support environment = rear camera */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleDocumentCapture}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800/40 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-400">
            <AlertTriangle size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-300 mb-0.5">Dicas de Captura</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Remova o documento do plástico de proteção.</li>
                <li>Evite reflexos diretos de lâmpadas ou flash.</li>
                <li>Certifique-se de que os dados e fotos estejam totalmente nítidos.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-full font-bold border-slate-800 hover:bg-slate-850 text-slate-400"
              onClick={() => setPasso(1)}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 h-11 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 shadow-lg shadow-indigo-950/50 transition-all gap-1"
              disabled={!documento}
              onClick={() => setPasso(3)}
            >
              <span>Avançar</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: SELFIE CAPTURE */}
      {passo === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <UserCheck size={24} />
            </div>
            <h2 className="text-lg font-black tracking-tight mt-3 text-slate-100">Selfie de Segurança</h2>
            <p className="text-xs text-slate-400">Enquadre seu rosto perfeitamente e tire uma foto de frente para validação biométrica facial.</p>
          </div>

          <div className="flex flex-col items-center justify-center w-full">
            {selfie ? (
              <div className="relative w-full rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-inner">
                <img 
                  src={selfie} 
                  alt="Pré-visualização da Selfie" 
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  onClick={() => setSelfie(null)}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : permissaoNegada ? (
              <div className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 aspect-[4/3] flex flex-col items-center justify-center gap-4 p-6 text-center">
                <AlertTriangle size={36} className="text-red-500 animate-bounce" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-red-400">Acesso à câmera bloqueado</p>
                  <p className="text-[10px] text-slate-400 max-w-[240px] mx-auto leading-normal">
                    Para garantir a legitimidade e segurança deste contrato, a selfie deve ser capturada em tempo real. Favor autorizar a câmera em seu navegador.
                  </p>
                </div>
                <Button
                  onClick={iniciarCamera}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-4 rounded-full text-xs shadow-md"
                >
                  Permitir Câmera e Tentar Novamente
                </Button>
              </div>
            ) : carregandoCamera ? (
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-950 aspect-[4/3] flex flex-col items-center justify-center gap-3 p-4 text-center">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
                <p className="text-xs font-bold text-slate-400">Iniciando câmera de segurança...</p>
              </div>
            ) : (
              <div className="relative w-full rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-inner">
                {/* Elemento de Vídeo com espelhamento horizontal para parecer espelho */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Máscara de foco oval profissional para o rosto */}
                <div className="absolute inset-0 border-[3px] border-dashed border-indigo-500/20 rounded-2xl pointer-events-none flex items-center justify-center overflow-hidden">
                  <div className="w-[170px] h-[220px] border-2 border-indigo-400/80 rounded-full bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]" />
                </div>

                {/* Guia de enquadramento translúcido em texto */}
                <div className="absolute top-3 left-0 right-0 text-center pointer-events-none z-10">
                  <span className="px-3 py-1 bg-slate-950/80 border border-slate-800 text-[10px] font-bold tracking-wider uppercase text-slate-300 rounded-full">
                    Enquadre seu rosto no centro
                  </span>
                </div>

                {/* Botão circular vermelho estilo obturador para disparar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    onClick={capturarFoto}
                    className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white transition-all active:scale-90 duration-75"
                    title="Tirar Selfie"
                  >
                    <div className="w-4.5 h-4.5 bg-white rounded-full animate-pulse" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800/40 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-400">
            <AlertTriangle size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-300 mb-0.5">Aviso Importante</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Evite usar óculos escuros, bonés ou chapéu.</li>
                <li>Mantenha uma expressão facial neutra e natural.</li>
                <li>Fique em um local com iluminação frontal adequada.</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-full font-bold border-slate-800 hover:bg-slate-850 text-slate-400"
              onClick={() => setPasso(2)}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 h-11 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 shadow-lg shadow-indigo-950/50 transition-all gap-1"
              disabled={!selfie}
              onClick={() => setPasso(4)}
            >
              <span>Avançar</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: DRAW OR TYPE DIGITAL SIGNATURE */}
      {passo === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-fade-in-up">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <Award size={24} />
            </div>
            <h2 className="text-lg font-black tracking-tight mt-3 text-slate-100">Assinatura Eletrônica</h2>
            <p className="text-xs text-slate-400">Escolha desenhar sua assinatura ou simplesmente digite seu nome completo.</p>
          </div>

          {/* Tab Selector between Draw and Type */}
          <div className="flex bg-slate-950 p-1.5 rounded-full border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => {
                setSigType('draw')
                clearCanvas()
              }}
              className={`flex-1 py-2 px-3 rounded-full text-[11px] font-black tracking-tight uppercase transition-all ${
                sigType === 'draw' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Desenhar
            </button>
            <button
              type="button"
              onClick={() => {
                setSigType('type')
                clearCanvas()
              }}
              className={`flex-1 py-2 px-3 rounded-full text-[11px] font-black tracking-tight uppercase transition-all ${
                sigType === 'type' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Escrever / Digitar
            </button>
          </div>

          {/* Typed Signature Input & Styles */}
          {sigType === 'type' && (
            <div className="w-full space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Seu Nome Completo</label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Digite seu nome para assinar..."
                  className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-850 focus:border-indigo-500 text-slate-100 text-sm font-semibold placeholder:text-slate-700 transition-colors focus:outline-none"
                />
              </div>
              
              {/* Font Options Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Estilo de Caligrafia</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Great Vibes', 'Dancing Script', 'Alex Brush'] as const).map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => setSelectedFont(font)}
                      className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all ${
                        selectedFont === font
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-500 hover:text-slate-400'
                      }`}
                      style={{ fontFamily: font }}
                    >
                      {font === 'Great Vibes' ? 'Elegante' : font === 'Dancing Script' ? 'Moderna' : 'Artística'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-full relative border border-slate-800 rounded-2xl overflow-hidden bg-white shadow-inner">
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
                className="w-full block touch-none cursor-crosshair"
              />
              {sigType === 'draw' && (
                <button
                  onClick={clearCanvas}
                  className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-indigo-400 text-slate-400 rounded-full transition-colors active:scale-95 shadow-lg"
                >
                  Limpar Quadro
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold italic text-center w-full">
              Sua assinatura digital registrada será vinculada à sua selfie, documento e endereço IP.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/40 rounded-2xl p-3.5 space-y-2 text-[11px] text-slate-400 leading-relaxed">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Smartphone size={14} className="text-indigo-400" />
              <span>Metadados de Resguardo Jurídico</span>
            </div>
            <div className="space-y-1 font-semibold">
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-slate-500" />
                <span>Geolocalização:</span>
                <span className="text-slate-300 truncate max-w-[280px]">{geolocation || 'Buscando coordenadas...'}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Nos moldes da MP 2.200-2/2001, registramos a assinatura digital integrada a IP e biometria para segurança operacional mútua.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-full font-bold border-slate-800 hover:bg-slate-850 text-slate-400"
              onClick={() => setPasso(3)}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 h-11 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/50 transition-all gap-1.5"
              onClick={handleSubmitSignature}
            >
              <CheckCircle2 size={16} />
              <span>Confirmar & Assinar</span>
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: LOADING / SUCCESS PAGE */}
      {passo === 5 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden animate-fade-in-up">
          {enviando ? (
            <div className="py-8 space-y-6">
              <div className="w-16 h-16 rounded-full border border-indigo-500/10 flex items-center justify-center mx-auto text-indigo-500 relative">
                <Loader2 size={32} className="animate-spin relative z-10" />
                <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-60" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-100">Processando Assinatura...</h2>
                <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                  Estamos fazendo o upload seguro das fotos, gerando seu Termo de Autenticidade Digital e assinando o seu contrato oficial. Aguarde alguns segundos.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-6 space-y-6 animate-scale-up">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
              
              <div className="w-18 h-18 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 relative">
                <CheckCircle2 size={40} className="relative z-10" />
                <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping opacity-40" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-black text-slate-100 tracking-tight">Contrato Assinado com Sucesso!</h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Parabéns! O processo de assinatura digital do contrato **{contrato.numero_contrato}** foi concluído com sucesso e está 100% verificado.
                </p>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 text-left text-[11px] font-semibold text-slate-400 space-y-1.5 max-w-xs mx-auto">
                <p className="text-center font-bold text-slate-300 uppercase tracking-wider text-[9px] mb-1">Registro de Autenticidade</p>
                <div className="flex justify-between">
                  <span>Tomador:</span>
                  <span className="text-slate-200">{cliente.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horário:</span>
                  <span className="text-slate-200 font-mono">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Validação:</span>
                  <span className="text-emerald-500 font-bold">Biometria e Evidências Salvas</span>
                </div>
              </div>

              {resultadoUrl && (
                <div className="pt-2 max-w-xs mx-auto">
                  <a href={resultadoUrl} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center justify-center w-full h-11 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/40 transition-all text-sm active:scale-[0.98]">
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
