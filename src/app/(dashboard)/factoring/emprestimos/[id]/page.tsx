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
import { Label } from '@/components/ui/label'
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
  analise:     { bg: '#F1F5F9', text: '#64748b', label: 'Em Análise' },
  aprovado:    { bg: '#FEF7E0', text: '#B06000', label: 'Aprovado' },
  ativo:       { bg: '#E6F4EA', text: '#137333', label: 'Ativo' },
  quitado:     { bg: '#E8F0FE', text: '#1A73E8', label: 'Quitado' },
  inadimplente:{ bg: '#FCE8E6', text: '#C5221F', label: 'Inadimplente' },
  cancelado:   { bg: '#F8FAFC', text: '#94a3b8', label: 'Cancelado' },
}

export default function EmprestimoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [emprestimo, setEmprestimo] = useState<Emprestimo | null>(null)
  const [cliente, setCliente] = useState<ClienteFactoring | null>(null)
  const [parcelas, setParcelas] = useState<ParcelaEmprestimo[]>([])
  const [movs, setMovs] = useState<MovimentacaoCaixa[]>([])
  const [loading, setLoading] = useState(true)
  const [configFactoring, setConfigFactoring] = useState<any>(null)

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
  const [partialOption, setPartialOption] = useState<'proxima' | 'diluir' | 'extra'>('proxima')
  const [partialDueDate, setPartialDueDate] = useState('')
  const [partialJurosPct, setPartialJurosPct] = useState('')

  async function handleGerarRecibo(p: ParcelaEmprestimo) {
    if (!cliente || !emprestimo) return
    
    // Calculate total paid/pending parcelas
    const totalPagas = parcelas.filter(x => x.status === 'pago').length
    const totalRestantes = parcelas.filter(x => ['pendente', 'atrasado'].includes(x.status)).length
    
    // Calculate delay days
    const dataVenc = new Date(p.data_vencimento + 'T12:00:00')
    const dataPag = p.data_pagamento ? new Date(p.data_pagamento + 'T12:00:00') : new Date()
    const diffTime = dataPag.getTime() - dataVenc.getTime()
    const diasAtraso = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
    
    await gerarReciboParcela({
      parcela: {
        numero_parcela: p.numero_parcela,
        total_parcelas: p.total_parcelas,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento ?? new Date().toISOString().split('T')[0],
        valor: p.valor,
        valor_pago: p.valor_pago ?? 0,
        tipo_pagamento: p.tipo_pagamento ?? 'pix',
        multa: p.multa ?? 0,
        juros_mora: p.juros_mora ?? 0,
        dias_atraso: diasAtraso > 0 ? diasAtraso : undefined,
        saldo_devedor_parcela: Math.round(Math.max(0, p.valor - (p.valor_pago ?? 0)) * 100) / 100,
        saldo_devedor_total: Math.round(Math.max(0, emprestimo.saldo_devedor) * 100) / 100,
        total_parcelas_pagas: totalPagas,
        total_parcelas_restantes: totalRestantes,
      },
      cliente: {
        nome: cliente.nome,
        cpf: cliente.cpf ?? null,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep
      },
      contrato: { numero_contrato: emprestimo.numero_contrato },
      empresaNome: empresaAtual?.nome,
      empresaCnpj: empresaAtual?.cnpj,
      empresaTelefone: empresaAtual?.telefone,
      empresaEmail: empresaAtual?.email,
      empresaEndereco: empresaAtual?.endereco,
      empresaCidade: empresaAtual?.cidade,
      empresaEstado: empresaAtual?.estado,
      empresaCep: empresaAtual?.cep,
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



  async function handleGerarContrato() {
    if (!emprestimo || !cliente) return
    setGerandoPDF(true)
    try {
      await gerarContratoPDF({
        contrato: emprestimo,
        cliente: {
          nome: cliente.nome,
          cpf: cliente.cpf ?? null,
          telefone: cliente.telefone,
          endereco: cliente.endereco,
          numero: cliente.numero,
          complemento: cliente.complemento,
          bairro: cliente.bairro,
          cidade: cliente.cidade,
          estado: cliente.estado,
          cep: cliente.cep
        },
        parcelas,
        empresaNome: empresaAtual?.nome,
        empresaCnpj: empresaAtual?.cnpj,
      })
    } finally {
      setGerandoPDF(false)
    }
  }

  async function handleGerarQuitacao() {
    if (!emprestimo || !cliente) return
    setGerandoPDF(true)
    try {
      const parcelasMapeadas = parcelas.map(p => ({
        numero_parcela: p.numero_parcela,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        valor: p.valor,
        valor_pago: p.valor_pago,
        tipo_pagamento: p.tipo_pagamento,
        status: p.status,
      }))
      await gerarQuitacaoPDF({
        contrato: {
          numero_contrato: emprestimo.numero_contrato,
          valor_principal: emprestimo.valor_principal,
          taxa_juros: emprestimo.taxa_juros,
          prazo_meses: emprestimo.prazo_meses,
          data_liberacao: emprestimo.data_liberacao,
          data_quitacao: emprestimo.data_quitacao ?? new Date().toISOString().split('T')[0],
        },
        cliente: {
          nome: cliente.nome,
          cpf: cliente.cpf ?? null,
          telefone: cliente.telefone,
          endereco: cliente.endereco,
          numero: cliente.numero,
          complemento: cliente.complemento,
          bairro: cliente.bairro,
          cidade: cliente.cidade,
          estado: cliente.estado,
          cep: cliente.cep
        },
        parcelas: parcelasMapeadas,
        empresaNome: empresaAtual?.nome,
        empresaCnpj: empresaAtual?.cnpj,
        empresaTelefone: empresaAtual?.telefone,
        empresaEmail: empresaAtual?.email,
        empresaEndereco: empresaAtual?.endereco,
        empresaCidade: empresaAtual?.cidade,
        empresaEstado: empresaAtual?.estado,
        empresaCep: empresaAtual?.cep,
      })
    } finally {
      setGerandoPDF(false)
    }
  }

  const carregarDados = useCallback(async () => {
    if (!empresaAtual || !id) return
    setLoading(true)
    try {
      const [{ data: emp }, { data: parcs }, { data: movsData }, { data: configData }] = await Promise.all([
        supabase.from('emprestimos').select('*').eq('id', id).eq('empresa_id', empresaAtual.id).single(),
        supabase.from('parcelas_emprestimo').select('*').eq('emprestimo_id', id).order('numero_parcela'),
        supabase.from('movimentacoes_caixa').select('*').eq('referencia_tipo', 'emprestimo').eq('referencia_id', id).order('created_at', { ascending: false }),
        supabase.from('config_factoring').select('*').eq('empresa_id', empresaAtual.id).maybeSingle(),
      ])
      if (!emp) { router.push('/factoring/emprestimos'); return }
      setEmprestimo(emp)
      setParcelas(parcs ?? [])
      setMovs(movsData ?? [])
      setConfigFactoring(configData ?? null)

      const { data: cli } = await supabase
        .from('clientes_factoring')
        .select('*')
        .eq('id', emp.cliente_id)
        .single()
      setCliente(cli ?? null)
    } catch (error) {
      logError('carregarDados', error)
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

  function calcDias(venc: string): number {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((hoje.getTime() - new Date(venc + 'T00:00:00').getTime()) / 86400000))
  }

  function abrirPagamento(p: ParcelaEmprestimo) {
    setPagarParcela(p)
    setPagForma('pix')
    setPagDesconto('')
    setPagTipoDesc('R$')
    setPagValorParcial('')
    setPagValorRecebido('')
    setPartialOption('proxima')
    try {
      const d = new Date(p.data_vencimento + 'T12:00:00')
      d.setMonth(d.getMonth() + 1)
      setPartialDueDate(d.toISOString().split('T')[0])
    } catch {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      setPartialDueDate(d.toISOString().split('T')[0])
    }
  }

  async function confirmarPagamentoParcela() {
    if (!pagarParcela || !emprestimo || !empresaAtual) return
    const hoje = new Date().toISOString().split('T')[0]
    
    const dias = calcDias(pagarParcela.data_vencimento)
    const obsText = emprestimo.observacoes ?? ''
    const matchMora = obsText.match(/\[Mora:\s*([\d.]+)%\s*ao\s*dia\]/)
    const moraDiario = matchMora ? parseFloat(matchMora[1]) : (configFactoring?.juros_mora_diario ?? 0.033)
    const multaAtrasoPct = configFactoring?.multa_atraso ?? 2.0

    const multaCalculada = dias > 0
      ? (pagarParcela.status === 'pendente' ? pagarParcela.valor * (multaAtrasoPct / 100) : (pagarParcela.multa || pagarParcela.valor * (multaAtrasoPct / 100)))
      : 0
    const jurosCalculado = dias > 0
      ? pagarParcela.valor * (moraDiario / 100) * dias
      : 0

    const subtotal = (pagarParcela.valor + multaCalculada + jurosCalculado) - (pagarParcela.valor_pago ?? 0)
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
        
        // 1. Mark current installment as paid with partial amount and save calculated charges
        await supabase.from('parcelas_emprestimo').update({ status: 'pago', multa: Number(multaCalculada.toFixed(2)), juros_mora: Number(jurosCalculado.toFixed(2)), valor_pago: valorFinal, data_pagamento: hoje, tipo_pagamento: pagForma }).eq('id', pagarParcela.id).eq('empresa_id', empresaAtual.id)
        
        // Organize remaining balance according to option chosen
        if (partialOption === 'proxima') {
          const jurosPct = Number(partialJurosPct) || 0
          const restanteComJuros = Math.round(restante * (1 + jurosPct / 100) * 100) / 100
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
              .update({ valor: Math.round((proxima.valor + restanteComJuros) * 100) / 100 })
              .eq('id', proxima.id)
              .eq('empresa_id', empresaAtual.id)
            if (errProxima) {
              toast.error(`Saldo de ${formatarMoeda(restanteComJuros)} não pôde ser somado à parcela ${proxima.numero_parcela}.`)
            } else {
              toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restanteComJuros)}${jurosPct > 0 ? ` (c/ ${jurosPct}% juros)` : ''} somado à parcela ${proxima.numero_parcela}.`)
            }
          } else {
            // Last parcel — fallback: create a new one with next month date
            const { data: todas } = await supabase.from('parcelas_emprestimo').select('numero_parcela').eq('emprestimo_id', emprestimo.id).eq('empresa_id', empresaAtual.id)
            const maxNum = Math.max(...(todas?.map(x => x.numero_parcela) ?? [0]))
            const novoVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })()
            await supabase.from('parcelas_emprestimo').insert({
              empresa_id: empresaAtual.id, emprestimo_id: emprestimo.id, cliente_id: emprestimo.cliente_id,
              numero_parcela: maxNum + 1, total_parcelas: maxNum + 1,
              valor: restanteComJuros, valor_principal: restanteComJuros, valor_juros: 0,
              saldo_devedor_antes: restanteComJuros, saldo_devedor_apos: 0,
              valor_pago: null, data_vencimento: novoVenc, data_pagamento: null, tipo_pagamento: null,
              multa: 0, juros_mora: 0, status: 'pendente',
              observacoes: `Saldo da parcela ${pagarParcela.numero_parcela} — parcial de ${formatarMoeda(valorFinal)}`,
            })
            toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restanteComJuros)}${jurosPct > 0 ? ` (c/ ${jurosPct}% juros)` : ''} criado como nova parcela.`)
          }
        } else if (partialOption === 'diluir') {
          const jurosPct = Number(partialJurosPct) || 0
          const restanteComJuros = Math.round(restante * (1 + jurosPct / 100) * 100) / 100
          // Dilute remainder among other pending/atrasado parcelas
          const { data: restantes } = await supabase
            .from('parcelas_emprestimo')
            .select('id, valor, numero_parcela')
            .eq('emprestimo_id', emprestimo.id)
            .eq('empresa_id', empresaAtual.id)
            .in('status', ['pendente', 'atrasado'])
            .order('numero_parcela')
          
          // filter out the current one since it is now paid
          const parcelasParaDiluir = (restantes ?? []).filter(p => p.id !== pagarParcela.id)
          
          if (parcelasParaDiluir.length > 0) {
            const valorDiluido = Math.round((restanteComJuros / parcelasParaDiluir.length) * 100) / 100
            
            const updates = parcelasParaDiluir.map(p => 
              supabase.from('parcelas_emprestimo')
                .update({ valor: Math.round((p.valor + valorDiluido) * 100) / 100 })
                .eq('id', p.id)
                .eq('empresa_id', empresaAtual.id)
            )
            await Promise.all(updates)
            toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restanteComJuros)}${jurosPct > 0 ? ` (c/ ${jurosPct}% juros)` : ''} diluído entre as outras ${parcelasParaDiluir.length} parcelas (+${formatarMoeda(valorDiluido)} cada).`)
          } else {
            // No other pending installments — fallback: create a new one
            const { data: todas } = await supabase.from('parcelas_emprestimo').select('numero_parcela').eq('emprestimo_id', emprestimo.id).eq('empresa_id', empresaAtual.id)
            const maxNum = Math.max(...(todas?.map(x => x.numero_parcela) ?? [0]))
            const novoVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })()
            await supabase.from('parcelas_emprestimo').insert({
              empresa_id: empresaAtual.id, emprestimo_id: emprestimo.id, cliente_id: emprestimo.cliente_id,
              numero_parcela: maxNum + 1, total_parcelas: maxNum + 1,
              valor: restanteComJuros, valor_principal: restanteComJuros, valor_juros: 0,
              saldo_devedor_antes: restanteComJuros, saldo_devedor_apos: 0,
              valor_pago: null, data_vencimento: novoVenc, data_pagamento: null, tipo_pagamento: null,
              multa: 0, juros_mora: 0, status: 'pendente',
              observacoes: `Saldo da parcela ${pagarParcela.numero_parcela} — parcial de ${formatarMoeda(valorFinal)}`,
            })
            toast.success(`${formatarMoeda(valorFinal)} registrado! Sem outras parcelas pendentes para diluir, saldo de ${formatarMoeda(restanteComJuros)}${jurosPct > 0 ? ` (c/ ${jurosPct}% juros)` : ''} criado como nova parcela.`)
          }
        } else if (partialOption === 'extra') {
          const jurosPct = Number(partialJurosPct) || 0
          const restanteComJuros = Math.round(restante * (1 + jurosPct / 100) * 100) / 100
          // Create custom extra installment
          const venc = partialDueDate || (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })()
          const { data: todas } = await supabase.from('parcelas_emprestimo').select('numero_parcela').eq('emprestimo_id', emprestimo.id).eq('empresa_id', empresaAtual.id)
          const maxNum = Math.max(...(todas?.map(x => x.numero_parcela) ?? [0]))
          
          await supabase.from('parcelas_emprestimo').insert({
            empresa_id: empresaAtual.id, emprestimo_id: emprestimo.id, cliente_id: emprestimo.cliente_id,
            numero_parcela: maxNum + 1, total_parcelas: maxNum + 1,
            valor: restanteComJuros, valor_principal: restanteComJuros, valor_juros: 0,
            saldo_devedor_antes: restanteComJuros, saldo_devedor_apos: 0,
            valor_pago: null, data_vencimento: venc, data_pagamento: null, tipo_pagamento: null,
            multa: 0, juros_mora: 0, status: 'pendente',
            observacoes: `Saldo da parcela ${pagarParcela.numero_parcela} — parcial de ${formatarMoeda(valorFinal)}`,
          })
          toast.success(`${formatarMoeda(valorFinal)} registrado! Saldo de ${formatarMoeda(restanteComJuros)}${jurosPct > 0 ? ` (c/ ${jurosPct}% juros)` : ''} criado como nova parcela extra com vencimento em ${formatarData(venc)}.`)
        }
      } else {
        // Full payment and save calculated charges
        await supabase.from('parcelas_emprestimo').update({ status: 'pago', multa: Number(multaCalculada.toFixed(2)), juros_mora: Number(jurosCalculado.toFixed(2)), valor_pago: valorFinal, data_pagamento: hoje, tipo_pagamento: pagForma }).eq('id', pagarParcela.id).eq('empresa_id', empresaAtual.id)
        const { data: restantes } = await supabase.from('parcelas_emprestimo').select('id').eq('emprestimo_id', emprestimo.id).eq('empresa_id', empresaAtual.id).in('status', ['pendente', 'atrasado'])
        if (!restantes?.length) {
          await supabase.from('emprestimos').update({ status: 'quitado', saldo_devedor: 0, data_quitacao: hoje }).eq('id', emprestimo.id).eq('empresa_id', empresaAtual.id)
        }
        toast.success(`${formatarMoeda(valorFinal)} registrado com sucesso!`)
      }

      // Decrement Outstanding Balance
      const novoSaldoDevedor = Math.round(Math.max(0, (emprestimo.saldo_devedor ?? 0) - valorFinal) * 100) / 100
      await supabase.from('emprestimos').update({ saldo_devedor: novoSaldoDevedor }).eq('id', emprestimo.id).eq('empresa_id', empresaAtual.id)

      await supabase.from('movimentacoes_caixa').insert({
        empresa_id: empresaAtual.id, tipo: 'entrada', categoria: 'pagamento_parcela',
        descricao: `Pagamento parcela ${pagarParcela.numero_parcela}/${pagarParcela.total_parcelas} — ${cliente?.nome ?? ''}`,
        valor: valorFinal, referencia_tipo: 'emprestimo', referencia_id: emprestimo.id, data_movimentacao: hoje,
      })

      // ── Enviar Recibo Automático via WhatsApp ──
      try {
        if (cliente) {
          const dataVenc = new Date(pagarParcela.data_vencimento + 'T12:00:00')
          const dataPag = new Date()
          const diffTime = dataPag.getTime() - dataVenc.getTime()
          const diasAtraso = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))

          const { data: todasP } = await supabase
            .from('parcelas_emprestimo')
            .select('id, status')
            .eq('emprestimo_id', emprestimo.id)
          
          const totalPagas = (todasP ?? []).filter(x => x.status === 'pago').length + 1
          const totalRestantes = Math.max(0, (todasP ?? []).length - totalPagas)

          const reciboParams = {
            parcela: {
              numero_parcela: pagarParcela.numero_parcela,
              total_parcelas: pagarParcela.total_parcelas,
              data_vencimento: pagarParcela.data_vencimento,
              data_pagamento: hoje,
              valor: pagarParcela.valor,
              valor_pago: valorFinal,
              tipo_pagamento: pagForma,
              multa: pagarParcela.multa ?? 0,
              juros_mora: pagarParcela.juros_mora ?? 0,
              dias_atraso: diasAtraso > 0 ? diasAtraso : undefined,
              saldo_devedor_parcela: Math.round(Math.max(0, pagarParcela.valor - valorFinal) * 100) / 100,
              saldo_devedor_total: Math.round(Math.max(0, novoSaldoDevedor) * 100) / 100,
              total_parcelas_pagas: totalPagas,
              total_parcelas_restantes: totalRestantes,
            },
            cliente: {
              nome: cliente.nome,
              cpf: cliente.cpf ?? null,
              telefone: cliente.telefone,
              endereco: cliente.endereco,
              numero: cliente.numero,
              complemento: cliente.complemento,
              bairro: cliente.bairro,
              cidade: cliente.cidade,
              estado: cliente.estado,
              cep: cliente.cep
            },
            contrato: { numero_contrato: emprestimo.numero_contrato },
            empresaNome: empresaAtual.nome,
            empresaCnpj: empresaAtual.cnpj,
            empresaTelefone: empresaAtual.telefone,
            empresaEmail: empresaAtual.email,
            empresaEndereco: empresaAtual.endereco,
            empresaCidade: empresaAtual.cidade,
            empresaEstado: empresaAtual.estado,
            empresaCep: empresaAtual.cep,
          }

          const reciboBlob = await gerarReciboParcela(reciboParams, { output: 'blob' })

          if (reciboBlob instanceof Blob) {
            const rcId = `${emprestimo.numero_contrato}-P${String(pagarParcela.numero_parcela).padStart(2, '0')}`
            const filePath = `${empresaAtual.id}/${cliente.id}/recibos/recibo-${rcId}-${Date.now()}.pdf`
            const { error: uploadError } = await supabase.storage
              .from('documentos-clientes')
              .upload(filePath, reciboBlob, {
                contentType: 'application/pdf',
                upsert: false,
              })

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('documentos-clientes')
                .getPublicUrl(filePath)
              
              const publicUrl = urlData.publicUrl

              const formas: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque' }
              const formaLabel = formas[pagForma] ?? 'PIX'

              const msgTexto = `Confirmamos o recebimento de ${formatarMoeda(valorFinal)} referente à parcela ${pagarParcela.numero_parcela}/${pagarParcela.total_parcelas} do contrato ${emprestimo.numero_contrato} via ${formaLabel}. Segue seu recibo em anexo.\n\n${publicUrl}`

              await supabase.from('notificacoes_log').insert({
                empresa_id: empresaAtual.id,
                canal: 'whatsapp',
                destinatario: cliente.telefone,
                assunto: `Recibo de Pagamento - Parcela ${pagarParcela.numero_parcela}`,
                mensagem: msgTexto,
                referencia_tipo: 'emprestimo',
                referencia_id: emprestimo.id,
                status: 'pendente',
              })
            }
          }

          // Se for a última parcela quitada, também gera o Termo de Quitação Integral!
          if (totalRestantes === 0) {
            const { data: todasP_Q } = await supabase
              .from('parcelas_emprestimo')
              .select('*')
              .eq('emprestimo_id', emprestimo.id)
              .order('numero_parcela', { ascending: true })

            const parcelasMapeadas = (todasP_Q ?? []).map(pItem => {
              if (pItem.id === pagarParcela.id) {
                return {
                  numero_parcela: pagarParcela.numero_parcela,
                  data_vencimento: pagarParcela.data_vencimento,
                  data_pagamento: hoje,
                  valor: pagarParcela.valor,
                  valor_pago: valorFinal,
                  tipo_pagamento: pagForma,
                  status: 'pago'
                }
              }
              return {
                numero_parcela: pItem.numero_parcela,
                data_vencimento: pItem.data_vencimento,
                data_pagamento: pItem.data_pagamento,
                valor: pItem.valor,
                valor_pago: pItem.valor_pago,
                tipo_pagamento: pItem.tipo_pagamento,
                status: pItem.status
              }
            })

            const quitacaoParams = {
              contrato: {
                numero_contrato: emprestimo.numero_contrato,
                valor_principal: emprestimo.valor_principal,
                taxa_juros: emprestimo.taxa_juros,
                prazo_meses: emprestimo.prazo_meses,
                data_liberacao: emprestimo.data_liberacao,
                data_quitacao: hoje,
              },
              cliente: {
                nome: cliente.nome,
                cpf: cliente.cpf ?? null,
                telefone: cliente.telefone,
                endereco: cliente.endereco,
                numero: cliente.numero,
                complemento: cliente.complemento,
                bairro: cliente.bairro,
                cidade: cliente.cidade,
                estado: cliente.estado,
                cep: cliente.cep
              },
              parcelas: parcelasMapeadas,
              empresaNome: empresaAtual.nome,
              empresaCnpj: empresaAtual.cnpj,
              empresaTelefone: empresaAtual.telefone,
              empresaEmail: empresaAtual.email,
              empresaEndereco: empresaAtual.endereco,
              empresaCidade: empresaAtual.cidade,
              empresaEstado: empresaAtual.estado,
              empresaCep: empresaAtual.cep,
            }

            const quitacaoBlob = await gerarQuitacaoPDF(quitacaoParams, { output: 'blob' })

            if (quitacaoBlob instanceof Blob) {
              const filePathQ = `${empresaAtual.id}/${cliente.id}/recibos/quitacao-${emprestimo.numero_contrato}-${Date.now()}.pdf`
              const { error: uploadErrorQ } = await supabase.storage
                .from('documentos-clientes')
                .upload(filePathQ, quitacaoBlob, {
                  contentType: 'application/pdf',
                  upsert: false,
                })

              if (!uploadErrorQ) {
                const { data: urlDataQ } = supabase.storage
                  .from('documentos-clientes')
                  .getPublicUrl(filePathQ)
                
                const publicUrlQ = urlDataQ.publicUrl

                const msgTextoQ = `Parabéns, ${cliente.nome}! O seu empréstimo do contrato ${emprestimo.numero_contrato} foi 100% QUITADO e liquidado com sucesso! Segue seu Termo de Quitação Integral em anexo.\n\n${publicUrlQ}`

                await supabase.from('notificacoes_log').insert({
                  empresa_id: empresaAtual.id,
                  canal: 'whatsapp',
                  destinatario: cliente.telefone,
                  assunto: `Termo de Quitação Integral - ${emprestimo.numero_contrato}`,
                  mensagem: msgTextoQ,
                  referencia_tipo: 'emprestimo',
                  referencia_id: emprestimo.id,
                  status: 'pendente',
                })
              }
            }
          }
        }
      } catch (e) {
        console.error('Erro ao gerar/enviar PDF do recibo:', e)
      }

      setPagarParcela(null)
      carregarDados()
    } catch (err) { logError('registrarPagamento', err); toast.error(parseSupabaseError(err, 'Erro ao registrar pagamento')) }
    finally { setPagando(false) }
  }

  async function quitarAntecipado() {
    if (!emprestimo || !empresaAtual || !cliente) return
    setProcessando(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const { error: e1 } = await supabase
        .from('emprestimos')
        .update({ status: 'quitado', saldo_devedor: 0, data_quitacao: hoje })
        .eq('id', emprestimo.id)
        .eq('empresa_id', empresaAtual.id)
      if (e1) throw e1

      // Mark all pending/atrasado parcelas as PAGO (not cancelled)
      const { data: pendentes } = await supabase
        .from('parcelas_emprestimo')
        .select('id, valor, numero_parcela, total_parcelas, data_vencimento')
        .eq('emprestimo_id', emprestimo.id)
        .eq('empresa_id', empresaAtual.id)
        .in('status', ['pendente', 'atrasado'])

      if (pendentes && pendentes.length > 0) {
        await supabase
          .from('parcelas_emprestimo')
          .update({ status: 'pago', valor_pago: null, data_pagamento: hoje, tipo_pagamento: 'dinheiro' })
          .eq('emprestimo_id', emprestimo.id)
          .eq('empresa_id', empresaAtual.id)
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

      // Generate Termo de Quitação PDF and trigger notifications
      const { data: todasP } = await supabase
        .from('parcelas_emprestimo')
        .select('*')
        .eq('emprestimo_id', emprestimo.id)
        .order('numero_parcela')

      const parcelasMapeadas = (todasP ?? []).map(p => ({
        numero_parcela: p.numero_parcela,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento || hoje,
        valor: p.valor,
        valor_pago: p.valor_pago || p.valor,
        tipo_pagamento: p.tipo_pagamento || 'dinheiro',
        status: 'pago',
      }))

      const quitacaoParams = {
        contrato: {
          numero_contrato: emprestimo.numero_contrato,
          valor_principal: emprestimo.valor_principal,
          taxa_juros: emprestimo.taxa_juros,
          prazo_meses: emprestimo.prazo_meses,
          data_liberacao: emprestimo.data_liberacao,
          data_quitacao: hoje,
        },
        cliente: {
          nome: cliente.nome,
          cpf: cliente.cpf ?? null,
          telefone: cliente.telefone,
          endereco: cliente.endereco,
          numero: cliente.numero,
          complemento: cliente.complemento,
          bairro: cliente.bairro,
          cidade: cliente.cidade,
          estado: cliente.estado,
          cep: cliente.cep
        },
        parcelas: parcelasMapeadas,
        empresaNome: empresaAtual.nome,
        empresaCnpj: empresaAtual.cnpj,
        empresaTelefone: empresaAtual.telefone,
        empresaEmail: empresaAtual.email,
        empresaEndereco: empresaAtual.endereco,
        empresaCidade: empresaAtual.cidade,
        empresaEstado: empresaAtual.estado,
        empresaCep: empresaAtual.cep,
      }

      const quitacaoBlob = await gerarQuitacaoPDF(quitacaoParams, { output: 'blob' })

      if (quitacaoBlob instanceof Blob) {
        const filePathQ = `${empresaAtual.id}/${cliente.id}/recibos/quitacao-${emprestimo.numero_contrato}-${Date.now()}.pdf`
        const { error: uploadErrorQ } = await supabase.storage
          .from('documentos-clientes')
          .upload(filePathQ, quitacaoBlob, {
            contentType: 'application/pdf',
            upsert: false,
          })

        if (!uploadErrorQ) {
          const { data: urlDataQ } = supabase.storage
            .from('documentos-clientes')
            .getPublicUrl(filePathQ)
          
          const publicUrlQ = urlDataQ.publicUrl

          const msgTextoQ = `Parabéns, ${cliente.nome}! O seu empréstimo do contrato ${emprestimo.numero_contrato} foi 100% QUITADO e liquidado antecipadamente com sucesso! Segue seu Termo de Quitação Integral em anexo.\n\n${publicUrlQ}`

          await supabase.from('notificacoes_log').insert({
            empresa_id: empresaAtual.id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Termo de Quitação Integral - ${emprestimo.numero_contrato}`,
            mensagem: msgTextoQ,
            status: 'pendente',
          })
        }
      }

      toast.success('Empréstimo quitado com sucesso! Termo de Quitação enviado.')
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
      await supabase.from('emprestimos').update({ status: 'cancelado' }).eq('id', emprestimo.id).eq('empresa_id', empresaAtual.id)
      await supabase.from('parcelas_emprestimo').update({ status: 'cancelado' }).eq('emprestimo_id', emprestimo.id).eq('empresa_id', empresaAtual.id).in('status', ['pendente', 'atrasado'])
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
        <X size={48} className="text-muted-foreground/30 animate-pulse" />
        <p className="text-muted-foreground text-lg font-bold">Empréstimo não localizado</p>
        <Button variant="outline" className="rounded-full font-semibold border-border hover:bg-muted" onClick={() => router.push('/factoring/emprestimos')}>
          <ChevronLeft size={16} className="mr-1" /> Voltar para lista
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

  function rowClass(p: ParcelaEmprestimo) {
    if (p.status === 'pago') return 'bg-[#E6F4EA]/10 border-b border-border/40 hover:bg-[#E6F4EA]/20'
    if (p.status === 'atrasado') return 'bg-[#FCE8E6]/25 border-b border-border/40 hover:bg-[#FCE8E6]/35 font-semibold text-[#C5221F]'
    if (p.status === 'pendente') {
      const hoje = new Date().toISOString().split('T')[0]
      if (p.data_vencimento === hoje) return 'bg-[#FEF7E0]/30 border-b border-border/40 hover:bg-[#FEF7E0]/40 font-semibold'
    }
    return 'border-b border-border/40 hover:bg-muted/10'
  }

  return (
    <AppShell empresa="factoring" titulo={`Contrato ${emprestimo.numero_contrato}`}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Voltar para empréstimos" className="h-9 w-9 rounded-full hover:bg-muted" onClick={() => router.push('/factoring/emprestimos')}>
              <ChevronLeft size={20} className="text-muted-foreground" />
            </Button>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="font-mono text-xl font-extrabold text-[#1A73E8]">
                  {emprestimo.numero_contrato}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={{ backgroundColor: statusInfo.bg, color: statusInfo.text, borderColor: `${statusInfo.text}18` }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/60 font-semibold">
                {emprestimo.data_liberacao ? `Data de Liberação: ${formatarData(emprestimo.data_liberacao)}` : 'Aguardando Liberação'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full font-semibold h-9 px-4 border-border hover:bg-muted/50 text-xs"
              onClick={handleGerarContrato}
              disabled={gerandoPDF}
            >
              {gerandoPDF
                ? <Loader2 size={14} className="animate-spin text-[#1A73E8]" />
                : <Download size={14} className="text-muted-foreground" />
              }
              {gerandoPDF ? 'Gerando...' : 'Contrato PDF'}
            </Button>
            {emprestimo.status === 'quitado' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-[#34A853] border-[#34A853]/25 hover:bg-[#E6F4EA] rounded-full font-semibold h-9 px-4 text-xs"
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
                  className="gap-1.5 text-white rounded-full bg-[#1A73E8] hover:bg-[#1557B0] font-semibold h-9 px-4 shadow-sm text-xs"
                  onClick={() => abrirPagamento(proxima)}
                >
                  <DollarSign size={14} />
                  Receber Parcela
                </Button>
              ) : null
            })()}
            {['ativo', 'inadimplente'].includes(emprestimo.status) && (
              <Button size="sm" variant="outline" className="gap-1.5 rounded-full font-semibold h-9 px-4 border-border hover:bg-muted/50 text-xs" onClick={() => setQuitarDialog(true)}>
                <CheckCircle2 size={14} className="text-muted-foreground" />
                Quitar Contrato
              </Button>
            )}
            {['analise', 'aprovado', 'ativo'].includes(emprestimo.status) && (
              <Button size="sm" variant="outline" className="gap-1.5 text-[#EA4335] border-[#EA4335]/25 hover:bg-[#FCE8E6] rounded-full font-semibold h-9 px-4 text-xs" onClick={() => setCancelarDialog(true)}>
                <X size={14} />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-m3-1 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Valor Principal</p>
            <p className="text-lg font-black text-foreground">{formatarMoeda(emprestimo.valor_principal)}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 shadow-m3-1 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Taxa de Juros</p>
            <p className="text-lg font-black text-foreground">{emprestimo.taxa_juros}% a.m.</p>
            <p className="text-[10px] font-semibold text-muted-foreground/60 mt-0.5">≡ {taxaAnual}% a.a. compostos</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 shadow-m3-1 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Prazo Contratual</p>
            <p className="text-lg font-black text-foreground">{emprestimo.prazo_meses} parcelas</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 shadow-m3-1 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Valor da Parcela</p>
            <p className="text-lg font-black text-foreground">{formatarMoeda(emprestimo.valor_parcela)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Totals */}
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5 space-y-4">
              <h3 className="font-bold text-foreground text-sm border-b border-border/60 pb-2">Demonstrativo Financeiro</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
                {[
                  { l: 'Total Pactuado', v: emprestimo.total_pagar, color: '#1A73E8' },
                  { l: 'Total Recebido', v: totalPago, color: '#34A853' },
                  { l: 'Saldo Devedor', v: emprestimo.saldo_devedor, color: '#FA903E' },
                  { l: 'Parcelas Quitadas', v: `${parcelasPagas}/${emprestimo.prazo_meses}`, color: 'var(--muted-foreground)', isText: true },
                ].map(c => (
                  <div key={c.l} className="text-center space-y-0.5">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{c.l}</p>
                    <p className="text-base font-black" style={{ color: c.color }}>
                      {c.isText ? c.v : formatarMoeda(c.v as number)}
                    </p>
                  </div>
                ))}
              </div>
              {/* Breakdown juros compostos — o que já foi pago */}
              {parcelasPagas > 0 && (
                <div className="pt-3.5 border-t border-border/60 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Composição dos Valores Recebidos</p>
                  <div className="flex rounded-full overflow-hidden h-2.5 bg-muted/60 border border-border/40">
                    <div
                      className="h-full bg-[#1A73E8] transition-all duration-500"
                      style={{ width: totalPago > 0 ? `${Math.round((totalPrincipalPago / totalPago) * 100)}%` : '0%' }}
                    />
                    <div className="h-full bg-[#FA903E] flex-1 transition-all duration-500" />
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground flex-wrap pt-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1A73E8] inline-block shadow-sm" />
                      Principal amortizado: <strong className="text-foreground">{formatarMoeda(totalPrincipalPago)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FA903E] inline-block shadow-sm" />
                      Juros faturados: <strong className="text-foreground">{formatarMoeda(totalJurosPagos)}</strong>
                    </span>
                  </div>
                </div>
              )}
              {/* Projeção total do contrato */}
              <div className="pt-3.5 border-t border-border/60 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider font-semibold">Composição Geral Pactuada do Contrato</p>
                <div className="flex rounded-full overflow-hidden h-2.5 bg-muted/60 border border-border/40">
                  <div
                    className="h-full bg-[#1A73E8] transition-all duration-500"
                    style={{ width: emprestimo.total_pagar > 0 ? `${Math.round((emprestimo.valor_principal / emprestimo.total_pagar) * 100)}%` : '0%' }}
                  />
                  <div className="h-full bg-[#FA903E] flex-1 transition-all duration-500" />
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground flex-wrap pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1A73E8] inline-block shadow-sm" />
                    Amortização Principal: <strong className="text-foreground">{formatarMoeda(emprestimo.valor_principal)}</strong> ({emprestimo.total_pagar > 0 ? Math.round((emprestimo.valor_principal / emprestimo.total_pagar) * 100) : 0}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FA903E] inline-block shadow-sm" />
                    Encargos de Juros Totais: <strong className="text-foreground">{formatarMoeda(emprestimo.total_juros)}</strong> ({emprestimo.total_pagar > 0 ? Math.round((emprestimo.total_juros / emprestimo.total_pagar) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Parcelas table */}
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-muted/10">
                <h3 className="font-bold text-foreground text-sm">Quadro Demonstrativo de Parcelas</h3>
                <span className="text-xs font-semibold text-muted-foreground bg-card border border-border/60 px-2.5 py-1 rounded-full">{parcelasPagas} de {parcelas.length} quitadas</span>
              </div>
              {/* Header */}
              <div className="grid grid-cols-[40px_1.2fr_1.1fr_1.1fr_100px_auto] gap-2 px-5 py-3 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                <span>Nº</span>
                <span>Vencimento</span>
                <span>Parcela</span>
                <span>Pago</span>
                <span>Status</span>
                <span />
              </div>
              <div className="divide-y divide-border/30">
                {parcelas.map(p => {
                  const statusColor: Record<string, string> = { pago: '#34A853', atrasado: '#EA4335', pendente: '#64748b', cancelado: '#94a3b8', renegociado: '#FA903E' }
                  const statusLabel: Record<string, string> = { pago: 'Pago', atrasado: 'Atrasado', pendente: 'Pendente', cancelado: 'Cancelado', renegociado: 'Renegoc.' }
                  const cor = statusColor[p.status] ?? '#64748b'
                  return (
                    <div key={p.id} className={cn('grid grid-cols-[40px_1.2fr_1.1fr_1.1fr_100px_auto] gap-2 px-5 py-3.5 text-sm items-center transition-all', rowClass(p))}>
                      <span className="text-muted-foreground/80 font-bold tabular-nums text-xs">{p.numero_parcela}</span>
                      <div className="flex items-center gap-1.5 min-w-0 font-semibold">
                        <span className="tabular-nums truncate text-xs">
                          {formatarData(p.data_vencimento)}
                        </span>
                        {p.dias_atraso > 0 && (
                          <span className="shrink-0 text-[9px] font-black text-[#EA4335] bg-[#FCE8E6] px-1.5 py-0.5 rounded-full">
                            {p.dias_atraso}d
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums font-bold">{formatarMoeda(p.valor)}</span>
                      <span className="tabular-nums font-semibold text-[#34A853]">{p.valor_pago ? formatarMoeda(p.valor_pago) : '—'}</span>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>
                        {statusLabel[p.status] ?? p.status}
                      </span>
                      {['pendente', 'atrasado'].includes(p.status) ? (
                        <Button
                          size="sm" className="h-7 text-xs px-3 rounded-full text-white bg-[#1A73E8] hover:bg-[#1557B0] font-semibold gap-1 shrink-0 shadow-sm"
                          onClick={e => { e.stopPropagation(); abrirPagamento(p) }}
                        >
                          <DollarSign size={12} />
                          Receber
                        </Button>
                      ) : p.status === 'pago' ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Baixar recibo oficial"
                            onClick={() => handleGerarRecibo(p)}
                            className="h-7 px-3 rounded-full flex items-center gap-1 text-[11px] font-semibold text-[#1557B0] bg-[#E8F0FE] hover:bg-[#1A73E8]/15 border border-[#1A73E8]/10 transition-colors shadow-sm"
                          >
                            <Receipt size={12} />
                            Recibo
                          </button>
                          {cliente?.telefone && (
                            <button
                              type="button"
                              title="Enviar comprovante via WhatsApp"
                              onClick={() => handleWhatsAppRecibo(p)}
                              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-[#34A853] hover:bg-[#E6F4EA] border border-transparent hover:border-[#34A853]/15 transition-all"
                            >
                              <MessageCircle size={14} />
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
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5 space-y-4">
              <h3 className="font-bold text-foreground text-sm border-b border-border/60 pb-2">Histórico de Caixa atrelado</h3>
              {movs.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-6 font-semibold">Nenhuma movimentação de caixa lançada para este título.</p>
              ) : (
                <div className="space-y-3">
                  {movs.map(m => (
                    <div key={m.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted/10 transition-colors">
                      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border shadow-sm',
                        m.tipo === 'entrada' ? 'bg-[#E6F4EA] border-[#34A853]/20' : 'bg-[#FCE8E6] border-[#EA4335]/20')}>
                        {m.tipo === 'entrada'
                          ? <ArrowUpCircle size={14} className="text-[#34A853]" />
                          : <ArrowDownCircle size={14} className="text-[#EA4335]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap font-semibold">
                          <p className="text-xs text-foreground truncate">{m.descricao}</p>
                          <p className={cn('text-xs font-bold shrink-0', m.tipo === 'entrada' ? 'text-[#34A853]' : 'text-[#EA4335]')}>
                            {m.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(m.valor)}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 font-bold mt-0.5">{formatarData(m.data_movimentacao)} · CATEGORIA: {m.categoria?.toUpperCase()}</p>
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
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                  <User size={14} className="text-muted-foreground" />
                  Tomador do Crédito
                </h3>
                <Link href={`/factoring/clientes/${cliente.id}`} className="group block">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm"
                      style={{ backgroundColor: '#1A73E8' }}
                    >
                      {iniciais(cliente.nome)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-sm group-hover:text-[#1A73E8] transition-colors truncate">{cliente.nome}</p>
                      <p className="text-[11px] text-muted-foreground/60 font-bold mt-0.5">{formatarCPF(cliente.cpf ?? '')}</p>
                    </div>
                  </div>
                </Link>
                <div className="flex justify-center py-2 border-t border-border/30">
                  <ScoreGauge score={cliente.score_interno} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground/60 text-center font-bold">{formatarTelefone(cliente.telefone)}</p>
                {empresaAtual && (
                  <ClienteSheet
                    clienteId={cliente.id}
                    empresaId={empresaAtual.id}
                    trigger={
                      <button type="button" className="w-full text-xs text-center py-2 px-4 rounded-full border border-border text-muted-foreground hover:bg-muted font-bold transition-all shadow-sm">
                        Ver Ficha Cadastral Completa
                      </button>
                    }
                  />
                )}
              </div>
            )}

            {/* Guarantees */}
            {emprestimo.garantias && (
              <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider border-b border-border/40 pb-2 mb-2">Garantias</h3>
                <p className="text-xs text-muted-foreground font-semibold leading-relaxed">{emprestimo.garantias}</p>
              </div>
            )}

            {/* Docs */}
            <div className="bg-card rounded-2xl border border-border shadow-m3-1 p-5 relative overflow-hidden space-y-3">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A73E8]" />
              <h3 className="font-bold text-foreground text-xs uppercase tracking-wider border-b border-border/40 pb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-muted-foreground" />
                Documentação Digital
              </h3>
              {Array.isArray(emprestimo.documentos) && emprestimo.documentos.length > 0 ? (
                <div className="space-y-2">
                  {(emprestimo.documentos as Array<{ name: string; url: string }>).map((doc, i) => (
                    <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/30 text-xs text-muted-foreground font-semibold transition-all">
                      <FileText size={14} className="text-muted-foreground/60" />
                      <span className="truncate flex-1">{doc.name}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 font-semibold py-2">Nenhum contrato digital anexado.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Dialog ─────────────────────────────────────── */}
      {pagarParcela && (() => {
        const dias = calcDias(pagarParcela.data_vencimento)
        const obsText = emprestimo?.observacoes ?? ''
        const matchMora = obsText.match(/\[Mora:\s*([\d.]+)%\s*ao\s*dia\]/)
        const moraDiario = matchMora ? parseFloat(matchMora[1]) : (configFactoring?.juros_mora_diario ?? 0.033)
        const multaAtrasoPct = configFactoring?.multa_atraso ?? 2.0

        const multaCalculada = dias > 0
          ? (pagarParcela.status === 'pendente' ? pagarParcela.valor * (multaAtrasoPct / 100) : (pagarParcela.multa || pagarParcela.valor * (multaAtrasoPct / 100)))
          : 0
        const jurosCalculado = dias > 0
          ? pagarParcela.valor * (moraDiario / 100) * dias
          : 0

        const subtotal = (pagarParcela.valor + multaCalculada + jurosCalculado) - (pagarParcela.valor_pago ?? 0)
        const descontoNum = Number(pagDesconto) || 0
        const descontoValor = pagTipoDesc === '%' ? subtotal * descontoNum / 100 : descontoNum
        const valorParcialNum = Number(pagValorParcial) || 0
        const isParcial = valorParcialNum > 0 && valorParcialNum < subtotal - 0.009
        const total = isParcial ? valorParcialNum : Math.max(0, subtotal - descontoValor)
        const troco = pagForma === 'dinheiro' ? Math.max(0, (Number(pagValorRecebido) || 0) - total) : 0
        const restante = isParcial ? Math.max(0, subtotal - total) : 0
        return (
          <Dialog open onOpenChange={open => { if (!open) setPagarParcela(null) }}>
            <DialogContent className="sm:max-w-md rounded-2xl border-border">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-foreground tracking-tight">Baixa de Parcela {pagarParcela.numero_parcela}/{pagarParcela.total_parcelas}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1 max-h-[65vh] overflow-y-auto pr-1">
                {/* Info — composição do valor */}
                <div className={cn('rounded-xl p-4 text-sm space-y-1.5 relative overflow-hidden border', dias > 0 ? 'bg-[#FCE8E6] border-[#EA4335]/20' : 'bg-muted/30 border-border/60')}>
                  <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: dias > 0 ? '#EA4335' : '#1A73E8' }} />
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-muted-foreground">Vencimento original</span>
                    <span className={dias > 0 ? 'text-[#C5221F] font-bold text-xs' : 'text-foreground'}>
                      {formatarData(pagarParcela.data_vencimento)}
                      {dias > 0 && ` (${dias}d de atraso)`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-semibold text-xs border-t border-border/30 pt-2">
                    <span className="text-muted-foreground">Valor original da Parcela</span>
                    <span className="text-foreground font-semibold">{formatarMoeda(pagarParcela.valor)}</span>
                  </div>
                  
                  {dias > 0 && (
                    <>
                      <div className="flex justify-between items-center text-xs font-semibold text-[#C5221F]">
                        <span>Multa por Atraso ({multaAtrasoPct}%)</span>
                        <span>+{formatarMoeda(multaCalculada)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold text-[#C5221F]">
                        <span>Juros de Mora ({moraDiario}% a.d. - {dias}d)</span>
                        <span>+{formatarMoeda(jurosCalculado)}</span>
                      </div>
                    </>
                  )}

                  {pagarParcela.valor_pago && pagarParcela.valor_pago > 0 && (
                    <div className="flex justify-between items-center text-xs font-semibold text-[#34A853]">
                      <span>Amortizado anteriormente</span>
                      <span>-{formatarMoeda(pagarParcela.valor_pago)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center font-bold text-base border-t border-border/30 pt-2 mt-1">
                    <span className="text-foreground">Total Atualizado hoje</span>
                    <span className="text-[#1A73E8] font-black">{formatarMoeda(subtotal)}</span>
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Forma de Recebimento</Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FORMAS_PAG.map(f => (
                      <button
                        key={f.key}
                        onClick={() => setPagForma(f.key)}
                        className={cn(
                          'flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-[10px] font-bold transition-all gap-1.5 focus:outline-none',
                          pagForma === f.key
                            ? 'border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8] shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                        )}
                      >
                        {f.icon}
                        <span className="truncate max-w-[90%]">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pagamento Parcial ou Total */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Desconto concedido</Label>
                    <div className="flex rounded-lg border border-border focus-within:border-[#1A73E8] focus-within:ring-1 focus-within:ring-[#1A73E8] overflow-hidden">
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={pagDesconto}
                        onChange={e => { setPagDesconto(e.target.value); setPagValorParcial('') }}
                        className="w-full h-10 px-3 bg-transparent text-sm focus:outline-none font-semibold"
                        disabled={valorParcialNum > 0}
                      />
                      <button
                        type="button"
                        onClick={() => setPagTipoDesc(p => p === 'R$' ? '%' : 'R$')}
                        className="bg-muted px-2.5 border-l border-border text-xs font-bold text-muted-foreground hover:bg-muted/80 focus:outline-none"
                      >
                        {pagTipoDesc}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recebimento Parcial</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-xs font-bold">R$</span>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Valor parcial"
                        value={pagValorParcial}
                        onChange={e => { setPagValorParcial(e.target.value); setPagDesconto('') }}
                        className="h-10 pl-8 pr-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg text-sm font-semibold"
                        disabled={descontoNum > 0}
                      />
                    </div>
                  </div>
                </div>

                {/* Se for dinheiro, mostra campo de valor recebido para calcular troco */}
                {pagForma === 'dinheiro' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor Recebido (para Troco)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-xs font-bold">R$</span>
                      <Input
                        type="number"
                        min="1"
                        placeholder="0.00"
                        value={pagValorRecebido}
                        onChange={e => setPagValorRecebido(e.target.value)}
                        className="h-11 pl-8 pr-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg text-sm font-bold text-foreground"
                      />
                    </div>
                  </div>
                )}

                {/* Organização do Saldo Restante */}
                {isParcial && (
                  <div className="border border-[#FA903E]/20 bg-[#FFF7ED]/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between border-b border-[#FA903E]/10 pb-2">
                      <span className="text-xs font-bold text-[#FA903E] uppercase tracking-wider">Saldo Remanescente</span>
                      <span className="text-sm font-black text-[#FA903E]">{formatarMoeda(restante)}</span>
                    </div>
                    
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Como organizar este saldo?</Label>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPartialOption('proxima')}
                        className={cn(
                          'flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all gap-1 focus:outline-none h-14',
                          partialOption === 'proxima'
                            ? 'border-[#FA903E] bg-[#FFF7ED] text-[#FA903E] shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                        )}
                      >
                        <span className="text-center leading-tight">Somar à Próxima</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialOption('diluir')}
                        className={cn(
                          'flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all gap-1 focus:outline-none h-14',
                          partialOption === 'diluir'
                            ? 'border-[#FA903E] bg-[#FFF7ED] text-[#FA903E] shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                        )}
                      >
                        <span className="text-center leading-tight">Diluir Restantes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialOption('extra')}
                        className={cn(
                          'flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all gap-1 focus:outline-none h-14',
                          partialOption === 'extra'
                            ? 'border-[#FA903E] bg-[#FFF7ED] text-[#FA903E] shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/30'
                        )}
                      >
                        <span className="text-center leading-tight">Parcela Extra</span>
                      </button>
                    </div>

                    {/* Explicações da opção */}
                    <div className="text-[10px] text-muted-foreground/80 leading-relaxed font-medium bg-muted/20 p-2 rounded-lg">
                      {partialOption === 'proxima' && (
                        <span>O saldo de {formatarMoeda(restante)} será somado ao valor da próxima parcela a vencer.</span>
                      )}
                      {partialOption === 'diluir' && (
                        <span>O saldo de {formatarMoeda(restante)} será dividido igualmente e somado em todas as parcelas restantes em aberto.</span>
                      )}
                      {partialOption === 'extra' && (
                        <span>Será criada uma nova parcela avulsa com o valor de {formatarMoeda(restante)} para a data de vencimento escolhida abaixo.</span>
                      )}
                    </div>

                    {/* Juros sobre saldo remanescente — Exibe para todas as opções */}
                    <div className="space-y-2 pt-2 border-t border-[#FA903E]/20">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Juros sobre o saldo remanescente (opcional)
                      </Label>
                      <div className="relative flex items-center">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          value={partialJurosPct}
                          onChange={e => setPartialJurosPct(e.target.value)}
                          className="h-9 pr-8 focus-visible:ring-1 focus-visible:ring-[#FA903E] focus-visible:border-[#FA903E] rounded-lg text-sm font-semibold"
                        />
                        <span className="absolute right-3 text-xs font-bold text-muted-foreground/60">%</span>
                      </div>
                      {Number(partialJurosPct) > 0 && (
                        <div className="rounded-lg border border-[#FA903E]/25 bg-orange-50/50 dark:bg-orange-950/10 p-2.5 space-y-1 text-[11px] font-semibold">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Saldo restante original</span>
                            <span>{formatarMoeda(restante)}</span>
                          </div>
                          <div className="flex justify-between text-[#FA903E]">
                            <span>+ {Number(partialJurosPct)}% juros</span>
                            <span>+ {formatarMoeda(Math.round(restante * (Number(partialJurosPct) / 100) * 100) / 100)}</span>
                          </div>
                          <div className="flex justify-between text-foreground font-black border-t border-[#FA903E]/20 pt-1.5">
                            {partialOption === 'proxima' && <span>Soma à próxima parcela</span>}
                            {partialOption === 'diluir' && <span>Valor total a diluir</span>}
                            {partialOption === 'extra' && <span>Valor da parcela extra</span>}
                            <span className="text-[#FA903E]">{formatarMoeda(Math.round(restante * (1 + Number(partialJurosPct) / 100) * 100) / 100)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vencimento da Parcela Extra */}
                    {partialOption === 'extra' && (
                      <div className="space-y-1.5 pt-1.5 border-t border-border/30">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vencimento da Parcela Extra</Label>
                        <Input
                          type="date"
                          value={partialDueDate}
                          onChange={e => setPartialDueDate(e.target.value)}
                          className="h-9 focus-visible:ring-1 focus-visible:ring-[#FA903E] focus-visible:border-[#FA903E] rounded-lg text-xs font-semibold"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Quadro resumo final do lançamento */}
                <div className="bg-[#E8F0FE]/40 border border-[#1A73E8]/10 rounded-xl p-3.5 text-xs space-y-1 font-semibold">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Subtotal devido</span>
                    <span>{formatarMoeda(subtotal)}</span>
                  </div>
                  {descontoValor > 0 && (
                    <div className="flex justify-between items-center text-[#EA4335]">
                      <span>Desconto</span>
                      <span>-{formatarMoeda(descontoValor)}</span>
                    </div>
                  )}
                  {restante > 0 && (
                    <div className="flex justify-between items-center text-[#FA903E]">
                      <span>Diferença a transferir</span>
                      <span>{formatarMoeda(restante)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-base font-black text-foreground border-t border-border/30 pt-2 mt-1">
                    <span>Lançar no Caixa</span>
                    <span>{formatarMoeda(total)}</span>
                  </div>
                  {pagForma === 'dinheiro' && (Number(pagValorRecebido) || 0) > 0 && (
                    <div className="flex justify-between items-center text-base font-bold text-[#34A853] border-t border-dashed border-border/30 pt-1 mt-1">
                      <span>Troco a devolver</span>
                      <span>{formatarMoeda(troco)}</span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPagarParcela(null)}
                  disabled={pagando}
                  className="rounded-full font-semibold border-border"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmarPagamentoParcela}
                  disabled={pagando}
                  className="text-white rounded-full bg-[#1A73E8] hover:bg-[#1557B0] font-bold"
                >
                  {pagando ? 'Registrando...' : 'Confirmar Recebimento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Quitar antecipadamente */}
      <ConfirmDialog
        open={quitarDialog}
        onOpenChange={setQuitarDialog}
        titulo="Quitar empréstimo antecipadamente?"
        descricao={`Esta operação dará baixa imediata em todas as parcelas pendentes do contrato ${emprestimo.numero_contrato}.`}
        labelConfirmar="Quitar contrato"
        onConfirmar={quitarAntecipado}
        carregando={processando}
      />

      {/* Cancelar contrato */}
      <ConfirmDialog
        open={cancelarDialog}
        onOpenChange={setCancelarDialog}
        titulo="Cancelar contrato de empréstimo?"
        descricao={`As parcelas em aberto do contrato ${emprestimo.numero_contrato} serão canceladas. Esta operação não pode ser revertida.`}
        labelConfirmar="Cancelar contrato"
        variante="danger"
        onConfirmar={cancelarContrato}
        carregando={processando}
      />
    </AppShell>
  )
}
