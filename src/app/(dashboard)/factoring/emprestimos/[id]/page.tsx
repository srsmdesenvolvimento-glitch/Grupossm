'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, CreditCard, User, ArrowUpCircle, ArrowDownCircle,
  Loader2, FileText, Upload, DollarSign, CheckCircle2, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
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
          {[
            { l: 'Valor Principal', v: formatarMoeda(emprestimo.valor_principal) },
            { l: 'Taxa', v: `${emprestimo.taxa_juros}% a.m.` },
            { l: 'Prazo', v: `${emprestimo.prazo_meses} meses` },
            { l: 'Parcela', v: formatarMoeda(emprestimo.valor_parcela) },
          ].map(c => (
            <div key={c.l} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">{c.l}</p>
              <p className="text-lg font-bold text-slate-800">{c.v}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Totals */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">Resumo Financeiro</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { l: 'Total a Pagar', v: emprestimo.total_pagar, color: '#1E5AA8' },
                  { l: 'Total Pago', v: totalPago, color: '#22c55e' },
                  { l: 'Saldo Devedor', v: emprestimo.saldo_devedor, color: '#f97316' },
                  { l: 'Parcelas', v: `${parcelasPagas}/${emprestimo.prazo_meses}`, color: '#64748b', isText: true },
                ].map(c => (
                  <div key={c.l} className="text-center">
                    <p className="text-xs text-slate-500 mb-0.5">{c.l}</p>
                    <p className="font-bold" style={{ color: c.color }}>
                      {c.isText ? c.v : formatarMoeda(c.v as number)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Parcelas table */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Parcelas</h3>
              </div>
              <div>
                {parcelas.map(p => (
                  <div key={p.id} className={cn('grid grid-cols-[40px_1fr_1fr_1fr_1fr_80px_80px_auto] gap-2 px-5 py-3 border-b border-slate-50 text-sm items-center', rowClass(p))}>
                    <span className="text-slate-400 tabular-nums">{p.numero_parcela}</span>
                    <span className="tabular-nums">{formatarData(p.data_vencimento)}</span>
                    <span className="tabular-nums font-medium">{formatarMoeda(p.valor)}</span>
                    <span className="tabular-nums text-green-700">{formatarMoeda(p.valor_pago ?? 0)}</span>
                    <span className="tabular-nums text-slate-500">{formatarMoeda(Math.max(0, p.valor - (p.valor_pago ?? 0)))}</span>
                    {p.dias_atraso > 0
                      ? <span className="text-xs font-bold text-red-600">{p.dias_atraso}d</span>
                      : <span />}
                    <span className="text-xs font-semibold" style={{
                      color: { pago: '#22c55e', atrasado: '#ef4444', pendente: '#64748b', cancelado: '#94a3b8', renegociado: '#D4A528' }[p.status] ?? '#64748b'
                    }}>
                      {{ pago: 'Pago', atrasado: 'Atrasado', pendente: 'Pendente', cancelado: 'Cancelado', renegociado: 'Renegoc.' }[p.status] ?? p.status}
                    </span>
                    {['pendente', 'atrasado'].includes(p.status) ? (
                      <Button
                        size="sm" variant="outline" className="h-6 text-xs px-2"
                        onClick={() => router.push(`/factoring/parcelas/pagamento?cliente=${emprestimo.cliente_id}&parcela=${p.id}`)}
                      >
                        Receber
                      </Button>
                    ) : <span />}
                  </div>
                ))}
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
                <p className="text-xs text-slate-400 text-center">{formatarTelefone(cliente.telefone)}</p>
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
