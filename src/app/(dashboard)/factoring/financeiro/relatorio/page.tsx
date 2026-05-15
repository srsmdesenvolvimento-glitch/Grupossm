'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { LoadingPage } from '@/components/shared/LoadingPage'
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
import { Badge } from '@/components/ui/badge'
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
  valor_liberado: number
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
    <div className="rounded-xl bg-white border border-slate-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">{formatarMoeda(p.value)}</span>
        </div>
      ))}
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
          .select('id, valor_liberado, data_liberacao')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_liberacao', periodoAtivo.inicio)
          .lte('data_liberacao', periodoAtivo.fim),
        supabase
          .from('parcelas_emprestimo')
          .select('id, status, data_pagamento, valor_juros')
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
    () => emprestimos.reduce((s, e) => s + Number(e.valor_liberado ?? 0), 0),
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
      mapa.set(dia, { ...prev, liberado: prev.liberado + Number(e.valor_liberado ?? 0) })
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
        <span className="text-sm text-slate-700 tabular-nums">
          {formatarData(row.data_movimentacao)}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row) => (
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-normal border',
            row.tipo === 'entrada'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200',
          )}
        >
          {row.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </Badge>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (row) => (
        <span className="text-sm text-slate-600 capitalize">{row.categoria}</span>
      ),
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (row) => (
        <span className="text-sm text-slate-700">{row.descricao}</span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      className: 'text-right',
      render: (row) => (
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            row.tipo === 'entrada' ? 'text-green-600' : 'text-red-500',
          )}
        >
          {row.tipo === 'saida' ? '- ' : '+ '}
          {formatarMoeda(Number(row.valor))}
        </span>
      ),
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell titulo="Relatório Financeiro" empresa="factoring">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row items-end gap-3 mb-6 p-4 rounded-xl bg-[#EDF4FE] border border-[#1E5AA8]/20">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="dataInicio" className="text-xs font-medium text-[#1E5AA8]">
            Data Inicial
          </Label>
          <Input
            id="dataInicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="h-9 bg-white"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="dataFim" className="text-xs font-medium text-[#1E5AA8]">
            Data Final
          </Label>
          <Input
            id="dataFim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="h-9 bg-white"
          />
        </div>
        <Button
          onClick={aplicarPeriodo}
          className="bg-[#1E5AA8] hover:bg-[#174a8c] text-white border-0 h-9 px-5 shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Aplicar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          titulo="Total Liberado"
          valor={formatarValorCurto(totalLiberado)}
          subtitulo={`${emprestimos.length} operação${emprestimos.length !== 1 ? 'ões' : ''}`}
          icone={DollarSign}
          corIcone="#1E5AA8"
          corFundo="#EDF4FE"
        />
        <StatCard
          titulo="Total Recebido"
          valor={formatarValorCurto(totalRecebido)}
          subtitulo="Entradas no período"
          icone={TrendingUp}
          corIcone="#22C55E"
          corFundo="#F0FDF4"
        />
        <StatCard
          titulo="Juros Recebidos"
          valor={formatarValorCurto(jurosRecebidos)}
          subtitulo="Parcelas pagas"
          icone={BarChart3}
          corIcone="#D4A528"
          corFundo="#FEFCE8"
        />
        <StatCard
          titulo="Em Aberto"
          valor={formatarValorCurto(emAberto)}
          subtitulo="Saldo a receber"
          icone={TrendingDown}
          corIcone="#F59E0B"
          corFundo="#FFFBEB"
        />
        <StatCard
          titulo="Taxa Inadimplência"
          valor={`${taxaInadimplencia.toFixed(1)}%`}
          subtitulo="Do total liberado"
          icone={AlertTriangle}
          corIcone={taxaInadimplencia > 10 ? '#EF4444' : '#22C55E'}
          corFundo={taxaInadimplencia > 10 ? '#FEF2F2' : '#F0FDF4'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Bar chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            Liberações vs Recebimentos
          </h3>
          {barChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barChartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dataLabel"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatarValorCurto(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#64748b' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="liberado" name="Liberado" fill="#1E5AA8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recebido" name="Recebido" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Line chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            Recebimentos Diários
          </h3>
          {lineChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Sem recebimentos no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dataLabel"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatarValorCurto(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  name="Recebido"
                  stroke="#D4A528"
                  strokeWidth={2.5}
                  dot={{ fill: '#D4A528', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-800">
            Movimentações do Período
          </h3>
          <div className="flex items-center gap-2">
            <Select
              value={tipoFiltro}
              onValueChange={(v) => setTipoFiltro(v as 'todos' | 'entrada' | 'saida')}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportarCSV}
              className="h-8 text-xs border-[#1E5AA8]/30 text-[#1E5AA8] hover:bg-[#EDF4FE]"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
          <span className="text-slate-500">
            {movimentacoesFiltradas.length} registro{movimentacoesFiltradas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-green-600 font-medium">
            Entradas: {formatarMoeda(totalRecebido)}
          </span>
          <span className="text-red-500 font-medium">
            Saídas: {formatarMoeda(totalSaida)}
          </span>
          <span className={cn('font-semibold ml-auto', totalRecebido - totalSaida >= 0 ? 'text-green-600' : 'text-red-500')}>
            Saldo: {formatarMoeda(totalRecebido - totalSaida)}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={movimentacoesFiltradas}
          keyExtractor={(row) => row.id}
          loading={loading}
          emptyMessage="Nenhuma movimentação encontrada no período"
          perPage={25}
        />
      </div>
    </AppShell>
  )
}
