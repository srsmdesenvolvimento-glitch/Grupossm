'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'

type Mov = {
  id: string
  tipo: 'entrada' | 'saida'
  categoria: string
  descricao: string
  valor: number
  data_movimentacao: string
  referencia_tipo: string | null
  referencia_id: string | null
}

const CATEGORIAS: Record<string, string> = {
  pagamento_parcela: 'Pagamento de parcela',
  liberacao_emprestimo: 'Liberação de empréstimo',
  quitacao_antecipada: 'Quitação antecipada',
  entrada_manual: 'Entrada manual',
  saida_manual: 'Saída manual',
  juros: 'Juros',
  multa: 'Multa',
}

function primeiroDiaMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDiaMes(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
}

export default function CaixaPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [movs, setMovs] = useState<Mov[]>([])
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroInicio, setFiltroInicio] = useState(primeiroDiaMes())
  const [filtroFim, setFiltroFim] = useState(ultimoDiaMes())
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')

  const carregar = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [configRes, movsRes] = await Promise.all([
        supabase.from('config_factoring').select('saldo_inicial_caixa').eq('empresa_id', empresaAtual.id).maybeSingle(),
        supabase
          .from('movimentacoes_caixa')
          .select('id, tipo, categoria, descricao, valor, data_movimentacao, referencia_tipo, referencia_id')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_movimentacao', filtroInicio)
          .lte('data_movimentacao', filtroFim)
          .order('data_movimentacao', { ascending: false }),
      ])
      setSaldoInicial(Number(configRes.data?.saldo_inicial_caixa ?? 0))
      setMovs((movsRes.data ?? []) as Mov[])
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, filtroInicio, filtroFim])

  useEffect(() => { carregar() }, [carregar])

  const filtradas = filtroTipo === 'todos' ? movs : movs.filter(m => m.tipo === filtroTipo)

  const totalEntradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totalSaidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const saldoAtual    = saldoInicial + totalEntradas - totalSaidas

  const columns: Column<Mov>[] = [
    {
      key: 'data',
      header: 'Data',
      render: m => <span className="text-sm text-slate-500 tabular-nums">{formatarData(m.data_movimentacao)}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: m => (
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: m.tipo === 'entrada' ? '#22c55e' : '#ef4444' }}>
          {m.tipo === 'entrada'
            ? <ArrowUpCircle size={13} />
            : <ArrowDownCircle size={13} />
          }
          {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: m => (
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {CATEGORIAS[m.categoria] ?? m.categoria}
        </span>
      ),
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: m => <span className="text-sm text-slate-700">{m.descricao}</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      render: m => (
        <span
          className="tabular-nums font-semibold text-sm"
          style={{ color: m.tipo === 'entrada' ? '#22c55e' : '#ef4444' }}
        >
          {m.tipo === 'entrada' ? '+' : '−'} {formatarMoeda(m.valor)}
        </span>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Caixa">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Saldo Atual"
            valor={formatarMoeda(saldoAtual)}
            icone={Wallet}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
          />
          <StatCard
            titulo="Saldo Inicial"
            valor={formatarMoeda(saldoInicial)}
            subtitulo="Configurado nas configurações"
            icone={Wallet}
            corIcone="#64748b"
          />
          <StatCard
            titulo="Entradas no Período"
            valor={formatarMoeda(totalEntradas)}
            icone={TrendingUp}
            corIcone="#22c55e"
            corFundo="#F0FDF4"
          />
          <StatCard
            titulo="Saídas no Período"
            valor={formatarMoeda(totalSaidas)}
            icone={TrendingDown}
            corIcone="#ef4444"
            corFundo="#FEF2F2"
          />
        </div>

        {/* Filtros */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <Filter size={15} className="text-slate-400" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">De</span>
              <input
                type="date"
                value={filtroInicio}
                onChange={e => setFiltroInicio(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700"
              />
              <span className="text-xs text-slate-500 font-medium">até</span>
              <input
                type="date"
                value={filtroFim}
                onChange={e => setFiltroFim(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-auto">
              {(['todos', 'entrada', 'saida'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={filtroTipo === t
                    ? { backgroundColor: '#1E5AA8', color: '#fff' }
                    : { color: '#64748b' }
                  }
                >
                  {t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filtradas}
            keyExtractor={m => m.id}
            emptyMessage="Nenhuma movimentação no período"
            onRowClick={m => {
              if (m.referencia_tipo === 'emprestimo' && m.referencia_id) {
                router.push(`/factoring/emprestimos/${m.referencia_id}`)
              }
            }}
            perPage={30}
          />

          {/* Saldo do período */}
          {filtradas.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {filtradas.length} movimentação(ões) · período: {formatarData(filtroInicio)} → {formatarData(filtroFim)}
              </span>
              <span className="text-sm font-bold" style={{ color: saldoAtual >= 0 ? '#1E5AA8' : '#ef4444' }}>
                Saldo: {formatarMoeda(saldoAtual)}
              </span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
