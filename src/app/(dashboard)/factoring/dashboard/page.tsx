'use client'

import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { formatarMoeda, formatarData, formatarCPF } from '@/lib/utils/formatters'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  Banknote, TrendingUp, Clock, AlertTriangle, CheckCircle,
  Percent, MessageCircle, AlertCircle, Scale,
} from 'lucide-react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ClienteFactoring {
  id: string
  nome: string
  cpf: string
  telefone: string
  score: number
}

interface Emprestimo {
  id: string
  cliente_id: string
  status: string
  saldo_devedor: number
  data_liberacao: string
  valor_liberado: number
  numero_contrato: string
}

interface ParcelaEmprestimo {
  id: string
  emprestimo_id: string
  cliente_id: string
  data_vencimento: string
  data_pagamento: string | null
  valor: number
  multa: number
  juros_mora: number
  valor_pago: number
  status: string
  dias_atraso: number
}

interface MovimentacaoCaixa {
  id: string
  descricao: string
  valor: number
  created_at: string
  categoria: string
}

interface ParcelaVencendoHoje {
  id: string
  clienteNome: string
  numeroContrato: string
  valor: number
  emprestimo_id: string
}

interface ParcelaInadimplente {
  id: string
  clienteNome: string
  clienteTelefone: string
  diasAtraso: number
  valor: number
}

interface Pagamento {
  id: string
  descricao: string
  valor: number
  data: string
}

interface Alerta {
  id: string
  tipo: 'info' | 'warning' | 'danger'
  mensagem: string
  icone: React.ReactNode
}

interface ChartMes {
  mes: string
  liberacoes: number
  recebimentos: number
  inadimplencia: number
}

interface ChartRisco {
  name: string
  value: number
  color: string
}

interface ChartReceivel {
  data: string
  ate30d: number
  ate60d: number
  ate90d: number
}

interface DashboardData {
  capitalAtivo: number
  recebidoMes: number
  aReceberHoje: number
  emAtraso: number
  novosEmprestimosMesCount: number
  novosEmprestimosMesValor: number
  taxaInadimplencia: number
  chartMeses: ChartMes[]
  chartRisco: ChartRisco[]
  chartReceivel: ChartReceivel[]
  parcelasVencendoHoje: ParcelaVencendoHoje[]
  inadimplentes: ParcelaInadimplente[]
  ultimosPagamentos: Pagamento[]
  alertas: Alerta[]
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function primeiroDiaMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

function mesMenos(n: number): Date {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d
}

function labelMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function diasAteHoje(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function FactoringDashboard() {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)

  const carregarDados = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const hojeStr = hoje()
      const primeiroDia = primeiroDiaMes()

      const [
        emprestimosRes,
        parcelasRes,
        clientesRes,
        movimentacoesRes,
      ] = await Promise.all([
        supabase
          .from('emprestimos')
          .select('id, cliente_id, status, saldo_devedor, data_liberacao, valor_liberado, numero_contrato')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('parcelas_emprestimo')
          .select('id, emprestimo_id, cliente_id, data_vencimento, data_pagamento, valor, multa, juros_mora, valor_pago, status, dias_atraso')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, telefone, score')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('movimentacoes_caixa')
          .select('id, descricao, valor, created_at, categoria')
          .eq('empresa_id', empresaAtual.id)
          .eq('categoria', 'pagamento_parcela')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const emprestimos: Emprestimo[] = emprestimosRes.data ?? []
      const parcelas: ParcelaEmprestimo[] = parcelasRes.data ?? []
      const clientes: ClienteFactoring[] = clientesRes.data ?? []
      const movimentacoes: MovimentacaoCaixa[] = movimentacoesRes.data ?? []

      // Map clientes by id
      const clienteMap = new Map<string, ClienteFactoring>()
      for (const c of clientes) clienteMap.set(c.id, c)

      // Map emprestimos by id
      const emprestimoMap = new Map<string, Emprestimo>()
      for (const e of emprestimos) emprestimoMap.set(e.id, e)

      // ── StatCard 1: Capital ativo
      const capitalAtivo = emprestimos
        .filter(e => e.status === 'ativo')
        .reduce((s, e) => s + (e.saldo_devedor ?? 0), 0)

      // ── StatCard 2: Recebido este mês
      const recebidoMes = parcelas
        .filter(p => p.data_pagamento && p.data_pagamento >= primeiroDia)
        .reduce((s, p) => s + (p.valor_pago ?? 0), 0)

      // ── StatCard 3: A receber hoje
      const aReceberHoje = parcelas
        .filter(p => p.data_vencimento === hojeStr && ['pendente', 'atrasado'].includes(p.status))
        .reduce((s, p) => s + ((p.valor ?? 0) + (p.multa ?? 0) + (p.juros_mora ?? 0) - (p.valor_pago ?? 0)), 0)

      // ── StatCard 4: Em atraso
      const emAtraso = parcelas
        .filter(p => p.status === 'atrasado')
        .reduce((s, p) => s + ((p.valor ?? 0) + (p.multa ?? 0) + (p.juros_mora ?? 0) - (p.valor_pago ?? 0)), 0)

      // ── StatCard 5: Novos empréstimos mês
      const novosEmpMes = emprestimos.filter(e => e.data_liberacao && e.data_liberacao >= primeiroDia)
      const novosEmprestimosMesCount = novosEmpMes.length
      const novosEmprestimosMesValor = novosEmpMes.reduce((s, e) => s + (e.valor_liberado ?? 0), 0)

      // ── StatCard 6: Taxa inadimplência
      const totalAtivos = parcelas.filter(p => ['pendente', 'atrasado'].includes(p.status)).length
      const totalAtrasados = parcelas.filter(p => p.status === 'atrasado').length
      const taxaInadimplencia = totalAtivos > 0 ? (totalAtrasados / totalAtivos) * 100 : 0

      // ── Chart 1 + 2: last 6 months
      const chartMeses: ChartMes[] = []
      for (let i = 5; i >= 0; i--) {
        const base = mesMenos(i)
        const ano = base.getFullYear()
        const mes = base.getMonth()
        const inicio = new Date(ano, mes, 1).toISOString().split('T')[0]
        const fim = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

        const liberacoes = emprestimos
          .filter(e => e.data_liberacao >= inicio && e.data_liberacao <= fim)
          .reduce((s, e) => s + (e.valor_liberado ?? 0), 0)

        const recebimentos = parcelas
          .filter(p => p.data_pagamento && p.data_pagamento >= inicio && p.data_pagamento <= fim)
          .reduce((s, p) => s + (p.valor_pago ?? 0), 0)

        const parcMes = parcelas.filter(
          p => p.data_vencimento >= inicio && p.data_vencimento <= fim &&
            ['pendente', 'atrasado'].includes(p.status)
        )
        const atrasadosMes = parcMes.filter(p => p.status === 'atrasado').length
        const inadimplenciaMes = parcMes.length > 0 ? (atrasadosMes / parcMes.length) * 100 : 0

        chartMeses.push({
          mes: labelMes(base),
          liberacoes,
          recebimentos,
          inadimplencia: parseFloat(inadimplenciaMes.toFixed(1)),
        })
      }

      // ── Chart 3: distribuição risco
      let baixo = 0, medio = 0, alto = 0, critico = 0
      for (const c of clientes) {
        const s = c.score ?? 0
        if (s >= 70) baixo++
        else if (s >= 50) medio++
        else if (s >= 30) alto++
        else critico++
      }
      const chartRisco: ChartRisco[] = [
        { name: 'Baixo (≥70)', value: baixo, color: '#22c55e' },
        { name: 'Médio (50-69)', value: medio, color: '#eab308' },
        { name: 'Alto (30-49)', value: alto, color: '#f97316' },
        { name: 'Crítico (<30)', value: critico, color: '#ef4444' },
      ]

      // ── Chart 4: projeção recebíveis próximos 90 dias
      const receiveisMap = new Map<string, { ate30d: number; ate60d: number; ate90d: number }>()
      const limite30 = diasAteHoje(30)
      const limite60 = diasAteHoje(60)
      const limite90 = diasAteHoje(90)

      for (const p of parcelas) {
        if (p.status !== 'pendente') continue
        if (p.data_vencimento > limite90) continue
        const key = p.data_vencimento
        const entry = receiveisMap.get(key) ?? { ate30d: 0, ate60d: 0, ate90d: 0 }
        const val = (p.valor ?? 0) - (p.valor_pago ?? 0)
        if (p.data_vencimento <= limite30) entry.ate30d += val
        if (p.data_vencimento <= limite60) entry.ate60d += val
        entry.ate90d += val
        receiveisMap.set(key, entry)
      }

      const chartReceivel: ChartReceivel[] = Array.from(receiveisMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([data, v]) => ({ data: formatarData(data), ...v }))

      // ── List 1: parcelas vencendo hoje
      const parcelasVencendoHoje: ParcelaVencendoHoje[] = parcelas
        .filter(p => p.data_vencimento === hojeStr && p.status === 'pendente')
        .map(p => {
          const emp = emprestimoMap.get(p.emprestimo_id)
          const cliente = clienteMap.get(p.cliente_id)
          return {
            id: p.id,
            clienteNome: cliente?.nome ?? '—',
            numeroContrato: emp?.numero_contrato ?? '—',
            valor: (p.valor ?? 0) + (p.multa ?? 0) + (p.juros_mora ?? 0) - (p.valor_pago ?? 0),
            emprestimo_id: p.emprestimo_id,
          }
        })

      // ── List 2: top 10 inadimplentes
      const inadimplentes: ParcelaInadimplente[] = parcelas
        .filter(p => p.status === 'atrasado')
        .sort((a, b) => (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0))
        .slice(0, 10)
        .map(p => {
          const cliente = clienteMap.get(p.cliente_id)
          return {
            id: p.id,
            clienteNome: cliente?.nome ?? '—',
            clienteTelefone: cliente?.telefone ?? '',
            diasAtraso: p.dias_atraso ?? 0,
            valor: (p.valor ?? 0) + (p.multa ?? 0) + (p.juros_mora ?? 0) - (p.valor_pago ?? 0),
          }
        })

      // ── List 3: últimos pagamentos
      const ultimosPagamentos: Pagamento[] = movimentacoes.map(m => ({
        id: m.id,
        descricao: m.descricao ?? '—',
        valor: m.valor ?? 0,
        data: m.created_at,
      }))

      // ── List 4: alertas
      const seteDiasAtras = new Date()
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
      const seteDiasStr = seteDiasAtras.toISOString().split('T')[0]

      const novosInadimplentes = parcelas.filter(
        p => p.status === 'atrasado' && p.data_vencimento >= seteDiasStr
      ).length

      const emAnalise = emprestimos.filter(e => e.status === 'analise').length

      const atrasados60d = parcelas.filter(
        p => p.status === 'atrasado' && (p.dias_atraso ?? 0) > 60
      ).length

      const alertas: Alerta[] = []
      if (novosInadimplentes > 0) {
        alertas.push({
          id: 'novos-inad',
          tipo: 'warning',
          mensagem: `${novosInadimplentes} novo(s) inadimplente(s) nos últimos 7 dias`,
          icone: <AlertTriangle className="w-4 h-4" />,
        })
      }
      if (emAnalise > 0) {
        alertas.push({
          id: 'em-analise',
          tipo: 'info',
          mensagem: `${emAnalise} empréstimo(s) aguardando análise e aprovação`,
          icone: <AlertCircle className="w-4 h-4" />,
        })
      }
      if (atrasados60d > 0) {
        alertas.push({
          id: 'juridico',
          tipo: 'danger',
          mensagem: `${atrasados60d} parcela(s) com mais de 60 dias de atraso — encaminhar ao jurídico`,
          icone: <Scale className="w-4 h-4" />,
        })
      }
      if (alertas.length === 0) {
        alertas.push({
          id: 'ok',
          tipo: 'info',
          mensagem: 'Nenhum alerta crítico no momento.',
          icone: <CheckCircle className="w-4 h-4" />,
        })
      }

      setData({
        capitalAtivo,
        recebidoMes,
        aReceberHoje,
        emAtraso,
        novosEmprestimosMesCount,
        novosEmprestimosMesValor,
        taxaInadimplencia,
        chartMeses,
        chartRisco,
        chartReceivel,
        parcelasVencendoHoje,
        inadimplentes,
        ultimosPagamentos,
        alertas,
      })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  if (loading) return <LoadingPage />

  const d = data!

  // ──────────────────────────────────────────────
  // Column definitions
  // ──────────────────────────────────────────────

  const colsVencendoHoje: Column<ParcelaVencendoHoje>[] = [
    { key: 'clienteNome', header: 'Cliente' },
    { key: 'numeroContrato', header: 'Contrato' },
    {
      key: 'valor',
      header: 'Valor',
      render: (row) => <MoneyDisplay valor={row.valor} />,
    },
    {
      key: 'id',
      header: '',
      render: () => (
        <button
          onClick={() => router.push('/factoring/parcelas/pagamento')}
          className="text-xs px-3 py-1 rounded-md bg-[#1E5AA8] text-white hover:bg-[#174a8e] transition-colors"
        >
          Receber
        </button>
      ),
    },
  ]

  const colsInadimplentes: Column<ParcelaInadimplente>[] = [
    { key: 'clienteNome', header: 'Cliente' },
    {
      key: 'diasAtraso',
      header: 'Dias atraso',
      render: (row) => (
        <span className="font-semibold text-red-600">{row.diasAtraso}d</span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: (row) => <MoneyDisplay valor={row.valor} />,
    },
    {
      key: 'id',
      header: '',
      render: (row) => (
        <button
          onClick={() => {
            const tel = row.clienteTelefone.replace(/\D/g, '')
            const msg = encodeURIComponent(
              `Olá ${row.clienteNome}, identificamos uma parcela em aberto no valor de ${formatarMoeda(row.valor)} com ${row.diasAtraso} dias de atraso. Por favor, entre em contato para regularizar sua situação.`
            )
            window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
          }}
          className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
        >
          <MessageCircle className="w-3 h-3" />
          Cobrar
        </button>
      ),
    },
  ]

  const colsPagamentos: Column<Pagamento>[] = [
    { key: 'descricao', header: 'Cliente / Descrição' },
    {
      key: 'valor',
      header: 'Valor',
      render: (row) => <MoneyDisplay valor={row.valor} />,
    },
    {
      key: 'data',
      header: 'Data',
      render: (row) => <span className="text-slate-500 text-xs">{formatarData(row.data)}</span>,
    },
  ]

  const alertaColors: Record<Alerta['tipo'], string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  }

  return (
    <AppShell empresa="factoring" titulo="Dashboard">
      <div className="space-y-6">
        {/* ── StatCards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            titulo="Carteira Ativa"
            valor={formatarMoeda(d.capitalAtivo)}
            subtitulo="Saldo devedor de contratos em aberto"
            icone={Banknote}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
            onClick={() => router.push('/factoring/emprestimos')}
            atalho="Ver contratos →"
          />
          <StatCard
            titulo="Recebido no Mês"
            valor={formatarMoeda(d.recebidoMes)}
            subtitulo="Total de parcelas pagas no mês atual"
            icone={CheckCircle}
            corIcone="#22c55e"
            corFundo="#F0FDF4"
            onClick={() => router.push('/factoring/parcelas')}
            atalho="Ver parcelas →"
          />
          <StatCard
            titulo="Vence Hoje"
            valor={formatarMoeda(d.aReceberHoje)}
            subtitulo="Parcelas com vencimento em hoje"
            icone={Clock}
            corIcone="#D4A528"
            corFundo="#FEFCE8"
            onClick={() => router.push('/factoring/parcelas')}
            atalho="Ver parcelas →"
          />
          <StatCard
            titulo="Total Inadimplente"
            valor={formatarMoeda(d.emAtraso)}
            subtitulo="Parcelas em atraso — valor total"
            icone={AlertTriangle}
            corIcone="#ef4444"
            corFundo="#FEF2F2"
            onClick={() => router.push('/factoring/parcelas/inadimplentes')}
            atalho="Ver inadimplentes →"
          />
          <StatCard
            titulo="Novos Contratos no Mês"
            valor={`${d.novosEmprestimosMesCount} contrato${d.novosEmprestimosMesCount !== 1 ? 's' : ''}`}
            subtitulo={formatarMoeda(d.novosEmprestimosMesValor) + ' liberados'}
            icone={TrendingUp}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
            onClick={() => router.push('/factoring/emprestimos')}
            atalho="Ver contratos →"
          />
          <StatCard
            titulo="Inadimplência"
            valor={`${d.taxaInadimplencia.toFixed(1)}%`}
            subtitulo="% de parcelas em atraso sobre carteira ativa"
            icone={Percent}
            corIcone="#f97316"
            corFundo="#FFF7ED"
            onClick={() => router.push('/factoring/clientes')}
            atalho="Ver clientes →"
          />
        </div>

        {/* ── Charts row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 1: Liberações vs Recebimentos */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Liberações vs Recebimentos</h3>
            {d.chartMeses.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.chartMeses} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatarMoeda(typeof v === 'number' ? v : 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="liberacoes" name="Liberações" fill="#1E5AA8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="recebimentos" name="Recebimentos" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 2: Evolução Inadimplência */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Evolução Inadimplência</h3>
            {d.chartMeses.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={d.chartMeses} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v) => `${typeof v === 'number' ? v : 0}%`} />
                  <Line
                    type="monotone"
                    dataKey="inadimplencia"
                    name="Inadimplência %"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Charts row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Chart 3: Distribuição Risco */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Distribuição Risco Carteira</h3>
            {d.chartRisco.every(r => r.value === 0) ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem dados de score</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={d.chartRisco}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {d.chartRisco.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart 4: Projeção Recebíveis */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Projeção Recebíveis (90 dias)</h3>
            {d.chartReceivel.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sem parcelas pendentes</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d.chartReceivel} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ate30d" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E5AA8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1E5AA8" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="ate60d" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="ate90d" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A528" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4A528" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatarMoeda(typeof v === 'number' ? v : 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="ate30d" name="30d" stroke="#1E5AA8" fill="url(#ate30d)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ate60d" name="60d" stroke="#7c3aed" fill="url(#ate60d)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ate90d" name="90d" stroke="#D4A528" fill="url(#ate90d)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Lists row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Parcelas vencendo hoje */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Parcelas vencendo hoje</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {d.parcelasVencendoHoje.length}
              </span>
            </div>
            {d.parcelasVencendoHoje.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma parcela vence hoje.</p>
            ) : (
              <DataTable
                data={d.parcelasVencendoHoje}
                columns={colsVencendoHoje}
                keyExtractor={p => p.id}
              />
            )}
          </div>

          {/* Top 10 inadimplentes */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Top 10 inadimplentes</h3>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {d.inadimplentes.length}
              </span>
            </div>
            {d.inadimplentes.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma parcela em atraso.</p>
            ) : (
              <DataTable
                data={d.inadimplentes}
                columns={colsInadimplentes}
                keyExtractor={p => p.id}
              />
            )}
          </div>
        </div>

        {/* ── Lists row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Últimos pagamentos */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Últimos pagamentos</h3>
            {d.ultimosPagamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum pagamento registrado.</p>
            ) : (
              <DataTable
                data={d.ultimosPagamentos}
                columns={colsPagamentos}
                keyExtractor={p => p.id}
              />
            )}
          </div>

          {/* Alertas */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Alertas</h3>
            <div className="space-y-3">
              {d.alertas.map(alerta => (
                <div
                  key={alerta.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${alertaColors[alerta.tipo]}`}
                >
                  <span className="mt-0.5 shrink-0">{alerta.icone}</span>
                  <span>{alerta.mensagem}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
