'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator, ArrowRight, TrendingUp, DollarSign, Percent, Search, X, UserPlus,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { calcularJurosCompostos, taxaMensalParaAnual, type ParcelaTabela } from '@/lib/utils/calculos'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { ClienteFactoring } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

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
    { key: 'numero_parcela', header: 'Nº', render: r => <span className="font-mono font-medium text-xs text-muted-foreground/60">{r.numero_parcela}</span> },
    { key: 'data_vencimento', header: 'Vencimento', render: r => <span className="font-mono text-sm text-muted-foreground font-medium">{formatarData(r.data_vencimento)}</span> },
    { key: 'valor_principal', header: 'Principal', render: r => <MoneyDisplay valor={r.valor_principal} tamanho="sm" /> },
    { key: 'valor_juros', header: 'Juros', render: r => <MoneyDisplay valor={r.valor_juros} tamanho="sm" className="text-[var(--gt-orange)] dark:text-orange-400" /> },
    { key: 'valor_parcela', header: 'Parcela', render: r => <MoneyDisplay valor={r.valor_parcela} tamanho="sm" /> },
    { key: 'saldo_devedor', header: 'Saldo Devedor', render: r => <MoneyDisplay valor={r.saldo_devedor} tamanho="sm" className="text-muted-foreground/60" /> },
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
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader 
          titulo="Simulador" 
          descricao="Realize simulações rápidas de parcelamento com parcelas fixas" 
          icone={Calculator}
          corIcone="var(--gt-blue)"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT — Parâmetros */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-5 shadow-m3-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/20">
                  <Calculator size={20} className="text-[var(--gt-blue)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Parâmetros de Cálculo</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Parcelas Fixas — com juros compostos mensais</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/40 pt-4">
                <Label className="font-semibold text-xs text-foreground/80">Valor do Empréstimo (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm font-medium">R$</span>
                  <Input 
                    type="number" 
                    value={valor} 
                    min={100} 
                    onChange={e => setValor(Number(e.target.value))} 
                    className="pl-10 h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-mono font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-foreground/80">Nº de Parcelas</Label>
                  <Input 
                    type="number" 
                    value={parcelas} 
                    min={1} 
                    max={60} 
                    onChange={e => setParcelas(Number(e.target.value))} 
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-foreground/80">Taxa Mensal (%)</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={taxa} 
                      min={0.1} 
                      step={0.1} 
                      onChange={e => setTaxa(Number(e.target.value))} 
                      className="pr-8 h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold" 
                    />
                    <Percent size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                  <p className="text-xs text-muted-foreground/60 font-medium">≡ {taxaAnual}% a.a. equivalente</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs text-foreground/80">Data do Primeiro Vencimento</Label>
                <Input 
                  type="date" 
                  value={dataVenc} 
                  onChange={e => setDataVenc(e.target.value)} 
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
                />
              </div>
            </div>

            {/* Cliente */}
            {resultado && (
              <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4 shadow-m3-1">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Vincular Cliente</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Selecione um cliente para prosseguir diretamente ao contrato.</p>
                </div>

                <div ref={wrapperRef} className="relative border-t border-border/40 pt-4">
                  <Search className="absolute left-4.5 top-[calc(50%+8px)] -translate-y-1/2 text-muted-foreground/60" size={17} />
                  <input
                    value={busca}
                    onChange={e => { setBusca(e.target.value); if (!e.target.value) setCliente(null) }}
                    placeholder="Buscar por nome, CPF ou telefone..."
                    className="w-full pl-11 pr-10 py-3 border border-border/60 rounded-full text-sm bg-card focus:outline-none focus:border-[var(--gt-blue)] focus:ring-1 focus:ring-[var(--gt-blue)]/20 transition-all duration-200"
                  />
                  {buscando && (
                    <div className="absolute right-4.5 top-[calc(50%+8px)] -translate-y-1/2 w-4.5 h-4.5 border-2 border-t-transparent rounded-full animate-spin border-[var(--gt-blue)]" />
                  )}
                  {cliente && !buscando && (
                    <button type="button" className="absolute right-4.5 top-[calc(50%+8px)] -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-0.5 rounded-full hover:bg-muted" onClick={() => { setCliente(null); setBusca('') }}>
                      <X size={15} />
                    </button>
                  )}
                  {showDropdown && resultados.length > 0 && (
                    <div className="absolute z-50 top-full mt-2.5 w-full bg-card border border-border/50 rounded-2xl shadow-m3-3 overflow-hidden">
                      {resultados.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          className="w-full px-4.5 py-3.5 flex items-center gap-3 hover:bg-muted/65 text-left border-b border-border/30 last:border-0 transition-colors"
                          onClick={() => { setCliente(c); setBusca(c.nome); setShowDropdown(false) }}
                        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-[var(--gt-blue)] shadow-sm">
                            {iniciais(c.nome)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-sm truncate leading-none">{c.nome}</p>
                            <p className="text-xs text-muted-foreground/75 mt-1">{c.cpf ? formatarCPF(c.cpf) : ''} · {formatarTelefone(c.telefone)}</p>
                          </div>
                          <span className="text-sm font-bold text-[var(--gt-blue)] bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/10 px-2 py-0.5 rounded-full shrink-0 shadow-sm">Score {c.score_interno}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {busca.length >= 2 && resultados.length === 0 && !buscando && (
                    <div className="absolute z-50 top-full mt-2.5 w-full flex items-center justify-between rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-m3-2">
                      <span className="text-xs font-semibold">Nenhum cliente ativo encontrado</span>
                      <button
                        type="button"
                        onClick={() => router.push('/factoring/clientes/novo?redirect=/factoring/emprestimos/simulador')}
                        className="flex items-center gap-1 text-xs font-bold text-[var(--gt-blue)] hover:underline"
                      >
                        <UserPlus size={13} /> Cadastrar Novo
                      </button>
                    </div>
                  )}
                </div>

                {cliente && (
                  <div className="rounded-2xl border-l-4 border-y border-r border-y-border/40 border-r-border/40 border-l-[var(--gt-blue)] bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/5 p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 bg-[var(--gt-blue)] shadow-sm">
                      {iniciais(cliente.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm leading-none">{cliente.nome}</p>
                      <p className="text-xs text-muted-foreground mt-1">{cliente.cpf ? formatarCPF(cliente.cpf) : ''}</p>
                    </div>
                    <span className="text-sm font-black text-[var(--gt-blue)]">Score {cliente.score_interno}</span>
                  </div>
                )}

                <Button
                  className="w-full h-11 gap-2 text-white font-bold rounded-full bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 transition-all duration-200 shadow-m3-1 hover:shadow-m3-2"
                  onClick={criarContrato}
                >
                  {cliente ? 'Criar Contrato da Simulação' : 'Continuar para Contrato'}
                  <ArrowRight size={17} />
                </Button>
                {!cliente && (
                  <p className="text-[11px] text-muted-foreground/60 text-center leading-normal">Selecione um cliente acima ou associe-o posteriormente no fluxo de contratação.</p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Resultados */}
          <div className="space-y-6">
            {!resultado ? (
              <div className="bg-card rounded-2xl border border-border/50 p-12 shadow-m3-1">
                <EmptyState
                  icone={Calculator}
                  titulo="Preencha os parâmetros"
                  descricao="Os resultados aparecem automaticamente enquanto você digita."
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Valor da Parcela', value: resultado.valor_parcela, color: 'var(--gt-blue)', bg: 'var(--gt-blue-light)', icon: DollarSign, isValue: true },
                    { label: 'Total de Juros', value: resultado.total_juros, color: 'var(--gt-orange)', bg: 'var(--gt-orange-light)', icon: TrendingUp, isValue: true },
                    { label: 'Total a Pagar', value: resultado.total_pagar, color: 'var(--gt-blue)', bg: 'var(--gt-blue-light)', icon: DollarSign, isValue: true },
                    { label: 'Taxa Anual Equiv.', value: taxaAnual, suffix: '% a.a.', color: 'var(--gt-purple)', bg: 'var(--gt-purple-light)', icon: Percent, isValue: false },
                  ].map(card => (
                    <div key={card.label} className="bg-card rounded-2xl border border-border/50 p-5 shadow-m3-1 flex flex-col justify-between h-28">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 rounded-md shrink-0 bg-card border border-border/40 shadow-sm flex items-center justify-center">
                          <card.icon size={13} style={{ color: card.color }} />
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
                      </div>
                      <p className="text-2xl font-black tracking-tight" style={{ color: card.color }}>
                        {card.isValue ? formatarMoeda(card.value as number) : `${card.value}${card.suffix ?? ''}`}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Barra de composição */}
                <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-m3-1">
                  <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Composição do contrato</p>
                  <div className="flex rounded-full overflow-hidden h-3 bg-muted">
                    <div className="h-3 bg-[var(--gt-blue)] transition-all" style={{ width: `${Math.round((valor / resultado.total_pagar) * 100)}%` }} />
                    <div className="h-3 bg-[var(--gt-orange)] flex-1" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-muted-foreground/75">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--gt-blue)] inline-block" />
                      Principal: {formatarMoeda(valor)} ({Math.round((valor / resultado.total_pagar) * 100)}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--gt-orange)] inline-block" />
                      Juros: {formatarMoeda(resultado.total_juros)} ({Math.round((resultado.total_juros / resultado.total_pagar) * 100)}%)
                    </span>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-m3-1">
                  <div className="px-6 py-4.5 border-b border-border/50 flex items-center justify-between bg-card">
                    <h3 className="font-bold text-foreground text-sm tracking-tight">Tabela de Amortização</h3>
                    <span className="text-xs font-bold text-muted-foreground/80 bg-muted px-2.5 py-1 rounded-full">{resultado.tabela.length} parcelas fixas</span>
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
      </div>
    </AppShell>
  )
}
