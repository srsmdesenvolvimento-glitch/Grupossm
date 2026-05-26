'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, CreditCard, User, ArrowUpCircle, ArrowDownCircle,
  Loader2, FileText, Upload, DollarSign, CheckCircle2, X, Download,
  QrCode, ArrowLeftRight, Receipt, MessageCircle, BadgeCheck,
} from 'lucide-react'
import { gerarContratoPDF, gerarReciboParcela, gerarQuitacaoPDF, type ReciboParcela, type QuitacaoParams } from '@/lib/utils/documentos'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { ClienteSheet } from '@/components/factoring/ClienteSheet'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { parseSupabaseError, logError } from '@/lib/utils/errors'
import { taxaMensalParaAnual } from '@/lib/utils/calculos'
import type { Emprestimo, ParcelaEmprestimo, ClienteFactoring, MovimentacaoCaixa, TipoPagamento } from '@/lib/types/database'

const FORMAS_PAG: { key: TipoPagamento; label: string; icon: React.ReactNode }[] = [
  { key: 'dinheiro',     label: 'Dinheiro',      icon: <DollarSign size={16} /> },
  { key: 'pix',          label: 'PIX',            icon: <QrCode size={16} /> },
  { key: 'transferencia',label: 'Transferência',  icon: <ArrowLeftRight size={16} /> },
  { key: 'boleto',       label: 'Boleto',         icon: <FileText size={16} /> },
  { key: 'cheque',       label: 'Cheque',         icon: <CreditCard size={16} /> },
]

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
  const searchParams = useSearchParams()
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

  // Payment dialog
  const [pagarParcela, setPagarParcela] = useState<ParcelaEmprestimo | null>(null)
  const [pagForma, setPagForma] = useState<TipoPagamento>('pix')
  const [pagDesconto, setPagDesconto] = useState('')
  const [pagTipoDesc, setPagTipoDesc] = useState<'R$' | '%'>('R$')
  const [pagValorParcial, setPagValorParcial] = useState('')
  const [pagValorRecebido, setPagValorRecebido] = useState('')
  const [pagando, setPagando] = useState(false)
  const [taxaMoraDiaria, setTaxaMoraDiaria] = useState(0.033)

  async function handleGerarRecibo(p: ParcelaEmprestimo) {
    if (!cliente || !emprestimo) return
    await gerarReciboParcela({
      parcela: {
        numero_parcela: p.numero_parcela,
        total_parcelas: p.total_parcelas,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento ?? new Date().toISOString().split('T')[0],
        valor: p.valor,
        valor_pago: p.valor_pago ?? 0,
        juros_mora: p.juros_mora ?? 0,
        multa: p.multa ?? 0,
        tipo_pagamento: p.tipo_pagamento ?? 'pix',
      },
      cliente: { nome: cliente.nome, cpf: cliente.cpf ?? null, telefone: cliente.telefone },
      contrato: { numero_contrato: emprestimo.numero_contrato },
      empresaNome: empresaAtual?.nome,
    })
  }

  function handleWhatsAppRecibo(p: ParcelaEmprestimo) {
    if (!cliente || !emprestimo) return
    const tel = (cliente.telefone ?? '').replace(/\D/g, '')
    const numero = tel.startsWith('55') ? tel : `55${tel}`
    const formas: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque' }
    const forma = formas[p.tipo_pagamento ?? ''] ?? 'PIX'
    const msg = `Olá ${cliente.nome.split(' ')[0]}! Confirmamos o recebimento da parcela ${p.numero_parcela}/${p.total_parcelas} do contrato ${emprestimo.numero_contrato} no valor de ${(p.valor_pago ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} via ${forma} em ${new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}. Obrigado!`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleGerarQuitacao() {
    if (!emprestimo || !cliente) return
    setGerandoPDF(true)
    try {
      await gerarQuitacaoPDF({
        contrato: {
          numero_contrato: emprestimo.numero_contrato,
          valor_principal: emprestimo.valor_principal,
          taxa_juros: emprestimo.taxa_juros,
          prazo_meses: emprestimo.prazo_meses,
          data_liberacao: emprestimo.data_liberacao,
          data_quitacao: emprestimo.data_quitacao ?? null,
        },
        cliente: { nome: cliente.nome, cpf: cliente.cpf ?? null, telefone: cliente.telefone },
        parcelas: parcelas.filter(p => p.status === 'pago').map(p => ({
          numero_parcela: p.numero_parcela,
          data_vencimento: p.data_vencimento,
          data_pagamento: p.data_pagamento,
          valor: p.valor,
          valor_pago: p.valor_pago,
          juros_mora: p.juros_mora ?? 0,
          multa: p.multa ?? 0,
          tipo_pagamento: p.tipo_pagamento,
          status: p.status,
        })),
        empresaNome: empresaAtual?.nome,
      })
    } finally {
      setGerandoPDF(false)
    }
  }

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

  // Auto-open payment dialog when navigated with ?parcela=<id>
  useEffect(() => {
    const parcelaId = searchParams.get('parcela')
    if (!parcelaId || !parcelas.length || pagarParcela) return
    const p = parcelas.find(x => x.id === parcelaId && ['pendente', 'atrasado'].includes(x.status))
    if (p) abrirPagamento(p)
  }, [parcelas, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!empresaAtual) return
    supabase.from('config_factoring').select('juros_mora_diario').eq('empresa_id', empresaAtual.id).maybeSingle()
      .then(({ data }) => { if (data?.juros_mora_diario) setTaxaMoraDiaria(Number(data.juros_mora_diario)) })
  }, [empresaAtual]) // eslint-disable-line react-hooks/exhaustive-deps

  function calcDias(venc: string): number {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((hoje.getTime() - new Date(venc + 'T00:00:00').getTime()) / 86400000))
  }

  function calcMoraLive(valor: number, venc: string): number {
    const dias = calcDias(venc)
    if (dias <= 0) return 0
    return Math.round(valor * (Math.pow(1 + taxaMoraDiaria / 100, dias) - 1) * 100) / 100
  }

  function abrirPagamento(p: ParcelaEmprestimo) {
    setPagarParcela(p)
    setPagForma('pix')
    setPagDesconto('')
    setPagTipoDesc('R$')
    setPagValorParcial('')
    setPagValorRecebido('')
  }

  async function confirmarPagamentoParcela() {
    if (!pagarParcela || !emprestimo || !empresaAtual) return
    const hoje = new Date().toISOString().split('T')[0]
    const moraLive = pagarParcela.status === 'atrasado' ? calcMoraLive(pagarParcela.valor, pagarParcela.data_vencimento) : (pagarParcela.juros_mora ?? 0)
    const subtotal = pagarParcela.valor + (pagarParcela.multa ?? 0) + moraLive - (pagarParcela.valor_pago ?? 0)
    const descontoNum = Number(pagDesconto) || 0
    const descontoValor = pagTipoDesc === '%' ? subtotal * descontoNum / 100 : descontoNum
    const valorDigitado = Number(pagValorParcial) || 0
    const valorFinal = valorDigitado > 0 && valorDigitado < subtotal - 0.009
      ? valorDigitado
      : Math.max(0, subtotal - descontoValor)
    if (valorFinal <= 0) { toast.error('Valor inválido'); return }
    if (pagForma === 'dinheiro' && Number(pagValorRecebido) < valorFinal) { toast.error('Valor recebido menor que o total'); return }
    setPagando(true)
    try {
      if (valorFinal < subtotal - 0.009) {
        const restante = Math.round((subtotal - valorFinal) * 100) / 100
        await supabase.from('parcelas_emprestimo').update({ status: 'pago', juros_mora: moraLive, valor_pago: valorFinal, data_pagamento: hoje, tipo_pagamento: pagForma }).eq('id', pagarParcela.id)
        // Transfer remainder to the next pending parcel
        const { data: proximas } = await supabase
          .from('parcelas_emprestimo')
          .select('id, valor, numero_parcela')
          .eq('emprestimo_id', emprestimo.id)
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado'])
          .order('numero_parcela')
          .limit(1)
        const proxima = proximas?.[0]
        if (proxima) {
          const { error: errProxima } = await supabase.from('parcelas_emprestimo')
            .update({ valor: Math.round((proxima.valor + restante) * 100) / 100 })
            .eq('id', proxima.id)
            .eq('empresa_id', empresaAtual.id)
          if (errProxima) {
            toast.error(`Saldo de ${formatarMoeda(restante)} não pôde ser somado à parcela ${proxima.numero_parcela}.`)
          } else {
            toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restante)} somado à parcela ${proxima.numero_parcela}.`)
          }
        } else {
          // Last parcel — create a new one with next month date
          const { data: todas } = await supabase.from('parcelas_emprestimo').select('numero_parcela').eq('emprestimo_id', emprestimo.id)
          const maxNum = Math.max(...(todas?.map(x => x.numero_parcela) ?? [0]))
          const novoVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })()
          await supabase.from('parcelas_emprestimo').insert({
            empresa_id: empresaAtual.id, emprestimo_id: emprestimo.id, cliente_id: emprestimo.cliente_id,
            numero_parcela: maxNum + 1, total_parcelas: maxNum + 1,
            valor: restante, valor_principal: restante, valor_juros: 0,
            saldo_devedor_antes: restante, saldo_devedor_apos: 0,
            valor_pago: null, data_vencimento: novoVenc, data_pagamento: null, tipo_pagamento: null,
            multa: 0, juros_mora: 0, status: 'pendente',
            observacoes: `Saldo da parcela ${pagarParcela.numero_parcela} — parcial de ${formatarMoeda(valorFinal)}`,
          })
          toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restante)} criado como nova parcela.`)
        }
      } else {
        await supabase.from('parcelas_emprestimo').update({ status: 'pago', juros_mora: moraLive, valor_pago: valorFinal, data_pagamento: hoje, tipo_pagamento: pagForma }).eq('id', pagarParcela.id)
        const { data: restantes } = await supabase.from('parcelas_emprestimo').select('id').eq('emprestimo_id', emprestimo.id).in('status', ['pendente', 'atrasado'])
        if (!restantes?.length) {
          await supabase.from('emprestimos').update({ status: 'quitado', saldo_devedor: 0, data_quitacao: hoje }).eq('id', emprestimo.id)
        }
        toast.success(`${formatarMoeda(valorFinal)} registrado com sucesso!`)
      }
      await supabase.from('movimentacoes_caixa').insert({
        empresa_id: empresaAtual.id, tipo: 'entrada', categoria: 'pagamento_parcela',
        descricao: `Pagamento parcela ${pagarParcela.numero_parcela}/${pagarParcela.total_parcelas} — ${cliente?.nome ?? ''}`,
        valor: valorFinal, referencia_tipo: 'emprestimo', referencia_id: emprestimo.id, data_movimentacao: hoje,
      })
      setPagarParcela(null)
      carregarDados()
    } catch (err) { logError('registrarPagamento', err); toast.error(parseSupabaseError(err, 'Erro ao registrar pagamento')) }
    finally { setPagando(false) }
  }

  async function quitarAntecipado() {
    if (!emprestimo || !empresaAtual) return
    setProcessando(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const { error: e1 } = await supabase
        .from('emprestimos')
        .update({ status: 'quitado', saldo_devedor: 0, data_quitacao: hoje })
        .eq('id', emprestimo.id)
      if (e1) throw e1

      // Mark all pending/atrasado parcelas as PAGO (not cancelled)
      const { data: pendentes } = await supabase
        .from('parcelas_emprestimo')
        .select('id, valor, numero_parcela, total_parcelas, data_vencimento')
        .eq('emprestimo_id', emprestimo.id)
        .in('status', ['pendente', 'atrasado'])

      if (pendentes && pendentes.length > 0) {
        await supabase
          .from('parcelas_emprestimo')
          .update({ status: 'pago', valor_pago: null, data_pagamento: hoje, tipo_pagamento: 'dinheiro' })
          .eq('emprestimo_id', emprestimo.id)
          .in('status', ['pendente', 'atrasado'])

        // Register one caixa entry for the total settled amount
        const totalQuitado = pendentes.reduce((s, p) => s + (p.valor ?? 0), 0)
        await supabase.from('movimentacoes_caixa').insert({
          empresa_id: empresaAtual.id,
          tipo: 'entrada',
          categoria: 'quitacao_antecipada',
          descricao: `Quitação antecipada contrato ${emprestimo.numero_contrato} — ${pendentes.length} parcela(s)`,
          valor: totalQuitado,
          referencia_tipo: 'emprestimo',
          referencia_id: emprestimo.id,
          data_movimentacao: hoje,
        })
      }

      toast.success('Empréstimo quitado com sucesso! Todas as parcelas foram marcadas como pagas.')
      setQuitarDialog(false)
      carregarDados()
    } catch (err) {
      logError('quitarAntecipado', err)
      toast.error(parseSupabaseError(err, 'Erro ao quitar empréstimo'))
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
    } catch (err) {
      logError('cancelarContrato', err)
      toast.error(parseSupabaseError(err, 'Erro ao cancelar contrato'))
    } finally {
      setProcessando(false)
    }
  }

  if (loading) return <LoadingPage />
  if (!emprestimo) return (
    <AppShell empresa="factoring" titulo="Empréstimo">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <X size={48} className="text-slate-300" />
        <p className="text-slate-500 text-lg font-medium">Empréstimo não encontrado</p>
        <Button variant="outline" onClick={() => router.push('/factoring/emprestimos')}>
          <ChevronLeft size={16} className="mr-1" /> Voltar para empréstimos
        </Button>
      </div>
    </AppShell>
  )

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
    { key: 'saldo', header: 'Restante', render: p => <span className="tabular-nums text-sm">{p.status === 'pago' ? <span className="text-green-600">—</span> : formatarMoeda(Math.max(0, p.valor - (p.valor_pago ?? 0)))}</span> },
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
      render: p => {
        const dias = calcDias(p.data_vencimento)
        return dias > 0
          ? <span className="text-xs font-semibold text-red-600">{dias}d</span>
          : <span className="text-slate-300 text-xs">—</span>
      },
    },
    {
      key: 'acao',
      header: '',
      render: p => ['pendente', 'atrasado'].includes(p.status)
        ? (
          <Button
            size="sm"
            className="h-6 text-xs px-2 text-white gap-1"
            style={{ backgroundColor: '#1E5AA8' }}
            onClick={e => { e.stopPropagation(); abrirPagamento(p) }}
          >
            <DollarSign size={11} />
            Receber
          </Button>
        ) : p.status === 'pago' ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              title="Baixar comprovante de pagamento"
              onClick={() => handleGerarRecibo(p)}
              className="h-6 px-2 rounded flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <Receipt size={11} />
              Recibo
            </button>
            {cliente?.telefone && (
              <button
                title="Enviar comprovante via WhatsApp"
                onClick={() => handleWhatsAppRecibo(p)}
                className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              >
                <MessageCircle size={13} />
              </button>
            )}
          </div>
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
            <Button variant="ghost" size="icon" aria-label="Voltar para empréstimos" className="h-8 w-8" onClick={() => router.push('/factoring/emprestimos')}>
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
            {emprestimo.status === 'quitado' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                onClick={handleGerarQuitacao}
                disabled={gerandoPDF}
              >
                <BadgeCheck size={14} />
                Termo de Quitação
              </Button>
            )}
            {['ativo', 'inadimplente'].includes(emprestimo.status) && (() => {
              const proxima = parcelas.find(p => ['pendente', 'atrasado'].includes(p.status))
              return proxima ? (
                <Button
                  size="sm"
                  className="gap-1.5 text-white"
                  style={{ backgroundColor: '#1E5AA8' }}
                  onClick={() => abrirPagamento(proxima)}
                >
                  <DollarSign size={14} />
                  Receber Parcela
                </Button>
              ) : null
            })()}
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
                          onClick={() => abrirPagamento(p)}
                        >
                          Receber
                        </Button>
                      ) : p.status === 'pago' ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            title="Baixar comprovante de pagamento"
                            onClick={() => handleGerarRecibo(p)}
                            className="h-6 px-2 rounded flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <Receipt size={11} />
                            Recibo
                          </button>
                          {cliente?.telefone && (
                            <button
                              title="Enviar comprovante via WhatsApp"
                              onClick={() => handleWhatsAppRecibo(p)}
                              className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            >
                              <MessageCircle size={13} />
                            </button>
                          )}
                        </div>
                      ) : <span />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-card rounded-xl border border-border p-5">
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
              <div className="bg-card rounded-xl border border-border p-5">
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
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">Garantias</h3>
                <p className="text-sm text-slate-600">{emprestimo.garantias}</p>
              </div>
            )}

            {/* Docs */}
            <div className="bg-card rounded-xl border border-border p-5">
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

      {/* ── Payment Dialog ─────────────────────────────────────── */}
      {pagarParcela && (() => {
        const moraLive = pagarParcela.status === 'atrasado' ? calcMoraLive(pagarParcela.valor, pagarParcela.data_vencimento) : (pagarParcela.juros_mora ?? 0)
        const dias = calcDias(pagarParcela.data_vencimento)
        const subtotal = pagarParcela.valor + (pagarParcela.multa ?? 0) + moraLive - (pagarParcela.valor_pago ?? 0)
        const descontoNum = Number(pagDesconto) || 0
        const descontoValor = pagTipoDesc === '%' ? subtotal * descontoNum / 100 : descontoNum
        const valorParcialNum = Number(pagValorParcial) || 0
        const isParcial = valorParcialNum > 0 && valorParcialNum < subtotal - 0.009
        const total = isParcial ? valorParcialNum : Math.max(0, subtotal - descontoValor)
        const troco = pagForma === 'dinheiro' ? Math.max(0, (Number(pagValorRecebido) || 0) - total) : 0
        const restante = isParcial ? Math.max(0, subtotal - total) : 0
        return (
          <Dialog open onOpenChange={open => { if (!open) setPagarParcela(null) }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Pagamento — Parcela {pagarParcela.numero_parcela}/{pagarParcela.total_parcelas}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1">
                {/* Info — composição do valor */}
                <div className={`rounded-lg p-3 text-sm space-y-1.5 ${dias > 0 ? 'bg-red-50 border border-red-100' : 'bg-slate-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Vencimento</span>
                    <span className={dias > 0 ? 'text-red-600 font-semibold text-xs' : 'text-slate-700'}>
                      {formatarData(pagarParcela.data_vencimento)}
                      {dias > 0 && <span className="ml-1.5 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{dias}d em atraso</span>}
                    </span>
                  </div>
                  {(pagarParcela.valor_pago ?? 0) > 0 && (
                    <div className="flex justify-between text-slate-500"><span>Já pago</span><span className="text-green-600">− {formatarMoeda(pagarParcela.valor_pago ?? 0)}</span></div>
                  )}
                  <div className="border-t border-slate-200/60 pt-1.5 mt-0.5 space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Valor da Parcela</span><span className="font-medium">{formatarMoeda(pagarParcela.valor)}</span></div>
                    {(pagarParcela.multa ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-orange-600">Multa</span><span className="text-orange-600 font-medium">+ {formatarMoeda(pagarParcela.multa ?? 0)}</span></div>
                    )}
                    {moraLive > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-500">Juros Diários{dias > 0 ? ` (${dias}d × ${taxaMoraDiaria}%/d)` : ''}</span>
                        <span className="text-red-500 font-medium">+ {formatarMoeda(moraLive)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5 mt-0.5 text-base">
                    <span>Total a Receber</span>
                    <span style={{ color: '#1E5AA8' }}>{formatarMoeda(subtotal)}</span>
                  </div>
                </div>

                {/* Valor a Receber */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valor a Receber</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      max={subtotal}
                      value={pagValorParcial}
                      onChange={e => { setPagValorParcial(e.target.value); setPagDesconto('') }}
                      placeholder={subtotal.toFixed(2).replace('.', ',')}
                      className="pl-9 text-lg font-bold"
                      style={{ color: '#1E5AA8' }}
                    />
                  </div>
                  {isParcial && restante > 0.01 && (
                    <div className="mt-2 rounded-lg p-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-700 space-y-0.5">
                      <p className="font-semibold">Saldo pendente: {formatarMoeda(restante)}</p>
                      <p className="text-amber-600">Será somado à próxima parcela automaticamente.</p>
                    </div>
                  )}
                  {descontoValor > 0 && !isParcial && (
                    <p className="text-xs text-green-600 mt-1">Desconto aplicado: − {formatarMoeda(descontoValor)}</p>
                  )}
                </div>

                {/* Forma */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Forma de Pagamento</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FORMAS_PAG.map(f => (
                      <button key={f.key} type="button" onClick={() => setPagForma(f.key)} className="flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-medium transition-all" style={pagForma === f.key ? { backgroundColor: '#EDF4FE', borderColor: '#1E5AA8', color: '#1E5AA8' } : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#64748b' }}>
                        {f.icon}{f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Troco */}
                {pagForma === 'dinheiro' && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valor Recebido</p>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span><Input type="number" min={0} step={0.01} value={pagValorRecebido} onChange={e => setPagValorRecebido(e.target.value)} placeholder="0,00" className="pl-9" /></div>
                    {troco > 0 && <div className="mt-2 flex justify-between items-center bg-green-50 rounded-lg px-3 py-2"><span className="text-sm font-medium text-green-700">Troco</span><span className="text-lg font-bold text-green-700">{formatarMoeda(troco)}</span></div>}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPagarParcela(null)} disabled={pagando}>Cancelar</Button>
                <Button
                  onClick={confirmarPagamentoParcela}
                  disabled={pagando || (pagForma === 'dinheiro' && (Number(pagValorRecebido) || 0) < total)}
                  className="text-white gap-2"
                  style={{ backgroundColor: '#1E5AA8' }}
                >
                  {pagando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  {pagando ? 'Registrando...' : 'Confirmar Pagamento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

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
