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
import {
  Settings, MessageSquare, CheckCircle, XCircle, Loader2, RefreshCw, Send,
  FileText, AlertTriangle, Info, Calendar, Clock, CheckSquare, AlertOctagon,
  Eye, History, Stethoscope, Zap, Phone, Search, ChevronDown, ChevronUp,
  LayoutDashboard, TrendingUp, AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type TriggerConfig = { ativo: boolean; template: string; dias_antes?: number }
type TriggerKey = 'contrato_criado' | 'contrato_assinado' | 'lembrete_pre_vencimento' | 'lembrete_vencimento' | 'cobranca_pos_vencimento'
type WhatsappSettings = {
  contrato_criado: TriggerConfig
  contrato_assinado: TriggerConfig
  lembrete_pre_vencimento: TriggerConfig
  lembrete_vencimento: TriggerConfig
  cobranca_pos_vencimento: TriggerConfig
  hora_envio?: string | null
  max_dias_atraso?: number
  frequencia_cobranca?: number
}
type MetaStatus = {
  configurado: boolean
  status: 'ativo' | 'erro' | 'nao_configurado'
  mensagem?: string
  display_phone_number?: string
  verified_name?: string
  phone_number_id?: string
}
type Stats = {
  total: number; enviado: number; entregue: number; lido: number
  erro: number; pendente: number; hoje: number
  taxa_entrega: number; taxa_leitura: number
  fila: Array<{ id: string; destinatario: string; assunto: string; created_at: string }>
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: WhatsappSettings = {
  contrato_criado: {
    ativo: true,
    template: `🏦 *SRS M FACTORING — CONTRATO APROVADO* ✅

Olá, *{{nome}}*! Ótimas notícias!

Seu contrato de crédito foi aprovado e gerado com sucesso.

📋 *Dados do Contrato:*
• Nº: {{numero_contrato}}
• Valor Liberado: *{{valor_principal}}*

✍️ *Assine agora (link exclusivo):*
{{link_assinatura}}

ℹ️ A assinatura é digital, segura e tem validade jurídica.

_SRS M Factoring — Crédito com Responsabilidade_`
  },
  contrato_assinado: {
    ativo: true,
    template: `✅ *CONTRATO ASSINADO — SRS M FACTORING*

Olá, *{{nome}}*!

Seu contrato *{{numero_contrato}}* foi assinado digitalmente com sucesso. O documento tem plena validade jurídica conforme MP 2.200-2/2001.

📄 *Acesse e salve seu contrato:*
{{link_contrato}}

Dúvidas? Estamos à disposição.
_SRS M Factoring_`
  },
  lembrete_pre_vencimento: {
    ativo: true,
    dias_antes: 3,
    template: `🔔 *LEMBRETE DE VENCIMENTO — SRS M FACTORING*

Olá, *{{nome}}*!

Sua parcela vence em *{{dias_antes}} dias*. Não esqueça!

📋 *Detalhes:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Vencimento: *{{data_vencimento}}*
• Valor: *{{valor}}*

💳 *Pague via PIX:*
\`{{whatsapp_padrao}}\`

Pagando antes do vencimento você evita encargos. 😊

_SRS M Factoring — Financeiro_`
  },
  lembrete_vencimento: {
    ativo: true,
    template: `📅 *PARCELA VENCE HOJE — SRS M FACTORING*

Olá, *{{nome}}*!

⚠️ Sua parcela vence *HOJE*. Evite multa e juros efetuando o pagamento.

📋 *Detalhes:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Valor: *{{valor}}*

💳 *Pague agora via PIX:*
\`{{whatsapp_padrao}}\`

Após o vencimento são cobrados multa + juros diários.
_SRS M Factoring — Setor Financeiro_`
  },
  cobranca_pos_vencimento: {
    ativo: true,
    template: `⚠️ *PARCELA EM ATRASO — SRS M FACTORING*

Olá, *{{nome}}*.

Identificamos que há parcela(s) em aberto no seu contrato.

📋 *Situação atual:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Vencimento: {{data_vencimento}}
• ⏱ Dias em atraso: *{{dias_atraso}} dias*

💰 *Valores atualizados:*
• Valor original: {{valor}}
• Multa: +{{multa}}
• Juros acumulados: +{{juros_mora}}
• *Total a pagar: {{valor_total}}*

💳 *Regularize via PIX:*
\`{{whatsapp_padrao}}\`

⚡ Os juros aumentam a cada dia. Regularize o quanto antes.

_SRS M Factoring — Departamento de Cobranças_`
  },
  hora_envio: '09:00',
  max_dias_atraso: 60,
  frequencia_cobranca: 1,
}

const FLOW_DETAILS = {
  contrato_criado: { titulo: 'Contrato Criado', icone: FileText, cor: 'text-blue-600 bg-blue-50 border-blue-200', variaveis: ['nome', 'numero_contrato', 'valor_principal', 'link_assinatura'], descricao: 'Enviado ao criar o empréstimo para que o cliente realize a assinatura eletrônica.' },
  contrato_assinado: { titulo: 'Contrato Assinado', icone: CheckSquare, cor: 'text-green-600 bg-green-50 border-green-200', variaveis: ['nome', 'numero_contrato', 'link_contrato'], descricao: 'Confirmação de assinatura com link para download do PDF.' },
  lembrete_pre_vencimento: { titulo: 'Lembrete Pré-Vencimento', icone: Calendar, cor: 'text-amber-600 bg-amber-50 border-amber-200', variaveis: ['nome', 'numero_parcela', 'total_parcelas', 'numero_contrato', 'dias_antes', 'data_vencimento', 'valor', 'whatsapp_padrao'], descricao: 'Alerta X dias antes do vencimento com chave PIX para pagamento.' },
  lembrete_vencimento: { titulo: 'Vencimento Hoje', icone: Clock, cor: 'text-purple-600 bg-purple-50 border-purple-200', variaveis: ['nome', 'numero_parcela', 'total_parcelas', 'numero_contrato', 'data_vencimento', 'valor', 'whatsapp_padrao'], descricao: 'Enviado no dia do vencimento com urgência e chave PIX.' },
  cobranca_pos_vencimento: { titulo: 'Cobrança Pós-Vencimento', icone: AlertOctagon, cor: 'text-red-600 bg-red-50 border-red-200', variaveis: ['nome', 'numero_parcela', 'total_parcelas', 'numero_contrato', 'dias_atraso', 'valor', 'valor_total', 'multa', 'juros_mora', 'whatsapp_padrao'], descricao: 'Enviada após o vencimento com valores atualizados (multa + juros). Repete conforme configuração.' },
}

const STATUS_FILTERS = [
  { key: 'todos', label: 'Todos', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'pendente', label: 'Na Fila', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  { key: 'enviado', label: 'Enviado', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'entregue', label: 'Entregue', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { key: 'lido', label: 'Lido', color: 'bg-sky-50 text-[#53BDEB] border-sky-200' },
  { key: 'erro', label: 'Erro', color: 'bg-red-50 text-red-600 border-red-200' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status, erro }: { status: string; erro?: string }) {
  if (status === 'lido') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#53BDEB]" title="Lido pelo destinatário">
      <DoubleCheck blue /> Lido
    </span>
  )
  if (status === 'entregue') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500" title="Entregue ao dispositivo">
      <DoubleCheck /> Entregue
    </span>
  )
  if (status === 'enviado') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400" title="Enviado pela Meta API">
      <SingleCheck /> Enviado
    </span>
  )
  if (status === 'erro') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500" title={erro || 'Falha no envio'}>
      <XCircle size={13} /> Erro
    </span>
  )
  if (status === 'pendente') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
      <Clock size={12} /> Na fila
    </span>
  )
  return <span className="text-xs text-slate-400">{status}</span>
}

function SingleCheck() {
  return <svg width="10" height="9" viewBox="0 0 10 9" fill="none"><path d="M1 4.5L4 7.5L9 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function DoubleCheck({ blue }: { blue?: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
      <path d="M1 5.5L5 9.5L15 1.5" stroke={blue ? '#53BDEB' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L9 9.5" stroke={blue ? '#53BDEB' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 1.5L13 5.5" stroke={blue ? '#53BDEB' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FunnelChart({ stats }: { stats: Stats }) {
  const processed = stats.enviado + stats.entregue + stats.lido + stats.erro
  const delivered = stats.entregue + stats.lido
  const read = stats.lido
  const max = Math.max(processed, 1)

  const stages = [
    { label: 'Mensagens Enviadas', sublabel: 'saíram do servidor Meta', count: processed, pct: 100, color: 'bg-slate-400', textBlue: false },
    { label: 'Entregues no Celular', sublabel: `${Math.round((delivered / max) * 100)}% das enviadas`, count: delivered, pct: Math.round((delivered / max) * 100), color: 'bg-blue-400', textBlue: false },
    { label: 'Lidas pelo Cliente', sublabel: `${delivered > 0 ? Math.round((read / delivered) * 100) : 0}% das entregues`, count: read, pct: Math.round((read / max) * 100), color: 'bg-[#53BDEB]', textBlue: true },
  ]

  return (
    <div className="space-y-4">
      {stages.map((s, i) => (
        <div key={i}>
          <div className="flex items-center gap-3">
            <div className="w-10 text-right flex-shrink-0">
              <p className={`text-base font-bold ${s.textBlue ? 'text-[#53BDEB]' : i === 1 ? 'text-blue-500' : 'text-slate-600'}`}>
                {s.count.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex-1 h-9 bg-slate-100 rounded-lg overflow-hidden relative">
              <div
                className={`h-full rounded-lg ${s.color} transition-all duration-700 flex items-center px-3`}
                style={{ width: `${Math.max(s.pct, s.count > 0 ? 6 : 0)}%` }}
              >
                {s.pct > 12 && <span className="text-white text-xs font-bold">{s.pct}%</span>}
              </div>
              {s.pct <= 12 && s.count > 0 && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">{s.pct}%</span>
              )}
            </div>
            <div className="w-36 flex-shrink-0">
              <p className="text-xs font-semibold text-slate-700 leading-tight">{s.label}</p>
              <p className="text-[10px] text-slate-400">{s.sublabel}</p>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="flex items-center gap-3 my-1">
              <div className="w-10" />
              <div className="flex-1 pl-2">
                <div className="h-4 border-l-2 border-dashed border-slate-200 ml-2" />
              </div>
              <div className="w-36" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppConexaoPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

  // Meta API
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Company config
  const [ativo, setAtivo] = useState(true)
  const [delayMs, setDelayMs] = useState(1200)
  const [savingConfig, setSavingConfig] = useState(false)

  // WhatsApp automation settings
  const [settings, setSettings] = useState<WhatsappSettings>(DEFAULT_SETTINGS)
  const [pixChave, setPixChave] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // Test send
  const [testNumber, setTestNumber] = useState('')
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do sistema SRS M Factoring.')
  const [sendingTest, setSendingTest] = useState(false)

  // History tab
  const [histLogs, setHistLogs] = useState<any[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histFilter, setHistFilter] = useState('todos')
  const [histSearch, setHistSearch] = useState('')
  const [histPage, setHistPage] = useState(0)
  const [loadingHist, setLoadingHist] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [histLoaded, setHistLoaded] = useState(false)

  // Automações
  const [activeTrigger, setActiveTrigger] = useState<TriggerKey>('contrato_criado')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Diagnostics
  const [diagnosticoAberto, setDiagnosticoAberto] = useState(false)
  const [loadingDiagnostico, setLoadingDiagnostico] = useState(false)
  const [resultadoDiagnostico, setResultadoDiagnostico] = useState<{
    ok: boolean; checks: { ok: boolean; msg: string; detail?: string }[]; recentLogs: any[]
  } | null>(null)

  // ─── API calls ───────────────────────────────────────────────────────────────
  const checkMetaStatus = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoadingMeta(true)
    try {
      const res = await fetch(`/api/whatsapp/conexao?empresa_id=${empresaAtual.id}`)
      setMetaStatus(await res.json())
    } catch {
      setMetaStatus({ configurado: false, status: 'erro', mensagem: 'Falha ao verificar' })
    } finally {
      setLoadingMeta(false)
    }
  }, [empresaAtual?.id])

  const loadStats = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/whatsapp/stats?empresa_id=${empresaAtual.id}`)
      if (res.ok) setStats(await res.json())
    } catch {} finally {
      setLoadingStats(false)
    }
  }, [empresaAtual?.id])

  const loadHistory = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoadingHist(true)
    try {
      let query = supabase
        .from('notificacoes_log')
        .select('*', { count: 'exact' })
        .eq('empresa_id', empresaAtual.id)
        .eq('canal', 'whatsapp')
        .order('created_at', { ascending: false })
        .range(histPage * 20, (histPage + 1) * 20 - 1)

      if (histFilter !== 'todos') query = query.eq('status', histFilter)
      if (histSearch.trim()) query = query.ilike('destinatario', `%${histSearch.trim()}%`)

      const { data, count, error } = await query
      if (!error) {
        setHistLogs(data ?? [])
        setHistTotal(count ?? 0)
      }
    } finally {
      setLoadingHist(false)
    }
  }, [empresaAtual?.id, histFilter, histSearch, histPage])

  const load = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const { data: cw } = await supabase
        .from('config_whatsapp')
        .select('ativo, delay_ms')
        .eq('empresa_id', empresaAtual.id)
        .maybeSingle()
      if (cw) { setAtivo(cw.ativo ?? true); setDelayMs(cw.delay_ms ?? 1200) }

      const { data: cf } = await supabase
        .from('config_factoring')
        .select('whatsapp_settings, whatsapp_padrao')
        .eq('empresa_id', empresaAtual.id)
        .maybeSingle()
      if (cf) {
        if (cf.whatsapp_padrao) setPixChave(cf.whatsapp_padrao)
        if (cf.whatsapp_settings) setSettings({ ...DEFAULT_SETTINGS, ...cf.whatsapp_settings })
      }

      await Promise.all([checkMetaStatus(), loadStats()])
    } catch {
      toast.error('Erro ao carregar configurações.')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, checkMetaStatus, loadStats])

  useEffect(() => { load() }, [load])

  // Auto-refresh stats no dashboard a cada 30s
  useEffect(() => {
    if (tab !== 'dashboard') return
    const interval = setInterval(() => loadStats(), 30_000)
    return () => clearInterval(interval)
  }, [tab, loadStats])

  // Carrega histórico na primeira vez que o tab é aberto
  useEffect(() => {
    if (tab === 'historico' && !histLoaded) setHistLoaded(true)
  }, [tab])

  useEffect(() => {
    if (!histLoaded) return
    loadHistory()
  }, [histLoaded, histFilter, histSearch, histPage, loadHistory])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const salvarConfig = async () => {
    if (!empresaAtual?.id) return
    setSavingConfig(true)
    try {
      const { error } = await supabase.from('config_whatsapp')
        .upsert({ empresa_id: empresaAtual.id, ativo, delay_ms: delayMs }, { onConflict: 'empresa_id' })
      if (error) throw error
      toast.success('Configurações salvas!')
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSavingConfig(false)
    }
  }

  const salvarSettings = async () => {
    if (!empresaAtual?.id) return
    setSavingSettings(true)
    try {
      const { error } = await supabase.from('config_factoring')
        .upsert({ empresa_id: empresaAtual.id, whatsapp_settings: settings, whatsapp_padrao: pixChave }, { onConflict: 'empresa_id' })
      if (error) throw error
      toast.success('Templates e configurações salvos!')
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleUpdateTrigger = (key: TriggerKey, field: keyof TriggerConfig, value: any) => {
    setSettings(prev => ({ ...prev, [key]: { ...(prev[key] as TriggerConfig), [field]: value } }))
  }

  const enviarTeste = async () => {
    if (!empresaAtual?.id || !testNumber) { toast.error('Informe um número com DDD.'); return }
    setSendingTest(true)
    try {
      const res = await fetch('/api/whatsapp/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaAtual.id, destinatario: testNumber, mensagem: testMessage }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erro || 'Erro ao enviar.'); return }
      toast.success('Mensagem enviada! Aguarde confirmação de entrega nos logs.')
      setTimeout(() => loadStats(), 2000)
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSendingTest(false)
    }
  }

  const executarDiagnostico = async () => {
    if (!empresaAtual?.id) return
    setLoadingDiagnostico(true)
    setDiagnosticoAberto(true)
    setResultadoDiagnostico(null)
    try {
      const res = await fetch(`/api/whatsapp/diagnostico?empresa_id=${empresaAtual.id}`)
      setResultadoDiagnostico(await res.json())
    } catch (e: any) {
      setResultadoDiagnostico({ ok: false, checks: [{ ok: false, msg: 'Falha: ' + e.message }], recentLogs: [] })
    } finally {
      setLoadingDiagnostico(false)
    }
  }

  const renderPreview = () => {
    const activeData = settings[activeTrigger]
    if (!activeData) return ''
    const mock: Record<string, string> = {
      nome: 'GUSTAVO GOMES FRANCO', numero_contrato: 'FAC-2026-8947', valor_principal: 'R$ 3.000,00',
      link_assinatura: 'https://srsm.vercel.app/assinar/d3b07384', link_contrato: 'https://supabase.co/.../contrato.pdf',
      numero_parcela: '1', total_parcelas: '6', dias_antes: String(activeData.dias_antes ?? 3),
      data_vencimento: '16/07/2026', valor: 'R$ 562,50', valor_total: 'R$ 601,88',
      multa: 'R$ 11,25', juros_mora: 'R$ 28,13', dias_atraso: '15',
      whatsapp_padrao: pixChave || 'financeiro@srsm.com.br',
    }
    let text = activeData.template
    Object.entries(mock).forEach(([k, v]) => { text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v) })
    return text
  }

  const insereVariavel = (varName: string) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const toInsert = `{{${varName}}}`
    const updated = settings[activeTrigger].template.substring(0, start) + toInsert + settings[activeTrigger].template.substring(end)
    handleUpdateTrigger(activeTrigger, 'template', updated)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + toInsert.length, start + toInsert.length) }, 50)
  }

  if (loading) return <LoadingPage />

  const tipoEmpresa = empresaAtual?.tipo ?? 'factoring'
  const metaOk = metaStatus?.status === 'ativo'

  return (
    <AppShell empresa={tipoEmpresa} titulo="WhatsApp">
      <div className="space-y-5">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-auto flex gap-1 w-fit">
            <TabsTrigger value="dashboard" className="rounded-lg flex gap-2 items-center text-sm font-medium py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <LayoutDashboard size={15} />Dashboard
            </TabsTrigger>
            <TabsTrigger value="historico" className="rounded-lg flex gap-2 items-center text-sm font-medium py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History size={15} />Histórico
            </TabsTrigger>
            <TabsTrigger value="automacoes" className="rounded-lg flex gap-2 items-center text-sm font-medium py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Settings size={15} />Automações
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════
              TAB 1: DASHBOARD
          ═══════════════════════════════════════════ */}
          <TabsContent value="dashboard" className="mt-5 space-y-5">

            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Hoje', value: loadingStats ? null : (stats?.hoje ?? 0),
                  sub: 'mensagens enviadas', icon: <Zap size={16} className="text-[#1E5AA8]" />, accent: 'border-[#1E5AA8]/20 bg-[#EDF4FE]/40',
                },
                {
                  label: '30 dias', value: loadingStats ? null : ((stats?.enviado ?? 0) + (stats?.entregue ?? 0) + (stats?.lido ?? 0) + (stats?.erro ?? 0)),
                  sub: 'total processadas', icon: <Send size={16} className="text-slate-400" />, accent: 'border-slate-200 bg-slate-50',
                },
                {
                  label: 'Entrega', value: loadingStats ? null : `${stats?.taxa_entrega ?? 0}%`,
                  sub: `${(stats?.entregue ?? 0) + (stats?.lido ?? 0)} entregues`, icon: <TrendingUp size={16} className="text-blue-400" />, accent: 'border-blue-100 bg-blue-50/50',
                },
                {
                  label: 'Leitura', value: loadingStats ? null : `${stats?.taxa_leitura ?? 0}%`,
                  sub: `${stats?.lido ?? 0} lidas`, icon: (
                    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="text-[#53BDEB]">
                      <path d="M1 5.5L5 9.5L15 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 5.5L9 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 1.5L13 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ), accent: 'border-sky-100 bg-sky-50/40',
                },
              ].map((c, i) => (
                <div key={i} className={`rounded-xl border p-4 ${c.accent}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{c.label}</p>
                    {c.icon}
                  </div>
                  <p className="text-2xl font-bold text-slate-800 tabular-nums">
                    {c.value === null ? <Loader2 className="animate-spin inline" size={18} /> : c.value}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Funnel + Meta Status */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Funil */}
              <Card className="lg:col-span-3 border-slate-200 shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-800 text-base">Funil de Entrega</CardTitle>
                      <CardDescription>Rastreamento em tempo real via Meta Cloud API — últimos 30 dias.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadStats} disabled={loadingStats} className="text-slate-400 hover:text-slate-600 rounded-lg text-xs">
                      <RefreshCw size={12} className={`mr-1.5 ${loadingStats ? 'animate-spin' : ''}`} />Atualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
                  ) : stats ? (
                    <FunnelChart stats={stats} />
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-6">Nenhum dado disponível ainda.</p>
                  )}
                  {/* Legenda ticks */}
                  <div className="flex items-center gap-5 mt-5 pt-4 border-t border-slate-100 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1.5"><SingleCheck /> Enviado</span>
                    <span className="flex items-center gap-1.5"><DoubleCheck /> Entregue</span>
                    <span className="flex items-center gap-1.5 text-[#53BDEB]"><DoubleCheck blue /> Lido</span>
                    {stats && stats.erro > 0 && (
                      <span className="flex items-center gap-1.5 text-red-400 ml-auto">
                        <AlertCircle size={11} /> {stats.erro} erros
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Meta Status + Config + Fila */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {/* Meta status */}
                <Card className="border-slate-200 shadow-sm rounded-xl">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="text-[#25D366]" size={18} />
                        <span className="text-sm font-bold text-slate-800">Meta Cloud API</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={checkMetaStatus} disabled={loadingMeta} className="text-slate-400 h-7 px-2 text-xs rounded-lg">
                        <RefreshCw size={11} className={loadingMeta ? 'animate-spin' : ''} />
                      </Button>
                    </div>
                    {loadingMeta ? (
                      <div className="flex items-center gap-2 text-slate-400 text-xs py-1"><Loader2 className="animate-spin" size={14} />Verificando...</div>
                    ) : metaStatus?.status === 'ativo' ? (
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle size={12} />CONECTADO & ATIVO
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5">
                          <Phone size={12} className="text-[#25D366]" />
                          <span className="font-semibold">{metaStatus.display_phone_number ?? metaStatus.phone_number_id}</span>
                        </div>
                        {metaStatus.verified_name && (
                          <p className="text-[11px] text-slate-400">{metaStatus.verified_name}</p>
                        )}
                      </div>
                    ) : metaStatus?.status === 'erro' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <XCircle size={12} />ERRO DE TOKEN
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <Info size={12} />NÃO CONFIGURADO
                      </span>
                    )}
                  </CardContent>
                </Card>

                {/* Fila de pendentes */}
                <Card className="border-slate-200 shadow-sm rounded-xl flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-800 text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock size={15} className="text-amber-500" />
                        Fila de Disparos
                      </span>
                      {stats && stats.pendente > 0 && (
                        <span className="text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                          {stats.pendente} pendentes
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {stats && stats.fila.length > 0 ? (
                      <div className="space-y-2">
                        {stats.fila.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                            <Clock size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{item.destinatario}</p>
                              <p className="text-[10px] text-slate-400 truncate">{item.assunto || 'Sem assunto'}</p>
                            </div>
                          </div>
                        ))}
                        {stats.pendente > 5 && (
                          <button onClick={() => { setTab('historico'); setHistFilter('pendente') }}
                            className="text-[11px] text-[#1E5AA8] font-semibold hover:underline">
                            +{stats.pendente - 5} na fila →
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-2">Fila vazia — disparos enviados com sucesso.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Enviar Teste + Config */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Enviar teste */}
              <Card className="border-slate-200 shadow-sm rounded-xl">
                <CardHeader>
                  <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                    <Send className="text-[#25D366]" size={17} />Enviar Mensagem de Teste
                  </CardTitle>
                  <CardDescription>{metaOk ? 'Meta API ativa — envie agora para validar.' : 'Configure WHATSAPP_TOKEN nas variáveis do Vercel.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Número (com DDD)</Label>
                    <Input type="tel" placeholder="62999999999" value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value.replace(/\D/g, ''))}
                      disabled={!metaOk} className="text-sm rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Mensagem</Label>
                    <Textarea rows={4} value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
                      disabled={!metaOk} className="text-sm rounded-lg resize-none" />
                  </div>
                  {!metaOk && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                      Token Meta não configurado. Adicione nas variáveis do Vercel.
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-3 bg-slate-50/50 rounded-b-xl justify-end gap-2">
                  <button onClick={executarDiagnostico} disabled={loadingDiagnostico}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#1E5AA8] transition-colors mr-auto disabled:opacity-50">
                    {loadingDiagnostico ? <Loader2 className="animate-spin" size={12} /> : <Stethoscope size={12} />}
                    Diagnóstico
                  </button>
                  <Button onClick={enviarTeste} disabled={sendingTest || !testNumber || !metaOk}
                    className="bg-[#25D366] hover:bg-[#1ebe59] text-white text-sm rounded-lg font-medium px-5">
                    {sendingTest ? <><Loader2 className="animate-spin mr-2" size={14} />Enviando...</> : <><Send size={14} className="mr-2" />Enviar</>}
                  </Button>
                </CardFooter>
              </Card>

              {/* Config de envio */}
              <Card className="border-slate-200 shadow-sm rounded-xl">
                <CardHeader>
                  <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                    <Settings className="text-[#1E5AA8]" size={17} />Configurações de Envio
                  </CardTitle>
                  <CardDescription>Controle de envio para esta empresa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-3">
                    <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
                    <Label htmlFor="ativo" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Ativar envio de mensagens
                    </Label>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delay_ms" className="text-xs font-semibold text-slate-600">Delay entre envios em lote (ms)</Label>
                    <Input id="delay_ms" type="number" min={0} max={10000} value={delayMs}
                      onChange={(e) => setDelayMs(parseInt(e.target.value) || 0)} className="text-sm rounded-lg max-w-[160px]" />
                    <p className="text-[10px] text-slate-400">Recomendado: 1200ms para evitar rate limit.</p>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-3 bg-slate-50/50 rounded-b-xl justify-end">
                  <Button onClick={salvarConfig} disabled={savingConfig}
                    className="bg-[#1E5AA8] hover:bg-[#154687] text-white text-sm rounded-lg font-medium px-5">
                    {savingConfig && <Loader2 className="animate-spin mr-2" size={14} />}Salvar
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Diagnóstico expandível */}
            {diagnosticoAberto && (
              <Card className="border-slate-200 shadow-sm rounded-xl">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope size={16} className="text-[#1E5AA8]" />
                    <CardTitle className="text-slate-800 text-base">Diagnóstico do Sistema</CardTitle>
                    {resultadoDiagnostico && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${resultadoDiagnostico.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {resultadoDiagnostico.ok ? '✓ OK' : '✗ PROBLEMAS'}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setDiagnosticoAberto(false)} className="text-slate-400 hover:text-slate-600 text-xs">Fechar</button>
                </CardHeader>
                <CardContent>
                  {loadingDiagnostico ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-4"><Loader2 className="animate-spin" size={18} />Verificando...</div>
                  ) : resultadoDiagnostico ? (
                    <div className="space-y-1.5">
                      {resultadoDiagnostico.checks.map((check, i) => (
                        <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${check.ok ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                          {check.ok ? <CheckCircle size={13} className="text-green-600 mt-0.5 flex-shrink-0" /> : <XCircle size={13} className="text-red-600 mt-0.5 flex-shrink-0" />}
                          <div>
                            <p className={`font-semibold ${check.ok ? 'text-green-800' : 'text-red-800'}`}>{check.msg}</p>
                            {check.detail && <p className="text-slate-500 mt-0.5">{check.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════
              TAB 2: HISTÓRICO
          ═══════════════════════════════════════════ */}
          <TabsContent value="historico" className="mt-5 space-y-4">
            {/* Filtros */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => { setHistFilter(f.key); setHistPage(0) }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          histFilter === f.key
                            ? f.color + ' shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {f.label}
                        {histFilter === f.key && histTotal > 0 && ` (${histTotal})`}
                      </button>
                    ))}
                  </div>
                  {/* Busca */}
                  <div className="flex items-center gap-2 ml-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-52">
                    <Search size={13} className="text-slate-400 flex-shrink-0" />
                    <input
                      placeholder="Buscar por número..."
                      value={histSearch}
                      onChange={(e) => { setHistSearch(e.target.value); setHistPage(0) }}
                      className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none w-full"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={loadHistory} disabled={loadingHist} className="rounded-lg text-xs shrink-0">
                    <RefreshCw size={12} className={`mr-1.5 ${loadingHist ? 'animate-spin' : ''}`} />Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardContent className="pt-4">
                {loadingHist ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#1E5AA8]" size={24} /></div>
                ) : histLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="mx-auto text-slate-200 mb-3" size={36} />
                    <p className="text-slate-400 text-sm">Nenhum registro encontrado.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-left">
                            <th className="pb-3 pr-4">Destinatário</th>
                            <th className="pb-3 pr-4">Tipo / Assunto</th>
                            <th className="pb-3 pr-4">Status</th>
                            <th className="pb-3 pr-4">Data/Hora</th>
                            <th className="pb-3 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {histLogs.map((log) => {
                            const isExpanded = expandedLogId === log.id
                            const date = new Date(log.enviado_em || log.created_at)
                            const timeStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            const isLido = log.status === 'lido'
                            const isErro = log.status === 'erro'
                            return (
                              <>
                                <tr
                                  key={log.id}
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className={`border-b border-slate-50 cursor-pointer transition-colors text-sm ${
                                    isLido ? 'hover:bg-sky-50/40' : isErro ? 'hover:bg-red-50/30' : 'hover:bg-slate-50/60'
                                  } ${isExpanded ? 'bg-slate-50/60' : ''}`}
                                >
                                  <td className="py-3 pr-4">
                                    <p className="font-semibold text-slate-800 text-xs">{log.destinatario}</p>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <p className="text-xs font-semibold text-slate-600">{log.assunto || '—'}</p>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <StatusBadge status={log.status} erro={log.erro} />
                                    {isErro && log.erro && (
                                      <p className="text-[10px] text-red-400 mt-0.5 max-w-[160px] truncate" title={log.erro}>{log.erro}</p>
                                    )}
                                  </td>
                                  <td className="py-3 pr-4">
                                    <p className="text-xs text-slate-400 font-medium whitespace-nowrap">{timeStr}</p>
                                  </td>
                                  <td className="py-3 text-slate-300">
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={log.id + '_detail'} className="bg-slate-50/80">
                                    <td colSpan={5} className="pb-4 pt-2 px-4">
                                      <div className="bg-[#E5DDD5] rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px]" />
                                        <div className="max-w-lg relative z-10">
                                          <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 border border-[#c1d9b7]/30">
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{log.mensagem}</p>
                                            <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-2 font-medium">
                                              <span>{timeStr}</span>
                                              {log.status === 'lido' && <span className="text-[#53BDEB] font-bold">✓✓</span>}
                                              {log.status === 'entregue' && <span className="text-slate-400 font-bold">✓✓</span>}
                                              {log.status === 'enviado' && <span className="text-slate-400 font-bold">✓</span>}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginação */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400">
                        {histPage * 20 + 1}–{Math.min((histPage + 1) * 20, histTotal)} de {histTotal} registros
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={histPage === 0} onClick={() => setHistPage(p => p - 1)} className="rounded-lg text-xs">
                          ← Anterior
                        </Button>
                        <Button variant="outline" size="sm" disabled={(histPage + 1) * 20 >= histTotal} onClick={() => setHistPage(p => p + 1)} className="rounded-lg text-xs">
                          Próximo →
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════
              TAB 3: AUTOMAÇÕES
          ═══════════════════════════════════════════ */}
          <TabsContent value="automacoes" className="mt-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px] items-start">

              {/* Sidebar de triggers */}
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1.5 sticky top-4">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gatilhos Automáticos</p>
                </div>
                {Object.entries(FLOW_DETAILS).map(([key, details]) => {
                  const Icon = details.icone
                  const isSelected = activeTrigger === key
                  const isActive = (settings[key as TriggerKey] as TriggerConfig)?.ativo ?? false
                  return (
                    <button key={key} onClick={() => setActiveTrigger(key as TriggerKey)}
                      className={`w-full text-left p-3 rounded-lg flex items-start gap-2.5 transition-all ${isSelected ? 'bg-[#EDF4FE] border border-[#1E5AA8]/20 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}>
                      <div className={`p-1.5 rounded-lg border ${details.cor} flex-shrink-0 mt-0.5`}><Icon size={15} /></div>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`font-semibold truncate leading-tight ${isSelected ? 'text-[#1E5AA8]' : 'text-slate-700'}`}>{details.titulo}</p>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                        </div>
                        <p className="text-slate-400 mt-0.5">{isActive ? 'Ativo' : 'Desativado'}</p>
                      </div>
                    </button>
                  )
                })}

                <div className="mt-3 pt-3 border-t border-slate-100 px-1">
                  <Button onClick={salvarSettings} disabled={savingSettings} className="w-full bg-[#1E5AA8] hover:bg-[#154687] text-white text-xs font-semibold py-2.5 rounded-lg">
                    {savingSettings && <Loader2 className="animate-spin mr-1.5" size={12} />}Salvar Tudo
                  </Button>
                </div>
              </div>

              {/* Área de edição */}
              <div className="lg:col-span-9 flex flex-col gap-4">

                {/* Config global de cobranças */}
                <Card className="border-slate-200 shadow-sm rounded-xl">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Chave PIX */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Chave PIX para Cobranças</Label>
                        <input value={pixChave} onChange={e => setPixChave(e.target.value)}
                          placeholder="CPF, CNPJ, e-mail ou chave aleatória"
                          className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5AA8]/30" />
                        <p className="text-[10px] text-slate-400">Aparece como <code className="font-mono bg-slate-100 px-1 rounded">{'{{whatsapp_padrao}}'}</code></p>
                      </div>

                      {/* Horário */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <Clock size={12} />Horário de Disparo Diário
                        </Label>
                        <Select value={settings.hora_envio || '09:00'} onValueChange={(val) => setSettings(prev => ({ ...prev, hora_envio: val }))}>
                          <SelectTrigger className="rounded-lg h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 17 }).map((_, i) => {
                              const h = String(i + 6).padStart(2, '0') + ':00'
                              return <SelectItem key={h} value={h}>{h}</SelectItem>
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-400">Fuso horário de Brasília.</p>
                      </div>

                      {/* Config de cobrança pós-vencimento */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                            <AlertOctagon size={12} className="text-red-500" />Cobrança Pós-Vencimento
                          </Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 whitespace-nowrap">Máximo</span>
                            <Input type="number" min={1} max={365} value={settings.max_dias_atraso ?? 60}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_dias_atraso: parseInt(e.target.value) || 60 }))}
                              className="w-20 h-8 text-sm rounded-lg text-center" />
                            <span className="text-xs text-slate-500 whitespace-nowrap">dias de atraso</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 whitespace-nowrap">A cada</span>
                            <Select value={String(settings.frequencia_cobranca ?? 1)}
                              onValueChange={(v) => setSettings(prev => ({ ...prev, frequencia_cobranca: parseInt(v ?? '1') }))}>
                              <SelectTrigger className="w-20 h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 7].map(d => <SelectItem key={d} value={String(d)}>{d} dia{d > 1 ? 's' : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-slate-500">após vencimento</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Header do trigger selecionado */}
                <Card className="border-slate-200 shadow-sm rounded-xl">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{FLOW_DETAILS[activeTrigger].titulo}</h3>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-md">{FLOW_DETAILS[activeTrigger].descricao}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{settings[activeTrigger]?.ativo ? 'Ativo' : 'Desativado'}</span>
                        <Switch checked={settings[activeTrigger]?.ativo ?? false}
                          onCheckedChange={(v) => handleUpdateTrigger(activeTrigger, 'ativo', v)} />
                      </div>
                    </div>
                    {activeTrigger === 'lembrete_pre_vencimento' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <Clock className="text-amber-500" size={14} />
                        Enviar lembrete
                        <Input type="number" min={1} max={30}
                          value={settings.lembrete_pre_vencimento.dias_antes ?? 3}
                          onChange={(e) => handleUpdateTrigger('lembrete_pre_vencimento', 'dias_antes', parseInt(e.target.value) || 3)}
                          className="w-16 h-7 text-center px-1 rounded-lg text-sm" />
                        dias antes do vencimento
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Editor + Preview side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Editor */}
                  <div className="space-y-3">
                    <Card className="border-slate-200 shadow-sm rounded-xl">
                      <CardContent className="pt-4 space-y-3">
                        <div>
                          <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                            Variáveis disponíveis
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {FLOW_DETAILS[activeTrigger].variaveis.map((v) => (
                              <button key={v} onClick={() => insereVariavel(v)}
                                className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-[#EDF4FE] hover:text-[#1E5AA8] hover:border-[#1E5AA8]/20 transition-all">
                                {`{{${v}}}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-slate-700">Mensagem Template</Label>
                          <Textarea ref={textareaRef} rows={12}
                            value={settings[activeTrigger]?.template ?? ''}
                            onChange={(e) => handleUpdateTrigger(activeTrigger, 'template', e.target.value)}
                            className="font-mono text-xs leading-relaxed rounded-xl focus:ring-[#1E5AA8] resize-none" />
                          <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                            <button onClick={() => handleUpdateTrigger(activeTrigger, 'template', DEFAULT_SETTINGS[activeTrigger].template)}
                              className="flex items-center gap-1 hover:text-[#1E5AA8] transition-colors">
                              <RefreshCw size={10} />Restaurar padrão
                            </button>
                            <span>{(settings[activeTrigger]?.template ?? '').length} chars</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Preview */}
                  <div className="space-y-3">
                    <Card className="border-slate-200 shadow-sm rounded-xl h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-slate-700 text-sm flex items-center gap-2">
                          <Eye size={14} className="text-[#1E5AA8]" />Preview do WhatsApp
                          <span className="text-[10px] text-slate-400 font-normal">(dados simulados)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* WhatsApp header */}
                        <div className="bg-[#075E54] rounded-t-xl px-4 py-2.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {empresaAtual?.nome?.[0] ?? 'S'}
                          </div>
                          <div>
                            <p className="text-white text-xs font-semibold">{empresaAtual?.nome ?? 'SRS M Factoring'}</p>
                            <p className="text-white/70 text-[10px]">online</p>
                          </div>
                        </div>
                        <div className="bg-[#E5DDD5] rounded-b-xl p-4 relative overflow-hidden min-h-[280px] flex flex-col justify-end">
                          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:14px_14px]" />
                          <div className="relative z-10">
                            {activeTrigger === 'contrato_assinado' && (
                              <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-2.5 mb-2 flex items-center gap-3 border border-slate-100">
                                <div className="w-9 h-9 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <FileText size={18} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold text-slate-700">contrato_assinado_FAC-2026.pdf</p>
                                  <p className="text-[9px] text-slate-400">Documento PDF • 256 KB</p>
                                </div>
                              </div>
                            )}
                            <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 border border-[#c1d9b7]/30">
                              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {renderPreview() || 'Digite o template ao lado para visualizar...'}
                              </p>
                              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-2 font-medium">
                                <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-[#53BDEB] font-bold">✓✓</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
