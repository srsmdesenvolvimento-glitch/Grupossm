'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { toast } from 'sonner'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Download,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type MovimentacaoCaixa = {
  id: string
  empresa_id: string
  usuario_id: string | null
  tipo: 'entrada' | 'saida'
  categoria: string
  descricao: string
  valor: number
  referencia_tipo: string | null
  referencia_id: string | null
  data_movimentacao: string
  observacoes: string | null
  created_at: string
}

type EmprestimoRow = {
  id: string
  valor_principal: number
  data_liberacao: string | null
}

type ParcelaRow = {
  id: string
  status: string
  data_pagamento: string | null
  valor_juros: number | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getPrimeiroDiaMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function getHoje(): string {
  return new Date().toISOString().split('T')[0]
}

function formatarValorCurto(valor: number): string {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(1)}k`
  return formatarMoeda(valor)
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-m3-2 p-4 text-xs space-y-2">
      <p className="font-bold text-foreground leading-none">{label}</p>
      <div className="space-y-1.5 border-t border-border/40 pt-2">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-muted-foreground font-medium">{p.name}:</span>
            </div>
            <span className="font-bold text-foreground font-mono">{formatarMoeda(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RelatorioFinanceiroFactoringPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  // ─── Period state ─────────────────────────────────────────────────────
  const [dataInicio, setDataInicio] = useState<string>(getPrimeiroDiaMes)
  const [dataFim, setDataFim] = useState<string>(getHoje)
  const [periodoAtivo, setPeriodoAtivo] = useState({ inicio: getPrimeiroDiaMes(), fim: getHoje() })

  // ─── Data state ───────────────────────────────────────────────────────
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([])
  const [emprestimos, setEmprestimos] = useState<EmprestimoRow[]>([])
  const [parcelasJuros, setParcelasJuros] = useState<ParcelaRow[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Table filter ─────────────────────────────────────────────────────
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos')

  // ─── Load ─────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const [movRes, empRes, parcRes] = await Promise.all([
        supabase
          .from('movimentacoes_caixa')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_movimentacao', periodoAtivo.inicio)
          .lte('data_movimentacao', periodoAtivo.fim)
          .order('data_movimentacao', { ascending: false }),
        supabase
          .from('emprestimos')
          .select('id, valor_principal, data_liberacao')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_liberacao', periodoAtivo.inicio)
          .lte('data_liberacao', periodoAtivo.fim),
        supabase
          .from('parcelas_emprestimo')
          .select('id, status, data_pagamento, valor_juros')
          .eq('empresa_id', empresaAtual.id)
          .eq('status', 'pago')
          .gte('data_pagamento', periodoAtivo.inicio)
          .lte('data_pagamento', periodoAtivo.fim),
      ])

      if (movRes.error) throw movRes.error
      if (empRes.error) throw empRes.error
      if (parcRes.error) throw parcRes.error

      setMovimentacoes((movRes.data as MovimentacaoCaixa[]) ?? [])
      setEmprestimos((empRes.data as EmprestimoRow[]) ?? [])
      setParcelasJuros((parcRes.data as ParcelaRow[]) ?? [])
    } catch {
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }, [supabase, empresaAtual?.id, periodoAtivo])

  useEffect(() => {
    carregar()
  }, [carregar])

  function aplicarPeriodo() {
    if (dataInicio > dataFim) {
      toast.error('Data inicial deve ser anterior à data final')
      return
    }
    setPeriodoAtivo({ inicio: dataInicio, fim: dataFim })
  }

  // ─── Computed stats ───────────────────────────────────────────────────

  const totalLiberado = useMemo(
    () => emprestimos.reduce((s, e) => s + Number(e.valor_principal ?? 0), 0),
    [emprestimos],
  )

  const totalRecebido = useMemo(
    () =>
      movimentacoes
        .filter((m) => m.tipo === 'entrada')
        .reduce((s, m) => s + Number(m.valor), 0),
    [movimentacoes],
  )

  const jurosRecebidos = useMemo(
    () => parcelasJuros.reduce((s, p) => s + Number(p.valor_juros ?? 0), 0),
    [parcelasJuros],
  )

  const totalSaida = useMemo(
    () =>
      movimentacoes
        .filter((m) => m.tipo === 'saida')
        .reduce((s, m) => s + Number(m.valor), 0),
    [movimentacoes],
  )

  const emAberto = useMemo(
    () => Math.max(0, totalLiberado - totalRecebido),
    [totalLiberado, totalRecebido],
  )

  const taxaInadimplencia = useMemo(() => {
    if (totalLiberado === 0) return 0
    return Math.min(100, (emAberto / totalLiberado) * 100)
  }, [emAberto, totalLiberado])

  // ─── Chart data: Bar (liberações vs recebimentos por dia) ─────────────

  const barChartData = useMemo(() => {
    const mapa = new Map<string, { data: string; liberado: number; recebido: number }>()

    emprestimos.forEach((e) => {
      const dia = e.data_liberacao?.split('T')[0] ?? ''
      if (!dia) return
      const prev = mapa.get(dia) ?? { data: dia, liberado: 0, recebido: 0 }
      mapa.set(dia, { ...prev, liberado: prev.liberado + Number(e.valor_principal ?? 0) })
    })

    movimentacoes
      .filter((m) => m.tipo === 'entrada')
      .forEach((m) => {
        const dia = m.data_movimentacao.split('T')[0]
        const prev = mapa.get(dia) ?? { data: dia, liberado: 0, recebido: 0 }
        mapa.set(dia, { ...prev, recebido: prev.recebido + Number(m.valor) })
      })

    return Array.from(mapa.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => ({
        ...d,
        dataLabel: formatarData(d.data),
      }))
  }, [emprestimos, movimentacoes])

  // ─── Chart data: Line (recebimentos diários) ──────────────────────────

  const lineChartData = useMemo(() => {
    const mapa = new Map<string, number>()

    movimentacoes
      .filter((m) => m.tipo === 'entrada')
      .forEach((m) => {
        const dia = m.data_movimentacao.split('T')[0]
        mapa.set(dia, (mapa.get(dia) ?? 0) + Number(m.valor))
      })

    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, valor]) => ({ dataLabel: formatarData(data), valor }))
  }, [movimentacoes])

  // ─── Table data ───────────────────────────────────────────────────────

  const movimentacoesFiltradas = useMemo(() => {
    if (tipoFiltro === 'todos') return movimentacoes
    return movimentacoes.filter((m) => m.tipo === tipoFiltro)
  }, [movimentacoes, tipoFiltro])

  // ─── Export CSV ───────────────────────────────────────────────────────

  function exportarCSV() {
    const header = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']
    const rows = movimentacoesFiltradas.map((m) => [
      formatarData(m.data_movimentacao),
      m.tipo === 'entrada' ? 'Entrada' : 'Saída',
      m.categoria,
      `"${m.descricao.replace(/"/g, '""')}"`,
      m.valor.toFixed(2).replace('.', ','),
    ])

    const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-factoring-${periodoAtivo.inicio}-${periodoAtivo.fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado com sucesso!')
  }

  // ─── Columns ──────────────────────────────────────────────────────────

  const columns: Column<MovimentacaoCaixa>[] = [
    {
      key: 'data_movimentacao',
      header: 'Data',
      render: (row) => (
        <span className="text-sm font-semibold font-mono text-muted-foreground/80 tabular-nums">
          {formatarData(row.data_movimentacao)}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row) => (
        <span 
          className={cn(
            "flex items-center gap-1.5 text-xs font-bold leading-none px-2 py-0.5 rounded-full border w-fit",
            row.tipo === 'entrada' 
              ? "bg-[var(--gt-green-light)] text-[var(--gt-green)] border-[var(--gt-green-light)]" 
              : "bg-[var(--gt-red-light)] text-[var(--gt-red)] border-[var(--gt-red-light)]"
          )}
        >
          {row.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (row) => (
        <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/40 font-medium capitalize">
          {row.categoria}
        </span>
      ),
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (row) => (
        <span className="text-sm font-semibold text-foreground leading-normal">{row.descricao}</span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      className: 'text-right',
      render: (row) => (
        <MoneyDisplay 
          valor={row.valor} 
          tamanho="sm" 
          positivo={row.tipo === 'entrada'} 
          negativo={row.tipo === 'saida'} 
          className="font-bold font-mono"
        />
      ),
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell titulo="Relatório Financeiro" empresa="factoring">
      <div className="space-y-6">

        {/* Header */}
        <PageHeader 
          titulo="Relatório Financeiro"
          descricao="Visualize a performance financeira global e o saldo consolidado da factoring"
          icone={BarChart3}
          corIcone="var(--gt-blue)"
        />

        {/* Period selector */}
        <div className="flex flex-col md:flex-row items-end gap-4 p-5 rounded-2xl bg-muted/20 border border-border/50 shadow-m3-1">
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="dataInicio" className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
              Data Inicial
            </Label>
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 bg-card rounded-xl border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
            />
          </div>
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="dataFim" className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
              Data Final
            </Label>
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 bg-card rounded-xl border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
            />
          </div>
          <Button
            onClick={aplicarPeriodo}
            className="bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] text-white border-0 h-10 px-6 shrink-0 rounded-full font-semibold shadow-sm flex items-center gap-2 transition-all duration-200 w-full md:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Filtrar Período
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          <StatCard
            titulo="Total Liberado"
            valor={formatarValorCurto(totalLiberado)}
            subtitulo={`${emprestimos.length} operação${emprestimos.length !== 1 ? 'ões' : ''}`}
            icone={DollarSign}
            corIcone="var(--gt-blue)"
            corFundo="var(--gt-blue-light)"
            delay={0}
          />
          <StatCard
            titulo="Total Recebido"
            valor={formatarValorCurto(totalRecebido)}
            subtitulo="Entradas no período"
            icone={TrendingUp}
            corIcone="var(--gt-green)"
            corFundo="var(--gt-green-light)"
            delay={0.07}
          />
          <StatCard
            titulo="Juros Recebidos"
            valor={formatarValorCurto(jurosRecebidos)}
            subtitulo="Parcelas pagas"
            icone={BarChart3}
            corIcone="var(--gt-yellow)"
            corFundo="var(--gt-yellow-light)"
            delay={0.14}
          />
          <StatCard
            titulo="Em Aberto"
            valor={formatarValorCurto(emAberto)}
            subtitulo="Saldo a receber"
            icone={TrendingDown}
            corIcone="var(--gt-orange)"
            corFundo="var(--gt-orange-light)"
            delay={0.21}
          />
          <StatCard
            titulo="Inadimplência"
            valor={`${taxaInadimplencia.toFixed(1)}%`}
            subtitulo="Do total liberado"
            icone={AlertTriangle}
            corIcone={taxaInadimplencia > 10 ? 'var(--gt-red)' : 'var(--gt-green)'}
            corFundo={taxaInadimplencia > 10 ? 'var(--gt-red-light)' : 'var(--gt-green-light)'}
            delay={0.28}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bar chart */}
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-m3-1 hover:shadow-m3-2 transition-shadow duration-200">
            <h3 className="text-sm font-bold text-foreground mb-4 tracking-tight">
              Liberações vs Recebimentos
            </h3>
            {barChartData.length === 0 ? (
              <div className="flex items-center justify-center h-60 text-sm text-muted-foreground/60 font-semibold border border-dashed border-border rounded-xl">
                Sem liberações ou recebimentos no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barChartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                  <XAxis
                    dataKey="dataLabel"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatarValorCurto(v)}
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(26,115,232,0.03)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 10 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="liberado" name="Liberado" fill="var(--gt-blue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recebido" name="Recebido" fill="var(--gt-green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Line chart */}
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-m3-1 hover:shadow-m3-2 transition-shadow duration-200">
            <h3 className="text-sm font-bold text-foreground mb-4 tracking-tight">
              Recebimentos Diários
            </h3>
            {lineChartData.length === 0 ? (
              <div className="flex items-center justify-center h-60 text-sm text-muted-foreground/60 font-semibold border border-dashed border-border rounded-xl">
                Sem recebimentos registrados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" />
                  <XAxis
                    dataKey="dataLabel"
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatarValorCurto(v)}
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    name="Recebido"
                    stroke="var(--gt-yellow)"
                    strokeWidth={3}
                    dot={{ fill: 'var(--gt-yellow)', r: 4, strokeWidth: 1 }}
                    activeDot={{ r: 6, fill: 'var(--gt-yellow)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-m3-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Movimentações Registradas
            </h3>
            <div className="flex items-center gap-2.5">
              <Select
                value={tipoFiltro}
                onValueChange={(v) => setTipoFiltro(v as 'todos' | 'entrada' | 'saida')}
              >
                <SelectTrigger className="h-10 w-36 text-xs rounded-full border-border/60">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="todos">Todos Tipos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="default"
                variant="outline"
                onClick={exportarCSV}
                className="h-10 text-xs rounded-full border-border/60 hover:bg-muted font-bold px-4 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-5 mb-5 p-4 rounded-xl bg-muted/20 border border-border/40 text-xs font-bold text-muted-foreground">
            <span>
              Total: {movimentacoesFiltradas.length} registro{movimentacoesFiltradas.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[var(--gt-green)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--gt-green)] inline-block" />
              Entradas: {formatarMoeda(totalRecebido)}
            </span>
            <span className="text-[var(--gt-red)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--gt-red)] inline-block" />
              Saídas: {formatarMoeda(totalSaida)}
            </span>
            <div className="sm:ml-auto flex items-center gap-2">
              <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-extrabold">Saldo do Fluxo:</span>
              <MoneyDisplay 
                valor={totalRecebido - totalSaida} 
                positivo={totalRecebido - totalSaida >= 0} 
                negativo={totalRecebido - totalSaida < 0} 
                tamanho="sm"
              />
            </div>
          </div>

          <div className="border border-border/40 rounded-2xl overflow-hidden">
            <DataTable
              columns={columns}
              data={movimentacoesFiltradas}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyMessage="Nenhuma movimentação encontrada no período"
              perPage={25}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
