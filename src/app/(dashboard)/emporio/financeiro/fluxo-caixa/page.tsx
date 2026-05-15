'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { toast } from 'sonner'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'

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
}

type Periodo = 'semana' | 'mes' | 'trimestre' | 'ano'

type ChartDatum = {
  periodo: string
  entradas: number
  saidas: number
}

// ─── Helper: group by period ────────────────────────────────────────────────────

function groupMovimentacoesByPeriod(
  movs: MovimentacaoCaixa[],
  periodo: Periodo,
): ChartDatum[] {
  const groups: Record<string, { entradas: number; saidas: number }> = {}

  for (const m of movs) {
    const d = new Date(m.data_movimentacao + 'T12:00:00')
    const key =
      periodo === 'mes' || periodo === 'semana'
        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    if (!groups[key]) groups[key] = { entradas: 0, saidas: 0 }
    if (m.tipo === 'entrada') groups[key].entradas += Number(m.valor)
    else groups[key].saidas += Number(m.valor)
  }

  return Object.entries(groups)
    .map(([p, v]) => ({ periodo: p, ...v }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

// ─── Tooltip customizado ────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background shadow-md p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatarMoeda(entry.value)}
        </p>
      ))}
    </div>
  )
}

function SaldoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background shadow-md p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          Saldo acumulado: {formatarMoeda(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Period Selector ───────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Periodo, string> = {
  semana: 'Semana',
  mes: 'Mês',
  trimestre: 'Trimestre',
  ano: 'Ano',
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: Periodo
  onChange: (p: Periodo) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {(Object.keys(PERIOD_LABELS) as Periodo[]).map((p) => (
        <Button
          key={p}
          size="sm"
          variant="ghost"
          onClick={() => onChange(p)}
          className={cn(
            'h-7 px-3 text-xs font-medium rounded-md transition-all',
            value === p
              ? 'bg-[#D4A528] text-white hover:bg-[#B8891F] shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background',
          )}
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FluxoCaixaPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Load ─────────────────────────────────────────────────────────────

  async function carregarMovimentacoes(p: Periodo) {
    if (!empresaAtual?.id) return
    setLoading(true)

    const hoje = new Date()
    const periodos: Record<Periodo, Date> = {
      semana: new Date(hoje.getTime() - 7 * 86400000),
      mes: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      trimestre: new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1),
      ano: new Date(hoje.getFullYear(), 0, 1),
    }
    const dataInicio = periodos[p].toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('movimentacoes_caixa')
      .select('*')
      .eq('empresa_id', empresaAtual.id)
      .gte('data_movimentacao', dataInicio)
      .order('data_movimentacao', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar movimentações')
    } else {
      setMovimentacoes((data as MovimentacaoCaixa[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    carregarMovimentacoes(periodo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual?.id, periodo])

  // ─── Computed ─────────────────────────────────────────────────────────

  const entradas = useMemo(
    () =>
      movimentacoes
        .filter((m) => m.tipo === 'entrada')
        .reduce((s, m) => s + Number(m.valor), 0),
    [movimentacoes],
  )

  const saidas = useMemo(
    () =>
      movimentacoes
        .filter((m) => m.tipo === 'saida')
        .reduce((s, m) => s + Number(m.valor), 0),
    [movimentacoes],
  )

  const saldo = entradas - saidas

  const chartData = useMemo(
    () => groupMovimentacoesByPeriod(movimentacoes, periodo),
    [movimentacoes, periodo],
  )

  const saldoData = useMemo(() => {
    let saldoAcum = 0
    return chartData.map((d) => {
      saldoAcum += d.entradas - d.saidas
      return { ...d, saldo: saldoAcum }
    })
  }, [chartData])

  // ─── Columns ──────────────────────────────────────────────────────────

  const columns: Column<MovimentacaoCaixa>[] = [
    {
      key: 'data',
      header: 'Data',
      render: (row) => (
        <span className="text-sm tabular-nums">
          {formatarData(row.data_movimentacao)}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row) =>
        row.tipo === 'entrada' ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 font-normal text-xs">
            Entrada
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 font-normal text-xs">
            Saída
          </Badge>
        ),
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.descricao}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {row.categoria}
          </p>
        </div>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      className: 'text-right',
      render: (row) => (
        <MoneyDisplay
          valor={Number(row.valor)}
          tamanho="sm"
          positivo={row.tipo === 'entrada'}
          negativo={row.tipo === 'saida'}
        />
      ),
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell titulo="Fluxo de Caixa" empresa="emporio">
      {/* Header: period selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {periodo === 'semana' && 'Últimos 7 dias'}
            {periodo === 'mes' && 'Mês atual'}
            {periodo === 'trimestre' && 'Últimos 3 meses'}
            {periodo === 'ano' && 'Ano atual'}
          </p>
        </div>
        <PeriodSelector value={periodo} onChange={setPeriodo} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          titulo="Total Entradas"
          valor={formatarMoeda(entradas)}
          subtitulo={`${movimentacoes.filter((m) => m.tipo === 'entrada').length} movimentações`}
          icone={TrendingUp}
          corIcone="#22C55E"
          corFundo="#F0FDF4"
        />
        <StatCard
          titulo="Total Saídas"
          valor={formatarMoeda(saidas)}
          subtitulo={`${movimentacoes.filter((m) => m.tipo === 'saida').length} movimentações`}
          icone={TrendingDown}
          corIcone="#EF4444"
          corFundo="#FEF2F2"
        />
        <StatCard
          titulo="Saldo"
          valor={formatarMoeda(Math.abs(saldo))}
          subtitulo={saldo >= 0 ? 'Superávit' : 'Déficit'}
          icone={DollarSign}
          corIcone={saldo >= 0 ? '#22C55E' : '#EF4444'}
          corFundo={saldo >= 0 ? '#F0FDF4' : '#FEF2F2'}
        />
      </div>

      {/* Charts */}
      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Bar chart: Entradas vs Saídas */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-[#D4A528]" />
                Entradas vs Saídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barGap={4}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F1F5F9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value) =>
                      value === 'entradas' ? 'Entradas' : 'Saídas'
                    }
                  />
                  <Bar
                    dataKey="entradas"
                    name="entradas"
                    fill="#22C55E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="saidas"
                    name="saidas"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line chart: Saldo acumulado */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#D4A528]" />
                Saldo Acumulado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={saldoData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F1F5F9"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="periodo"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip content={<SaldoTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="saldo"
                    stroke="#D4A528"
                    strokeWidth={2.5}
                    dot={{
                      fill: '#D4A528',
                      r: 4,
                      strokeWidth: 2,
                      stroke: '#fff',
                    }}
                    activeDot={{ r: 6, fill: '#D4A528' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        !loading && (
          <div className="mb-6">
            <EmptyState
              icone={BarChart2}
              titulo="Sem dados para exibir"
              descricao="Nenhuma movimentação encontrada para gerar os gráficos neste período."
            />
          </div>
        )
      )}

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#1A1A2E]">
            Movimentações do Período
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movimentacoes.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icone={DollarSign}
                titulo="Nenhuma movimentação encontrada"
                descricao="Nenhuma movimentação encontrada para este período."
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={movimentacoes}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyMessage="Nenhuma movimentação encontrada para este período"
              perPage={25}
            />
          )}
        </CardContent>
      </Card>
    </AppShell>
  )
}
