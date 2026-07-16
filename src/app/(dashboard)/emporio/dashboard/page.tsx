'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarMoeda } from '@/lib/utils/formatters'
import { linkWhatsApp } from '@/lib/utils/validators'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Package,
  Plus,
  ExternalLink,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────────────

interface VendaRow {
  total: number
  tipo_pagamento: string | null
  created_at: string
}

interface ParcelaRow {
  id: string
  valor: number
  data_vencimento: string
  clientes_emporio: { nome: string } | null
}

interface ProdutoBaixo {
  id: string
  nome: string
  estoque: number
  estoque_minimo: number
}

interface MovRow {
  tipo: 'entrada' | 'saida'
  valor: number
  categoria: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  boleto: 'Boleto',
  cheque: 'Cheque',
}

const PIE_COLORS = ['#D4A528', '#1E5AA8', '#16A34A', '#7C3AED', '#EA580C', '#6B7280']

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600">
          <span style={{ color: p.name === 'saidas' ? '#DC2626' : '#16A34A' }}>■</span>
          {' '}{p.name === 'saidas' ? 'Saídas' : p.name === 'entradas' ? 'Entradas' : p.name}:{' '}
          <span className="font-semibold">{formatarMoeda(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-slate-700">{payload[0].name}</p>
      <p className="text-slate-600">{formatarMoeda(payload[0].value)}</p>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmporioDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [vendasHoje, setVendasHoje] = useState<VendaRow[]>([])
  const [vendasMes, setVendasMes] = useState<VendaRow[]>([])
  const [parcelasHoje, setParcelasHoje] = useState<ParcelaRow[]>([])
  const [parcelasAtrasadas, setParcelasAtrasadas] = useState<ParcelaRow[]>([])
  const [produtosBaixo, setProdutosBaixo] = useState<ProdutoBaixo[]>([])
  const [caixaMes, setCaixaMes] = useState<MovRow[]>([])

  const carregarDados = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    const id = empresaAtual.id

    const now = new Date()
    const hoje = now.toISOString().split('T')[0]
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]

    try {
      const [
        { data: vHoje },
        { data: vMes },
        { data: pHoje },
        { data: pAtrasadas },
        { data: pBaixo },
        { data: caixa },
      ] = await Promise.all([
        supabase
          .from('vendas')
          .select('total')
          .eq('empresa_id', id)
          .eq('status', 'aprovada')
          .gte('created_at', hoje),
        supabase
          .from('vendas')
          .select('total, tipo_pagamento, created_at')
          .eq('empresa_id', id)
          .eq('status', 'aprovada')
          .gte('created_at', inicioMes),
        supabase
          .from('parcelas_receber')
          .select('id, valor, data_vencimento, clientes_emporio(nome)')
          .eq('empresa_id', id)
          .eq('status', 'pendente')
          .eq('data_vencimento', hoje),
        supabase
          .from('parcelas_receber')
          .select('id, valor, data_vencimento, clientes_emporio(nome)')
          .eq('empresa_id', id)
          .eq('status', 'atrasado')
          .order('data_vencimento')
          .limit(5),
        supabase
          .from('produtos')
          .select('id, nome, estoque, estoque_minimo')
          .eq('empresa_id', id)
          .eq('status', 'ativo')
          .filter('estoque', 'lt', 'estoque_minimo')
          .limit(8),
        supabase
          .from('movimentacoes_caixa')
          .select('tipo, valor, categoria')
          .eq('empresa_id', id)
          .gte('data_movimentacao', inicioMes),
      ])

      setVendasHoje((vHoje ?? []) as VendaRow[])
      setVendasMes((vMes ?? []) as VendaRow[])
      setParcelasHoje((pHoje ?? []) as unknown as ParcelaRow[])
      setParcelasAtrasadas((pAtrasadas ?? []) as unknown as ParcelaRow[])
      setProdutosBaixo((pBaixo ?? []) as ProdutoBaixo[])
      setCaixaMes((caixa ?? []) as MovRow[])
    } catch (e) {
      toast.error('Erro ao carregar dados do dashboard')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // ── Derived stats ────────────────────────────────────────────────────────────

  const totalVendasHoje = vendasHoje.reduce((s, v) => s + Number(v.total), 0)
  const totalVendasMes = vendasMes.reduce((s, v) => s + Number(v.total), 0)
  const totalParcelasHoje = parcelasHoje.reduce((s, p) => s + Number(p.valor), 0)
  const totalAtrasado = parcelasAtrasadas.reduce((s, p) => s + Number(p.valor), 0)

  // Vendas last 7 days chart
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const isoDate = d.toISOString().split('T')[0]
    const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
    const total = vendasMes
      .filter((v) => v.created_at.startsWith(isoDate))
      .reduce((s, v) => s + Number(v.total), 0)
    return { dia, total }
  })

  // Formas de pagamento pie
  const formasPagamento = Object.entries(
    vendasMes.reduce<Record<string, number>>((acc, v) => {
      const tipo = v.tipo_pagamento ?? 'outro'
      acc[tipo] = (acc[tipo] || 0) + Number(v.total)
      return acc
    }, {}),
  ).map(([name, value]) => ({
    name: PAYMENT_LABELS[name] ?? name,
    value,
  }))

  // Fluxo de caixa
  const entradas = caixaMes
    .filter((m) => m.tipo === 'entrada')
    .reduce((s, m) => s + Number(m.valor), 0)
  const saidas = caixaMes
    .filter((m) => m.tipo === 'saida')
    .reduce((s, m) => s + Number(m.valor), 0)
  const fluxoData = [{ mes: 'Este Mês', entradas, saidas, saldo: entradas - saidas }]

  // Days overdue helper
  const diasAtraso = (dataVencimento: string) => {
    const diff = new Date().getTime() - new Date(dataVencimento).getTime()
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="emporio" titulo="Dashboard">
      <div className="space-y-6">
        {/* ── StatCards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            titulo="Vendas Hoje"
            valor={formatarMoeda(totalVendasHoje)}
            subtitulo={`${vendasHoje.length} venda${vendasHoje.length !== 1 ? 's' : ''}`}
            icone={ShoppingCart}
            corIcone="#D4A528"
            corFundo="#FEF9E7"
          />
          <StatCard
            titulo="Vendas do Mês"
            valor={formatarMoeda(totalVendasMes)}
            subtitulo={`${vendasMes.length} vendas aprovadas`}
            icone={TrendingUp}
            corIcone="#16A34A"
            corFundo="#F0FDF4"
          />
          <StatCard
            titulo="A Receber Hoje"
            valor={formatarMoeda(totalParcelasHoje)}
            subtitulo={`${parcelasHoje.length} parcela${parcelasHoje.length !== 1 ? 's' : ''}`}
            icone={CreditCard}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(totalAtrasado)}
            subtitulo={`${parcelasAtrasadas.length} parcelas`}
            icone={AlertTriangle}
            corIcone="#DC2626"
            corFundo="#FEF2F2"
          />
          <StatCard
            titulo="Estoque Crítico"
            valor={String(produtosBaixo.length)}
            subtitulo="Produtos abaixo do mínimo"
            icone={Package}
            corIcone="#EA580C"
            corFundo="#FFF7ED"
          />
        </div>

        {/* ── Quick action ── */}
        <div className="flex justify-end">
          <Button
            onClick={() => router.push('/emporio/vendas/nova')}
            className="bg-[#D4A528] hover:bg-[#C09020] text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Venda
          </Button>
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Vendas últimos 7 dias */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Vendas — Últimos 7 dias</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ultimos7Dias} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#D4A528" radius={[4, 4, 0, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {ultimos7Dias.every((d) => d.total === 0) && (
              <p className="text-center text-xs text-slate-400 -mt-8">Nenhuma venda neste período</p>
            )}
          </div>

          {/* Chart 2: Formas de Pagamento */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">Formas de Pagamento — Mês</h3>
            {formasPagamento.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formasPagamento}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {formasPagamento.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ fontSize: 12, color: '#64748b' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-slate-400">Nenhuma venda este mês</p>
              </div>
            )}
          </div>

          {/* Chart 3: Fluxo de Caixa */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">Fluxo de Caixa — Mês Atual</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-500">Entradas: <strong className="text-slate-700">{formatarMoeda(entradas)}</strong></span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span className="text-slate-500">Saídas: <strong className="text-slate-700">{formatarMoeda(saidas)}</strong></span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-500">Saldo:</span>
                  <strong className={cn(
                    entradas - saidas >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {formatarMoeda(entradas - saidas)}
                  </strong>
                </span>
              </div>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fluxoData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="entradas" fill="#16A34A" radius={[4, 4, 0, 0]} name="entradas" />
                  <Bar dataKey="saidas" fill="#DC2626" radius={[4, 4, 0, 0]} name="saidas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Bottom Lists ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Parcelas vencendo hoje */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Parcelas Vencendo Hoje</h3>
              <span className="text-xs text-slate-500">{parcelasHoje.length} parcela{parcelasHoje.length !== 1 ? 's' : ''}</span>
            </div>
            {parcelasHoje.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CreditCard className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhuma parcela vence hoje</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {parcelasHoje.map((parcela) => (
                  <div key={parcela.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {parcela.clientes_emporio?.nome ?? 'Cliente não identificado'}
                      </p>
                      <p className="text-xs text-slate-500">Vence hoje</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {formatarMoeda(Number(parcela.valor))}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-[#D4A528] text-[#D4A528] hover:bg-[#FEF9E7]"
                        onClick={() => router.push('/emporio/financeiro')}
                      >
                        Receber
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parcelas em atraso */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Parcelas em Atraso</h3>
              {parcelasAtrasadas.length > 0 && (
                <span className="text-xs text-red-500 font-medium">
                  {formatarMoeda(totalAtrasado)} em aberto
                </span>
              )}
            </div>
            {parcelasAtrasadas.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhuma parcela em atraso</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {parcelasAtrasadas.map((parcela) => {
                  const dias = diasAtraso(parcela.data_vencimento)
                  const telefone = (parcela as unknown as { clientes_emporio: { nome: string; telefone?: string } | null }).clientes_emporio?.telefone
                  const nome = parcela.clientes_emporio?.nome ?? 'Cliente não identificado'
                  const whatsappMsg = `Olá ${nome}! Passando para lembrar sobre a parcela em atraso de ${formatarMoeda(Number(parcela.valor))} que venceu em ${new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}. Podemos resolver?`
                  const whatsappUrl = telefone ? linkWhatsApp(telefone, whatsappMsg) : null

                  return (
                    <div key={parcela.id} className="flex items-center justify-between px-5 py-3 bg-red-50/30">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{nome}</p>
                        <p className="text-xs text-red-500">
                          {dias} {dias === 1 ? 'dia' : 'dias'} em atraso
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-red-600">
                          {formatarMoeda(Number(parcela.valor))}
                        </span>
                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'h-7 px-2 text-xs rounded-md border inline-flex items-center gap-1 transition-colors',
                              'border-red-200 text-red-500 hover:bg-red-50',
                            )}
                          >
                            Cobrar
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-200 text-red-500 hover:bg-red-50"
                            onClick={() => router.push('/emporio/financeiro')}
                          >
                            Ver
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Estoque Crítico ── */}
        {produtosBaixo.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-slate-800 text-sm">Estoque Crítico</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/emporio/produtos')}
                className="text-xs text-slate-500 hover:text-slate-700 h-7"
              >
                Ver todos
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-5 py-3">
                      Produto
                    </th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                      Estoque Atual
                    </th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                      Mínimo
                    </th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {produtosBaixo.map((produto) => (
                    <tr key={produto.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800">{produto.nome}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            produto.estoque === 0 ? 'text-red-600' : 'text-orange-500',
                          )}
                        >
                          {produto.estoque}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm text-slate-500 tabular-nums">
                          {produto.estoque_minimo}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/emporio/produtos?id=${produto.id}`)}
                          className="h-7 text-xs text-slate-400 hover:text-slate-700"
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
