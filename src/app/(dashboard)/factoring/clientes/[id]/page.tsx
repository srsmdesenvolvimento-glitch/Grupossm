'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  MessageCircle, Edit, Plus, Ban, DollarSign, CreditCard,
  AlertTriangle, Clock, MessageSquare, Trash2, Check, X,
  User, MapPin, Banknote, Download, ChevronDown, FileText,
} from 'lucide-react'

import { gerarContratoPDF } from '@/lib/utils/documentos'

import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import {
  calcularScore,
  REGRAS_SCORE_PADRAO,
  FAIXAS_RISCO_PADRAO,
  type DadosScore,
} from '@/lib/utils/calculos'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import {
  formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais,
} from '@/lib/utils/formatters'
import { useEmpresa } from '@/contexts/EmpresaContext'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClienteFactoring {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  rg: string | null
  orgao_emissor: string | null
  data_nascimento: string | null
  estado_civil: string | null
  profissao: string | null
  renda_mensal: number | null
  telefone: string | null
  telefone2: string | null
  email: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo_conta: string | null
  pix: string | null
  limite_credito: number | null
  credito_utilizado: number | null
  credito_disponivel: number | null
  score_interno: number | null
  total_emprestimos: number | null
  valor_total_emprestado: number | null
  ultima_operacao: string | null
  observacoes: string | null
  status: string
}

interface Emprestimo {
  id: string
  empresa_id: string
  numero_contrato: string
  cliente_id: string
  valor_principal: number
  taxa_juros: number
  tipo_taxa: string | null
  prazo_meses: number
  valor_parcela: number
  total_pagar: number
  total_juros: number
  saldo_devedor: number
  data_primeiro_vencimento: string | null
  data_liberacao: string | null
  status: string
}

interface Parcela {
  id: string
  empresa_id: string
  emprestimo_id: string
  cliente_id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_principal: number | null
  valor_juros: number | null
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  dias_atraso: number | null
  multa: number | null
  juros_mora: number | null
  tipo_pagamento: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'renegociado' | 'cancelado'
}

interface Movimentacao {
  id: string
  empresa_id: string
  tipo: 'entrada' | 'saida'
  categoria: string | null
  descricao: string | null
  valor: number
  referencia_tipo: string | null
  referencia_id: string | null
  data_movimentacao: string
}

interface ReferenciaCliente {
  id: string
  cliente_id: string
  nome: string
  parentesco: string | null
  telefone: string | null
  observacoes: string | null
}

interface Anotacao {
  id: string
  empresa_id: string
  canal: string
  destinatario: string | null
  assunto: string | null
  mensagem: string | null
  referencia_tipo: string | null
  referencia_id: string | null
  status: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRiscoBadge(score: number | null) {
  const s = score ?? 0
  if (s >= 70) return { label: 'Baixo Risco', cls: 'bg-green-100 text-green-800 border-green-200' }
  if (s >= 50) return { label: 'Risco Médio', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
  if (s >= 30) return { label: 'Alto Risco', cls: 'bg-orange-100 text-orange-800 border-orange-200' }
  return { label: 'Risco Crítico', cls: 'bg-red-100 text-red-800 border-red-200' }
}

function anotacaoIcon(assunto: string | null) {
  switch (assunto) {
    case 'nota': return '📝'
    case 'ligacao': return '📞'
    case 'visita': return '🏠'
    case 'negociacao': return '🤝'
    case 'alerta': return '⚠️'
    default: return '💬'
  }
}

function anotacaoBorderColor(assunto: string | null) {
  switch (assunto) {
    case 'nota': return 'border-l-blue-400'
    case 'ligacao': return 'border-l-green-400'
    case 'visita': return 'border-l-purple-400'
    case 'negociacao': return 'border-l-amber-400'
    case 'alerta': return 'border-l-red-400'
    default: return 'border-l-slate-400'
  }
}

// ─── Shared FormField ─────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientePerfilPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { empresaAtual } = useEmpresa()

  // Data state
  const [cliente, setCliente] = useState<ClienteFactoring | null>(null)
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [pagamentos, setPagamentos] = useState<Movimentacao[]>([])
  const [referencias, setReferencias] = useState<ReferenciaCliente[]>([])
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [bloqueandoOpen, setBloqueandoOpen] = useState(false)
  const [bloqueandoLoading, setBloqueandoLoading] = useState(false)

  // Tab filters
  const [filtroParcela, setFiltroParcela] = useState<string>('todos')

  // Anotação dialog
  const [anotacaoOpen, setAnotacaoOpen] = useState(false)
  const [anotacaoTipo, setAnotacaoTipo] = useState<string>('nota')
  const [anotacaoConteudo, setAnotacaoConteudo] = useState('')
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false)

  // Dados form
  const [formData, setFormData] = useState<Partial<ClienteFactoring>>({})
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)

  // Títulos accordion
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [gerandoContratoId, setGerandoContratoId] = useState<string | null>(null)

  // Referências
  const [novaRefOpen, setNovaRefOpen] = useState(false)
  const [novaRef, setNovaRef] = useState({ nome: '', parentesco: '', telefone: '', observacoes: '' })
  const [salvandoRef, setSalvandoRef] = useState(false)
  const [editRefId, setEditRefId] = useState<string | null>(null)
  const [editRefData, setEditRefData] = useState<Partial<ReferenciaCliente>>({})
  const [deletandoRefId, setDeletandoRefId] = useState<string | null>(null)

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    setErro(null)
    const supabase = createClient()

    try {
      const [
        { data: clienteData, error: clienteErr },
        { data: emprestimosData },
        { data: parcelasData },
        { data: pagamentosData },
        { data: referenciasData },
        { data: anotacoesData },
      ] = await Promise.all([
        supabase
          .from('clientes_factoring')
          .select('*')
          .eq('id', id)
          .eq('empresa_id', empresaAtual.id)
          .single(),
        supabase
          .from('emprestimos')
          .select('*')
          .eq('cliente_id', id)
          .eq('empresa_id', empresaAtual.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('parcelas_emprestimo')
          .select('*')
          .eq('cliente_id', id)
          .eq('empresa_id', empresaAtual.id)
          .order('data_vencimento', { ascending: true }),
        supabase
          .from('movimentacoes_caixa')
          .select('*')
          .eq('referencia_tipo', 'cliente')
          .eq('referencia_id', id)
          .eq('tipo', 'entrada')
          .eq('empresa_id', empresaAtual.id)
          .order('data_movimentacao', { ascending: false }),
        supabase
          .from('referencias_cliente_factoring')
          .select('*')
          .eq('cliente_id', id),
        supabase
          .from('notificacoes_log')
          .select('*')
          .eq('referencia_tipo', 'cliente')
          .eq('referencia_id', id)
          .eq('empresa_id', empresaAtual.id)
          .order('created_at', { ascending: false }),
      ])

      if (clienteErr || !clienteData) {
        setErro('Cliente não encontrado.')
        return
      }

      setCliente(clienteData as ClienteFactoring)
      setFormData(clienteData as ClienteFactoring)
      setEmprestimos((emprestimosData ?? []) as Emprestimo[])
      setParcelas((parcelasData ?? []) as Parcela[])
      setPagamentos((pagamentosData ?? []) as Movimentacao[])
      setReferencias((referenciasData ?? []) as ReferenciaCliente[])
      setAnotacoes((anotacoesData ?? []) as Anotacao[])
    } catch {
      setErro('Erro ao carregar dados do cliente.')
    } finally {
      setLoading(false)
    }
  }, [id, empresaAtual?.id])

  useEffect(() => { loadData() }, [loadData])

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalPago = pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0)

  const emAberto = parcelas
    .filter(p => p.status === 'pendente' || p.status === 'atrasado')
    .reduce((s, p) => s + ((p.valor ?? 0) - (p.valor_pago ?? 0)), 0)

  const emAtraso = parcelas
    .filter(p => p.status === 'atrasado')
    .reduce((s, p) => s + ((p.valor ?? 0) - (p.valor_pago ?? 0)), 0)

  const parcelasFiltradas = filtroParcela === 'todos'
    ? parcelas
    : parcelas.filter(p => p.status === filtroParcela)

  const parcelasAtrasadas = parcelas.filter(p => p.status === 'atrasado' || (p.dias_atraso ?? 0) > 0)

  // ─── Score calculation ────────────────────────────────────────────────────

  const dadosScore: DadosScore = {
    total_parcelas:           parcelas.length,
    pagas_pontualmente:       parcelas.filter(p => p.status === 'pago' && (p.dias_atraso ?? 0) <= 0).length,
    pagas_antecipado:         parcelas.filter(p => p.status === 'pago' && (p.dias_atraso ?? 0) < -5).length,
    emprestimos_quitados:     emprestimos.filter(e => e.status === 'quitado').length,
    parcelas_atrasadas_atuais: parcelas.filter(p => p.status === 'atrasado').length,
    max_dias_atraso:          Math.max(0, ...parcelas.map(p => p.dias_atraso ?? 0)),
    cliente_bloqueado:        cliente?.status === 'bloqueado',
    cadastro_completo:        !!(cliente?.cpf && cliente?.telefone && cliente?.endereco && cliente?.renda_mensal),
    volume_total_pago:        pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0),
  }

  const resultadoScore = calcularScore(
    dadosScore,
    REGRAS_SCORE_PADRAO,
    FAIXAS_RISCO_PADRAO,
    cliente?.limite_credito ?? undefined,
  )

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function bloquearCliente() {
    if (!cliente) return
    setBloqueandoLoading(true)
    const supabase = createClient()
    const novoStatus = cliente.status === 'bloqueado' ? 'ativo' : 'bloqueado'
    const { error } = await supabase
      .from('clientes_factoring')
      .update({ status: novoStatus })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar status do cliente.')
    } else {
      toast.success(novoStatus === 'bloqueado' ? 'Cliente bloqueado.' : 'Cliente desbloqueado.')
      setCliente(prev => prev ? { ...prev, status: novoStatus } : prev)
    }
    setBloqueandoLoading(false)
    setBloqueandoOpen(false)
  }

  async function salvarDados() {
    if (!cliente) return
    setSalvandoDados(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('clientes_factoring')
      .update(formData)
      .eq('id', id)

    if (error) {
      toast.error('Erro ao salvar dados.')
    } else {
      toast.success('Dados salvos com sucesso.')
      setCliente(prev => prev ? { ...prev, ...formData } as ClienteFactoring : prev)
    }
    setSalvandoDados(false)
  }

  async function buscarCep(cep: string) {
    const cleaned = cep.replace(/\D/g, '')
    if (cleaned.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
      const data = await res.json() as Record<string, string>
      if (!data['erro']) {
        setFormData(prev => ({
          ...prev,
          endereco: data['logradouro'] ?? prev.endereco,
          bairro: data['bairro'] ?? prev.bairro,
          cidade: data['localidade'] ?? prev.cidade,
          estado: data['uf'] ?? prev.estado,
        }))
      }
    } catch {
      // silent — user fills manually
    } finally {
      setCepLoading(false)
    }
  }

  async function salvarAnotacao() {
    if (!anotacaoConteudo.trim() || !cliente || !empresaAtual?.id) return
    setSalvandoAnotacao(true)
    const supabase = createClient()
    const { error } = await supabase.from('notificacoes_log').insert({
      empresa_id: empresaAtual.id,
      canal: 'sistema',
      destinatario: cliente.nome,
      assunto: anotacaoTipo,
      mensagem: anotacaoConteudo.trim(),
      referencia_tipo: 'cliente',
      referencia_id: id,
      status: 'enviado',
    })

    if (error) {
      toast.error('Erro ao salvar anotação.')
    } else {
      toast.success('Anotação adicionada.')
      setAnotacaoConteudo('')
      setAnotacaoTipo('nota')
      setAnotacaoOpen(false)
      loadData()
    }
    setSalvandoAnotacao(false)
  }

  async function adicionarReferencia() {
    if (!novaRef.nome.trim()) return
    setSalvandoRef(true)
    const supabase = createClient()
    const { error } = await supabase.from('referencias_cliente_factoring').insert({
      cliente_id: id,
      nome: novaRef.nome.trim(),
      parentesco: novaRef.parentesco || null,
      telefone: novaRef.telefone || null,
      observacoes: novaRef.observacoes || null,
    })

    if (error) {
      toast.error('Erro ao adicionar referência.')
    } else {
      toast.success('Referência adicionada.')
      setNovaRef({ nome: '', parentesco: '', telefone: '', observacoes: '' })
      setNovaRefOpen(false)
      loadData()
    }
    setSalvandoRef(false)
  }

  async function salvarEdicaoRef(refId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('referencias_cliente_factoring')
      .update(editRefData)
      .eq('id', refId)

    if (error) {
      toast.error('Erro ao atualizar referência.')
    } else {
      toast.success('Referência atualizada.')
      setEditRefId(null)
      setEditRefData({})
      loadData()
    }
  }

  async function deletarReferencia(refId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('referencias_cliente_factoring')
      .delete()
      .eq('id', refId)

    if (error) {
      toast.error('Erro ao excluir referência.')
    } else {
      toast.success('Referência excluída.')
      setDeletandoRefId(null)
      setReferencias(prev => prev.filter(r => r.id !== refId))
    }
  }

  function toggleExpanded(empId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(empId)) next.delete(empId)
      else next.add(empId)
      return next
    })
  }

  async function handleGerarContratoPerfil(emp: Emprestimo) {
    if (!cliente) return
    setGerandoContratoId(emp.id)
    try {
      const empParcelas = parcelas.filter(p => p.emprestimo_id === emp.id)
      await gerarContratoPDF({
        contrato: emp,
        cliente,
        parcelas: empParcelas,
        empresaNome: empresaAtual?.nome,
      })
    } finally {
      setGerandoContratoId(null)
    }
  }

  // ─── Column definitions ───────────────────────────────────────────────────

  const colsEmprestimos: Column<Emprestimo>[] = [
    {
      key: 'numero_contrato',
      header: 'Contrato',
      render: r => <span className="font-mono text-xs font-semibold text-slate-700">{r.numero_contrato}</span>,
    },
    {
      key: 'valor_principal',
      header: 'Valor',
      render: r => <span className="font-semibold">{formatarMoeda(r.valor_principal)}</span>,
    },
    {
      key: 'parcelas',
      header: 'Parcelas',
      render: r => {
        const pagas = parcelas.filter(p => p.emprestimo_id === r.id && p.status === 'pago').length
        const total = parcelas.filter(p => p.emprestimo_id === r.id).length || r.prazo_meses
        return <span className="text-slate-600">{pagas}/{total}x</span>
      },
    },
    {
      key: 'taxa_juros',
      header: 'Taxa',
      render: r => (
        <span className="text-slate-600">
          {r.taxa_juros}% {r.tipo_taxa === 'anual' ? 'a.a.' : 'a.m.'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'data_liberacao',
      header: 'Liberação',
      render: r => <span className="text-slate-500 text-xs">{formatarData(r.data_liberacao)}</span>,
    },
    {
      key: 'saldo_devedor',
      header: 'Saldo',
      render: r => <span className="font-semibold text-slate-800">{formatarMoeda(r.saldo_devedor)}</span>,
    },
  ]

  const colsParcelas: Column<Parcela>[] = [
    {
      key: 'numero_parcela',
      header: 'Nº',
      render: r => <span className="font-mono text-xs">{r.numero_parcela}/{r.total_parcelas}</span>,
    },
    {
      key: 'contrato',
      header: 'Contrato',
      render: r => {
        const emp = emprestimos.find(e => e.id === r.emprestimo_id)
        return <span className="font-mono text-xs text-slate-600">{emp?.numero_contrato ?? '—'}</span>
      },
    },
    {
      key: 'data_vencimento',
      header: 'Vencimento',
      render: r => (
        <span className={cn('text-xs', r.status === 'atrasado' ? 'text-red-600 font-semibold' : 'text-slate-600')}>
          {formatarData(r.data_vencimento)}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: r => <span className={cn(r.status === 'atrasado' ? 'text-red-600 font-semibold' : '')}>{formatarMoeda(r.valor)}</span>,
    },
    {
      key: 'juros_mora',
      header: 'Juros Mora',
      render: r => <span className="text-slate-500 text-xs">{r.juros_mora ? formatarMoeda(r.juros_mora) : '—'}</span>,
    },
    {
      key: 'multa',
      header: 'Multa',
      render: r => <span className="text-slate-500 text-xs">{r.multa ? formatarMoeda(r.multa) : '—'}</span>,
    },
    {
      key: 'total_devido',
      header: 'Total Devido',
      render: r => {
        const total = (r.valor ?? 0) + (r.juros_mora ?? 0) + (r.multa ?? 0)
        return <span className="font-semibold">{formatarMoeda(total)}</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'dias_atraso',
      header: 'Atraso',
      render: r => r.dias_atraso && r.dias_atraso > 0
        ? <span className="text-red-600 font-semibold text-xs">{r.dias_atraso}d</span>
        : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'acao',
      header: 'Ação',
      render: r => (
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 px-2"
          onClick={e => {
            e.stopPropagation()
            router.push(`/factoring/parcelas/pagamento?cliente=${id}&parcela=${r.id}`)
          }}
        >
          Receber
        </Button>
      ),
    },
  ]

  const colsAtrasos: Column<Parcela>[] = [
    {
      key: 'numero_parcela',
      header: 'Parcela',
      render: r => <span className="font-mono text-xs">{r.numero_parcela}/{r.total_parcelas}</span>,
    },
    {
      key: 'contrato',
      header: 'Contrato',
      render: r => {
        const emp = emprestimos.find(e => e.id === r.emprestimo_id)
        return <span className="font-mono text-xs text-slate-600">{emp?.numero_contrato ?? '—'}</span>
      },
    },
    {
      key: 'dias_atraso',
      header: 'Dias Atraso',
      render: r => (
        <span className="text-red-600 font-bold">{r.dias_atraso ?? 0}d</span>
      ),
    },
    {
      key: 'multa',
      header: 'Multa',
      render: r => <span className="text-orange-600">{formatarMoeda(r.multa ?? 0)}</span>,
    },
    {
      key: 'juros_mora',
      header: 'Juros Mora',
      render: r => <span className="text-orange-600">{formatarMoeda(r.juros_mora ?? 0)}</span>,
    },
    {
      key: 'total_atualizado',
      header: 'Total Atualizado',
      render: r => {
        const total = (r.valor ?? 0) + (r.juros_mora ?? 0) + (r.multa ?? 0)
        return <span className="font-bold text-red-700">{formatarMoeda(total)}</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
  ]

  // ─── Render guards ────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  if (erro || !cliente) {
    return (
      <AppShell empresa="factoring" titulo="Cliente">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-500 text-lg">{erro ?? 'Cliente não encontrado.'}</p>
            <Button className="mt-4" variant="outline" onClick={() => router.back()}>
              Voltar
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const risco = getRiscoBadge(cliente.score_interno)

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <AppShell empresa="factoring" titulo={`Cliente — ${cliente.nome}`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header Card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">

            {/* Avatar + info */}
            <div className="flex items-start gap-5 flex-1">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg"
                style={{ backgroundColor: '#1E5AA8' }}
              >
                {iniciais(cliente.nome)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-800 truncate">{cliente.nome}</h1>
                  <StatusBadge status={cliente.status} />
                  <Badge
                    variant="outline"
                    className={cn('text-xs font-semibold', risco.cls)}
                  >
                    {risco.label}
                  </Badge>
                </div>
                <p className="text-slate-500 mt-1 text-sm">
                  CPF: {formatarCPF(cliente.cpf)}
                  {cliente.telefone && (
                    <span className="ml-4">Tel: {formatarTelefone(cliente.telefone)}</span>
                  )}
                  {cliente.email && (
                    <span className="ml-4">{cliente.email}</span>
                  )}
                </p>
                {cliente.ultima_operacao && (
                  <p className="text-slate-400 text-xs mt-1">
                    Última operação: {formatarData(cliente.ultima_operacao)}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {cliente.telefone && (
                    <a
                      href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
                        <MessageCircle size={15} />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                  <Link href={`/factoring/clientes/${id}/editar`}>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Edit size={15} />
                      Editar
                    </Button>
                  </Link>
                  <Link href={`/factoring/emprestimos/novo?cliente=${id}`}>
                    <Button
                      size="sm"
                      className="gap-2 text-white"
                      style={{ backgroundColor: '#1E5AA8' }}
                    >
                      <Plus size={15} />
                      Novo Empréstimo
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'gap-2',
                      cliente.status === 'bloqueado'
                        ? 'text-green-700 border-green-200 hover:bg-green-50'
                        : 'text-red-600 border-red-200 hover:bg-red-50'
                    )}
                    onClick={() => setBloqueandoOpen(true)}
                  >
                    <Ban size={15} />
                    {cliente.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Score gauge */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <ScoreGauge score={cliente.score_interno ?? 0} size="md" />
              <span className="text-xs text-slate-400 font-medium">Score Interno</span>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Total Emprestado"
            valor={formatarMoeda(cliente.valor_total_emprestado)}
            icone={DollarSign}
            corIcone="#1E5AA8"
            corFundo="#EFF6FF"
          />
          <StatCard
            titulo="Total Pago"
            valor={formatarMoeda(totalPago)}
            icone={CreditCard}
            corIcone="#16a34a"
            corFundo="#f0fdf4"
          />
          <StatCard
            titulo="Em Aberto"
            valor={formatarMoeda(emAberto)}
            icone={Clock}
            corIcone="#d97706"
            corFundo="#fffbeb"
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(emAtraso)}
            icone={AlertTriangle}
            corIcone="#dc2626"
            corFundo="#fef2f2"
          />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs defaultValue="emprestimos">
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="emprestimos" className="text-sm px-4 py-2 rounded-lg">
              Títulos
              {emprestimos.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-xs h-4 min-w-4 rounded-full p-0 px-1 flex items-center justify-center">
                  {emprestimos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="text-sm px-4 py-2 rounded-lg">
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="dados" className="text-sm px-4 py-2 rounded-lg">
              Dados
            </TabsTrigger>
            <TabsTrigger value="anotacoes" className="text-sm px-4 py-2 rounded-lg">
              Anotações
            </TabsTrigger>
            <TabsTrigger value="score" className="text-sm px-4 py-2 rounded-lg">
              Score e Risco
            </TabsTrigger>
          </TabsList>

          {/* TAB 1 — Títulos */}
          <TabsContent value="emprestimos" className="mt-4">
            <div className="space-y-3">
              {emprestimos.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                  <FileText size={40} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400">Nenhum título encontrado.</p>
                  <Link href={`/factoring/emprestimos/novo?cliente=${id}`}>
                    <Button size="sm" className="mt-4 text-white gap-2" style={{ backgroundColor: '#1E5AA8' }}>
                      <Plus size={14} /> Novo Empréstimo
                    </Button>
                  </Link>
                </div>
              ) : (
                emprestimos.map(emp => {
                  const empParcelas = parcelas.filter(p => p.emprestimo_id === emp.id)
                  const pagas = empParcelas.filter(p => p.status === 'pago').length
                  const total = empParcelas.length || emp.prazo_meses
                  const emAtrasoEmp = empParcelas.filter(p => p.status === 'atrasado').length
                  const isExpanded = expandedIds.has(emp.id)
                  const progress = total > 0 ? Math.round((pagas / total) * 100) : 0
                  const statusColor = emp.status === 'quitado' ? '#16a34a'
                    : emp.status === 'inadimplente' ? '#dc2626'
                    : emp.status === 'cancelado' ? '#6b7280'
                    : emp.status === 'renegociado' ? '#d97706'
                    : '#1E5AA8'

                  return (
                    <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Card header */}
                      <div className="flex items-stretch">
                        <div className="w-1.5 shrink-0" style={{ backgroundColor: statusColor }} />
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-bold text-slate-700">{emp.numero_contrato}</span>
                                <StatusBadge status={emp.status} />
                                {emAtrasoEmp > 0 && (
                                  <Badge className="text-xs bg-red-100 text-red-700 border border-red-200 gap-1 flex items-center">
                                    <AlertTriangle size={10} />
                                    {emAtrasoEmp} em atraso
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-1.5 flex items-center gap-3 flex-wrap text-sm">
                                <span className="font-semibold text-slate-800">{formatarMoeda(emp.valor_principal)}</span>
                                {emp.data_liberacao && (
                                  <span className="text-xs text-slate-400">Lib: {formatarData(emp.data_liberacao)}</span>
                                )}
                                <span className="text-xs text-slate-500">
                                  {pagas}/{total} parcelas · {emp.taxa_juros}% {emp.tipo_taxa === 'anual' ? 'a.a.' : 'a.m.'}
                                </span>
                              </div>

                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${progress}%`, backgroundColor: statusColor }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-400 shrink-0">{progress}%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs h-8"
                                disabled={gerandoContratoId === emp.id}
                                onClick={() => handleGerarContratoPerfil(emp)}
                              >
                                <Download size={12} />
                                {gerandoContratoId === emp.id ? 'Gerando...' : 'Contrato'}
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs h-8 text-white"
                                style={{ backgroundColor: '#1E5AA8' }}
                                onClick={() => router.push(`/factoring/parcelas/pagamento?cliente=${id}&emprestimo=${emp.id}`)}
                              >
                                <DollarSign size={12} />
                                Receber
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => toggleExpanded(emp.id)}
                                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                              >
                                <ChevronDown
                                  size={16}
                                  className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
                                />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                          {/* Mini stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg p-3 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">Capital</p>
                              <p className="font-bold text-slate-800 text-sm">{formatarMoeda(emp.valor_principal)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">Taxa</p>
                              <p className="font-bold text-slate-800 text-sm">{emp.taxa_juros}% {emp.tipo_taxa === 'anual' ? 'a.a.' : 'a.m.'}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">Valor Parcela</p>
                              <p className="font-bold text-slate-800 text-sm">{formatarMoeda(emp.valor_parcela)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-100">
                              <p className="text-xs text-slate-400 mb-0.5">Saldo Devedor</p>
                              <p className="font-bold text-slate-800 text-sm">{formatarMoeda(emp.saldo_devedor)}</p>
                            </div>
                          </div>

                          {/* Parcelas table */}
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Histórico de Parcelas</p>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-500">
                                    <th className="px-3 py-2 text-left font-medium">Nº</th>
                                    <th className="px-3 py-2 text-left font-medium">Vencimento</th>
                                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                                    <th className="px-3 py-2 text-right font-medium">Pago</th>
                                    <th className="px-3 py-2 text-left font-medium">Pago em</th>
                                    <th className="px-3 py-2 text-left font-medium">Status</th>
                                    <th className="px-3 py-2 text-center font-medium">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {empParcelas.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                                        Nenhuma parcela gerada.
                                      </td>
                                    </tr>
                                  ) : empParcelas.map(p => (
                                    <tr
                                      key={p.id}
                                      className={cn(
                                        'bg-white',
                                        p.status === 'atrasado' && 'bg-red-50',
                                        p.status === 'pago' && 'bg-green-50/50',
                                      )}
                                    >
                                      <td className="px-3 py-2 font-mono text-slate-600">{p.numero_parcela}</td>
                                      <td className={cn('px-3 py-2', p.status === 'atrasado' && 'text-red-600 font-semibold')}>
                                        {formatarData(p.data_vencimento)}
                                        {(p.dias_atraso ?? 0) > 0 && (
                                          <span className="text-red-500 ml-1">({p.dias_atraso}d)</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">{formatarMoeda(p.valor)}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">
                                        {p.valor_pago ? formatarMoeda(p.valor_pago) : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-slate-400">
                                        {p.data_pagamento ? formatarData(p.data_pagamento) : '—'}
                                      </td>
                                      <td className="px-3 py-2">
                                        <StatusBadge status={p.status} />
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {p.status !== 'pago' && p.status !== 'cancelado' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-6 px-2"
                                            onClick={() => router.push(`/factoring/parcelas/pagamento?cliente=${id}&parcela=${p.id}`)}
                                          >
                                            Receber
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Link
                              href={`/factoring/emprestimos/${emp.id}`}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Ver detalhes completos →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>

          {/* TAB 2 — Pagamentos */}
          <TabsContent value="pagamentos" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              {pagamentos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Nenhum pagamento registrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pagamentos.map(pag => (
                    <div key={pag.id} className="py-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CreditCard size={18} className="text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800">
                            {formatarMoeda(pag.valor)}
                          </p>
                          <span className="text-xs text-slate-400">
                            {formatarData(pag.data_movimentacao)}
                          </span>
                        </div>
                        {pag.descricao && (
                          <p className="text-sm text-slate-600 mt-0.5">{pag.descricao}</p>
                        )}
                        {pag.categoria && (
                          <Badge variant="outline" className="mt-1.5 text-xs">
                            {pag.categoria}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3 — Dados */}
          <TabsContent value="dados" className="mt-4">
            <div className="space-y-6">

              {/* Dados Pessoais */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <User size={18} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Dados Pessoais</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Nome Completo">
                    <Input
                      value={formData.nome ?? ''}
                      onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="CPF">
                    <Input
                      value={formData.cpf ?? ''}
                      onChange={e => setFormData(p => ({ ...p, cpf: e.target.value }))}
                      placeholder="000.000.000-00"
                    />
                  </FormField>
                  <FormField label="RG">
                    <Input
                      value={formData.rg ?? ''}
                      onChange={e => setFormData(p => ({ ...p, rg: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Órgão Emissor">
                    <Input
                      value={formData.orgao_emissor ?? ''}
                      onChange={e => setFormData(p => ({ ...p, orgao_emissor: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Data Nascimento">
                    <Input
                      type="date"
                      value={formData.data_nascimento?.slice(0, 10) ?? ''}
                      onChange={e => setFormData(p => ({ ...p, data_nascimento: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Estado Civil">
                    <Select
                      value={formData.estado_civil ?? ''}
                      onValueChange={v => setFormData(p => ({ ...p, estado_civil: v ?? '' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="uniao_estavel">União Estável</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Profissão">
                    <Input
                      value={formData.profissao ?? ''}
                      onChange={e => setFormData(p => ({ ...p, profissao: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Renda Mensal (R$)">
                    <Input
                      type="number"
                      value={formData.renda_mensal ?? ''}
                      onChange={e => setFormData(p => ({ ...p, renda_mensal: parseFloat(e.target.value) || null }))}
                    />
                  </FormField>
                  <FormField label="Telefone">
                    <Input
                      value={formData.telefone ?? ''}
                      onChange={e => setFormData(p => ({ ...p, telefone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </FormField>
                  <FormField label="Telefone 2">
                    <Input
                      value={formData.telefone2 ?? ''}
                      onChange={e => setFormData(p => ({ ...p, telefone2: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </FormField>
                  <FormField label="E-mail">
                    <Input
                      type="email"
                      value={formData.email ?? ''}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    />
                  </FormField>
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <MapPin size={18} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Endereço</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="CEP">
                    <div className="flex gap-2 items-center">
                      <Input
                        value={formData.cep ?? ''}
                        onChange={e => setFormData(p => ({ ...p, cep: e.target.value }))}
                        placeholder="00000-000"
                        className="flex-1"
                        onBlur={e => buscarCep(e.target.value)}
                      />
                      {cepLoading && (
                        <span className="text-xs text-slate-400 whitespace-nowrap">Buscando...</span>
                      )}
                    </div>
                  </FormField>
                  <FormField label="Endereço" className="sm:col-span-2">
                    <Input
                      value={formData.endereco ?? ''}
                      onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Número">
                    <Input
                      value={formData.numero ?? ''}
                      onChange={e => setFormData(p => ({ ...p, numero: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Complemento">
                    <Input
                      value={formData.complemento ?? ''}
                      onChange={e => setFormData(p => ({ ...p, complemento: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Bairro">
                    <Input
                      value={formData.bairro ?? ''}
                      onChange={e => setFormData(p => ({ ...p, bairro: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Cidade">
                    <Input
                      value={formData.cidade ?? ''}
                      onChange={e => setFormData(p => ({ ...p, cidade: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Estado (UF)">
                    <Input
                      value={formData.estado ?? ''}
                      onChange={e => setFormData(p => ({ ...p, estado: e.target.value }))}
                      maxLength={2}
                      placeholder="UF"
                    />
                  </FormField>
                </div>
              </div>

              {/* Dados Bancários */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Banknote size={18} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Dados Bancários</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Banco">
                    <Input
                      value={formData.banco ?? ''}
                      onChange={e => setFormData(p => ({ ...p, banco: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Agência">
                    <Input
                      value={formData.agencia ?? ''}
                      onChange={e => setFormData(p => ({ ...p, agencia: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Conta">
                    <Input
                      value={formData.conta ?? ''}
                      onChange={e => setFormData(p => ({ ...p, conta: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Tipo de Conta">
                    <Select
                      value={formData.tipo_conta ?? ''}
                      onValueChange={v => setFormData(p => ({ ...p, tipo_conta: v ?? '' }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                        <SelectItem value="salario">Salário</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="PIX">
                    <Input
                      value={formData.pix ?? ''}
                      onChange={e => setFormData(p => ({ ...p, pix: e.target.value }))}
                      placeholder="CPF, e-mail, telefone ou chave"
                    />
                  </FormField>
                  <FormField label="Limite de Crédito (R$)">
                    <Input
                      type="number"
                      value={formData.limite_credito ?? ''}
                      onChange={e => setFormData(p => ({ ...p, limite_credito: parseFloat(e.target.value) || null }))}
                    />
                  </FormField>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <FormField label="Observações">
                  <Textarea
                    value={formData.observacoes ?? ''}
                    onChange={e => setFormData(p => ({ ...p, observacoes: e.target.value }))}
                    rows={4}
                    className="resize-none"
                  />
                </FormField>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  onClick={salvarDados}
                  disabled={salvandoDados}
                  className="text-white px-8"
                  style={{ backgroundColor: '#1E5AA8' }}
                >
                  {salvandoDados ? 'Salvando...' : 'Salvar Dados'}
                </Button>
              </div>

              {/* ── Referências ─────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-slate-500" />
                    <h3 className="font-semibold text-slate-700">Referências</h3>
                    <Badge variant="outline" className="text-xs ml-1">{referencias.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setNovaRefOpen(true)}
                  >
                    <Plus size={14} />
                    Nova Referência
                  </Button>
                </div>

                {referencias.length === 0 && !novaRefOpen ? (
                  <p className="text-slate-400 text-sm text-center py-6">
                    Nenhuma referência cadastrada.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {referencias.map(ref => (
                      <div key={ref.id} className="border border-slate-200 rounded-lg p-4">
                        {editRefId === ref.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Nome">
                                <Input
                                  value={editRefData.nome ?? ref.nome}
                                  onChange={e => setEditRefData(p => ({ ...p, nome: e.target.value }))}
                                />
                              </FormField>
                              <FormField label="Parentesco">
                                <Input
                                  value={editRefData.parentesco ?? ref.parentesco ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, parentesco: e.target.value }))}
                                />
                              </FormField>
                              <FormField label="Telefone">
                                <Input
                                  value={editRefData.telefone ?? ref.telefone ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, telefone: e.target.value }))}
                                />
                              </FormField>
                              <FormField label="Observações">
                                <Input
                                  value={editRefData.observacoes ?? ref.observacoes ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, observacoes: e.target.value }))}
                                />
                              </FormField>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => salvarEdicaoRef(ref.id)} className="gap-1">
                                <Check size={13} /> Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditRefId(null); setEditRefData({}) }}
                                className="gap-1"
                              >
                                <X size={13} /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-800">{ref.nome}</p>
                                {ref.parentesco && (
                                  <Badge variant="outline" className="text-xs">{ref.parentesco}</Badge>
                                )}
                              </div>
                              {ref.telefone && (
                                <p className="text-sm text-slate-500 mt-0.5">{formatarTelefone(ref.telefone)}</p>
                              )}
                              {ref.observacoes && (
                                <p className="text-xs text-slate-400 mt-1">{ref.observacoes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => { setEditRefId(ref.id); setEditRefData({}) }}
                              >
                                <Edit size={13} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletandoRefId(ref.id)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Nova referência inline form */}
                {novaRefOpen && (
                  <div className="mt-4 border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Nova Referência</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nome *">
                        <Input
                          value={novaRef.nome}
                          onChange={e => setNovaRef(p => ({ ...p, nome: e.target.value }))}
                          placeholder="Nome completo"
                        />
                      </FormField>
                      <FormField label="Parentesco">
                        <Input
                          value={novaRef.parentesco}
                          onChange={e => setNovaRef(p => ({ ...p, parentesco: e.target.value }))}
                          placeholder="Ex: Cônjuge, Filho..."
                        />
                      </FormField>
                      <FormField label="Telefone">
                        <Input
                          value={novaRef.telefone}
                          onChange={e => setNovaRef(p => ({ ...p, telefone: e.target.value }))}
                          placeholder="(00) 00000-0000"
                        />
                      </FormField>
                      <FormField label="Observações">
                        <Input
                          value={novaRef.observacoes}
                          onChange={e => setNovaRef(p => ({ ...p, observacoes: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={adicionarReferencia}
                        disabled={salvandoRef || !novaRef.nome.trim()}
                        className="gap-1"
                      >
                        <Plus size={13} /> {salvandoRef ? 'Salvando...' : 'Adicionar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNovaRefOpen(false)
                          setNovaRef({ nome: '', parentesco: '', telefone: '', observacoes: '' })
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 6 — Anotações */}
          <TabsContent value="anotacoes" className="mt-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-slate-500" />
                  <h3 className="font-semibold text-slate-700">Histórico de Anotações</h3>
                  <Badge variant="outline" className="text-xs ml-1">{anotacoes.length}</Badge>
                </div>
                <Button
                  size="sm"
                  className="gap-2 text-white"
                  style={{ backgroundColor: '#1E5AA8' }}
                  onClick={() => setAnotacaoOpen(true)}
                >
                  <Plus size={14} />
                  Nova Anotação
                </Button>
              </div>

              {anotacoes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Nenhuma anotação registrada.</p>
                  <p className="text-xs mt-1">Registre ligações, visitas ou observações importantes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anotacoes.map(anotacao => (
                    <div
                      key={anotacao.id}
                      className={cn(
                        'border-l-4 pl-4 py-3 pr-3 rounded-r-lg bg-slate-50 border border-slate-200',
                        anotacaoBorderColor(anotacao.assunto)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 mt-0.5" role="img" aria-label={anotacao.assunto ?? 'nota'}>
                          {anotacaoIcon(anotacao.assunto)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              {anotacao.assunto ?? 'nota'}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatarData(anotacao.created_at)}
                            </span>
                            {anotacao.status && (
                              <Badge variant="outline" className="text-xs py-0 h-4">
                                {anotacao.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                            {anotacao.mensagem}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 7 — Score e Risco */}
          <TabsContent value="score" className="mt-4">
            <div className="space-y-4">
              {/* Score principal */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <ScoreGauge score={resultadoScore.score} size="lg" showLabel showDescription animated />
                  </div>
                  <div className="flex-1 space-y-4">
                    {/* Recommendation */}
                    <div
                      className="rounded-xl p-4 border"
                      style={{
                        backgroundColor:
                          resultadoScore.recomendacao === 'aprovar' ? '#f0fdf4' :
                          resultadoScore.recomendacao === 'analisar' ? '#fffbeb' : '#fef2f2',
                        borderColor:
                          resultadoScore.recomendacao === 'aprovar' ? '#bbf7d0' :
                          resultadoScore.recomendacao === 'analisar' ? '#fde68a' : '#fecaca',
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                        style={{ color: resultadoScore.recomendacao === 'aprovar' ? '#15803d' : resultadoScore.recomendacao === 'analisar' ? '#b45309' : '#b91c1c' }}>
                        Recomendação
                      </p>
                      <p className="font-bold text-slate-800 text-lg capitalize">{resultadoScore.recomendacao}</p>
                      {resultadoScore.faixa && (
                        <p className="text-sm text-slate-500 mt-1">{resultadoScore.faixa.nome}</p>
                      )}
                    </div>
                    {/* Limit & rate */}
                    <div className="grid grid-cols-2 gap-4">
                      {resultadoScore.limiteSugerido != null && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-0.5">Limite Sugerido</p>
                          <p className="font-bold text-slate-800 text-base">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultadoScore.limiteSugerido)}
                          </p>
                        </div>
                      )}
                      {resultadoScore.taxaSugerida != null && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-0.5">Taxa Sugerida</p>
                          <p className="font-bold text-slate-800 text-base">{resultadoScore.taxaSugerida.toFixed(2)}% a.m.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fatores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Positivos */}
                <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5">
                  <p className="text-sm font-semibold text-green-700 mb-3">Fatores Positivos</p>
                  <div className="space-y-2">
                    {resultadoScore.fatores.filter(f => f.tipo === 'positivo' && f.pontos !== 0).length === 0 && (
                      <p className="text-sm text-slate-400 italic">Nenhum fator positivo identificado.</p>
                    )}
                    {resultadoScore.fatores.filter(f => f.tipo === 'positivo' && f.pontos !== 0).map(f => (
                      <div key={f.id} className="flex items-start gap-2">
                        <span className="text-green-500 font-bold mt-0.5 shrink-0">+{f.pontos.toFixed(0)}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{f.label}</p>
                          <p className="text-xs text-slate-400">{f.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Negativos */}
                <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
                  <p className="text-sm font-semibold text-red-600 mb-3">Fatores Negativos</p>
                  <div className="space-y-2">
                    {resultadoScore.fatores.filter(f => f.tipo === 'negativo' && f.pontos !== 0).length === 0 && (
                      <p className="text-sm text-slate-400 italic">Nenhum fator negativo identificado.</p>
                    )}
                    {resultadoScore.fatores.filter(f => f.tipo === 'negativo' && f.pontos !== 0).map(f => (
                      <div key={f.id} className="flex items-start gap-2">
                        <span className="text-red-500 font-bold mt-0.5 shrink-0">{f.pontos.toFixed(0)}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{f.label}</p>
                          <p className="text-xs text-slate-400">{f.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────── */}

      {/* Bloquear/Desbloquear */}
      <ConfirmDialog
        open={bloqueandoOpen}
        onOpenChange={setBloqueandoOpen}
        titulo={cliente.status === 'bloqueado' ? 'Desbloquear cliente?' : 'Bloquear cliente?'}
        descricao={
          cliente.status === 'bloqueado'
            ? `${cliente.nome} voltará a ter status ativo.`
            : `${cliente.nome} ficará impedido de novas operações.`
        }
        labelConfirmar={cliente.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
        variante={cliente.status === 'bloqueado' ? 'default' : 'danger'}
        onConfirmar={bloquearCliente}
        carregando={bloqueandoLoading}
      />

      {/* Deletar referência */}
      <ConfirmDialog
        open={!!deletandoRefId}
        onOpenChange={open => { if (!open) setDeletandoRefId(null) }}
        titulo="Excluir referência?"
        descricao="Esta ação não pode ser desfeita."
        labelConfirmar="Excluir"
        variante="danger"
        onConfirmar={() => { if (deletandoRefId) deletarReferencia(deletandoRefId) }}
      />

      {/* Nova Anotação */}
      <Dialog open={anotacaoOpen} onOpenChange={setAnotacaoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Anotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Tipo">
              <Select
                value={anotacaoTipo}
                onValueChange={v => setAnotacaoTipo(v ?? 'nota')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota">📝 Nota</SelectItem>
                  <SelectItem value="ligacao">📞 Ligação</SelectItem>
                  <SelectItem value="visita">🏠 Visita</SelectItem>
                  <SelectItem value="negociacao">🤝 Negociação</SelectItem>
                  <SelectItem value="alerta">⚠️ Alerta</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Conteúdo *">
              <Textarea
                value={anotacaoConteudo}
                onChange={e => setAnotacaoConteudo(e.target.value)}
                placeholder="Descreva a anotação..."
                rows={5}
                className="resize-none"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnotacaoOpen(false)}
              disabled={salvandoAnotacao}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarAnotacao}
              disabled={salvandoAnotacao || !anotacaoConteudo.trim()}
              className="text-white"
              style={{ backgroundColor: '#1E5AA8' }}
            >
              {salvandoAnotacao ? 'Salvando...' : 'Salvar Anotação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
