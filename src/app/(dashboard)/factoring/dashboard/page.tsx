'use client'

import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { SectionCard } from '@/components/shared/SectionCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Banknote, TrendingUp, Clock, AlertTriangle, CheckCircle,
  Percent, MessageCircle, RefreshCw, CalendarDays, Scale, AlertCircle,
} from 'lucide-react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ClienteFactoring {
  id: string
  nome: string
  cpf: string
  telefone: string
  score_interno: number
}

interface Emprestimo {
  id: string
  cliente_id: string
  status: string
  saldo_devedor: number
  data_liberacao: string
  valor_principal?: number
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
  clienteId: string
  numeroContrato: string
  valor: number
  emprestimo_id: string
  data_vencimento: string
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

interface DashboardData {
  saldoCaixa: number
  recebidoMes: number
  aReceberHoje: number
  emAtraso: number
  novosEmprestimosMesCount: number
  novosEmprestimosMesValor: number
  taxaInadimplencia: number
  totalClientes: number
  totalContratosAtivos: number
  totalParcelasPagas: number
  parcelasVencendoHoje: ParcelaVencendoHoje[]
  parcelasProximos7: ParcelaVencendoHoje[]
  inadimplentes: ParcelaInadimplente[]
  ultimosPagamentos: Pagamento[]
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

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function FactoringDashboard() {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [agendaTab, setAgendaTab] = useState<'hoje' | 'proximos7'>('hoje')
  const [filtroMode, setFiltroMode] = useState<'mes' | 'dia'>('mes')
  const [mesFiltroAno, setMesFiltroAno] = useState(() => new Date().getFullYear())
  const [mesFiltroMes, setMesFiltroMes] = useState(() => new Date().getMonth() + 1)
  const [diaFiltro, setDiaFiltro] = useState(() => new Date().toISOString().split('T')[0])

  const mesFiltro = `${mesFiltroAno}-${String(mesFiltroMes).padStart(2, '0')}`

  const carregarDados = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const hojeStr = hoje()
      const primeiroDia = filtroMode === 'dia'
        ? diaFiltro
        : `${mesFiltroAno}-${String(mesFiltroMes).padStart(2, '0')}-01`
      const ultimoDia = filtroMode === 'dia'
        ? diaFiltro
        : new Date(mesFiltroAno, mesFiltroMes, 0).toISOString().split('T')[0]

      const [
        emprestimosRes,
        parcelasRes,
        clientesRes,
        movimentacoesRes,
        configRes,
        movsTodasRes,
      ] = await Promise.all([
        supabase
          .from('emprestimos')
          .select('id, cliente_id, status, saldo_devedor, data_liberacao, valor_principal, numero_contrato')
          .eq('empresa_id', empresaAtual.id)
          .limit(1000),
        supabase
          .from('parcelas_emprestimo')
          .select('id, emprestimo_id, cliente_id, data_vencimento, data_pagamento, valor, multa, juros_mora, valor_pago, status, dias_atraso')
          .eq('empresa_id', empresaAtual.id)
          .limit(2000),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, telefone, score_interno')
          .eq('empresa_id', empresaAtual.id)
          .limit(1000),
        supabase
          .from('movimentacoes_caixa')
          .select('id, descricao, valor, created_at, categoria')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_movimentacao', primeiroDia)
          .lte('data_movimentacao', ultimoDia)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('config_factoring')
          .select('saldo_inicial_caixa')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
        supabase
          .from('movimentacoes_caixa')
          .select('tipo, valor')
          .eq('empresa_id', empresaAtual.id),
      ])

      const emprestimos: Emprestimo[] = emprestimosRes.data ?? []
      const parcelas: ParcelaEmprestimo[] = parcelasRes.data ?? []
      const clientes: ClienteFactoring[] = clientesRes.data ?? []
      const movimentacoes: MovimentacaoCaixa[] = movimentacoesRes.data ?? []
      const movsAll = movsTodasRes.data ?? []
      const saldoInicialCaixa = Number(configRes.data?.saldo_inicial_caixa ?? 0)

      // Map clientes by id
      const clienteMap = new Map<string, ClienteFactoring>()
      for (const c of clientes) clienteMap.set(c.id, c)

      // Map emprestimos by id
      const emprestimoMap = new Map<string, Emprestimo>()
      for (const e of emprestimos) emprestimoMap.set(e.id, e)

      // ── StatCard 1: Saldo do Caixa
      const totalEntradas = movsAll.filter((m: { tipo: string }) => m.tipo === 'entrada').reduce((s: number, m: { valor: number }) => s + m.valor, 0)
      const totalSaidas   = movsAll.filter((m: { tipo: string }) => m.tipo === 'saida').reduce((s: number, m: { valor: number }) => s + m.valor, 0)
      const saldoCaixa = saldoInicialCaixa + totalEntradas - totalSaidas

      // ── StatCard 2: Recebido no mês filtrado
      const recebidoMes = parcelas
        .filter(p => p.data_pagamento && p.data_pagamento >= primeiroDia && p.data_pagamento <= ultimoDia)
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
      const novosEmpMes = emprestimos.filter(e => e.data_liberacao && e.data_liberacao >= primeiroDia && e.data_liberacao <= ultimoDia)
      const novosEmprestimosMesCount = novosEmpMes.length
      const novosEmprestimosMesValor = novosEmpMes.reduce((s, e) => s + (e.valor_principal ?? 0), 0)

      // ── StatCard 6: Taxa inadimplência
      const totalAtivos = parcelas.filter(p => ['pendente', 'atrasado'].includes(p.status)).length
      const totalAtrasados = parcelas.filter(p => p.status === 'atrasado').length
      const taxaInadimplencia = totalAtivos > 0 ? (totalAtrasados / totalAtivos) * 100 : 0

      const em7DiasStr = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        return d.toISOString().split('T')[0]
      })()

      const mapParcela = (p: ParcelaEmprestimo): ParcelaVencendoHoje => {
        const emp = emprestimoMap.get(p.emprestimo_id)
        const cliente = clienteMap.get(p.cliente_id)
        return {
          id: p.id,
          clienteNome: cliente?.nome ?? '—',
          clienteId: p.cliente_id,
          numeroContrato: emp?.numero_contrato ?? '—',
          valor: (p.valor ?? 0) + (p.multa ?? 0) + (p.juros_mora ?? 0) - (p.valor_pago ?? 0),
          emprestimo_id: p.emprestimo_id,
          data_vencimento: p.data_vencimento,
        }
      }

      // ── List 1: parcelas vencendo hoje
      const parcelasVencendoHoje: ParcelaVencendoHoje[] = parcelas
        .filter(p => p.data_vencimento === hojeStr && p.status === 'pendente')
        .map(mapParcela)

      const parcelasProximos7: ParcelaVencendoHoje[] = parcelas
        .filter(p => p.data_vencimento > hojeStr && p.data_vencimento <= em7DiasStr && p.status === 'pendente')
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .map(mapParcela)

      // ── List 2: top 10 inadimplentes
      const calcDiasAtraso = (venc: string): number => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
        return Math.max(0, Math.floor((hoje.getTime() - new Date(venc + 'T00:00:00').getTime()) / 86400000))
      }
      const inadimplentes: ParcelaInadimplente[] = parcelas
        .filter(p => p.status === 'atrasado')
        .map(p => ({ ...p, _dias: (p.dias_atraso && p.dias_atraso > 0) ? p.dias_atraso : calcDiasAtraso(p.data_vencimento) }))
        .sort((a, b) => b._dias - a._dias)
        .slice(0, 10)
        .map(p => {
          const cliente = clienteMap.get(p.cliente_id)
          return {
            id: p.id,
            clienteNome: cliente?.nome ?? '—',
            clienteTelefone: cliente?.telefone ?? '',
            diasAtraso: p._dias,
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

      // ── Visão geral
      const totalClientes = clientes.length
      const totalContratosAtivos = emprestimos.filter(e => e.status === 'ativo').length
      const totalParcelasPagas = parcelas.filter(p => p.status === 'pago').length

      setData({
        saldoCaixa,
        recebidoMes,
        aReceberHoje,
        emAtraso,
        novosEmprestimosMesCount,
        novosEmprestimosMesValor,
        taxaInadimplencia,
        totalClientes,
        totalContratosAtivos,
        totalParcelasPagas,
        parcelasVencendoHoje,
        parcelasProximos7,
        inadimplentes,
        ultimosPagamentos,
      })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, supabase, filtroMode, mesFiltroAno, mesFiltroMes, diaFiltro])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  if (loading) return <LoadingPage />
  if (!data) return (
    <AppShell empresa="factoring" titulo="Dashboard">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-lg">Erro ao carregar o dashboard.</p>
        <button
          onClick={carregarDados}
          className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </AppShell>
  )

  const d = data

  // ──────────────────────────────────────────────
  // Column definitions
  // ──────────────────────────────────────────────

  const colsVencendoHoje: Column<ParcelaVencendoHoje>[] = [
    { key: 'clienteNome', header: 'Cliente' },
    { key: 'numeroContrato', header: 'Contrato' },
    {
      key: 'data_vencimento',
      header: 'Vence',
      render: (row) => <span className="text-xs text-muted-foreground">{formatarData(row.data_vencimento)}</span>,
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
          onClick={e => { e.stopPropagation(); router.push(`/factoring/emprestimos/${row.emprestimo_id}?parcela=${row.id}`) }}
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
      render: (row) => <span className="text-muted-foreground text-xs">{formatarData(row.data)}</span>,
    },
  ]

  const saudacao = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  })()

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <AppShell empresa="factoring" titulo="Dashboard">
      <div className="space-y-6">

        {/* ── Saudação + filtros ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{saudacao}!</h1>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dataFormatada}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              {(['mes', 'dia'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setFiltroMode(m)}
                  className="px-3 py-1.5 transition-colors"
                  style={filtroMode === m ? { backgroundColor: '#1E5AA8', color: '#fff' } : {}}
                >
                  {m === 'mes' ? 'Mês' : 'Dia'}
                </button>
              ))}
            </div>

            {filtroMode === 'mes' ? (
              <div className="flex items-center gap-1">
                <select
                  value={mesFiltroMes}
                  onChange={e => setMesFiltroMes(Number(e.target.value))}
                  className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none"
                >
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((nome, i) => (
                    <option key={i + 1} value={i + 1}>{nome}</option>
                  ))}
                </select>
                <select
                  value={mesFiltroAno}
                  onChange={e => setMesFiltroAno(Number(e.target.value))}
                  className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <input
                type="date"
                value={diaFiltro}
                onChange={e => setDiaFiltro(e.target.value)}
                className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none"
              />
            )}

            <button
              onClick={carregarDados}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>
        </div>

        {/* ── StatCards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            titulo="Caixa"
            valor={formatarMoeda(d.saldoCaixa)}
            subtitulo="Saldo inicial + entradas − saídas"
            icone={Banknote}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
            onClick={() => router.push('/factoring/financeiro/caixa')}
            atalho="Ver movimentações →"
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
            valor={formatarMoeda(d.novosEmprestimosMesValor)}
            subtitulo={`${d.novosEmprestimosMesCount} contrato${d.novosEmprestimosMesCount !== 1 ? 's' : ''} liberados no mês`}
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

        {/* ── Ações rápidas ── */}
        <SectionCard titulo="Ações rápidas">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Novo Contrato',    sub: 'Liberar empréstimo',     icon: Banknote,      color: '#1E5AA8', href: '/factoring/emprestimos/novo',          primary: true  },
              { label: 'Ver Empréstimos',  sub: 'Abrir contrato e pagar', icon: CheckCircle,   color: '#22c55e', href: '/factoring/emprestimos',               primary: true  },
              { label: 'Simulador',        sub: 'Calcular empréstimo',    icon: Scale,         color: '#7C3AED', href: '/factoring/emprestimos/simulador',     primary: false },
              { label: 'Novo Cliente',     sub: 'Cadastrar tomador',      icon: MessageCircle, color: '#D4A528', href: '/factoring/clientes/novo',             primary: false },
              { label: 'Contas a Receber', sub: 'Ver pendentes e atraso', icon: TrendingUp,    color: '#f97316', href: '/factoring/financeiro/contas-receber', primary: false },
              { label: 'Inadimplentes',    sub: 'Ver em atraso',          icon: AlertCircle,   color: '#ef4444', href: '/factoring/parcelas/inadimplentes',    primary: false },
            ].map(({ label, sub, icon: Icon, color, href, primary }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`group flex flex-col items-start gap-3 p-4 rounded-xl transition-all text-left ${
                  primary
                    ? 'text-white shadow-sm hover:opacity-90'
                    : 'bg-muted/30 border border-border/60 hover:bg-muted/50 hover:border-border'
                }`}
                style={primary ? { backgroundColor: color } : {}}
              >
                <div className="p-2 rounded-lg" style={{ backgroundColor: primary ? 'rgba(255,255,255,0.2)' : `${color}18` }}>
                  <Icon size={18} style={{ color: primary ? '#fff' : color }} />
                </div>
                <div>
                  <p className={`text-sm font-semibold leading-tight ${primary ? 'text-white' : 'text-foreground'}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${primary ? 'text-white/70' : 'text-muted-foreground'}`}>{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Lists row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <SectionCard
            titulo="Agenda de parcelas"
            acoes={
              <div className="flex gap-1">
                <button
                  onClick={() => setAgendaTab('hoje')}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                    agendaTab === 'hoje' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Hoje ({d.parcelasVencendoHoje.length})
                </button>
                <button
                  onClick={() => setAgendaTab('proximos7')}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                    agendaTab === 'proximos7' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  7 dias ({d.parcelasProximos7.length})
                </button>
              </div>
            }
          >
            {(() => {
              const lista = agendaTab === 'hoje' ? d.parcelasVencendoHoje : d.parcelasProximos7
              const empty = agendaTab === 'hoje' ? 'Nenhuma parcela vence hoje.' : 'Nenhuma parcela nos próximos 7 dias.'
              return lista.length === 0
                ? <p className="text-muted-foreground text-sm py-8 text-center">{empty}</p>
                : <DataTable data={lista} columns={colsVencendoHoje} keyExtractor={p => p.id} />
            })()}
          </SectionCard>

          <SectionCard
            titulo="Top 10 inadimplentes"
            acoes={
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                {d.inadimplentes.length}
              </span>
            }
          >
            {d.inadimplentes.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma parcela em atraso.</p>
            ) : (
              <DataTable
                data={d.inadimplentes}
                columns={colsInadimplentes}
                keyExtractor={p => p.id}
              />
            )}
          </SectionCard>
        </div>

        {/* ── Lists row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <SectionCard titulo="Últimos pagamentos">
            {d.ultimosPagamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum pagamento registrado.</p>
            ) : (
              <DataTable
                data={d.ultimosPagamentos}
                columns={colsPagamentos}
                keyExtractor={p => p.id}
              />
            )}
          </SectionCard>

          <SectionCard titulo="Visão Geral">
            <div className="space-y-1">
              {[
                { label: 'Clientes cadastrados',    valor: d.totalClientes,              suffix: 'clientes',  color: '#1E5AA8', href: '/factoring/clientes' },
                { label: 'Contratos ativos',         valor: d.totalContratosAtivos,       suffix: 'contratos', color: '#22c55e', href: '/factoring/emprestimos' },
                { label: 'Parcelas pagas (total)',   valor: d.totalParcelasPagas,         suffix: 'parcelas',  color: '#D4A528', href: '/factoring/parcelas' },
                { label: 'Em atraso hoje',           valor: d.inadimplentes.length,       suffix: 'parcelas',  color: '#ef4444', href: '/factoring/parcelas/inadimplentes' },
                { label: 'Vencendo hoje',            valor: d.parcelasVencendoHoje.length, suffix: 'parcelas', color: '#f97316', href: '/factoring/parcelas' },
                { label: 'Nos próximos 7 dias',     valor: d.parcelasProximos7.length,   suffix: 'parcelas',  color: '#7C3AED', href: '/factoring/parcelas' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className="flex items-center justify-between w-full rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors text-left group"
                >
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/60">{item.suffix}</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
                      {item.valor}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

      </div>
    </AppShell>
  )
}
