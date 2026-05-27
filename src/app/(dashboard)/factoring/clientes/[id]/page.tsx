'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  MessageCircle, Edit, Plus, Ban, DollarSign, CreditCard,
  AlertTriangle, Clock, MessageSquare, Trash2, Check, X,
  User, Users, MapPin, Banknote, Download, ChevronDown, FileText,
  History, TrendingUp, CheckCircle, ArrowUpRight, Camera, Home,
  Paperclip, Eye, Upload, Search, Loader2,
} from 'lucide-react'

import { gerarContratoPDF } from '@/lib/utils/documentos'
import { buscarEnderecoPorCep } from '@/lib/utils/cep'
import {
  CATEGORIAS_DOCUMENTO, uploadDocumentoCliente, deletarDocumentoCliente,
  formatarTamanho, ehImagem, type DocumentoMeta,
} from '@/lib/utils/storage'

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
import { parseSupabaseError, logError } from '@/lib/utils/errors'

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
  if (s >= 70) return { label: 'Baixo Risco', cls: 'bg-[#E6F4EA] text-[#137333] border-[#34A853]/20' }
  if (s >= 50) return { label: 'Risco Médio', cls: 'bg-[#FEF7E0] text-[#B06000] border-[#FBBC04]/20' }
  if (s >= 30) return { label: 'Alto Risco', cls: 'bg-[#FEF0E1] text-[#C26400] border-[#FA903E]/20' }
  return { label: 'Risco Crítico', cls: 'bg-[#FCE8E6] text-[#C5221F] border-[#EA4335]/20' }
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
    case 'nota': return 'border-l-[#1A73E8]'
    case 'ligacao': return 'border-l-[#34A853]'
    case 'visita': return 'border-l-[#A142F4]'
    case 'negociacao': return 'border-l-[#FA903E]'
    case 'alerta': return 'border-l-[#EA4335]'
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
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
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

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>('historico')

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

  // Documentos
  const [documentos, setDocumentos] = useState<DocumentoMeta[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [deletandoDocId, setDeletandoDocId] = useState<string | null>(null)
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
      setReferencias((referenciasData ?? []) as ReferenciaCliente[])
      setAnotacoes((anotacoesData ?? []) as Anotacao[])
      setDocumentos((clienteData?.documentos ?? []) as DocumentoMeta[])

      // Load payments using emprestimo IDs (stored with referencia_tipo: 'emprestimo')
      const empIds = (emprestimosData ?? []).map(e => e.id)
      if (empIds.length > 0) {
        const { data: pagamentosData } = await supabase
          .from('movimentacoes_caixa')
          .select('*')
          .in('referencia_id', empIds)
          .eq('referencia_tipo', 'emprestimo')
          .eq('tipo', 'entrada')
          .eq('empresa_id', empresaAtual.id)
          .order('data_movimentacao', { ascending: false })
        setPagamentos((pagamentosData ?? []) as Movimentacao[])
      } else {
        setPagamentos([])
      }
    } catch (err) {
      logError('loadData:cliente', err)
      setErro('Erro ao carregar dados do cliente.')
    } finally {
      setLoading(false)
    }
  }, [id, empresaAtual?.id])

  useEffect(() => { loadData() }, [loadData])

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalPago = parcelas
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + (p.valor_pago ?? p.valor ?? 0), 0)

  const emAberto = parcelas
    .filter(p => p.status === 'pendente' || p.status === 'atrasado')
    .reduce((s, p) => s + ((p.valor ?? 0) + (p.juros_mora ?? 0) + (p.multa ?? 0) - (p.valor_pago ?? 0)), 0)

  const emAtraso = parcelas
    .filter(p => p.status === 'atrasado')
    .reduce((s, p) => s + ((p.valor ?? 0) + (p.juros_mora ?? 0) + (p.multa ?? 0) - (p.valor_pago ?? 0)), 0)

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
    volume_total_pago:        totalPago,
  }

  const resultadoScore = calcularScore(
    dadosScore,
    REGRAS_SCORE_PADRAO,
    FAIXAS_RISCO_PADRAO,
    cliente?.limite_credito ?? undefined,
  )

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function bloquearCliente() {
    if (!cliente || !empresaAtual) return
    setBloqueandoLoading(true)
    const supabase = createClient()
    const novoStatus = cliente.status === 'bloqueado' ? 'ativo' : 'bloqueado'
    const { error } = await supabase
      .from('clientes_factoring')
      .update({ status: novoStatus })
      .eq('id', id)
      .eq('empresa_id', empresaAtual.id)

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
    if (!cliente || !empresaAtual) return
    setSalvandoDados(true)
    const supabase = createClient()
    const payload = {
      nome: formData.nome,
      cpf: formData.cpf ?? null,
      rg: formData.rg ?? null,
      orgao_emissor: formData.orgao_emissor ?? null,
      data_nascimento: formData.data_nascimento ?? null,
      estado_civil: formData.estado_civil ?? null,
      profissao: formData.profissao ?? null,
      renda_mensal: formData.renda_mensal ?? null,
      telefone: formData.telefone ?? null,
      telefone2: formData.telefone2 ?? null,
      email: formData.email ?? null,
      endereco: formData.endereco ?? null,
      numero: formData.numero ?? null,
      complemento: formData.complemento ?? null,
      bairro: formData.bairro ?? null,
      cidade: formData.cidade ?? null,
      estado: formData.estado ?? null,
      cep: formData.cep ?? null,
      banco: formData.banco ?? null,
      agencia: formData.agencia ?? null,
      conta: formData.conta ?? null,
      tipo_conta: formData.tipo_conta ?? null,
      pix: formData.pix ?? null,
      limite_credito: formData.limite_credito ?? null,
      observacoes: formData.observacoes ?? null,
    }
    const { error } = await supabase
      .from('clientes_factoring')
      .update(payload)
      .eq('id', id)
      .eq('empresa_id', empresaAtual.id)

    if (error) {
      logError('salvarDados:cliente', error)
      toast.error(parseSupabaseError(error, 'Erro ao salvar dados'))
    } else {
      toast.success('Dados salvos com sucesso.')
      setCliente(prev => prev ? { ...prev, ...payload } as ClienteFactoring : prev)
    }
    setSalvandoDados(false)
  }

  async function buscarCep(cepValor: string) {
    const cleaned = cepValor.replace(/\D/g, '')
    if (cleaned.length !== 8) return
    setCepLoading(true)
    try {
      const end = await buscarEnderecoPorCep(cleaned)
      setFormData(prev => ({
        ...prev,
        endereco: end.logradouro || prev.endereco,
        bairro:   end.bairro    || prev.bairro,
        cidade:   end.cidade    || prev.cidade,
        estado:   end.estado    || prev.estado,
      }))
      toast.success(`Endereço preenchido — ${end.cidade}/${end.estado}`)
    } catch (err) {
      logError('buscarCep:perfil', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar CEP')
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
      .eq('cliente_id', id)

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
      .eq('cliente_id', id)

    if (error) {
      toast.error('Erro ao excluir referência.')
    } else {
      toast.success('Referência excluída.')
      setDeletandoRefId(null)
      setReferencias(prev => prev.filter(r => r.id !== refId))
    }
  }

  async function fazerUploadDocumento(categoriaId: string, file: File) {
    if (!cliente || !empresaAtual) return
    setUploadingDoc(categoriaId)
    const supabase = createClient()
    try {
      const meta = await uploadDocumentoCliente(supabase, empresaAtual.id, cliente.id, categoriaId, file)
      const novos = [...documentos.filter(d => d.categoria !== categoriaId), meta]
      const { error: updateError } = await supabase.from('clientes_factoring').update({ documentos: novos }).eq('id', cliente.id).eq('empresa_id', empresaAtual.id)
      if (updateError) throw updateError
      setDocumentos(novos)
      toast.success(`${meta.label} enviado com sucesso!`)
    } catch (err) {
      logError('fazerUploadDocumento', err)
      toast.error(parseSupabaseError(err, 'Erro ao enviar documento'))
    } finally {
      setUploadingDoc(null)
    }
  }

  async function deletarDocumento(doc: DocumentoMeta) {
    if (!cliente || !empresaAtual) return
    setDeletandoDocId(doc.id)
    const supabase = createClient()
    try {
      await deletarDocumentoCliente(supabase, doc.path)
      const novos = documentos.filter(d => d.id !== doc.id)
      const { error: updateError } = await supabase.from('clientes_factoring').update({ documentos: novos }).eq('id', cliente.id).eq('empresa_id', empresaAtual.id)
      if (updateError) throw updateError
      setDocumentos(novos)
      toast.success('Documento removido.')
    } catch (err) {
      logError('deletarDocumento', err)
      toast.error('Erro ao remover documento')
    } finally {
      setDeletandoDocId(null)
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

  // ─── Render guards ────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  if (erro || !cliente) {
    return (
      <AppShell empresa="factoring" titulo="Cliente">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground text-lg font-semibold">{erro ?? 'Cliente não encontrado.'}</p>
            <Button className="mt-4 rounded-full" variant="outline" onClick={() => router.back()}>
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
        <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1A73E8]" />
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 pt-1">

            {/* Avatar + info */}
            <div className="flex flex-col sm:flex-row items-start gap-5 flex-1">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-m3-2 select-none"
                style={{ backgroundColor: '#1A73E8' }}
              >
                {iniciais(cliente.nome)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{cliente.nome}</h1>
                  <StatusBadge status={cliente.status} />
                  <Badge
                    variant="outline"
                    className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full border', risco.cls)}
                  >
                    {risco.label}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1.5 text-sm font-medium flex items-center gap-4 flex-wrap">
                  <span>CPF: {formatarCPF(cliente.cpf ?? '')}</span>
                  {cliente.telefone && (
                    <span className="flex items-center gap-1">Tel: {formatarTelefone(cliente.telefone)}</span>
                  )}
                  {cliente.email && (
                    <span className="flex items-center gap-1">{cliente.email}</span>
                  )}
                </p>
                {cliente.ultima_operacao && (
                  <p className="text-muted-foreground/60 text-xs mt-1 font-medium">
                    Última operação: {formatarData(cliente.ultima_operacao)}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {cliente.telefone && (
                    <a
                      href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5 rounded-full text-[#34A853] border-[#34A853]/20 hover:bg-[#E6F4EA] font-semibold h-9 px-4">
                        <MessageCircle size={15} />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full font-semibold h-9 px-4 active:scale-95 transition-all duration-150"
                    onClick={() => setActiveTab('dados')}
                  >
                    <Edit size={15} className="text-muted-foreground" />
                    Editar Ficha
                  </Button>
                  <Link href={`/factoring/emprestimos/novo?cliente_id=${id}`}>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-full text-white bg-[#1A73E8] hover:bg-[#1557B0] font-semibold h-9 px-4 shadow-sm"
                    >
                      <Plus size={15} />
                      Novo Empréstimo
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'gap-1.5 rounded-full font-semibold h-9 px-4',
                      cliente.status === 'bloqueado'
                        ? 'text-[#34A853] border-[#34A853]/20 hover:bg-[#E6F4EA]'
                        : 'text-[#EA4335] border-[#EA4335]/20 hover:bg-[#FCE8E6]'
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
            <div className="flex flex-col items-center gap-1.5 shrink-0 bg-muted/20 border border-border/40 rounded-2xl p-4 shadow-sm">
              <ScoreGauge score={cliente.score_interno ?? 0} size="md" />
              <span className="text-xs text-muted-foreground/80 font-bold uppercase tracking-wider">Score Interno</span>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Total Emprestado"
            valor={formatarMoeda(cliente.valor_total_emprestado)}
            icone={DollarSign}
            corIcone="#1A73E8"
            corFundo="#E8F0FE"
          />
          <StatCard
            titulo="Total Recebido"
            valor={formatarMoeda(totalPago)}
            icone={CreditCard}
            corIcone="#34A853"
            corFundo="#E6F4EA"
          />
          <StatCard
            titulo="Em Aberto"
            valor={formatarMoeda(emAberto)}
            icone={Clock}
            corIcone="#FBBC04"
            corFundo="#FEF7E0"
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(emAtraso)}
            icone={AlertTriangle}
            corIcone="#EA4335"
            corFundo="#FCE8E6"
          />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-start h-auto flex-wrap gap-1.5 bg-muted/50 p-1.5 rounded-full border border-border/30">
            <TabsTrigger value="historico" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              <History size={13} />
              Linha do Tempo
            </TabsTrigger>
            <TabsTrigger value="emprestimos" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              Títulos Ativos
              {emprestimos.length > 0 && (
                <Badge variant="outline" className="ml-0.5 text-[10px] font-bold h-5 min-w-5 rounded-full p-0 flex items-center justify-center bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]/20">
                  {emprestimos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              Recibos
            </TabsTrigger>
            <TabsTrigger value="dados" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              Dados Cadastrais
            </TabsTrigger>
            <TabsTrigger value="anotacoes" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              Anotações
            </TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              <FileText size={13} />
              Documentos
              {documentos.length > 0 && (
                <Badge variant="outline" className="ml-0.5 text-[10px] font-bold h-5 min-w-5 rounded-full p-0 flex items-center justify-center bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]/20">
                  {documentos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="score" className="text-xs font-semibold px-4 py-2 rounded-full gap-1.5 data-[state=active]:bg-card data-[state=active]:text-[#1A73E8] data-[state=active]:shadow-sm">
              Risco & Score
            </TabsTrigger>
          </TabsList>

          {/* TAB 0 — Histórico unificado */}
          <TabsContent value="historico" className="outline-none">
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 space-y-5">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2 pb-3 border-b border-border/60">
                <History size={18} className="text-muted-foreground" />
                Linha do Tempo
              </h3>
              {(() => {
                type EventoTimeline = {
                  id: string
                  data: string
                  tipo: 'emprestimo' | 'pagamento' | 'anotacao'
                  titulo: string
                  subtitulo: string
                  valor?: number
                  cor: string
                }
                const eventos: EventoTimeline[] = [
                  ...emprestimos.map(e => ({
                    id: `emp-${e.id}`,
                    data: e.data_liberacao ?? e.id,
                    tipo: 'emprestimo' as const,
                    titulo: `Contrato ${e.numero_contrato} — ${e.status}`,
                    subtitulo: `${e.prazo_meses}x de ${formatarMoeda(e.valor_parcela)} · Taxa ${e.taxa_juros}% a.m.`,
                    valor: e.valor_principal,
                    cor: '#1A73E8',
                  })),
                  ...pagamentos.map(p => ({
                    id: `pag-${p.id}`,
                    data: p.data_movimentacao,
                    tipo: 'pagamento' as const,
                    titulo: 'Pagamento registrado',
                    subtitulo: p.descricao ?? '',
                    valor: p.valor,
                    cor: '#34A853',
                  })),
                  ...anotacoes.map(a => ({
                    id: `anot-${a.id}`,
                    data: a.created_at,
                    tipo: 'anotacao' as const,
                    titulo: a.assunto ?? 'Anotação',
                    subtitulo: a.mensagem ?? '',
                    cor: '#A142F4',
                  })),
                ].sort((a, b) => b.data.localeCompare(a.data))

                if (eventos.length === 0) return (
                  <p className="text-muted-foreground/60 text-sm text-center py-10 font-semibold">Nenhum evento registrado.</p>
                )

                return (
                  <div className="relative pl-2 pt-2">
                    <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-border/60" />
                    <div className="space-y-6">
                      {eventos.map(ev => (
                        <div key={ev.id} className="flex gap-4 relative group">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-card shadow-sm transition-all group-hover:scale-105 duration-300"
                            style={{ backgroundColor: `${ev.cor}18`, borderColor: ev.cor }}
                          >
                            {ev.tipo === 'emprestimo' && <Banknote size={16} style={{ color: ev.cor }} />}
                            {ev.tipo === 'pagamento' && <CheckCircle size={16} style={{ color: ev.cor }} />}
                            {ev.tipo === 'anotacao' && <MessageSquare size={16} style={{ color: ev.cor }} />}
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-start justify-between gap-4 flex-wrap bg-muted/10 border border-border/40 hover:border-border/80 hover:bg-muted/20 p-4 rounded-xl transition-all duration-300">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-foreground capitalize">{ev.titulo}</p>
                                {ev.subtitulo && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{ev.subtitulo}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                {ev.valor !== undefined && (
                                  <p className="text-sm font-bold" style={{ color: ev.cor }}>{formatarMoeda(ev.valor)}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground/60 font-semibold mt-1">{formatarData(ev.data)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </TabsContent>

          {/* TAB 1 — Títulos */}
          <TabsContent value="emprestimos" className="outline-none">
            <div className="space-y-4">
              {emprestimos.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-12 text-center">
                  <FileText size={40} className="mx-auto mb-3 text-muted-foreground/30 animate-pulse" />
                  <p className="text-muted-foreground/60 font-semibold">Nenhum título registrado.</p>
                  <Link href={`/factoring/emprestimos/novo?cliente_id=${id}`}>
                    <Button size="sm" className="mt-4 text-white gap-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] shadow-sm font-semibold px-5">
                      <Plus size={14} /> Iniciar Empréstimo
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
                  const statusColor = emp.status === 'quitado' ? '#34A853'
                    : emp.status === 'inadimplente' ? '#EA4335'
                    : emp.status === 'cancelado' ? '#6b7280'
                    : emp.status === 'renegociado' ? '#FA903E'
                    : '#1A73E8'

                  return (
                    <div key={emp.id} className="bg-card rounded-2xl border border-border shadow-m3-1 overflow-hidden transition-all duration-300">
                      {/* Card header */}
                      <div className="flex items-stretch">
                        <div className="w-1.5 shrink-0" style={{ backgroundColor: statusColor }} />
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-mono text-sm font-bold text-foreground">{emp.numero_contrato}</span>
                                <StatusBadge status={emp.status} />
                                {emAtrasoEmp > 0 && (
                                  <Badge className="text-[10px] font-bold bg-[#FCE8E6] text-[#EA4335] border border-[#EA4335]/20 gap-1 flex items-center rounded-full px-2 py-0.5">
                                    <AlertTriangle size={10} />
                                    {emAtrasoEmp} em atraso
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-2.5 flex items-center gap-4 flex-wrap text-sm font-semibold">
                                <span className="text-foreground text-base">{formatarMoeda(emp.valor_principal)}</span>
                                {emp.data_liberacao && (
                                  <span className="text-xs text-muted-foreground/60 font-medium">Liberação: {formatarData(emp.data_liberacao)}</span>
                                )}
                                <span className="text-xs text-muted-foreground font-medium">
                                  {pagas}/{total} parcelas · Taxa {emp.taxa_juros}% {emp.tipo_taxa === 'anual' ? 'a.a.' : 'a.m.'}
                                </span>
                              </div>

                              <div className="mt-3.5 max-w-md">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${progress}%`, backgroundColor: statusColor }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-muted-foreground/60 shrink-0">{progress}% quitado</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs h-8 rounded-full font-semibold border-border hover:bg-muted/50"
                                disabled={gerandoContratoId === emp.id}
                                onClick={() => handleGerarContratoPerfil(emp)}
                              >
                                <Download size={12} className="text-muted-foreground" />
                                {gerandoContratoId === emp.id ? 'Gerando...' : 'Contrato PDF'}
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs h-8 text-white rounded-full bg-[#1A73E8] hover:bg-[#1557B0] font-semibold shadow-sm"
                                onClick={() => router.push(`/factoring/emprestimos/${emp.id}`)}
                              >
                                <DollarSign size={12} />
                                Receber
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                                onClick={() => toggleExpanded(emp.id)}
                                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                              >
                                <ChevronDown
                                  size={16}
                                  className={cn('transition-transform duration-200 text-muted-foreground', isExpanded && 'rotate-180')}
                                />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="border-t border-border/60 p-5 bg-muted/20 space-y-5">
                          {/* Mini stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-card rounded-xl p-3.5 border border-border/60 shadow-sm">
                              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Capital</p>
                              <p className="font-extrabold text-foreground text-sm">{formatarMoeda(emp.valor_principal)}</p>
                            </div>
                            <div className="bg-card rounded-xl p-3.5 border border-border/60 shadow-sm">
                              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Taxa de Juros</p>
                              <p className="font-extrabold text-foreground text-sm">{emp.taxa_juros}% {emp.tipo_taxa === 'anual' ? 'a.a.' : 'a.m.'}</p>
                            </div>
                            <div className="bg-card rounded-xl p-3.5 border border-border/60 shadow-sm">
                              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Valor da Parcela</p>
                              <p className="font-extrabold text-foreground text-sm">{formatarMoeda(emp.valor_parcela)}</p>
                            </div>
                            <div className="bg-card rounded-xl p-3.5 border border-border/60 shadow-sm">
                              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Saldo Devedor</p>
                              <p className="font-extrabold text-foreground text-sm">{formatarMoeda(emp.saldo_devedor)}</p>
                            </div>
                          </div>

                          {/* Parcelas table */}
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Detalhamento das Parcelas</p>
                            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/40 text-muted-foreground border-b border-border/80 text-[10px] font-bold uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left font-bold">Nº</th>
                                    <th className="px-4 py-3 text-left font-bold">Vencimento</th>
                                    <th className="px-4 py-3 text-right font-bold">Valor</th>
                                    <th className="px-4 py-3 text-right font-bold">Pago</th>
                                    <th className="px-4 py-3 text-left font-bold">Pago em</th>
                                    <th className="px-4 py-3 text-left font-bold">Status</th>
                                    <th className="px-4 py-3 text-center font-bold">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 font-medium">
                                  {empParcelas.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground/60 font-semibold">
                                        Nenhuma parcela disponível.
                                      </td>
                                    </tr>
                                  ) : empParcelas.map(p => (
                                    <tr
                                      key={p.id}
                                      className={cn(
                                        'hover:bg-muted/10 transition-colors',
                                        p.status === 'atrasado' && 'bg-[#FCE8E6]/20',
                                        p.status === 'pago' && 'bg-[#E6F4EA]/15',
                                      )}
                                    >
                                      <td className="px-4 py-3 font-mono text-muted-foreground font-semibold">{p.numero_parcela}</td>
                                      <td className={cn('px-4 py-3', p.status === 'atrasado' && 'text-[#EA4335] font-bold')}>
                                        {formatarData(p.data_vencimento)}
                                        {(p.dias_atraso ?? 0) > 0 && (
                                          <span className="text-[#EA4335] ml-1.5 font-bold">({p.dias_atraso}d)</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatarMoeda(p.valor)}</td>
                                      <td className="px-4 py-3 text-right text-[#34A853] font-semibold">
                                        {p.valor_pago ? formatarMoeda(p.valor_pago) : '—'}
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground/60 font-semibold">
                                        {p.data_pagamento ? formatarData(p.data_pagamento) : '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <StatusBadge status={p.status} />
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {p.status !== 'pago' && p.status !== 'cancelado' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7 px-3 rounded-full font-semibold border-border hover:bg-muted/50"
                                            onClick={() => router.push(`/factoring/emprestimos/${p.emprestimo_id}?parcela=${p.id}`)}
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
                              className="text-xs font-bold text-[#1A73E8] hover:text-[#1557B0] hover:underline flex items-center gap-1"
                            >
                              Ver detalhes completos <ArrowUpRight size={13} />
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
          <TabsContent value="pagamentos" className="outline-none">
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 pb-3 border-b border-border/60 mb-3">
                <CreditCard size={18} className="text-muted-foreground" />
                Histórico de Recebimentos
              </h3>
              {pagamentos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground/60 font-semibold">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
                  <p>Nenhum recibo de pagamento registrado.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {pagamentos.map(pag => (
                    <div key={pag.id} className="py-4 flex items-start gap-4 hover:bg-muted/10 rounded-xl px-2 transition-colors duration-300">
                      <div className="w-10 h-10 rounded-full bg-[#E6F4EA] flex items-center justify-center shrink-0 border border-[#34A853]/20">
                        <CreditCard size={18} className="text-[#34A853]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="font-extrabold text-base text-[#137333]">
                            {formatarMoeda(pag.valor)}
                          </p>
                          <span className="text-xs text-muted-foreground/60 font-bold">
                            {formatarData(pag.data_movimentacao)}
                          </span>
                        </div>
                        {pag.descricao && (
                          <p className="text-sm text-muted-foreground font-medium mt-0.5">{pag.descricao}</p>
                        )}
                        {pag.categoria && (
                          <Badge variant="outline" className="mt-1.5 text-xs font-semibold rounded-full bg-muted/40">
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
          <TabsContent value="dados" className="outline-none">
            <div className="space-y-6">

              {/* Dados Pessoais */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/60">
                  <User size={18} className="text-[#1A73E8]" />
                  <h3 className="font-bold text-foreground text-sm">Dados Pessoais</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <FormField label="Nome Completo">
                    <Input
                      value={formData.nome ?? ''}
                      onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="CPF">
                    <Input
                      value={formData.cpf ?? ''}
                      onChange={e => setFormData(p => ({ ...p, cpf: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="RG">
                    <Input
                      value={formData.rg ?? ''}
                      onChange={e => setFormData(p => ({ ...p, rg: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Órgão Emissor">
                    <Input
                      value={formData.orgao_emissor ?? ''}
                      onChange={e => setFormData(p => ({ ...p, orgao_emissor: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Data Nascimento">
                    <Input
                      type="date"
                      value={formData.data_nascimento?.slice(0, 10) ?? ''}
                      onChange={e => setFormData(p => ({ ...p, data_nascimento: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Estado Civil">
                    <Select
                      value={formData.estado_civil ?? ''}
                      onValueChange={v => setFormData(p => ({ ...p, estado_civil: v ?? '' }))}
                    >
                      <SelectTrigger className="h-11 px-4 focus:ring-1 focus:ring-[#1A73E8] focus:border-[#1A73E8] rounded-lg transition-all w-full">
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
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Renda Mensal (R$)">
                    <Input
                      type="number"
                      value={formData.renda_mensal ?? ''}
                      onChange={e => setFormData(p => ({ ...p, renda_mensal: parseFloat(e.target.value) || null }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Telefone">
                    <Input
                      value={formData.telefone ?? ''}
                      onChange={e => setFormData(p => ({ ...p, telefone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Telefone 2">
                    <Input
                      value={formData.telefone2 ?? ''}
                      onChange={e => setFormData(p => ({ ...p, telefone2: e.target.value }))}
                      placeholder="(00) 00000-0000"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="E-mail">
                    <Input
                      type="email"
                      value={formData.email ?? ''}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Endereço */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/60">
                  <MapPin size={18} className="text-[#1A73E8]" />
                  <h3 className="font-bold text-foreground text-sm">Endereço</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <FormField label="CEP">
                    <div className="flex gap-2 items-center">
                      <Input
                        value={formData.cep ?? ''}
                        onChange={e => setFormData(p => ({ ...p, cep: e.target.value }))}
                        onBlur={e => buscarCep(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && buscarCep(formData.cep ?? '')}
                        placeholder="00000-000"
                        className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all flex-1"
                        maxLength={9}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => buscarCep(formData.cep ?? '')}
                        disabled={cepLoading || (formData.cep ?? '').replace(/\D/g,'').length < 8}
                        className="shrink-0 h-11 px-3 border-border hover:bg-muted/50 rounded-lg"
                      >
                        {cepLoading
                          ? <Loader2 size={16} className="animate-spin text-[#1A73E8]" />
                          : <Search size={16} className="text-muted-foreground" />
                        }
                      </Button>
                    </div>
                  </FormField>
                  <FormField label="Endereço" className="sm:col-span-2">
                    <Input
                      value={formData.endereco ?? ''}
                      onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Número">
                    <Input
                      value={formData.numero ?? ''}
                      onChange={e => setFormData(p => ({ ...p, numero: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Complemento">
                    <Input
                      value={formData.complemento ?? ''}
                      onChange={e => setFormData(p => ({ ...p, complemento: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Bairro">
                    <Input
                      value={formData.bairro ?? ''}
                      onChange={e => setFormData(p => ({ ...p, bairro: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Cidade">
                    <Input
                      value={formData.cidade ?? ''}
                      onChange={e => setFormData(p => ({ ...p, cidade: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Estado (UF)">
                    <Input
                      value={formData.estado ?? ''}
                      onChange={e => setFormData(p => ({ ...p, estado: e.target.value }))}
                      maxLength={2}
                      placeholder="UF"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Dados Bancários */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/60">
                  <Banknote size={18} className="text-[#1A73E8]" />
                  <h3 className="font-bold text-foreground text-sm">Dados Bancários</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <FormField label="Banco">
                    <Input
                      value={formData.banco ?? ''}
                      onChange={e => setFormData(p => ({ ...p, banco: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Agência">
                    <Input
                      value={formData.agencia ?? ''}
                      onChange={e => setFormData(p => ({ ...p, agencia: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Conta">
                    <Input
                      value={formData.conta ?? ''}
                      onChange={e => setFormData(p => ({ ...p, conta: e.target.value }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Tipo de Conta">
                    <Select
                      value={formData.tipo_conta ?? ''}
                      onValueChange={v => setFormData(p => ({ ...p, tipo_conta: v ?? '' }))}
                    >
                      <SelectTrigger className="h-11 px-4 focus:ring-1 focus:ring-[#1A73E8] focus:border-[#1A73E8] rounded-lg w-full">
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
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                  <FormField label="Limite de Crédito (R$)">
                    <Input
                      type="number"
                      value={formData.limite_credito ?? ''}
                      onChange={e => setFormData(p => ({ ...p, limite_credito: parseFloat(e.target.value) || null }))}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <FormField label="Observações de Análise de Risco / Gerais">
                  <Textarea
                    value={formData.observacoes ?? ''}
                    onChange={e => setFormData(p => ({ ...p, observacoes: e.target.value }))}
                    rows={4}
                    className="resize-none focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all mt-1"
                  />
                </FormField>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button
                  onClick={salvarDados}
                  disabled={salvandoDados}
                  className="text-white px-8 rounded-full h-11 bg-[#1A73E8] hover:bg-[#1557B0] font-semibold transition-all shadow-sm"
                >
                  {salvandoDados ? 'Salvando...' : 'Salvar Ficha Cadastral'}
                </Button>
              </div>

              {/* ── Referências ─────────────────────────────────────── */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <div className="flex items-center justify-between mb-5 pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-[#1A73E8]" />
                    <h3 className="font-bold text-foreground text-sm">Contatos de Referência</h3>
                    <Badge variant="outline" className="text-xs ml-1 bg-muted/60 rounded-full font-bold">{referencias.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-full font-semibold border-border hover:bg-muted/50"
                    onClick={() => setNovaRefOpen(true)}
                  >
                    <Plus size={14} />
                    Nova Referência
                  </Button>
                </div>

                {referencias.length === 0 && !novaRefOpen ? (
                  <p className="text-muted-foreground/60 text-sm text-center py-8 font-semibold">
                    Nenhuma referência de contato registrada.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {referencias.map(ref => (
                      <div key={ref.id} className="border border-border/80 rounded-xl p-4 bg-muted/10 hover:bg-muted/20 transition-all duration-300">
                        {editRefId === ref.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <FormField label="Nome">
                                <Input
                                  value={editRefData.nome ?? ref.nome}
                                  onChange={e => setEditRefData(p => ({ ...p, nome: e.target.value }))}
                                  className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                                />
                              </FormField>
                              <FormField label="Parentesco">
                                <Input
                                  value={editRefData.parentesco ?? ref.parentesco ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, parentesco: e.target.value }))}
                                  className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                                />
                              </FormField>
                              <FormField label="Telefone">
                                <Input
                                  value={editRefData.telefone ?? ref.telefone ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, telefone: e.target.value }))}
                                  className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                                />
                              </FormField>
                              <FormField label="Observações">
                                <Input
                                  value={editRefData.observacoes ?? ref.observacoes ?? ''}
                                  onChange={e => setEditRefData(p => ({ ...p, observacoes: e.target.value }))}
                                  className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                                />
                              </FormField>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => salvarEdicaoRef(ref.id)} className="gap-1 rounded-full text-white bg-[#1A73E8] hover:bg-[#1557B0] font-semibold">
                                <Check size={13} /> Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditRefId(null); setEditRefData({}) }}
                                className="gap-1 rounded-full border-border hover:bg-muted font-semibold"
                              >
                                <X size={13} /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-foreground text-sm">{ref.nome}</p>
                                {ref.parentesco && (
                                  <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-muted/60">{ref.parentesco}</Badge>
                                )}
                              </div>
                              {ref.telefone && (
                                <p className="text-sm text-[#1A73E8] font-semibold">{formatarTelefone(ref.telefone)}</p>
                              )}
                              {ref.observacoes && (
                                <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium mt-1 pr-6">{ref.observacoes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                                onClick={() => { setEditRefId(ref.id); setEditRefData({}) }}
                              >
                                <Edit size={13} className="text-muted-foreground" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full text-[#EA4335] hover:text-[#EA4335] hover:bg-[#FCE8E6]"
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
                  <div className="mt-4 border border-dashed border-border rounded-xl p-4 bg-muted/30">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Cadastrar Nova Referência</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Nome *">
                        <Input
                          value={novaRef.nome}
                          onChange={e => setNovaRef(p => ({ ...p, nome: e.target.value }))}
                          placeholder="Nome completo"
                          className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                        />
                      </FormField>
                      <FormField label="Parentesco">
                        <Input
                          value={novaRef.parentesco}
                          onChange={e => setNovaRef(p => ({ ...p, parentesco: e.target.value }))}
                          placeholder="Ex: Cônjuge, Filho, Sócio..."
                          className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                        />
                      </FormField>
                      <FormField label="Telefone">
                        <Input
                          value={novaRef.telefone}
                          onChange={e => setNovaRef(p => ({ ...p, telefone: formatarTelefone(e.target.value) }))}
                          placeholder="(00) 00000-0000"
                          className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                        />
                      </FormField>
                      <FormField label="Observações">
                        <Input
                          value={novaRef.observacoes}
                          onChange={e => setNovaRef(p => ({ ...p, observacoes: e.target.value }))}
                          placeholder="Cargo, local de trabalho, notas..."
                          className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                        />
                      </FormField>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={adicionarReferencia}
                        disabled={salvandoRef || !novaRef.nome.trim()}
                        className="gap-1 rounded-full text-white bg-[#1A73E8] hover:bg-[#1557B0] font-semibold h-9 px-4"
                      >
                        <Plus size={13} /> {salvandoRef ? 'Adicionando...' : 'Adicionar Contato'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-border hover:bg-muted font-semibold h-9 px-4"
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
          <TabsContent value="anotacoes" className="outline-none">
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-[#1A73E8]" />
                  <h3 className="font-bold text-foreground text-sm">Linha de Contato / Anotações</h3>
                  <Badge variant="outline" className="text-xs ml-1 bg-muted/60 rounded-full font-bold">{anotacoes.length}</Badge>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-full text-white bg-[#1A73E8] hover:bg-[#1557B0] font-semibold shadow-sm"
                  onClick={() => setAnotacaoOpen(true)}
                >
                  <Plus size={14} />
                  Nova Anotação
                </Button>
              </div>

              {anotacoes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground/60 font-semibold">
                  <MessageSquare size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
                  <p>Nenhuma anotação registrada.</p>
                  <p className="text-xs font-medium text-muted-foreground/50 mt-1">Gere anotações para registrar telefonemas, reuniões ou avisos importantes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anotacoes.map(anotacao => (
                    <div
                      key={anotacao.id}
                      className={cn(
                        'border-l-4 pl-4 py-3.5 pr-3.5 rounded-r-xl bg-muted/10 border border-border/40 hover:bg-muted/20 hover:border-border transition-all duration-300 shadow-sm relative',
                        anotacaoBorderColor(anotacao.assunto)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 mt-0.5 select-none" role="img" aria-label={anotacao.assunto ?? 'nota'}>
                          {anotacaoIcon(anotacao.assunto)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              {anotacao.assunto ?? 'nota'}
                            </span>
                            <span className="text-xs text-muted-foreground/60 font-semibold">
                              {formatarData(anotacao.created_at)}
                            </span>
                            {anotacao.status && (
                              <Badge variant="outline" className="text-[10px] font-bold rounded-full py-0 h-4 bg-muted/40 uppercase">
                                {anotacao.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-1.5 leading-relaxed font-semibold whitespace-pre-wrap">
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

          {/* TAB 6 — Documentos */}
          <TabsContent value="documentos" className="outline-none">
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
              <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-5">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <FileText size={18} className="text-[#1A73E8]" />
                  Central de Documentos
                </h3>
                <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{documentos.length} arquivo(s) enviados</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {CATEGORIAS_DOCUMENTO.map(cat => {
                  const doc = documentos.find(d => d.categoria === cat.id)
                  const isUploading = uploadingDoc === cat.id
                  const isDeletando = doc ? deletandoDocId === doc.id : false
                  const inputId = `perfil-doc-${cat.id}`
                  const IconeCat = cat.id === 'foto' ? Camera
                    : cat.id === 'rg_cnh' ? CreditCard
                    : cat.id === 'cpf' ? FileText
                    : cat.id === 'comprovante_residencia' ? Home
                    : cat.id === 'comprovante_renda' ? Banknote
                    : Paperclip

                  return (
                    <div key={cat.id} className="relative group">
                      {doc ? (
                        /* Documento enviado */
                        <div className="rounded-xl border border-[#34A853]/20 bg-[#E6F4EA]/25 p-4 flex flex-col items-center gap-2.5 min-h-[150px] relative transition-all duration-300 shadow-sm">
                          {/* Botão remover */}
                          <button
                            type="button"
                            disabled={isDeletando}
                            onClick={() => deletarDocumento(doc)}
                            className="absolute top-2 right-2 w-5.5 h-5.5 rounded-full bg-[#EA4335]/10 hover:bg-[#EA4335]/25 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            {isDeletando
                              ? <div className="w-3 h-3 border border-[#EA4335] border-t-transparent rounded-full animate-spin" />
                              : <X size={11} className="text-[#EA4335] font-bold" />
                            }
                          </button>

                          {/* Preview ou ícone */}
                          {ehImagem(doc.tipo_mime) ? (
                            <img
                              src={doc.url}
                              alt={doc.label}
                              className="w-16 h-16 object-cover rounded-lg shadow-sm border border-white"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-[#E6F4EA] flex items-center justify-center border border-[#34A853]/20">
                              <IconeCat size={26} className="text-[#34A853]" />
                            </div>
                          )}

                          <p className="text-[11px] font-extrabold text-[#137333] text-center leading-tight mt-1 truncate w-full">{cat.label}</p>
                          <p className="text-[9px] text-muted-foreground/80 font-bold">{formatarTamanho(doc.tamanho)}</p>

                          {/* Ações */}
                          <div className="flex gap-1.5 mt-auto w-full">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-[#137333] bg-[#E6F4EA] hover:bg-[#34A853]/15 rounded-md py-1.5 transition-colors border border-[#34A853]/10"
                            >
                              <Eye size={9} /> Ver
                            </a>
                            <a
                              href={doc.url}
                              download={doc.nome_original}
                              className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-md py-1.5 transition-colors border border-border/60"
                            >
                              <Download size={9} /> Baixar
                            </a>
                          </div>
                        </div>
                      ) : (
                        /* Slot vazio */
                        <label
                          htmlFor={inputId}
                          className={`cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-[#1A73E8]/50 hover:bg-[#E8F0FE]/10 p-4 flex flex-col items-center gap-2.5 min-h-[150px] transition-all duration-300 group ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
                        >
                          <div className="w-16 h-16 rounded-lg bg-muted/60 flex items-center justify-center mt-1 group-hover:bg-card transition-all border border-transparent group-hover:border-[#1A73E8]/10">
                            {isUploading
                              ? <div className="w-6 h-6 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
                              : <IconeCat size={26} className="text-muted-foreground/40 group-hover:text-[#1A73E8]/60 transition-colors" />
                            }
                          </div>
                          <p className="text-[11px] font-bold text-muted-foreground text-center leading-tight mt-1">{cat.label}</p>
                          <p className="text-[9px] text-[#1A73E8] font-bold flex items-center gap-1">
                            <Upload size={9} /> {isUploading ? 'Enviando...' : 'Carregar arquivo'}
                          </p>
                        </label>
                      )}
                      <input
                        id={inputId}
                        type="file"
                        accept={cat.accept}
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) fazerUploadDocumento(cat.id, f)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground/60 text-center font-medium">
                Selecione ou arraste qualquer documento para realizar upload de comprovação.
              </p>
            </div>
          </TabsContent>

          {/* TAB 7 — Score e Risco */}
          <TabsContent value="score" className="outline-none">
            <div className="space-y-6">
              {/* Score principal */}
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <div className="flex flex-col lg:flex-row items-center gap-8 pt-1">
                  <div className="flex flex-col items-center gap-3 shrink-0 bg-muted/10 border border-border/40 p-5 rounded-2xl shadow-sm">
                    <ScoreGauge score={resultadoScore.score} size="lg" showLabel showDescription animated />
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    {/* Recommendation */}
                    <div
                      className="rounded-xl p-4 border relative overflow-hidden"
                      style={{
                        backgroundColor:
                          resultadoScore.recomendacao === 'aprovar' ? '#E6F4EA' :
                          resultadoScore.recomendacao === 'analisar' ? '#FEF7E0' : '#FCE8E6',
                        borderColor:
                          resultadoScore.recomendacao === 'aprovar' ? '#34A853/20' :
                          resultadoScore.recomendacao === 'analisar' ? '#FBBC04/20' : '#EA4335/20',
                      }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1"
                        style={{
                          backgroundColor:
                            resultadoScore.recomendacao === 'aprovar' ? '#34A853' :
                            resultadoScore.recomendacao === 'analisar' ? '#FBBC04' : '#EA4335'
                        }}
                      />
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                        style={{ color: resultadoScore.recomendacao === 'aprovar' ? '#137333' : resultadoScore.recomendacao === 'analisar' ? '#B06000' : '#C5221F' }}>
                        Diretriz da Mesa de Crédito
                      </p>
                      <p className="font-extrabold text-foreground text-xl capitalize">{resultadoScore.recomendacao}</p>
                      {resultadoScore.faixa && (
                        <p className="text-sm text-muted-foreground font-semibold mt-1">{resultadoScore.faixa.nome}</p>
                      )}
                    </div>
                    {/* Limit & rate */}
                    <div className="grid grid-cols-2 gap-4">
                      {resultadoScore.limiteSugerido != null && (
                        <div className="bg-muted/20 rounded-xl p-4 border border-border/60 shadow-sm">
                          <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Crédito Proposto</p>
                          <p className="font-black text-[#1A73E8] text-lg">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultadoScore.limiteSugerido)}
                          </p>
                        </div>
                      )}
                      {resultadoScore.taxaSugerida != null && (
                        <div className="bg-muted/20 rounded-xl p-4 border border-border/60 shadow-sm">
                          <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-0.5">Taxa de Juros Proposta</p>
                          <p className="font-black text-[#1A73E8] text-lg">{resultadoScore.taxaSugerida.toFixed(2)}% a.m.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fatores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Positivos */}
                <div className="bg-card rounded-2xl border border-[#34A853]/20 shadow-m3-1 p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#34A853]" />
                  <p className="text-xs font-bold text-[#137333] uppercase tracking-wider mb-4 border-b border-border/40 pb-2">Fatores Favoráveis</p>
                  <div className="space-y-3">
                    {resultadoScore.fatores.filter(f => f.tipo === 'positivo' && f.pontos !== 0).length === 0 && (
                      <p className="text-sm text-muted-foreground/50 italic font-semibold py-4 text-center">Nenhum fator favorável catalogado.</p>
                    )}
                    {resultadoScore.fatores.filter(f => f.tipo === 'positivo' && f.pontos !== 0).map(f => (
                      <div key={f.id} className="flex items-start gap-2.5 bg-[#E6F4EA]/15 p-2 rounded-xl border border-[#34A853]/10">
                        <span className="text-[#34A853] font-black text-sm shrink-0 mt-0.5">+{f.pontos.toFixed(0)}</span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground/80 font-medium leading-relaxed">{f.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Negativos */}
                <div className="bg-card rounded-2xl border border-[#EA4335]/20 shadow-m3-1 p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#EA4335]" />
                  <p className="text-xs font-bold text-[#C5221F] uppercase tracking-wider mb-4 border-b border-border/40 pb-2">Fatores Degradantes</p>
                  <div className="space-y-3">
                    {resultadoScore.fatores.filter(f => f.tipo === 'negativo' && f.pontos !== 0).length === 0 && (
                      <p className="text-sm text-muted-foreground/50 italic font-semibold py-4 text-center">Nenhum agravante de risco identificado.</p>
                    )}
                    {resultadoScore.fatores.filter(f => f.tipo === 'negativo' && f.pontos !== 0).map(f => (
                      <div key={f.id} className="flex items-start gap-2.5 bg-[#FCE8E6]/15 p-2 rounded-xl border border-[#EA4335]/10">
                        <span className="text-[#EA4335] font-black text-sm shrink-0 mt-0.5">{f.pontos.toFixed(0)}</span>
                        <div>
                          <p className="text-xs font-bold text-foreground">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground/80 font-medium leading-relaxed">{f.descricao}</p>
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
            : `${cliente.nome} ficará impedido de realizar novas operações de crédito.`
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
        descricao="Esta ação não pode ser desfeita e removerá permanentemente este contato de segurança."
        labelConfirmar="Excluir"
        variante="danger"
        onConfirmar={() => { if (deletandoRefId) deletarReferencia(deletandoRefId) }}
      />

      {/* Nova Anotação */}
      <Dialog open={anotacaoOpen} onOpenChange={setAnotacaoOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-foreground tracking-tight">Registrar Nova Anotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Tipo de Evento">
              <Select
                value={anotacaoTipo}
                onValueChange={v => setAnotacaoTipo(v ?? 'nota')}
              >
                <SelectTrigger className="w-full h-11 focus:ring-1 focus:ring-[#1A73E8] focus:border-[#1A73E8]">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota">📝 Nota Interna</SelectItem>
                  <SelectItem value="ligacao">📞 Ligação Telefônica</SelectItem>
                  <SelectItem value="visita">🏠 Visita de Análise</SelectItem>
                  <SelectItem value="negociacao">🤝 Acordo / Negociação</SelectItem>
                  <SelectItem value="alerta">⚠️ Alerta Crítico</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Mensagem / Observação *">
              <Textarea
                value={anotacaoConteudo}
                onChange={e => setAnotacaoConteudo(e.target.value)}
                placeholder="Descreva detalhadamente o evento..."
                rows={5}
                className="resize-none focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAnotacaoOpen(false)}
              disabled={salvandoAnotacao}
              className="rounded-full font-semibold border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarAnotacao}
              disabled={salvandoAnotacao || !anotacaoConteudo.trim()}
              className="text-white rounded-full bg-[#1A73E8] hover:bg-[#1557B0] font-semibold"
            >
              {salvandoAnotacao ? 'Salvando...' : 'Salvar Anotação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
