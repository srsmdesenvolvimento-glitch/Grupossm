'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, DollarSign, QrCode, ArrowLeftRight, FileText, CreditCard,
  CheckCircle2, X, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import type { ClienteFactoring, ParcelaEmprestimo, TipoPagamento } from '@/lib/types/database'

type ClienteSumario = Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'score_interno'>
type ParcelaComContrato = ParcelaEmprestimo & { numero_contrato: string }

function FormaIcon({ forma }: { forma: TipoPagamento }) {
  switch (forma) {
    case 'dinheiro': return <DollarSign size={18} />
    case 'pix': return <QrCode size={18} />
    case 'transferencia': return <ArrowLeftRight size={18} />
    case 'boleto': return <FileText size={18} />
    case 'cheque': return <CreditCard size={18} />
    default: return null
  }
}

const FORMAS: { key: TipoPagamento; label: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'pix', label: 'PIX' },
  { key: 'transferencia', label: 'Transferência' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cheque', label: 'Cheque' },
]

export default function LancarPagamentoPage() {
  const { empresaAtual } = useEmpresa()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ClienteSumario[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [cliente, setCliente] = useState<ClienteSumario | null>(null)
  const [parcelas, setParcelas] = useState<ParcelaComContrato[]>([])
  const [carregandoParcelas, setCarregandoParcelas] = useState(false)

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [desconto, setDesconto] = useState('')
  const [tipoDesconto, setTipoDesconto] = useState<'R$' | '%'>('R$')
  const [forma, setForma] = useState<TipoPagamento>('pix')
  const [valorRecebido, setValorRecebido] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const buscarClientes = useCallback(async (q: string) => {
    if (!empresaAtual || q.trim().length < 2) {
      setResultados([])
      setShowDropdown(false)
      return
    }
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('clientes_factoring')
        .select('id, nome, cpf, telefone, score_interno')
        .eq('empresa_id', empresaAtual.id)
        .or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(8)
      setResultados((data ?? []) as ClienteSumario[])
      setShowDropdown(true)
    } finally {
      setBuscando(false)
    }
  }, [empresaAtual, supabase])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarClientes(busca), 300)
  }, [busca, buscarClientes])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const carregarParcelas = useCallback(async (c: ClienteSumario) => {
    if (!empresaAtual) return
    setCarregandoParcelas(true)
    try {
      const [{ data: parcelasData }, { data: emps }] = await Promise.all([
        supabase
          .from('parcelas_emprestimo')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .eq('cliente_id', c.id)
          .in('status', ['pendente', 'atrasado'])
          .order('data_vencimento'),
        supabase
          .from('emprestimos')
          .select('id, numero_contrato')
          .eq('empresa_id', empresaAtual.id)
          .eq('cliente_id', c.id),
      ])
      const contratoMap: Record<string, string> = {}
      for (const e of emps ?? []) contratoMap[e.id] = e.numero_contrato
      setParcelas((parcelasData ?? []).map(p => ({ ...p, numero_contrato: contratoMap[p.emprestimo_id] ?? '—' })))
    } finally {
      setCarregandoParcelas(false)
    }
  }, [empresaAtual, supabase])

  const selecionarCliente = (c: ClienteSumario) => {
    setCliente(c)
    setBusca(c.nome)
    setShowDropdown(false)
    setSelecionadas(new Set())
    setDesconto('')
    carregarParcelas(c)
  }

  // Auto-select client when navigating from inadimplentes (?clienteId=...)
  useEffect(() => {
    const clienteId = searchParams.get('clienteId')
    if (!clienteId || !empresaAtual || cliente) return
    supabase
      .from('clientes_factoring')
      .select('id, nome, cpf, telefone, score_interno')
      .eq('id', clienteId)
      .eq('empresa_id', empresaAtual.id)
      .single()
      .then(({ data }) => {
        if (data) selecionarCliente(data as ClienteSumario)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, empresaAtual])

  const limparCliente = () => {
    setCliente(null)
    setBusca('')
    setParcelas([])
    setSelecionadas(new Set())
    setDesconto('')
  }

  const toggleParcela = (id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodas = () => {
    setSelecionadas(prev => prev.size === parcelas.length ? new Set() : new Set(parcelas.map(p => p.id)))
  }

  const parcelasSel = useMemo(() => parcelas.filter(p => selecionadas.has(p.id)), [parcelas, selecionadas])

  const subtotal = useMemo(
    () => parcelasSel.reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0),
    [parcelasSel]
  )

  const descontoNum = Number(desconto) || 0
  const descontoValor = tipoDesconto === '%' ? subtotal * descontoNum / 100 : descontoNum
  const total = Math.max(0, subtotal - descontoValor)
  const valorRecebidoNum = Number(valorRecebido) || 0
  const troco = forma === 'dinheiro' ? Math.max(0, valorRecebidoNum - total) : 0

  const confirmarPagamento = async () => {
    if (!parcelasSel.length || !cliente || !empresaAtual) return
    if (forma === 'dinheiro' && valorRecebidoNum < total) {
      toast.error('Valor recebido menor que o total a pagar')
      return
    }
    setConfirmando(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const discountPerParcela = parcelasSel.length > 0 ? descontoValor / parcelasSel.length : 0

      await Promise.all(parcelasSel.map(p => {
        const devido = p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0)
        return supabase.from('parcelas_emprestimo').update({
          status: 'pago',
          valor_pago: Math.max(0, devido - discountPerParcela),
          data_pagamento: hoje,
          tipo_pagamento: forma,
        }).eq('id', p.id)
      }))

      const empIds = [...new Set(parcelasSel.map(p => p.emprestimo_id))]
      await Promise.all(empIds.map(async empId => {
        const { data: restantes } = await supabase
          .from('parcelas_emprestimo')
          .select('id')
          .eq('emprestimo_id', empId)
          .in('status', ['pendente', 'atrasado'])
        if (!restantes?.length) {
          await supabase.from('emprestimos').update({
            status: 'quitado',
            saldo_devedor: 0,
            data_quitacao: hoje,
          }).eq('id', empId)
        }
      }))

      await supabase.from('movimentacoes_caixa').insert({
        empresa_id: empresaAtual.id,
        tipo: 'entrada',
        categoria: 'pagamento_parcela',
        descricao: `Pagamento ${parcelasSel.length} parcela(s) — ${cliente.nome}`,
        valor: total,
        referencia_tipo: 'cliente_factoring',
        referencia_id: cliente.id,
        data_movimentacao: hoje,
      })

      toast.success(`${formatarMoeda(total)} registrado com sucesso!`)
      setSelecionadas(new Set())
      setDesconto('')
      setValorRecebido('')
      await carregarParcelas(cliente)
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <AppShell empresa="factoring" titulo="Lançar Pagamento">
      <div className="space-y-5">
        {/* Search */}
        <div ref={wrapperRef} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); if (!e.target.value) limparCliente() }}
            placeholder="Buscar cliente por nome, CPF ou telefone..."
            className="w-full pl-12 pr-12 py-4 text-lg border-2 rounded-xl focus:outline-none transition-colors"
            style={{ borderColor: cliente ? '#1E5AA8' : '#e2e8f0' }}
          />
          {buscando && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1E5AA8', borderTopColor: 'transparent' }} />
          )}
          {cliente && !buscando && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={limparCliente}>
              <X size={18} />
            </button>
          )}
          {showDropdown && resultados.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {resultados.map(c => (
                <button
                  key={c.id}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0 transition-colors"
                  onClick={() => selecionarCliente(c)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: '#1E5AA8' }}
                  >
                    {iniciais(c.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.nome}</p>
                    <p className="text-sm text-slate-400">{c.cpf ? formatarCPF(c.cpf) : ''} · {formatarTelefone(c.telefone)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">Score</p>
                    <p className="text-base font-bold" style={{ color: '#1E5AA8' }}>{c.score_interno}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && !buscando && resultados.length === 0 && busca.trim().length >= 2 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-center text-slate-400 text-sm">
              Nenhum cliente encontrado
            </div>
          )}
        </div>

        {!cliente && (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <Users size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-400">Digite nome, CPF ou telefone para buscar um cliente</p>
          </div>
        )}

        {cliente && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Parcelas table */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: '#1E5AA8' }}
                >
                  {iniciais(cliente.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{cliente.nome}</p>
                  <p className="text-sm text-slate-400">{cliente.cpf ? formatarCPF(cliente.cpf) : ''} · {formatarTelefone(cliente.telefone)}</p>
                </div>
                <span className="text-sm font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: '#EDF4FE', color: '#1E5AA8' }}>
                  Score {cliente.score_interno}
                </span>
              </div>

              {carregandoParcelas ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1E5AA8', borderTopColor: 'transparent' }} />
                </div>
              ) : parcelas.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={40} className="mx-auto mb-3 text-green-400" />
                  <p className="font-medium text-slate-600">Nenhuma parcela em aberto</p>
                  <p className="text-sm text-slate-400 mt-1">Todos os pagamentos estão em dia</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="pl-5 pr-3 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selecionadas.size === parcelas.length}
                            onChange={toggleTodas}
                            className="rounded border-slate-300"
                          />
                        </th>
                        <th className="px-3 py-3 text-left">Contrato</th>
                        <th className="px-3 py-3 text-left">Parcela</th>
                        <th className="px-3 py-3 text-left">Vencimento</th>
                        <th className="px-3 py-3 text-right">Valor</th>
                        <th className="px-3 py-3 text-right">Mora/Multa</th>
                        <th className="px-3 py-3 text-right">Total</th>
                        <th className="px-3 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map(p => {
                        const mora = p.multa + p.juros_mora
                        const totalP = p.valor + mora - (p.valor_pago ?? 0)
                        const sel = selecionadas.has(p.id)
                        const atrasado = p.status === 'atrasado'
                        return (
                          <tr
                            key={p.id}
                            onClick={() => toggleParcela(p.id)}
                            className={`border-t border-slate-100 cursor-pointer transition-colors ${sel ? 'bg-blue-50' : atrasado ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="pl-5 pr-3 py-3.5">
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => toggleParcela(p.id)}
                                onClick={e => e.stopPropagation()}
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="px-3 py-3.5">
                              <span className="font-mono text-xs font-semibold" style={{ color: '#1E5AA8' }}>
                                {p.numero_contrato}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 tabular-nums text-slate-600">{p.numero_parcela}/{p.total_parcelas}</td>
                            <td className={`px-3 py-3.5 tabular-nums ${atrasado ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                              {formatarData(p.data_vencimento)}
                              {atrasado && <span className="text-xs ml-1 opacity-75">({p.dias_atraso}d)</span>}
                            </td>
                            <td className="px-3 py-3.5 tabular-nums text-right text-slate-700">{formatarMoeda(p.valor)}</td>
                            <td className="px-3 py-3.5 tabular-nums text-right">
                              {mora > 0 ? <span className="text-red-600 font-medium">{formatarMoeda(mora)}</span> : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3.5 tabular-nums text-right font-semibold text-slate-800">{formatarMoeda(totalP)}</td>
                            <td className="px-3 py-3.5 text-center">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={atrasado
                                  ? { color: '#ef4444', backgroundColor: '#fef2f2' }
                                  : { color: '#eab308', backgroundColor: '#fefce8' }}
                              >
                                {atrasado ? `Atrasado ${p.dias_atraso}d` : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment panel */}
            <div>
              {selecionadas.size === 0 ? (
                <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
                  <p className="text-slate-400 text-sm leading-relaxed">Selecione as parcelas<br />que deseja receber</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 sticky top-4">
                  {/* Subtotal */}
                  <div className="text-center pb-4 border-b border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">{selecionadas.size} parcela(s) selecionada(s)</p>
                    <p className="text-2xl font-bold text-slate-700">{formatarMoeda(subtotal)}</p>
                  </div>

                  {/* Desconto */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desconto</p>
                    <div className="flex gap-2">
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                        {(['R$', '%'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setTipoDesconto(t)}
                            className="px-3 py-1.5 text-sm font-medium transition-colors"
                            style={tipoDesconto === t
                              ? { backgroundColor: '#1E5AA8', color: '#fff' }
                              : { color: '#64748b' }}
                          >{t}</button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={desconto}
                        onChange={e => setDesconto(e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                    </div>
                    {descontoValor > 0 && (
                      <p className="text-xs text-green-600 mt-1">— {formatarMoeda(descontoValor)}</p>
                    )}
                  </div>

                  {/* Total final */}
                  <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#EDF4FE' }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Valor Final</p>
                    <p className="text-4xl font-bold" style={{ color: '#1E5AA8' }}>{formatarMoeda(total)}</p>
                  </div>

                  {/* Forma de pagamento */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Forma de Pagamento</p>
                    <div className="grid grid-cols-3 gap-2">
                      {FORMAS.map(f => (
                        <button
                          key={f.key}
                          onClick={() => setForma(f.key)}
                          className="flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all"
                          style={forma === f.key
                            ? { backgroundColor: '#EDF4FE', borderColor: '#1E5AA8', color: '#1E5AA8' }
                            : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#64748b' }}
                        >
                          <FormaIcon forma={f.key} />
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Troco */}
                  {forma === 'dinheiro' && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valor Recebido</p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={valorRecebido}
                          onChange={e => setValorRecebido(e.target.value)}
                          placeholder="0,00"
                          className="pl-9"
                        />
                      </div>
                      {troco > 0 && (
                        <div className="mt-2 flex justify-between items-center bg-green-50 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-green-700">Troco</span>
                          <span className="text-xl font-bold text-green-700">{formatarMoeda(troco)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full h-14 text-base font-bold text-white gap-2"
                    style={{ backgroundColor: '#1E5AA8' }}
                    onClick={confirmarPagamento}
                    disabled={confirmando || (forma === 'dinheiro' && valorRecebidoNum < total)}
                  >
                    {confirmando
                      ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle2 size={22} />
                    }
                    {confirmando ? 'Registrando...' : 'CONFIRMAR PAGAMENTO'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
