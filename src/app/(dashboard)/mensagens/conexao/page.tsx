'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Link2, 
  Settings, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  Send, 
  FileText, 
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  CheckSquare,
  AlertOctagon,
  Eye,
  FileCode2,
  History
} from 'lucide-react'

type WhatsAppConfig = {
  id?: string
  api_url: string
  api_key: string
  instance_name: string
  ativo: boolean
  status: string
  delay_ms?: number
}

type TriggerConfig = {
  ativo: boolean
  template: string
  dias_antes?: number
}

type TriggerKey = 'contrato_criado' | 'contrato_assinado' | 'lembrete_pre_vencimento' | 'lembrete_vencimento' | 'cobranca_pos_vencimento'

type WhatsappSettings = {
  contrato_criado: TriggerConfig
  contrato_assinado: TriggerConfig
  lembrete_pre_vencimento: TriggerConfig
  lembrete_vencimento: TriggerConfig
  cobranca_pos_vencimento: TriggerConfig
  hora_envio?: string | null
}


const DEFAULT_SETTINGS: WhatsappSettings = {
  contrato_criado: {
    ativo: true,
    template: "Olá, {{nome}}! O seu contrato de empréstimo {{numero_contrato}} no valor de {{valor_principal}} foi criado e está pronto para assinatura. Por favor, acesse o link a seguir para assinar digitalmente: {{link_assinatura}}"
  },
  contrato_assinado: {
    ativo: true,
    template: "Olá, {{nome}}! Seu contrato {{numero_contrato}} foi assinado digitalmente com sucesso. Segue a cópia assinada do contrato: {{link_contrato}}"
  },
  lembrete_pre_vencimento: {
    ativo: true,
    dias_antes: 3,
    template: "Olá, {{nome}}! Passando para lembrar que sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} vence em {{dias_antes}} dias ({{data_vencimento}}) no valor de {{valor}}. Chave PIX: {{whatsapp_padrao}}."
  },
  lembrete_vencimento: {
    ativo: true,
    template: "Atenção, {{nome}}! Sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} vence HOJE ({{data_vencimento}}) no valor de {{valor}}. Chave PIX de pagamento: {{whatsapp_padrao}}. Favor desconsiderar caso já pago."
  },
  cobranca_pos_vencimento: {
    ativo: true,
    template: "Prezado(a) {{nome}}, consta em nosso sistema que a sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} está em atraso. O valor de {{valor}} foi atualizado para {{valor_total}} (multa de {{multa}} e juros de {{juros_mora}}). Favor regularizar via PIX: {{whatsapp_padrao}}."
  },
  hora_envio: "09:00"
}

const FLOW_DETAILS = {
  contrato_criado: {
    titulo: "Contrato Criado",
    icone: FileText,
    cor: "text-blue-600 bg-blue-50 border-blue-200",
    variaveis: ["nome", "numero_contrato", "valor_principal", "link_assinatura"],
    descricao: "Enviado logo após criar o empréstimo para que o cliente realize a assinatura eletrônica."
  },
  contrato_assinado: {
    titulo: "Contrato Assinado",
    icone: CheckSquare,
    cor: "text-green-600 bg-green-50 border-green-200",
    variaveis: ["nome", "numero_contrato", "link_contrato"],
    descricao: "Enviado em formato PDF como comprovante da assinatura para o WhatsApp do cliente."
  },
  lembrete_pre_vencimento: {
    titulo: "Lembrete de Vencimento (Pré)",
    icone: Calendar,
    cor: "text-amber-600 bg-amber-50 border-amber-200",
    variaveis: ["nome", "numero_parcela", "total_parcelas", "numero_contrato", "dias_antes", "data_vencimento", "valor", "whatsapp_padrao"],
    descricao: "Alerta prévio enviado X dias antes do vencimento da parcela com código/dados Pix."
  },
  lembrete_vencimento: {
    titulo: "Lembrete no Dia do Vencimento",
    icone: Clock,
    cor: "text-purple-600 bg-purple-50 border-purple-200",
    variaveis: ["nome", "numero_parcela", "total_parcelas", "numero_contrato", "data_vencimento", "valor", "whatsapp_padrao"],
    descricao: "Mensagem enviada no dia exato do vencimento relembrando o pagamento."
  },
  cobranca_pos_vencimento: {
    titulo: "Cobrança de Parcela em Atraso (Overdue)",
    icone: AlertOctagon,
    cor: "text-red-600 bg-red-50 border-red-200",
    variaveis: ["nome", "numero_parcela", "total_parcelas", "numero_contrato", "dias_atraso", "valor", "valor_total", "multa", "juros_mora", "whatsapp_padrao"],
    descricao: "Cobrança diária para parcelas vencidas, detalhando multa, juros acumulados e novo total."
  }
}

export default function WhatsAppConexaoPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [dbMigrationError, setDbMigrationError] = useState(false)
  const [tab, setTab] = useState('conexao')

  // Config do WhatsApp (Evolution API)
  const [config, setConfig] = useState<WhatsAppConfig>({
    api_url: '',
    api_key: '',
    instance_name: '',
    ativo: true,
    status: 'desconectado',
    delay_ms: 1200
  })

  // Settings de Automação (JSONB no config_factoring)
  const [settings, setSettings] = useState<WhatsappSettings>(DEFAULT_SETTINGS)

  // Logs Recentes de Envio
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Status de conexão em tempo real da API
  const [connectionState, setConnectionState] = useState<'open' | 'close' | 'connecting' | 'nao_configurado' | 'erro'>('nao_configurado')
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string; code?: string; qrcode?: { base64?: string; code?: string; } } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingQr, setLoadingQr] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Refs para controle do polling sem stale closures
  const prevConnectionState = useRef<'open' | 'close' | 'connecting' | 'nao_configurado' | 'erro'>('nao_configurado')
  const qrFetchedRef = useRef(false)

  // Mensagem de teste
  const [testNumber, setTestNumber] = useState('')
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do módulo WhatsApp do SRSM Group.')
  const [sendingTest, setSendingTest] = useState(false)

  // Trigger selecionado para edição
  const [activeTrigger, setActiveTrigger] = useState<TriggerKey>('contrato_criado')

  // Carrega logs recentes
  const loadRecentLogs = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from('notificacoes_log')
        .select('*')
        .eq('empresa_id', empresaAtual.id)
        .eq('canal', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        if (!error.message.includes('relation') && !error.message.includes('does not exist')) {
          throw error
        }
      } else {
        setRecentLogs(data || [])
      }
    } catch (err) {
      console.error('Erro ao carregar logs recentes:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [empresaAtual?.id])

  // Carrega configurações
  const load = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    setDbMigrationError(false)
    try {
      // 1. Carrega credenciais da config_whatsapp
      const { data: cwData, error: cwErr } = await supabase
        .from('config_whatsapp')
        .select('*')
        .eq('empresa_id', empresaAtual.id)
        .maybeSingle()

      if (cwErr) {
        if (cwErr.message.includes('relation') || cwErr.message.includes('does not exist')) {
          setDbMigrationError(true)
        } else {
          throw cwErr
        }
      } else if (cwData) {
        setConfig({
          id: cwData.id,
          api_url: cwData.api_url || '',
          api_key: cwData.api_key || '',
          instance_name: cwData.instance_name || '',
          ativo: cwData.ativo ?? true,
          status: cwData.status || 'desconectado',
          delay_ms: cwData.delay_ms ?? 1200
        })
      }

      // 2. Carrega automações da config_factoring
      const { data: cfData, error: cfErr } = await supabase
        .from('config_factoring')
        .select('whatsapp_settings')
        .eq('empresa_id', empresaAtual.id)
        .maybeSingle()

      if (cfErr) {
        if (cfErr.message.includes('column') || cfErr.message.includes('does not exist')) {
          setDbMigrationError(true)
        } else {
          throw cfErr
        }
      } else if (cfData?.whatsapp_settings) {
        // Mescla com default caso falte algum trigger
        setSettings({
          ...DEFAULT_SETTINGS,
          ...cfData.whatsapp_settings
        })
      }

      // Carrega logs recentes de disparos
      await loadRecentLogs()
    } catch (err: any) {
      console.error('Erro ao carregar configurações de WhatsApp:', err)
      toast.error('Erro ao carregar configurações.')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, loadRecentLogs])

  useEffect(() => {
    load()
  }, [load])

  // Checa status da conexão da instância na Evolution API
  const checkConnectionStatus = useCallback(async (showToast = false) => {
    if (!empresaAtual?.id || !config.api_url || !config.instance_name) return
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/whatsapp/conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'status', empresa_id: empresaAtual.id })
      })

      const data = await res.json()

      if (!res.ok) {
        setConnectionState('erro')
        if (showToast) toast.error(data.erro || 'Falha ao buscar status da conexão.')
        return
      }

      if (data.status === 'nao_configurado') {
        setConnectionState('nao_configurado')
        return
      }

      const nextState: 'open' | 'close' | 'connecting' =
        data.state === 'open' ? 'open' :
        data.state === 'connecting' ? 'connecting' :
        'close'

      // Side-effects fora do setState para evitar dupla execução no React 18 Strict Mode
      if (nextState === 'open' && prevConnectionState.current !== 'open') {
        toast.success('WhatsApp pareado com sucesso!')
        loadRecentLogs()
        setQrCodeData(null)
        qrFetchedRef.current = false
      }

      prevConnectionState.current = nextState
      setConnectionState(nextState)
    } catch (err) {
      console.error(err)
      setConnectionState('erro')
    } finally {
      setLoadingStatus(false)
    }
  }, [empresaAtual?.id, config.api_url, config.instance_name, loadRecentLogs])

  // Polling de status — reinicia quando config ou empresa mudam
  useEffect(() => {
    if (loading || dbMigrationError || !config.api_url || !config.instance_name) return
    qrFetchedRef.current = false
    setQrCodeData(null)
    checkConnectionStatus()
    const interval = setInterval(() => checkConnectionStatus(), 6000)
    return () => clearInterval(interval)
  }, [config.api_url, config.instance_name, loading, dbMigrationError, checkConnectionStatus])

  // Auto-fetch do QR quando estado muda para 'close' — apenas uma vez por ciclo
  useEffect(() => {
    if (connectionState === 'close' && !qrFetchedRef.current && config.api_url && config.instance_name) {
      qrFetchedRef.current = true
      getQrCode()
    }
    // getQrCode é uma função estável no render atual; qrFetchedRef garante single-fire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, config.api_url, config.instance_name])

  // Obtém o QR Code para pareamento
  const getQrCode = async () => {
    if (!empresaAtual?.id) return
    setLoadingQr(true)
    try {
      const res = await fetch('/api/whatsapp/conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'conectar', empresa_id: empresaAtual.id })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.erro || 'Erro ao gerar QR Code.')
        return
      }

      setQrCodeData(data)
    } catch (err: any) {
      toast.error('Erro ao gerar QR Code: ' + err.message)
    } finally {
      setLoadingQr(false)
    }
  }

  // Desconecta / Despareia
  const disconnectInstance = async () => {
    if (!empresaAtual?.id) return
    if (!confirm('Deseja realmente desconectar e limpar a conexão atual do WhatsApp?')) return
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/whatsapp/conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'desconectar', empresa_id: empresaAtual.id })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.erro || 'Erro ao desconectar.')
        return
      }

      toast.success('WhatsApp desconectado com sucesso.')
      setConnectionState('close')
      setQrCodeData(null)
      qrFetchedRef.current = false
      // auto-QR effect dispara ao detectar connectionState === 'close'
    } catch (err: any) {
      toast.error('Erro ao desconectar: ' + err.message)
    } finally {
      setLoadingStatus(false)
    }
  }

  // Salva credenciais do WhatsApp
  const salvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaAtual?.id) return
    setSavingConfig(true)
    try {
      const payload = {
        empresa_id: empresaAtual.id,
        api_url: config.api_url.trim(),
        api_key: config.api_key.trim(),
        instance_name: config.instance_name.trim(),
        ativo: config.ativo,
        delay_ms: config.delay_ms ?? 1200
      }

      const { error } = await supabase
        .from('config_whatsapp')
        .upsert(payload, { onConflict: 'empresa_id' })

      if (error) throw error

      toast.success('Configurações do WhatsApp salvas com sucesso!')
      await load()
      // Aciona checagem de status após salvar
      setTimeout(() => checkConnectionStatus(true), 500)
    } catch (err: any) {
      toast.error('Erro ao salvar credenciais: ' + err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  // Salva triggers / templates de automação
  const salvarSettings = async () => {
    if (!empresaAtual?.id) return
    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('config_factoring')
        .upsert(
          {
            empresa_id: empresaAtual.id,
            whatsapp_settings: settings
          },
          { onConflict: 'empresa_id' }
        )

      if (error) throw error
      toast.success('Configurações de disparos salvas com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao salvar automações: ' + err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  // Atualiza um trigger específico nas configurações locais
  const handleUpdateTrigger = (key: TriggerKey, field: keyof TriggerConfig, value: any) => {
    setSettings(prev => {
      const trigger = prev[key] as TriggerConfig
      return {
        ...prev,
        [key]: {
          ...trigger,
          [field]: value
        }
      }
    })
  }

  // Dispara mensagem de teste
  const enviarTeste = async () => {
    if (!empresaAtual?.id) return
    if (!testNumber) {
      toast.error('Informe um número de telefone com DDD para testar.')
      return
    }
    setSendingTest(true)
    try {
      const res = await fetch('/api/whatsapp/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtual.id,
          destinatario: testNumber,
          mensagem: testMessage
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.erro || 'Erro ao enviar mensagem de teste.')
        return
      }

      toast.success('Mensagem de teste disparada com sucesso!')
      loadRecentLogs()
    } catch (err: any) {
      toast.error('Erro ao enviar teste: ' + err.message)
    } finally {
      setSendingTest(false)
    }
  }

  // Renderiza preview dinâmico de WhatsApp
  const renderPreview = () => {
    const activeData = settings[activeTrigger]
    const details = FLOW_DETAILS[activeTrigger]
    if (!activeData) return ''

    const mockValues: Record<string, string> = {
      nome: "GUSTAVO GOMES FRANCO LEITE",
      numero_contrato: "FAC-2026-8947",
      valor_principal: "R$ 3.000,00",
      link_assinatura: `http://localhost:3000/assinar/d3b07384-d113`,
      link_contrato: "https://relldwstuqmrefeviaua.supabase.co/storage/v1/object/public/.../contrato_assinado_FAC-2026-8947.pdf",
      numero_parcela: "1",
      total_parcelas: "6",
      dias_antes: String(activeData.dias_antes ?? 3),
      data_vencimento: "16/07/2026",
      valor: "R$ 562,50",
      valor_total: "R$ 575,44",
      multa: "R$ 11,25",
      juros_mora: "R$ 1,69",
      dias_atraso: "5",
      whatsapp_padrao: "financeiro@grupo.com (Chave Pix CNPJ)"
    }

    let text = activeData.template
    Object.entries(mockValues).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v)
    })
    return text
  }

  // Insere variável no cursor do textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const insereVariavel = (varName: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const currentText = settings[activeTrigger].template
    const toInsert = `{{${varName}}}`
    const updated = currentText.substring(0, start) + toInsert + currentText.substring(end)
    handleUpdateTrigger(activeTrigger, 'template', updated)
    
    // Devolve foco com cursor posicionado
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + toInsert.length, start + toInsert.length)
    }, 50)
  }

  if (loading) return <LoadingPage />

  const tipoEmpresa = empresaAtual?.tipo ?? 'factoring'

  return (
    <AppShell empresa={tipoEmpresa} titulo="Conexão & Automação WhatsApp">
      {dbMigrationError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-5 mb-6 flex gap-3 items-start">
          <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-sm">Banco de Dados não Migrado</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              As tabelas ou colunas necessárias para gerenciar o WhatsApp não foram encontradas no banco de dados. 
              Por favor, copie as instruções contidas no arquivo <code className="bg-red-100 px-1 py-0.5 rounded font-mono">src/lib/supabase/whatsapp_migration.sql</code> e execute-as no <strong>SQL Editor do seu Supabase Dashboard</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="conexao" className="rounded-lg flex gap-2 items-center text-sm font-medium py-2">
              <Link2 size={16} />
              Conectar WhatsApp
            </TabsTrigger>
            <TabsTrigger value="automacoes" className="rounded-lg flex gap-2 items-center text-sm font-medium py-2">
              <Settings size={16} />
              Triggers & Templates
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CONEXÃO WHATSAPP */}
          <TabsContent value="conexao" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form de Config de Credenciais */}
              <div className="lg:col-span-2">
                <form onSubmit={salvarConfig}>
                  <Card className="border-slate-200 shadow-sm rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
                        <FileCode2 className="text-[#1E5AA8]" size={20} />
                        Credenciais da Evolution API
                      </CardTitle>
                      <CardDescription>
                        Insira as informações do seu servidor Evolution API open-source para parear seu dispositivo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="api_url" className="text-xs font-semibold text-slate-600">URL da API</Label>
                          <Input 
                            id="api_url"
                            type="url"
                            placeholder="https://api.meuservidor.com"
                            value={config.api_url}
                            onChange={(e) => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
                            required
                            className="text-sm rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="instance_name" className="text-xs font-semibold text-slate-600">Nome da Instância</Label>
                          <Input 
                            id="instance_name"
                            placeholder="ex: factoring_01"
                            value={config.instance_name}
                            onChange={(e) => setConfig(prev => ({ ...prev, instance_name: e.target.value.replace(/\s+/g, '') }))}
                            required
                            className="text-sm rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="delay_ms" className="text-xs font-semibold text-slate-600">Delay de Envio (ms)</Label>
                          <Input 
                            id="delay_ms"
                            type="number"
                            min={0}
                            max={10000}
                            placeholder="1200"
                            value={config.delay_ms ?? 1200}
                            onChange={(e) => setConfig(prev => ({ ...prev, delay_ms: parseInt(e.target.value) || 0 }))}
                            required
                            className="text-sm rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="api_key" className="text-xs font-semibold text-slate-600">Chave da API (Global Key / Token)</Label>
                        <Input 
                          id="api_key"
                          type="password"
                          placeholder="EvolutionAPI_Secret_Key_..."
                          value={config.api_key}
                          onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                          required
                          className="text-sm rounded-lg"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Switch 
                          id="ativo" 
                          checked={config.ativo}
                          onCheckedChange={(checked) => setConfig(prev => ({ ...prev, ativo: checked }))}
                        />
                        <Label htmlFor="ativo" className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Ativar envio de mensagens para esta empresa
                        </Label>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-slate-100 pt-4 bg-slate-50/50 rounded-b-xl">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Info size={14} className="text-slate-400" />
                        O tráfego de dados é direto com seu servidor Evolution API.
                      </div>
                      <Button 
                        type="submit" 
                        disabled={savingConfig || dbMigrationError}
                        className="bg-[#1E5AA8] hover:bg-[#154687] text-white text-sm rounded-lg font-medium px-5"
                      >
                        {savingConfig ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                        Salvar Configuração
                      </Button>
                    </CardFooter>
                  </Card>
                </form>

                {/* Card de Teste de Disparo */}
                {config.api_url && config.instance_name && connectionState === 'open' && (
                  <Card className="border-slate-200 shadow-sm rounded-xl mt-6">
                    <CardHeader>
                      <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
                        <Send className="text-[#1E5AA8]" size={18} />
                        Disparar Mensagem de Teste
                      </CardTitle>
                      <CardDescription>
                        Valide se sua instância está funcionando corretamente enviando uma mensagem manual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="test_number" className="text-xs font-semibold text-slate-600">Número de Destino (Com DDD)</Label>
                        <Input 
                          id="test_number"
                          type="tel"
                          placeholder="62999999999"
                          value={testNumber}
                          onChange={(e) => setTestNumber(e.target.value.replace(/\D/g, ''))}
                          className="text-sm rounded-lg max-w-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="test_message" className="text-xs font-semibold text-slate-600">Conteúdo da Mensagem</Label>
                        <Textarea 
                          id="test_message"
                          rows={3}
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          className="text-sm rounded-lg"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end border-t border-slate-100 pt-4 bg-slate-50/50 rounded-b-xl">
                      <Button 
                        onClick={enviarTeste} 
                        disabled={sendingTest || !testNumber}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium px-5"
                      >
                        {sendingTest ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                        Enviar Teste
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </div>

              {/* Status do Monitor & Pareamento via QR Code */}
              <div>
                <Card className="border-slate-200 shadow-sm rounded-xl h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-slate-800 text-lg">Pareamento de Celular</CardTitle>
                    <CardDescription>
                      Estado da conexão da sua instância com o WhatsApp.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                    
                    {/* Badge de status */}
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1.5 uppercase font-semibold tracking-wider">Status da Instância</p>
                      {connectionState === 'open' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle size={14} />
                          CONECTADO
                        </span>
                      )}
                      {connectionState === 'connecting' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                          <Loader2 className="animate-spin" size={14} />
                          CONECTANDO...
                        </span>
                      )}
                      {connectionState === 'close' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <XCircle size={14} />
                          DESCONECTADO
                        </span>
                      )}
                      {connectionState === 'nao_configurado' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Info size={14} />
                          NÃO CONFIGURADO
                        </span>
                      )}
                      {connectionState === 'erro' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertTriangle size={14} />
                          ERRO DE CONEXÃO
                        </span>
                      )}
                    </div>

                    {/* QR Code Container */}
                    <div className="flex-1 flex items-center justify-center min-h-[260px] w-full max-w-[260px] bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 relative overflow-hidden">
                      {connectionState === 'open' ? (
                        <div className="text-center p-4">
                          <div className="w-16 h-16 bg-green-50 rounded-full border border-green-200 flex items-center justify-center mx-auto mb-3">
                            <MessageSquare className="text-green-600" size={28} />
                          </div>
                          <h4 className="font-semibold text-sm text-slate-800">WhatsApp Pareado</h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Seu celular está conectado e pronto para disparar notificações automáticas.
                          </p>
                        </div>
                      ) : connectionState === 'nao_configurado' ? (
                        <div className="text-center p-4">
                          <Info className="text-slate-400 mx-auto mb-3" size={32} />
                          <h4 className="font-semibold text-sm text-slate-600">Aguardando Credenciais</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Preencha as credenciais da Evolution API ao lado e salve para gerar o QR Code.
                          </p>
                        </div>
                      ) : loadingQr ? (
                        <div className="text-center">
                          <Loader2 className="animate-spin text-[#1E5AA8] mx-auto mb-2" size={28} />
                          <p className="text-xs text-slate-400">Gerando QR Code...</p>
                        </div>
                      ) : qrCodeData ? (
                        <div className="flex flex-col items-center space-y-4">
                          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            {(() => {
                              const raw = qrCodeData.base64 || qrCodeData.qrcode?.base64
                              const code = qrCodeData.code || qrCodeData.qrcode?.code
                              if (raw) {
                                const src = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
                                return <img src={src} alt="QR Code WhatsApp" className="w-[180px] h-[180px]" />
                              }
                              if (code) return <QRCodeSVG value={code} size={180} />
                              return <div className="w-[180px] h-[180px] flex items-center justify-center text-xs text-slate-400">QR inválido — tente novamente</div>
                            })()}
                          </div>
                          <p className="text-[10px] text-center text-slate-400 max-w-[200px] leading-relaxed">
                            Abra o WhatsApp no celular, toque em "Aparelhos conectados" e escaneie o código acima.
                          </p>
                          <button
                            type="button"
                            onClick={() => { qrFetchedRef.current = false; getQrCode() }}
                            disabled={loadingQr}
                            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={10} className={loadingQr ? 'animate-spin' : ''} />
                            QR expirou? Atualizar
                          </button>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { qrFetchedRef.current = false; getQrCode() }}
                            disabled={!config.api_url}
                            className="text-xs font-semibold rounded-lg"
                          >
                            <RefreshCw size={12} className="mr-1.5" />
                            Gerar QR Code
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions do Card */}
                    <div className="w-full flex gap-2 pt-2 border-t border-slate-100">
                      <Button 
                        variant="outline"
                        onClick={() => checkConnectionStatus(true)}
                        disabled={loadingStatus || !config.api_url}
                        className="flex-1 text-xs font-semibold rounded-lg py-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <RefreshCw size={12} className={`mr-1.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                        Atualizar Status
                      </Button>
                      
                      {(connectionState === 'open' || connectionState === 'connecting') && (
                        <Button 
                          variant="destructive"
                          onClick={disconnectInstance}
                          disabled={loadingStatus}
                          className="flex-1 text-xs font-medium rounded-lg py-2"
                        >
                          Desconectar
                        </Button>
                      )}
                    </div>

                  </CardContent>
                </Card>
              </div>

            </div>

            {/* Logs Recentes de Disparos */}
            <Card className="border-slate-200 shadow-sm rounded-xl mt-6">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <CardTitle className="text-slate-800 text-lg flex items-center gap-2">
                    <History className="text-[#1E5AA8]" size={20} />
                    Histórico de Disparos Recentes (Últimos 10)
                  </CardTitle>
                  <CardDescription>
                    Monitore em tempo real as notificações enviadas, entregues, lidas ou com falha.
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={loadRecentLogs}
                  disabled={loadingLogs}
                  className="rounded-lg text-xs"
                >
                  <RefreshCw size={12} className={`mr-1.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Atualizar Logs
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-[#1E5AA8]" size={24} />
                  </div>
                ) : recentLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Nenhum disparo de WhatsApp registrado recentemente.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="pb-3 pr-4">Destinatário</th>
                          <th className="pb-3 pr-4">Assunto</th>
                          <th className="pb-3 pr-4">Mensagem</th>
                          <th className="pb-3 pr-4">Status</th>
                          <th className="pb-3">Data/Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentLogs.map((log) => {
                          const date = new Date(log.enviado_em || log.created_at)
                          const timeStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                          return (
                            <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 pr-4 font-medium text-slate-700">{log.destinatario}</td>
                              <td className="py-3 pr-4 text-slate-500 font-semibold text-xs">{log.assunto || 'Sem Assunto'}</td>
                              <td className="py-3 pr-4 text-slate-600 max-w-[340px] truncate" title={log.mensagem}>
                                {log.mensagem}
                              </td>
                              <td className="py-3 pr-4">
                                {log.status === 'lido' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                    Lido ✓✓
                                  </span>
                                )}
                                {log.status === 'entregue' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Entregue ✓✓
                                  </span>
                                )}
                                {log.status === 'enviado' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
                                    Enviado ✓
                                  </span>
                                )}
                                {log.status === 'erro' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200" title={log.erro || ''}>
                                    Erro ⚠️
                                  </span>
                                )}
                                {log.status === 'pendente' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">
                                    Fila ⏳
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-slate-400 text-xs font-medium whitespace-nowrap">{timeStr}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: TRIGGER & TEMPLATES */}
          <TabsContent value="automacoes" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)] items-stretch">
              
              {/* Menu lateral de Triggers */}
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1.5 overflow-y-auto">
                <div className="px-3 py-2 border-b border-slate-100 mb-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gatilhos de Envio</p>
                </div>
                {Object.entries(FLOW_DETAILS).map(([key, details]) => {
                  const Icon = details.icone
                  const isSelected = activeTrigger === key
                  const isActive = (settings[key as TriggerKey] as TriggerConfig)?.ativo ?? false

                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTrigger(key as TriggerKey)}
                      className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all ${
                        isSelected 
                          ? 'bg-[#EDF4FE] text-[#1E5AA8] border border-[#1E5AA8]/20 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border ${details.cor} flex-shrink-0 mt-0.5`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="font-semibold truncate leading-tight">{details.titulo}</p>
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-300'} flex-shrink-0`} />
                        </div>
                        <p className="text-slate-400 truncate mt-1">{isActive ? 'Ativo' : 'Desativado'}</p>
                      </div>
                    </button>
                  )
                })}

                <div className="mt-auto border-t border-slate-100 pt-4 p-2">
                  <Button 
                    onClick={salvarSettings}
                    disabled={savingSettings || dbMigrationError}
                    className="w-full bg-[#1E5AA8] hover:bg-[#154687] text-white text-xs font-semibold py-2.5 rounded-lg flex gap-1.5 items-center justify-center shadow-sm"
                  >
                    {savingSettings ? <Loader2 className="animate-spin" size={12} /> : null}
                    Salvar Alterações
                  </Button>
                </div>
              </div>

              {/* Editor de Mensagem e Preview */}
              <div className="lg:col-span-9 flex flex-col gap-4 overflow-y-auto pr-1">
                
                {/* Horário Global de Envio de Cobrança */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Horário de Envio das Cobranças</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Define o horário de disparo diário para os lembretes automáticos e cobranças (Fuso Horário de Brasília).</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={settings.hora_envio || '09:00'} 
                      onValueChange={(val) => setSettings(prev => ({ ...prev, hora_envio: val }))}
                    >
                      <SelectTrigger className="w-[120px] rounded-lg">
                        <SelectValue placeholder="09:00" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 17 }).map((_, i) => {
                          const hour = String(i + 6).padStart(2, '0') + ':00'
                          return (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Header do gatilho */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{FLOW_DETAILS[activeTrigger].titulo}</h3>
                    <p className="text-xs text-slate-400 mt-1">{FLOW_DETAILS[activeTrigger].descricao}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="trigger_active" className="text-xs font-semibold text-slate-600">Status do Envio:</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{settings[activeTrigger]?.ativo ? 'Enviando' : 'Inativo'}</span>
                      <Switch 
                        id="trigger_active"
                        checked={settings[activeTrigger]?.ativo ?? false}
                        onCheckedChange={(checked) => handleUpdateTrigger(activeTrigger, 'ativo', checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco de parametrização dinâmica (dias_antes) */}
                {activeTrigger === 'lembrete_pre_vencimento' && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
                    <Clock className="text-amber-500" size={18} />
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <span>Enviar lembrete de vencimento</span>
                      <Input 
                        type="number"
                        min={1}
                        max={30}
                        value={settings.lembrete_pre_vencimento.dias_antes ?? 3}
                        onChange={(e) => handleUpdateTrigger('lembrete_pre_vencimento', 'dias_antes', parseInt(e.target.value) || 3)}
                        className="w-16 h-8 text-center px-1 rounded-lg"
                      />
                      <span>dias antes do vencimento da parcela.</span>
                    </div>
                  </div>
                )}

                {/* Editor do Template */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
                  <div>
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 block">
                      Variáveis Dinâmicas (Clique para inserir)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {FLOW_DETAILS[activeTrigger].variaveis.map((v) => (
                        <button
                          key={v}
                          onClick={() => insereVariavel(v)}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-[#EDF4FE] hover:text-[#1E5AA8] hover:border-[#1E5AA8]/20 transition-all cursor-pointer"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template_text" className="text-xs font-bold text-slate-700">Mensagem Template</Label>
                    <Textarea 
                      id="template_text"
                      ref={textareaRef}
                      rows={6}
                      value={settings[activeTrigger]?.template ?? ''}
                      onChange={(e) => handleUpdateTrigger(activeTrigger, 'template', e.target.value)}
                      placeholder="Construa sua mensagem..."
                      className="font-mono text-sm leading-relaxed rounded-xl focus:ring-[#1E5AA8]"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Não remova as chaves das variáveis.</span>
                      <span>{(settings[activeTrigger]?.template ?? '').length} caracteres</span>
                    </div>
                  </div>
                </div>

                {/* Live Preview de WhatsApp */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={15} className="text-[#1E5AA8]" />
                    <Label className="text-xs font-bold text-slate-700">Live Preview no WhatsApp</Label>
                    <span className="text-[10px] text-slate-400">(Dados de simulação real)</span>
                  </div>

                  <div className="bg-[#E5DDD5] rounded-xl p-4 md:p-6 border border-slate-300 relative overflow-hidden flex flex-col justify-end min-h-[160px]">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                    
                    <div className="max-w-md relative z-10">
                      <div className="bg-white rounded-xl rounded-tl-none shadow-md p-3.5 border border-[#c1d9b7]/30">
                        
                        {/* Se for trigger assinado, simula um box de anexo de documento PDF */}
                        {activeTrigger === 'contrato_assinado' && (
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-2.5 flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">contrato_assinado_FAC-2026-8947.pdf</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Documento PDF • 256 KB</p>
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {renderPreview() || "Digite um template acima para visualizar..."}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-2 font-medium">
                          <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-green-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
