'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator, ArrowRight, TrendingUp, DollarSign, Percent, Search, X, UserPlus,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { calcularJurosCompostos, taxaMensalParaAnual, type ParcelaTabela } from '@/lib/utils/calculos'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { ClienteFactoring } from '@/lib/types/database'

type ClienteSumario = Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'score_interno'>

const defaultVenc = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
})()

export default function SimuladorPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [valor, setValor] = useState(5000)
  const [parcelas, setParcelas] = useState(12)
  const [taxa, setTaxa] = useState(5)
  const [dataVenc, setDataVenc] = useState(defaultVenc)

  // Cliente search
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ClienteSumario[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [cliente, setCliente] = useState<ClienteSumario | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const buscarClientes = useCallback(async (q: string) => {
    if (!empresaAtual || q.trim().length < 2) { setResultados([]); setShowDropdown(false); return }
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('clientes_factoring')
        .select('id, nome, cpf, telefone, score_interno')
        .eq('empresa_id', empresaAtual.id)
        .eq('status', 'ativo')
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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!empresaAtual) return
    supabase.from('config_factoring').select('taxa_juros_padrao').eq('empresa_id', empresaAtual.id).single()
      .then(({ data }) => { if (data?.taxa_juros_padrao) setTaxa(Number(data.taxa_juros_padrao)) })
  }, [empresaAtual, supabase])

  const resultado = useMemo(() => {
    if (!valor || !parcelas || !taxa) return null
    return calcularJurosCompostos(valor, taxa, parcelas, new Date(dataVenc))
  }, [valor, parcelas, taxa, dataVenc])

  const taxaAnual = useMemo(() => taxaMensalParaAnual(taxa), [taxa])

  const columns: Column<ParcelaTabela>[] = [
    { key: 'numero_parcela', header: 'Nº', render: r => <span className="tabular-nums text-slate-400">{r.numero_parcela}</span> },
    { key: 'data_vencimento', header: 'Vencimento', render: r => <span className="tabular-nums">{formatarData(r.data_vencimento)}</span> },
    { key: 'valor_principal', header: 'Principal', render: r => <span className="tabular-nums">{formatarMoeda(r.valor_principal)}</span> },
    { key: 'valor_juros', header: 'Juros', render: r => <span className="tabular-nums text-orange-600">{formatarMoeda(r.valor_juros)}</span> },
    { key: 'valor_parcela', header: 'Parcela', render: r => <span className="tabular-nums font-semibold">{formatarMoeda(r.valor_parcela)}</span> },
    { key: 'saldo_devedor', header: 'Saldo Devedor', render: r => <span className="tabular-nums text-slate-400">{formatarMoeda(r.saldo_devedor)}</span> },
  ]

  function criarContrato() {
    if (!resultado) return
    const params = new URLSearchParams({
      valor: String(valor),
      parcelas: String(parcelas),
      taxa: String(taxa),
      venc: dataVenc,
      ...(cliente ? { cliente_id: cliente.id } : {}),
    })
    router.push(`/factoring/emprestimos/novo?${params.toString()}`)
  }

  return (
    <AppShell empresa="factoring" titulo="Simulador de Empréstimo">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* LEFT — Parâmetros */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FE' }}>
                <Calculator size={20} style={{ color: '#1E5AA8' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Parâmetros</h2>
                <p className="text-xs text-slate-400">Sistema Price — juros compostos mensais</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Valor do Empréstimo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <Input type="number" value={valor} min={100} onChange={e => setValor(Number(e.target.value))} className="pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nº de Parcelas</Label>
                <Input type="number" value={parcelas} min={1} max={60} onChange={e => setParcelas(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa Mensal (%)</Label>
                <div className="relative">
                  <Input type="number" value={taxa} min={0.1} step={0.1} onChange={e => setTaxa(Number(e.target.value))} className="pr-8" />
                  <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-xs text-slate-400">≡ {taxaAnual}% a.a.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>1º Vencimento</Label>
              <Input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
            </div>
          </div>

          {/* Cliente */}
          {resultado && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800">Selecionar Cliente</h3>
                <p className="text-xs text-slate-400 mt-0.5">Opcional — selecione para já criar o contrato direto.</p>
              </div>

              <div ref={wrapperRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={busca}
                  onChange={e => { setBusca(e.target.value); if (!e.target.value) setCliente(null) }}
                  placeholder="Buscar por nome, CPF ou telefone..."
                  className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
                {buscando && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1E5AA8', borderTopColor: 'transparent' }} />
                )}
                {cliente && !buscando && (
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => { setCliente(null); setBusca('') }}>
                    <X size={14} />
                  </button>
                )}
                {showDropdown && resultados.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {resultados.map(c => (
                      <button
                        key={c.id}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                        onClick={() => { setCliente(c); setBusca(c.nome); setShowDropdown(false) }}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#1E5AA8' }}>
                          {iniciais(c.nome)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{c.nome}</p>
                          <p className="text-xs text-slate-400">{c.cpf ? formatarCPF(c.cpf) : ''} · {formatarTelefone(c.telefone)}</p>
                        </div>
                        <span className="text-sm font-bold shrink-0" style={{ color: '#1E5AA8' }}>{c.score_interno}</span>
                      </button>
                    ))}
                  </div>
                )}
                {busca.length >= 2 && resultados.length === 0 && !buscando && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">
                    <span className="text-xs">Nenhum cliente encontrado</span>
                    <button
                      onClick={() => router.push('/factoring/clientes/novo?redirect=/factoring/emprestimos/simulador')}
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: '#1E5AA8' }}
                    >
                      <UserPlus size={12} /> Cadastrar
                    </button>
                  </div>
                )}
              </div>

              {cliente && (
                <div className="rounded-lg border border-blue-200 p-3 flex items-center gap-3" style={{ backgroundColor: '#EDF4FE' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: '#1E5AA8' }}>
                    {iniciais(cliente.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{cliente.nome}</p>
                    <p className="text-xs text-slate-400">{cliente.cpf ? formatarCPF(cliente.cpf) : ''}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#1E5AA8' }}>Score {cliente.score_interno}</span>
                </div>
              )}

              <Button
                className="w-full gap-2 text-white font-semibold"
                style={{ backgroundColor: '#1E5AA8' }}
                onClick={criarContrato}
              >
                {cliente ? 'Criar Contrato' : 'Continuar para Contrato'}
                <ArrowRight size={16} />
              </Button>
              {!cliente && (
                <p className="text-xs text-slate-400 text-center">Selecione um cliente acima ou escolha na próxima tela.</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Resultados */}
        <div className="space-y-4">
          {!resultado ? (
            <div className="bg-card rounded-xl border border-border p-12">
              <EmptyState
                icone={Calculator}
                titulo="Preencha os parâmetros"
                descricao="Os resultados aparecem automaticamente enquanto você digita."
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Valor da Parcela', value: resultado.valor_parcela, color: '#1E5AA8', icon: DollarSign, isValue: true },
                  { label: 'Total de Juros', value: resultado.total_juros, color: '#f97316', icon: TrendingUp, isValue: true },
                  { label: 'Total a Pagar', value: resultado.total_pagar, color: '#1E5AA8', icon: DollarSign, isValue: true },
                  { label: 'Taxa Anual Equiv.', value: taxaAnual, suffix: '% a.a.', color: '#64748b', icon: Percent, isValue: false },
                ].map(card => (
                  <div key={card.label} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <card.icon size={13} style={{ color: card.color }} />
                      <p className="text-xs text-slate-400">{card.label}</p>
                    </div>
                    <p className="text-xl font-bold" style={{ color: card.color }}>
                      {card.isValue ? formatarMoeda(card.value as number) : `${card.value}${card.suffix ?? ''}`}
                    </p>
                  </div>
                ))}
              </div>

              {/* Barra de composição */}
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Composição do contrato</p>
                <div className="flex rounded-full overflow-hidden h-3">
                  <div className="h-3 bg-[#1E5AA8] transition-all" style={{ width: `${Math.round((valor / resultado.total_pagar) * 100)}%` }} />
                  <div className="h-3 bg-orange-400 flex-1" />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1E5AA8] inline-block" />
                    Principal: {formatarMoeda(valor)} ({Math.round((valor / resultado.total_pagar) * 100)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    Juros: {formatarMoeda(resultado.total_juros)} ({Math.round((resultado.total_juros / resultado.total_pagar) * 100)}%)
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm">Tabela de Amortização</h3>
                  <span className="text-xs text-slate-400">{resultado.tabela.length} parcelas · Price</span>
                </div>
                <DataTable
                  columns={columns}
                  data={resultado.tabela}
                  keyExtractor={r => String(r.numero_parcela)}
                  perPage={12}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
