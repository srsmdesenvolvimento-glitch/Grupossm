'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, CreditCard, User, ArrowUpCircle, ArrowDownCircle,
  Loader2, FileText, Upload, DollarSign, CheckCircle2, X, Download,
} from 'lucide-react'
import { gerarContratoPDF } from '@/lib/utils/documentos'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHelp } from '@/components/shared/PageHelp'
import { ClienteSheet } from '@/components/factoring/ClienteSheet'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { taxaMensalParaAnual } from '@/lib/utils/calculos'
import type { Emprestimo, ParcelaEmprestimo, ClienteFactoring, MovimentacaoCaixa } from '@/lib/types/database'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  analise:     { bg: '#f1f5f9', text: '#64748b', label: 'Em Análise' },
  aprovado:    { bg: '#fefce8', text: '#ca8a04', label: 'Aprovado' },
  ativo:       { bg: '#f0fdf4', text: '#16a34a', label: 'Ativo' },
  quitado:     { bg: '#eff6ff', text: '#1E5AA8', label: 'Quitado' },
  inadimplente:{ bg: '#fef2f2', text: '#dc2626', label: 'Inadimplente' },
  cancelado:   { bg: '#f8fafc', text: '#94a3b8', label: 'Cancelado' },
}

export default function EmprestimoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [emprestimo, setEmprestimo] = useState<Emprestimo | null>(null)
  const [cliente, setCliente] = useState<Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'score_interno'> | null>(null)
  const [parcelas, setParcelas] = useState<ParcelaEmprestimo[]>([])
  const [movs, setMovs] = useState<MovimentacaoCaixa[]>([])
  const [loading, setLoading] = useState(true)

  const [quitarDialog, setQuitarDialog] = useState(false)
  const [cancelarDialog, setCancelarDialog] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState(false)

  async function handleGerarContrato() {
    if (!emprestimo || !cliente) return
    setGerandoPDF(true)
    try {
      await gerarContratoPDF({
        contrato: emprestimo,
        cliente,
        parcelas,
        empresaNome: empresaAtual?.nome,
      })
    } finally {
      setGerandoPDF(false)
    }
  }

  const carregarDados = useCallback(async () => {
    if (!empresaAtual || !id) return
    setLoading(true)
    try {
      const [{ data: emp }, { data: parcs }, { data: movsData }] = await Promise.all([
        supabase.from('emprestimos').select('*').eq('id', id).eq('empresa_id', empresaAtual.id).single(),
        supabase.from('parcelas_emprestimo').select('*').eq('emprestimo_id', id).order('numero_parcela'),
        supabase.from('movimentacoes_caixa').select('*').eq('referencia_tipo', 'emprestimo').eq('referencia_id', id).order('created_at', { ascending: false }),
      ])
      if (!emp) { router.push('/factoring/emprestimos'); return }
      setEmprestimo(emp)
      setParcelas(parcs ?? [])
      setMovs(movsData ?? [])

      const { data: cli } = await supabase
        .from('clientes_factoring')
        .select('id, nome, cpf, telefone, score_interno')
        .eq('id', emp.cliente_id)
        .single()
      setCliente(cli ?? null)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, id])

  useEffect(() => { carregarDados() }, [carregarDados])

  async function quitarAntecipado() {
    if (!emprestimo || !empresaAtual) return
    setProcessando(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const { error: e1 } = await supabase
        .from('emprestimos')
        .update({ status: 'quitado', data_quitacao: hoje })
        .eq('id', emprestimo.id)
      if (e1) throw e1

      await supabase
        .from('parcelas_emprestimo')
        .update({ status: 'cancelado' })
        .eq('emprestimo_id', emprestimo.id)
        .eq('status', 'pendente')

      await supabase.from('movimentacoes_caixa').insert({
        empresa_id: empresaAtual.id,
        tipo: 'entrada',
        categoria: 'quitacao_antecipada',
        descricao: `Quitação antecipada contrato ${emprestimo.numero_contrato}`,
        valor: emprestimo.saldo_devedor,
        referencia_tipo: 'emprestimo',
        referencia_id: emprestimo.id,
        data_movimentacao: hoje,
      })

      toast.success('Empréstimo quitado com sucesso!')
      setQuitarDialog(false)
      carregarDados()
    } catch {
      toast.error('Erro ao quitar empréstimo')
    } finally {
      setProcessando(false)
    }
  }

  async function cancelarContrato() {
    if (!emprestimo || !empresaAtual) return
    setProcessando(true)
    try {
      await supabase.from('emprestimos').update({ status: 'cancelado' }).eq('id', emprestimo.id)
      await supabase.from('parcelas_emprestimo').update({ status: 'cancelado' }).eq('emprestimo_id', emprestimo.id).in('status', ['pendente', 'atrasado'])
      toast.success('Contrato cancelado')
      setCancelarDialog(false)
      carregarDados()
    } catch {
      toast.error('Erro ao cancelar contrato')
    } finally {
      setProcessando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (!emprestimo) return null

  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length
  const statusInfo = STATUS_COLORS[emprestimo.status] ?? STATUS_COLORS.analise
  const taxaAnual = taxaMensalParaAnual(emprestimo.taxa_juros)
  const totalJurosPagos = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor_juros ?? 0), 0)
  const totalPrincipalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + (p.valor_principal ?? 0), 0)

  const parcelaColumns: Column<ParcelaEmprestimo>[] = [
    { key: 'num', header: 'Nº', render: p => <span className="tabular-nums text-sm text-slate-500">{p.numero_parcela}/{p.total_parcelas}</span> },
    { key: 'venc', header: 'Vencimento', render: p => <span className="tabular-nums text-sm">{formatarData(p.data_vencimento)}</span> },
    { key: 'principal', header: 'Principal', render: p => <span className="tabular-nums text-sm">{formatarMoeda(p.valor_principal)}</span> },
    { key: 'juros', header: 'Juros', render: p => <span className="tabular-nums text-sm text-orange-600">{formatarMoeda(p.valor_juros)}</span> },
    { key: 'valor', header: 'Parcela', render: p => <span className="tabular-nums text-sm font-semibold">{formatarMoeda(p.valor)}</span> },
    { key: 'pago', header: 'Pago', render: p => <span className="tabular-nums text-sm text-green-700">{formatarMoeda(p.valor_pago ?? 0)}</span> },
    { key: 'saldo', header: 'Saldo', render: p => <span className="tabular-nums text-sm">{formatarMoeda(Math.max(0, p.valor - (p.valor_pago ?? 0)))}</span> },
    {
      key: 'status',
      header: 'Status',
      render: p => {
        const colors: Record<string, string> = { pago: '#22c55e', atrasado: '#ef4444', pendente: '#64748b', cancelado: '#94a3b8', renegociado: '#D4A528' }
        const labels: Record<string, string> = { pago: 'Pago', atrasado: 'Atrasado', pendente: 'Pendente', cancelado: 'Cancelado', renegociado: 'Renegoc.' }
        const c = colors[p.status] ?? '#64748b'
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: c, backgroundColor: `${c}18` }}>{labels[p.status] ?? p.status}</span>
      },
    },
    {
      key: 'dias',
      header: 'Atraso',
      render: p => p.dias_atraso > 0
        ? <span className="text-xs font-semibold text-red-600">{p.dias_atraso}d</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      key: 'acao',
      header: '',
      render: p => ['pendente', 'atrasado'].includes(p.status)
        ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2"
            onClick={e => { e.stopPropagation(); router.push(`/factoring/parcelas/pagamento?cliente=${emprestimo.cliente_id}&parcela=${p.id}`) }}
          >
            Receber
          </Button>
        ) : null,
    },
  ]

  function rowClass(p: ParcelaEmprestimo) {
    if (p.status === 'pago') return 'bg-green-50/50'
    if (p.status === 'atrasado') return 'bg-red-50/50'
    if (p.status === 'pendente') {
      const hoje = new Date().toISOString().split('T')[0]
      if (p.data_vencimento === hoje) return 'bg-yellow-50/50'
    }
    return ''
  }

  return (
    <AppShell empresa="factoring" titulo={`Contrato ${emprestimo.numero_contrato}`}>
      <div className="space-y-6">
        <PageHelp
          storageKey="help.factoring.emprestimo-detalhe.v1"
          titulo="Detalhes do Contrato"
          oQueE="Visualize e gerencie um contrato de empréstimo: parcelas, pagamentos realizados, dados do cliente e histórico financeiro."
          passos={[
            'Veja o resumo financeiro: valor original, total pago e saldo devedor.',
            'Na tabela de parcelas, cada linha mostra o status individual.',
            'Clique em "Receber" numa parcela para registrar o pagamento.',
            'Use "Lançar Pagamento" (topo) para registrar pagamento geral do contrato.',
            'Clique "Quitar" para liquidar o contrato antecipadamente.',
          ]}
          dicas={[
            'Parcelas em vermelho estão vencidas — registre o pagamento o quanto antes.',
            'O cliente no painel lateral tem link direto para a ficha completa.',
            'Após quitar ou cancelar, o status do contrato é atualizado automaticamente.',
          ]}
        />
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/factoring/emprestimos')}>
              <ChevronLeft size={18} />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-lg font-bold" style={{ color: '#1E5AA8' }}>
                  {emprestimo.numero_contrato}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                {emprestimo.data_liberacao ? `Liberado em ${formatarData(emprestimo.data_liberacao)}` : 'Aguardando liberação'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleGerarContrato}
              disabled={gerandoPDF}
            >
              {gerandoPDF
                ? <Loader2 size={14} className="animate-spin" />
                : <Download size={14} />
              }
              {gerandoPDF ? 'Gerando...' : 'Contrato PDF'}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-white"
              style={{ backgroundColor: '#1E5AA8' }}
              onClick={() => router.push(`/factoring/parcelas/pagamento?cliente=${emprestimo.cliente_id}&emprestimo=${emprestimo.id}`)}
            >
              <DollarSign size={14} />
              Lançar Pagamento
            </Button>
            {['ativo', 'inadimplente'].includes(emprestimo.status) && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQuitarDialog(true)}>
                <CheckCircle2 size={14} />
                Quitar
              </Button>
            )}
            {['analise', 'aprovado', 'ativo'].includes(emprestimo.status) && (
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" onClick={() => setCancelarDialog(true)}>
                <X size={14} />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Principal</p>
            <p className="text-lg font-bold text-card-foreground">{formatarMoeda(emprestimo.valor_principal)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Taxa de Juros</p>
            <p className="text-lg font-bold text-card-foreground">{emprestimo.taxa_juros}% a.m.</p>
            <p className="text-xs text-muted-foreground mt-0.5">≡ {taxaAnual}% a.a. (compostos)</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Prazo</p>
            <p className="text-lg font-bold text-card-foreground">{emprestimo.prazo_meses} meses</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">Parcela (Price)</p>
            <p className="text-lg font-bold text-card-foreground">{formatarMoeda(emprestimo.valor_parcela)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Totals */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-3 text-sm">Resumo Financeiro</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { l: 'Total a Pagar', v: emprestimo.total_pagar, color: '#1E5AA8' },
                  { l: 'Total Pago', v: totalPago, color: '#22c55e' },
                  { l: 'Saldo Devedor', v: emprestimo.saldo_devedor, color: '#f97316' },
                  { l: 'Parcelas', v: `${parcelasPagas}/${emprestimo.prazo_meses}`, color: '#64748b', isText: true },
                ].map(c => (
                  <div key={c.l} className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">{c.l}</p>
                    <p className="font-bold" style={{ color: c.color }}>
                      {c.isText ? c.v : formatarMoeda(c.v as number)}
                    </p>
                  </div>
                ))}
              </div>
              {/* Breakdown juros compostos — o que já foi pago */}
              {parcelasPagas > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Composição do que foi pago</p>
                  <div className="flex rounded-full overflow-hidden h-2 mb-1.5">
                    <div
                      className="h-2 bg-[#1E5AA8]"
                      style={{ width: totalPago > 0 ? `${Math.round((totalPrincipalPago / totalPago) * 100)}%` : '0%' }}
                    />
                    <div className="h-2 bg-orange-400 flex-1" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#1E5AA8] inline-block" />
                      Principal amortizado: {formatarMoeda(totalPrincipalPago)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                      Juros pagos: {formatarMoeda(totalJurosPagos)}
                    </span>
                  </div>
                </div>
              )}
              {/* Projeção total do contrato */}
              <div className="pt-3 border-t border-border mt-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Composição total do contrato</p>
                <div className="flex rounded-full overflow-hidden h-2 mb-1.5">
                  <div
                    className="h-2 bg-[#1E5AA8]"
                    style={{ width: emprestimo.total_pagar > 0 ? `${Math.round((emprestimo.valor_principal / emprestimo.total_pagar) * 100)}%` : '0%' }}
                  />
                  <div className="h-2 bg-orange-400 flex-1" />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1E5AA8] inline-block" />
                    Principal: {formatarMoeda(emprestimo.valor_principal)} ({emprestimo.total_pagar > 0 ? Math.round((emprestimo.valor_principal / emprestimo.total_pagar) * 100) : 0}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    Juros totais: {formatarMoeda(emprestimo.total_juros)} ({emprestimo.total_pagar > 0 ? Math.round((emprestimo.total_juros / emprestimo.total_pagar) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Parcelas table */}
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-card-foreground text-sm">Parcelas</h3>
                <span className="text-xs text-muted-foreground">{parcelas.filter(p => p.status === 'pago').length}/{parcelas.length} pagas</span>
              </div>
              {/* Header */}
              <div className="grid grid-cols-[36px_1fr_1fr_1fr_100px_auto] gap-2 px-5 py-2 border-b border-border text-xs text-muted-foreground font-medium bg-muted/30">
                <span>#</span>
                <span>Vencimento</span>
                <span>Parcela</span>
                <span>Pago</span>
                <span>Status</span>
                <span />
              </div>
              <div>
                {parcelas.map(p => {
                  const statusColor: Record<string, string> = { pago: '#22c55e', atrasado: '#ef4444', pendente: '#64748b', cancelado: '#94a3b8', renegociado: '#D4A528' }
                  const statusLabel: Record<string, string> = { pago: 'Pago', atrasado: 'Atrasado', pendente: 'Pendente', cancelado: 'Cancelado', renegociado: 'Renegoc.' }
                  const cor = statusColor[p.status] ?? '#64748b'
                  return (
                    <div key={p.id} className={cn('grid grid-cols-[36px_1fr_1fr_1fr_100px_auto] gap-2 px-5 py-3 border-b border-border last:border-0 text-sm items-center', rowClass(p))}>
                      <span className="text-muted-foreground tabular-nums text-xs">{p.numero_parcela}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`tabular-nums truncate ${p.status === 'atrasado' ? 'text-red-600 font-medium' : ''}`}>
                          {formatarData(p.data_vencimento)}
                        </span>
                        {p.dias_atraso > 0 && (
                          <span className="shrink-0 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950 px-1 py-0.5 rounded">
                            {p.dias_atraso}d
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums font-semibold">{formatarMoeda(p.valor)}</span>
                      <span className="tabular-nums text-green-700">{formatarMoeda(p.valor_pago ?? 0)}</span>
                      <span className="text-xs font-semibold" style={{ color: cor }}>
                        {statusLabel[p.status] ?? p.status}
                      </span>
                      {['pendente', 'atrasado'].includes(p.status) ? (
                        <Button
                          size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0"
                          onClick={() => router.push(`/factoring/parcelas/pagamento?cliente=${emprestimo.cliente_id}&parcela=${p.id}`)}
                        >
                          Receber
                        </Button>
                      ) : <span />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Histórico de Movimentações</h3>
              {movs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma movimentação registrada</p>
              ) : (
                <div className="space-y-3">
                  {movs.map(m => (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        m.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100')}>
                        {m.tipo === 'entrada'
                          ? <ArrowUpCircle size={14} className="text-green-600" />
                          : <ArrowDownCircle size={14} className="text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.descricao}</p>
                          <p className={cn('text-sm font-bold shrink-0', m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600')}>
                            {m.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(m.valor)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400">{formatarData(m.data_movimentacao)} · {m.categoria}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — Client + Info */}
          <div className="space-y-4">
            {cliente && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-1.5">
                  <User size={14} />
                  Cliente
                </h3>
                <Link href={`/factoring/clientes/${cliente.id}`} className="group">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: '#1E5AA8' }}
                    >
                      {iniciais(cliente.nome)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-[#1E5AA8] transition-colors">{cliente.nome}</p>
                      <p className="text-xs text-slate-400">{formatarCPF(cliente.cpf ?? '')}</p>
                    </div>
                  </div>
                </Link>
                <div className="flex justify-center mb-2">
                  <ScoreGauge score={cliente.score_interno} size="sm" />
                </div>
                <p className="text-xs text-slate-400 text-center mb-3">{formatarTelefone(cliente.telefone)}</p>
                {empresaAtual && (
                  <ClienteSheet
                    clienteId={cliente.id}
                    empresaId={empresaAtual.id}
                    trigger={
                      <button className="w-full text-xs text-center py-1.5 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Ver ficha completa
                      </button>
                    }
                  />
                )}
              </div>
            )}

            {/* Guarantees */}
            {emprestimo.garantias && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">Garantias</h3>
                <p className="text-sm text-slate-600">{emprestimo.garantias}</p>
              </div>
            )}

            {/* Docs */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-1.5">
                <FileText size={14} />
                Documentos
              </h3>
              {Array.isArray(emprestimo.documentos) && emprestimo.documentos.length > 0 ? (
                <div className="space-y-2">
                  {(emprestimo.documentos as Array<{ name: string; url: string }>).map((doc, i) => (
                    <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-sm text-slate-600 transition-colors">
                      <FileText size={14} className="text-slate-400" />
                      {doc.name}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nenhum documento</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={quitarDialog}
        onOpenChange={setQuitarDialog}
        titulo="Quitar Antecipado"
        descricao={`Confirma a quitação antecipada do contrato ${emprestimo.numero_contrato}? Saldo devedor: ${formatarMoeda(emprestimo.saldo_devedor)}`}
        labelConfirmar="Confirmar Quitação"
        onConfirmar={quitarAntecipado}
        carregando={processando}
      />

      <ConfirmDialog
        open={cancelarDialog}
        onOpenChange={setCancelarDialog}
        titulo="Cancelar Contrato"
        descricao={`Tem certeza que deseja cancelar o contrato ${emprestimo.numero_contrato}? Esta ação não pode ser desfeita.`}
        labelConfirmar="Cancelar Contrato"
        onConfirmar={cancelarContrato}
        carregando={processando}
        variante="danger"
      />
    </AppShell>
  )
}
