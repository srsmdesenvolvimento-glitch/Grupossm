'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { formatarMoeda } from '@/lib/utils/formatters'
import { LineChart as LineChartIcon, TrendingUp, AlertTriangle, DollarSign, Percent } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

type EmprestimoRow = {
  id: string
  cliente_id: string
  status: string
  valor_principal: number
  data_liberacao: string | null
}

type ParcelaRow = {
  id: string
  emprestimo_id: string
  cliente_id: string
  status: string
  valor: number
  multa: number | null
  juros_mora: number | null
  valor_pago: number | null
  data_vencimento: string
}

type ClienteRow = {
  id: string
  score_interno: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mesReferencia(dataISO: string): string {
  return dataISO.slice(0, 7) // 'YYYY-MM'
}

function mesLabel(mesRef: string): string {
  const [ano, mes] = mesRef.split('-')
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function diasAtraso(dataVencimento: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000))
}

const FAIXAS_SCORE = [
  { id: 'baixo',   nome: 'Baixo Risco (70-100)', min: 70, max: 100, cor: '#34A853' },
  { id: 'medio',   nome: 'Médio Risco (50-69)',  min: 50, max: 69,  cor: '#FBBC04' },
  { id: 'alto',    nome: 'Alto Risco (30-49)',   min: 30, max: 49,  cor: '#FA903E' },
  { id: 'critico', nome: 'Crítico (0-29)',       min: 0,  max: 29,  cor: '#EA4335' },
] as const

function faixaDoScore(score: number) {
  return FAIXAS_SCORE.find(f => score >= f.min && score <= f.max) ?? FAIXAS_SCORE[FAIXAS_SCORE.length - 1]
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function PctTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl bg-card border border-border/50 shadow-m3-2 p-3.5 text-xs space-y-1.5">
      <p className="font-bold text-foreground leading-none mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-foreground font-mono">{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsCarteiraPage() {
  const { empresaAtual } = useEmpresa()

  const [emprestimos, setEmprestimos] = useState<EmprestimoRow[]>([])
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([])
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const supabase = createClient()
      const [{ data: empData, error: empErr }, { data: parcData, error: parcErr }, { data: cliData, error: cliErr }] = await Promise.all([
        supabase
          .from('emprestimos')
          .select('id, cliente_id, status, valor_principal, data_liberacao')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('parcelas_emprestimo')
          .select('id, emprestimo_id, cliente_id, status, valor, multa, juros_mora, valor_pago, data_vencimento')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('clientes_factoring')
          .select('id, score_interno')
          .eq('empresa_id', empresaAtual.id),
      ])
      if (empErr || parcErr || cliErr) throw (empErr ?? parcErr ?? cliErr)
      setEmprestimos((empData ?? []) as EmprestimoRow[])
      setParcelas((parcData ?? []) as ParcelaRow[])
      setClientes((cliData ?? []) as ClienteRow[])
    } catch {
      toast.error('Erro ao carregar analytics da carteira')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id])

  useEffect(() => { carregar() }, [carregar])

  // ─── Vintage: cohort por mês de liberação, % de contratos com atraso ──────
  const vintage = useMemo(() => {
    const porEmprestimo: Record<string, ParcelaRow[]> = {}
    for (const p of parcelas) {
      (porEmprestimo[p.emprestimo_id] ??= []).push(p)
    }

    const cohorts: Record<string, { total: number; comAtraso: number; valorLiberado: number }> = {}
    for (const e of emprestimos) {
      if (!e.data_liberacao) continue
      const mes = mesReferencia(e.data_liberacao)
      cohorts[mes] ??= { total: 0, comAtraso: 0, valorLiberado: 0 }
      cohorts[mes].total += 1
      cohorts[mes].valorLiberado += Number(e.valor_principal ?? 0)
      const parcelasDoEmp = porEmprestimo[e.id] ?? []
      const teveAtraso = parcelasDoEmp.some(p => p.status === 'atrasado') || e.status === 'inadimplente'
      if (teveAtraso) cohorts[mes].comAtraso += 1
    }

    return Object.entries(cohorts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // últimos 12 meses de originação
      .map(([mes, c]) => ({
        mes: mesLabel(mes),
        'Contratos em atraso': c.total > 0 ? Math.round((c.comAtraso / c.total) * 1000) / 10 : 0,
        totalContratos: c.total,
        valorLiberado: c.valorLiberado,
      }))
  }, [emprestimos, parcelas])

  // ─── Distribuição de atraso por faixa de dias (snapshot atual) ────────────
  const faixasAtraso = useMemo(() => {
    const buckets = [
      { id: '1-30',  label: '1-30 dias',  min: 1,  max: 30,  cor: '#FBBC04' },
      { id: '31-60', label: '31-60 dias', min: 31, max: 60,  cor: '#FA903E' },
      { id: '61-90', label: '61-90 dias', min: 61, max: 90,  cor: '#EA4335' },
      { id: '90+',   label: '90+ dias',   min: 91, max: Infinity, cor: '#B91C1C' },
    ]
    const valores = buckets.map(b => ({ ...b, valor: 0, qtd: 0 }))

    for (const p of parcelas) {
      if (p.status !== 'atrasado') continue
      const dias = diasAtraso(p.data_vencimento)
      const bucket = valores.find(b => dias >= b.min && dias <= b.max)
      if (bucket) {
        bucket.valor += Number(p.valor ?? 0) + Number(p.multa ?? 0) + Number(p.juros_mora ?? 0) - Number(p.valor_pago ?? 0)
        bucket.qtd += 1
      }
    }
    return valores
  }, [parcelas])

  // ─── Inadimplência por faixa de score interno ─────────────────────────────
  const porScore = useMemo(() => {
    const clienteAtrasado = new Set(parcelas.filter(p => p.status === 'atrasado').map(p => p.cliente_id))
    const clienteAtivo = new Set(emprestimos.filter(e => ['ativo', 'inadimplente'].includes(e.status)).map(e => e.cliente_id))

    const porFaixa: Record<string, { total: number; inadimplentes: number }> = {}
    for (const f of FAIXAS_SCORE) porFaixa[f.id] = { total: 0, inadimplentes: 0 }

    for (const c of clientes) {
      if (!clienteAtivo.has(c.id)) continue
      const faixa = faixaDoScore(c.score_interno)
      porFaixa[faixa.id].total += 1
      if (clienteAtrasado.has(c.id)) porFaixa[faixa.id].inadimplentes += 1
    }

    return FAIXAS_SCORE.map(f => ({
      nome: f.nome,
      cor: f.cor,
      total: porFaixa[f.id].total,
      'Taxa de inadimplência': porFaixa[f.id].total > 0 ? Math.round((porFaixa[f.id].inadimplentes / porFaixa[f.id].total) * 1000) / 10 : 0,
    })).filter(f => f.total > 0)
  }, [clientes, parcelas, emprestimos])

  // ─── KPIs gerais ───────────────────────────────────────────────────────────
  const carteiraAtiva = emprestimos.filter(e => ['ativo', 'inadimplente'].includes(e.status))
  const totalCarteiraAtiva = carteiraAtiva.reduce((s, e) => s + Number(e.valor_principal ?? 0), 0)
  const totalEmAtrasoValor = faixasAtraso.reduce((s, b) => s + b.valor, 0)
  const taxaInadimplenciaGeral = carteiraAtiva.length > 0
    ? Math.round((emprestimos.filter(e => e.status === 'inadimplente').length / carteiraAtiva.length) * 1000) / 10
    : 0
  const ticketMedio = carteiraAtiva.length > 0 ? totalCarteiraAtiva / carteiraAtiva.length : 0

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Analytics da Carteira">
      <div className="space-y-6">
        <PageHeader
          titulo="Analytics da Carteira"
          descricao="Visão de risco: safras de originação, atraso por faixa e inadimplência por perfil de score"
          icone={LineChartIcon}
          corIcone="#1A73E8"
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard titulo="Carteira Ativa" valor={formatarMoeda(totalCarteiraAtiva)} icone={DollarSign} corIcone="#1A73E8" corFundo="#E8F0FE" />
          <StatCard titulo="Em Atraso (snapshot)" valor={formatarMoeda(totalEmAtrasoValor)} icone={AlertTriangle} corIcone="#EA4335" corFundo="#FCE8E6" />
          <StatCard titulo="Taxa de Inadimplência" valor={`${taxaInadimplenciaGeral}%`} icone={Percent} corIcone="#FA903E" corFundo="#FEF0E1" />
          <StatCard titulo="Ticket Médio" valor={formatarMoeda(ticketMedio)} icone={TrendingUp} corIcone="#34A853" corFundo="#E6F4EA" />
        </div>

        {/* Vintage analysis */}
        <SectionCard titulo="Safras de Originação (Vintage) — últimos 12 meses">
          {vintage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sem contratos liberados ainda para montar as safras.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4 -mt-1">
                % de contratos de cada mês de liberação que já tiveram alguma parcela em atraso até hoje.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={vintage} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<PctTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Contratos em atraso" stroke="#EA4335" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição de atraso por faixa */}
          <SectionCard titulo="Distribuição do Atraso Atual">
            <p className="text-xs text-muted-foreground mb-4 -mt-1">
              Valor em aberto agora, por faixa de dias de atraso (foto do momento, não é taxa de migração histórica).
            </p>
            {faixasAtraso.every(b => b.qtd === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma parcela em atraso no momento.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={faixasAtraso} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatarMoeda(v).replace(',00', '')} width={70} />
                  <Tooltip formatter={(v?: number | string | readonly (number | string)[]) => formatarMoeda(Number(Array.isArray(v) ? v[0] : v))} />
                  <Bar dataKey="valor" name="Valor em atraso" radius={[6, 6, 0, 0]}>
                    {faixasAtraso.map((b, i) => <Cell key={i} fill={b.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Inadimplência por faixa de score */}
          <SectionCard titulo="Inadimplência por Perfil de Score">
            <p className="text-xs text-muted-foreground mb-4 -mt-1">
              % de clientes ativos com alguma parcela em atraso, agrupados pela faixa de score interno.
            </p>
            {porScore.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem contratos ativos suficientes para segmentar por score.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porScore} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<PctTooltip />} />
                  <Bar dataKey="Taxa de inadimplência" radius={[6, 6, 0, 0]}>
                    {porScore.map((f, i) => <Cell key={i} fill={f.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  )
}
