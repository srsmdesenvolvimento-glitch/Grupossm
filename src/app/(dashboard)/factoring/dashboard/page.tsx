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
  UserCheck, ShieldCheck, DollarSign, ArrowUpRight
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

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

// Generates a beautiful Google-style initials avatar
function renderAvatar(nome: string) {
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const bgCores = ['#E8F0FE', '#E6F4EA', '#FCE8E6', '#FEF7E0', '#F3E8FD', '#FEF0E1']
  const textCores = ['#1A73E8', '#34A853', '#EA4335', '#FBBC04', '#A142F4', '#FA903E']
  
  const charSum = nome.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const idx = charSum % bgCores.length

  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold uppercase tracking-wider shrink-0 transition-transform duration-200 group-hover:scale-105"
      style={{ backgroundColor: bgCores[idx], color: textCores[idx] }}
    >
      {iniciais}
    </div>
  )
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
  const [saudacao, setSaudacao] = useState('Olá')
  const [dataFormatada, setDataFormatada] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setSaudacao(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
    setDataFormatada(new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }))
  }, [])
  const [mesFiltroAno, setMesFiltroAno] = useState(() => new Date().getFullYear())
  const [mesFiltroMes, setMesFiltroMes] = useState(() => new Date().getMonth() + 1)
  const [diaFiltro, setDiaFiltro] = useState(() => new Date().toISOString().split('T')[0])

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
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <p className="text-muted-foreground text-lg">Erro ao carregar o dashboard.</p>
        <button
          onClick={carregarDados}
          className="text-sm px-5 py-2.5 rounded-full border border-border hover:bg-accent transition-colors font-medium"
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
    {
      key: 'clienteNome',
      header: 'Cliente / Tomador',
      render: (row) => (
        <div className="flex items-center gap-3">
          {renderAvatar(row.clienteNome)}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-foreground truncate max-w-[160px] sm:max-w-[220px]">
              {row.clienteNome}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Contrato: {row.numeroContrato}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'data_vencimento',
      header: 'Data Vence',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <CalendarDays className="w-3.5 h-3.5 text-[#1A73E8]/70" />
          <span>{formatarData(row.data_vencimento)}</span>
        </div>
      ),
    },
    {
      key: 'valor',
      header: 'A Receber',
      render: (row) => (
        <div className="font-bold text-sm">
          <MoneyDisplay valor={row.valor} />
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      className: 'w-[100px] text-right',
      render: (row) => (
        <button
          onClick={e => { e.stopPropagation(); router.push(`/factoring/emprestimos/${row.emprestimo_id}?parcela=${row.id}`) }}
          className="text-[11px] px-4 py-1.5 rounded-full font-bold text-white transition-all shadow-sm duration-150 hover:shadow hover:scale-105 active:scale-95 flex items-center gap-1 justify-center shrink-0 w-full"
          style={{ backgroundColor: '#1A73E8' }}
        >
          <span>Baixar</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      ),
    },
  ]

  const colsInadimplentes: Column<ParcelaInadimplente>[] = [
    {
      key: 'clienteNome',
      header: 'Cliente / Contato',
      render: (row) => (
        <div className="flex items-center gap-3">
          {renderAvatar(row.clienteNome)}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm text-foreground truncate max-w-[160px] sm:max-w-[220px]">
              {row.clienteNome}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Tel: {row.clienteTelefone || 'Sem telefone'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'diasAtraso',
      header: 'Atraso / Gravidade',
      render: (row) => {
        let color = '#FBBC04'
        let bg = '#FEF7E0'
        let label = 'Leve'
        if (row.diasAtraso > 90) {
          color = '#EA4335'
          bg = '#FCE8E6'
          label = 'Crítico'
        } else if (row.diasAtraso > 30) {
          color = '#FA903E'
          bg = '#FEF0E1'
          label = 'Médio'
        }

        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight" style={{ color }}>
              {row.diasAtraso}d
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: bg, color }}
            >
              {label}
            </span>
          </div>
        )
      },
    },
    {
      key: 'valor',
      header: 'Total Atrasado',
      render: (row) => (
        <div className="font-bold text-sm text-foreground">
          <MoneyDisplay valor={row.valor} />
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Cobrança',
      className: 'w-[110px] text-right',
      render: (row) => (
        <button
          onClick={() => {
            const tel = row.clienteTelefone.replace(/\D/g, '')
            const msg = encodeURIComponent(
              `Olá ${row.clienteNome}, identificamos uma parcela em aberto no valor de ${formatarMoeda(row.valor)} com ${row.diasAtraso} dias de atraso. Por favor, entre em contato para regularizar sua situação.`
            )
            window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
          }}
          disabled={!row.clienteTelefone}
          className="flex items-center justify-center gap-1.5 text-[11px] px-3.5 py-1.5 rounded-full font-bold text-white transition-all shadow-sm hover:shadow hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 w-full"
          style={{ backgroundColor: '#34A853' }}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Cobrar</span>
        </button>
      ),
    },
  ]

  const colsPagamentos: Column<Pagamento>[] = [
    {
      key: 'descricao',
      header: 'Movimentação / Histórico',
      render: (row) => {
        const isRecebimento = row.descricao.toLowerCase().includes('receb') || row.descricao.toLowerCase().includes('parcela')
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isRecebimento ? '#E6F4EA' : '#E8F0FE',
                color: isRecebimento ? '#34A853' : '#1A73E8'
              }}
            >
              {isRecebimento ? <ArrowUpRight className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-foreground truncate max-w-[180px] sm:max-w-[240px]">
                {row.descricao}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ID: {row.id.slice(0, 8)}...
              </span>
            </div>
          </div>
        )
      }
    },
    {
      key: 'valor',
      header: 'Valor Lançado',
      render: (row) => (
        <div className="font-bold text-sm">
          <MoneyDisplay valor={row.valor} />
        </div>
      ),
    },
    {
      key: 'data',
      header: 'Data Registro',
      render: (row) => (
        <span className="text-muted-foreground text-xs font-medium">
          {formatarData(row.data)}
        </span>
      ),
    },
  ]

  // Saudação and dataFormatada are managed via client-side state to prevent SSR hydration errors.

  // Calculating visual bar metrics for "Visão Geral"
  const totalCarteira = d.totalClientes + d.totalContratosAtivos + d.totalParcelasPagas
  const pctClientes = totalCarteira > 0 ? (d.totalClientes / totalCarteira) * 100 : 0
  const pctContratos = totalCarteira > 0 ? (d.totalContratosAtivos / totalCarteira) * 100 : 0
  const pctPagas = totalCarteira > 0 ? (d.totalParcelasPagas / totalCarteira) * 100 : 0

  return (
    <AppShell empresa="factoring" titulo="Dashboard">
      <div className="space-y-8 animate-fade-in-up">

        {/* ── CUSTOM GLOSSY WELCOME BANNER ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-m3-3 bg-gradient-to-r from-[#0d3b66] via-[#1A73E8] to-[#1557B0] p-6 sm:p-8 text-white">
          {/* Animated decorative glowing circles */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#34A853]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-12 w-80 h-80 bg-[#FA903E]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-white/90">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34A853]" />
                <span>Módulo Factoring Ativo</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {saudacao}, administrador!
              </h1>
              <p className="text-sm text-white/70 max-w-xl font-medium mt-1">
                Hoje é <span className="text-white font-semibold capitalize">{dataFormatada}</span>. 
                Aqui está um resumo operacional rápido para apoiar suas decisões.
              </p>
              {/* Dynamic tag pills removed */}
            </div>

            {/* Quick Filters inside banner */}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 shrink-0 self-start lg:self-center shadow-inner">
              <div className="flex rounded-full border border-white/20 bg-black/15 overflow-hidden text-[10px] font-bold p-0.5 w-full sm:w-auto">
                {(['mes', 'dia'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setFiltroMode(m)}
                    className="px-4 py-1.5 rounded-full transition-all duration-150 flex-1 sm:flex-initial"
                    style={filtroMode === m
                      ? { backgroundColor: '#FFFFFF', color: '#1A73E8' }
                      : { color: 'rgba(255,255,255,0.8)' }
                    }
                  >
                    {m === 'mes' ? 'MÊS' : 'DIA'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {filtroMode === 'mes' ? (
                  <div className="flex gap-1.5 w-full sm:w-auto">
                    <select
                      value={mesFiltroMes}
                      onChange={e => setMesFiltroMes(Number(e.target.value))}
                      className="text-xs font-semibold border border-white/20 rounded-full px-3 py-1.5 bg-black/25 text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer min-w-[105px]"
                    >
                      {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((nome, i) => (
                        <option key={i + 1} value={i + 1} className="bg-[#1A1D21] text-white">{nome}</option>
                      ))}
                    </select>
                    <select
                      value={mesFiltroAno}
                      onChange={e => setMesFiltroAno(Number(e.target.value))}
                      className="text-xs font-semibold border border-white/20 rounded-full px-3 py-1.5 bg-black/25 text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-[#1A1D21] text-white">{y}</option>)}
                    </select>
                  </div>
                ) : (
                  <input
                    type="date"
                    value={diaFiltro}
                    onChange={e => setDiaFiltro(e.target.value)}
                    className="text-xs font-semibold border border-white/20 rounded-full px-3.5 py-1.5 bg-black/25 text-white focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer w-full"
                  />
                )}

                <button
                  onClick={carregarDados}
                  className="flex items-center justify-center p-2 rounded-full border border-white/20 bg-white hover:bg-[#E8F0FE] text-[#1A73E8] transition-all hover:scale-105 active:scale-95 shadow shrink-0"
                  title="Atualizar dados"
                >
                  <RefreshCw size={14} className="animate-spin-hover" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── StatCards Grid with Shadow Glows ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            titulo="Saldo do Caixa"
            valor={formatarMoeda(d.saldoCaixa)}
            subtitulo="Fundo operacional da mesa"
            icone={Banknote}
            corIcone="#1A73E8"
            corFundo="#E8F0FE"
            onClick={() => router.push('/factoring/financeiro/caixa')}
            atalho="Visualizar Extrato de Caixa"
            delay={0}
          />
          <StatCard
            titulo="Amortizado no Mês"
            valor={formatarMoeda(d.recebidoMes)}
            subtitulo="Total de parcelas quitadas no período"
            icone={CheckCircle}
            corIcone="#34A853"
            corFundo="#E6F4EA"
            onClick={() => router.push('/factoring/parcelas')}
            atalho="Relatório de Amortizações"
            delay={0.06}
          />
          <StatCard
            titulo="A Receber Hoje"
            valor={formatarMoeda(d.aReceberHoje)}
            subtitulo="Carteira com vencimento imediato"
            icone={Clock}
            corIcone="#FBBC04"
            corFundo="#FEF7E0"
            onClick={() => router.push('/factoring/parcelas')}
            atalho="Verificar Vencimentos"
            delay={0.12}
          />
          <StatCard
            titulo="Carteira em Atraso"
            valor={formatarMoeda(d.emAtraso)}
            subtitulo="Total do passivo em inadimplência"
            icone={AlertTriangle}
            corIcone="#EA4335"
            corFundo="#FCE8E6"
            onClick={() => router.push('/factoring/parcelas/inadimplentes')}
            atalho="Ver Carteira de Cobrança"
            delay={0.18}
          />
          <StatCard
            titulo="Novos Contratos"
            valor={formatarMoeda(d.novosEmprestimosMesValor)}
            subtitulo={`${d.novosEmprestimosMesCount} contrato${d.novosEmprestimosMesCount !== 1 ? 's' : ''} emitidos no período`}
            icone={TrendingUp}
            corIcone="#1A73E8"
            corFundo="#E8F0FE"
            onClick={() => router.push('/factoring/emprestimos')}
            atalho="Ver Relação de Contratos"
            delay={0.24}
          />
          <StatCard
            titulo="Taxa Inadimplência"
            valor={`${d.taxaInadimplencia.toFixed(1)}%`}
            subtitulo="Atraso relativo sobre carteira total ativa"
            icone={Percent}
            corIcone="#FA903E"
            corFundo="#FEF0E1"
            onClick={() => router.push('/factoring/clientes')}
            atalho="Análise de Risco"
            delay={0.3}
          />
        </div>

        {/* ── PREMIUM QUICK ACTIONS PANEL ── */}
        <SectionCard titulo="Atalhos Operacionais Rápidos">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Novo Contrato',    sub: 'Emitir Empréstimo',    icon: Banknote,      color: '#1A73E8', href: '/factoring/emprestimos/novo',          primary: true  },
              { label: 'Ver Contratos',    sub: 'Histórico & Baixas',   icon: CheckCircle,   color: '#34A853', href: '/factoring/emprestimos',               primary: true  },
              { label: 'Simulador',        sub: 'Cálculo de Parcelas Fixas', icon: Scale,         color: '#A142F4', href: '/factoring/emprestimos/simulador',     primary: false },
              { label: 'Novo Cliente',     sub: 'Cadastrar Tomador',    icon: UserCheck,     color: '#FBBC04', href: '/factoring/clientes/novo',             primary: false },
              { label: 'Contas a Receber', sub: 'Pendências Financeiras', icon: TrendingUp,    color: '#FA903E', href: '/factoring/financeiro/contas-receber', primary: false },
              { label: 'Inadimplentes',    sub: 'Mesa de Cobrança',      icon: AlertCircle,   color: '#EA4335', href: '/factoring/parcelas/inadimplentes',    primary: false },
            ].map(({ label, sub, icon: Icon, color, href, primary }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`group flex flex-col items-start justify-between gap-4 p-4.5 rounded-2xl transition-all duration-300 text-left hover-lift ${
                  primary
                    ? 'text-white hover:shadow-lg'
                    : 'bg-card border border-border/50 hover:border-border hover:shadow-md'
                }`}
                style={primary ? {
                  background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
                  boxShadow: `0 4px 14px -3px ${color}45`
                } : {}}
              >
                <div
                  className="p-3 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm shrink-0"
                  style={{
                    backgroundColor: primary ? 'rgba(255,255,255,0.22)' : `${color}12`,
                    border: primary ? '1px solid rgba(255,255,255,0.15)' : 'none'
                  }}
                >
                  <Icon size={20} style={{ color: primary ? '#fff' : color }} />
                </div>
                
                <div className="space-y-0.5">
                  <p className={`text-sm font-bold tracking-tight leading-tight ${primary ? 'text-white' : 'text-foreground'}`}>
                    {label}
                  </p>
                  <p className={`text-[10px] ${primary ? 'text-white/80 font-medium' : 'text-muted-foreground'}`}>
                    {sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Lists Row 1: Agenda vs Inadimplência ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Agenda de Parcelas Card */}
          <SectionCard
            titulo="Agenda de Recebimento"
            acoes={
              <div className="flex gap-1.5 bg-muted/40 p-0.5 border border-border/40 rounded-full">
                <button
                  onClick={() => setAgendaTab('hoje')}
                  className="text-[10px] tracking-wider uppercase px-4 py-1.5 rounded-full transition-all duration-200 font-bold shrink-0"
                  style={
                    agendaTab === 'hoje'
                      ? { backgroundColor: '#FBBC04', color: '#202124', boxShadow: 'var(--shadow-m3-1)' }
                      : { color: 'var(--muted-foreground)' }
                  }
                >
                  Hoje ({d.parcelasVencendoHoje.length})
                </button>
                <button
                  onClick={() => setAgendaTab('proximos7')}
                  className="text-[10px] tracking-wider uppercase px-4 py-1.5 rounded-full transition-all duration-200 font-bold shrink-0"
                  style={
                    agendaTab === 'proximos7'
                      ? { backgroundColor: '#1A73E8', color: '#fff', boxShadow: 'var(--shadow-m3-1)' }
                      : { color: 'var(--muted-foreground)' }
                  }
                >
                  7 Dias ({d.parcelasProximos7.length})
                </button>
              </div>
            }
          >
            {(() => {
              const lista = agendaTab === 'hoje' ? d.parcelasVencendoHoje : d.parcelasProximos7
              const empty = agendaTab === 'hoje' ? 'Nenhum vencimento pendente para o dia de hoje.' : 'Nenhuma parcela pendente agendada para os próximos 7 dias.'
              return lista.length === 0
                ? <p className="text-muted-foreground text-sm py-16 text-center">{empty}</p>
                : <DataTable data={lista} columns={colsVencendoHoje} keyExtractor={p => p.id} />
            })()}
          </SectionCard>

          {/* Top 10 Inadimplentes Card */}
          <SectionCard
            titulo="Passivos Críticos / Cobrança"
            acoes={
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full animate-pulse-ring"
                style={{ backgroundColor: '#FCE8E6', color: '#EA4335', border: '1px solid #EA43351A' }}
              >
                {d.inadimplentes.length} Atrasados
              </span>
            }
          >
            {d.inadimplentes.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">Inadimplência zerada! Não há parcelas atrasadas em aberto.</p>
            ) : (
              <DataTable
                data={d.inadimplentes}
                columns={colsInadimplentes}
                keyExtractor={p => p.id}
              />
            )}
          </SectionCard>
        </div>

        {/* ── Lists Row 2: Ultimos Pagamentos vs Visão Geral ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Últimos Pagamentos Card */}
          <SectionCard titulo="Extrato Operacional Recente">
            {d.ultimosPagamentos.length === 0 ? (
              <p className="text-muted-foreground text-sm py-16 text-center">Nenhum lançamento de caixa recente no período filtrado.</p>
            ) : (
              <DataTable
                data={d.ultimosPagamentos}
                columns={colsPagamentos}
                keyExtractor={p => p.id}
              />
            )}
          </SectionCard>

          {/* Visão Geral com Barras Proporcionais Premium */}
          <SectionCard titulo="Distribuição Proporcional Operacional">
            <div className="space-y-6">
              
              {/* Graphical Stacked Indicator Bar */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Distribuição Geral de Carteira</span>
                <div className="h-4.5 rounded-full overflow-hidden flex bg-muted shadow-inner">
                  <div 
                    style={{ width: `${pctClientes}%` }} 
                    className="bg-[#1A73E8] h-full transition-all duration-500 hover:opacity-90" 
                    title={`Clientes: ${d.totalClientes}`}
                  />
                  <div 
                    style={{ width: `${pctContratos}%` }} 
                    className="bg-[#34A853] h-full transition-all duration-500 hover:opacity-90"
                    title={`Contratos Ativos: ${d.totalContratosAtivos}`}
                  />
                  <div 
                    style={{ width: `${pctPagas}%` }} 
                    className="bg-[#FBBC04] h-full transition-all duration-500 hover:opacity-90"
                    title={`Parcelas Pagas: ${d.totalParcelasPagas}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 font-bold px-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1A73E8]" />
                    <span>Clientes ({pctClientes.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
                    <span>Contratos Ativos ({pctContratos.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC04]" />
                    <span>Pagas ({pctPagas.toFixed(0)}%)</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Interactive List Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                {[
                  { label: 'Tomadores Cadastrados', valor: d.totalClientes, suffix: 'clientes', color: '#1A73E8', href: '/factoring/clientes' },
                  { label: 'Contratos Ativos Emitidos', valor: d.totalContratosAtivos, suffix: 'ativos', color: '#34A853', href: '/factoring/emprestimos' },
                  { label: 'Baixas de Parcelas (Total)', valor: d.totalParcelasPagas, suffix: 'parcelas', color: '#FBBC04', href: '/factoring/parcelas' },
                  { label: 'Inadimplentes em Carteira', valor: d.inadimplentes.length, suffix: 'parcelas', color: '#EA4335', href: '/factoring/parcelas/inadimplentes' },
                  { label: 'Contas Vencendo Hoje', valor: d.parcelasVencendoHoje.length, suffix: 'parcelas', color: '#FA903E', href: '/factoring/parcelas' },
                  { label: 'Previsões para 7 Dias', valor: d.parcelasProximos7.length, suffix: 'parcelas', color: '#A142F4', href: '/factoring/parcelas' },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className="flex items-center justify-between rounded-2xl border border-border/30 bg-card/60 p-3.5 hover:bg-accent/80 hover:border-border hover:shadow-sm transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors truncate max-w-[140px] sm:max-w-[160px]">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{item.suffix}</span>
                      </div>
                    </div>
                    <span className="text-xl font-extrabold tabular-nums tracking-tight" style={{ color: item.color }}>
                      {item.valor}
                    </span>
                  </button>
                ))}
              </div>

            </div>
          </SectionCard>
        </div>

      </div>
    </AppShell>
  )
}
