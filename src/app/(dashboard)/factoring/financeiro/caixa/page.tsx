'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

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
      render: m => <span className="text-sm font-medium font-mono text-muted-foreground/80 tabular-nums">{formatarData(m.data_movimentacao)}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: m => (
        <span 
          className={cn(
            "flex items-center gap-1.5 text-xs font-bold leading-none px-2 py-0.5 rounded-full border w-fit",
            m.tipo === 'entrada' 
              ? "bg-[var(--gt-green-light)] text-[var(--gt-green)] border-[var(--gt-green-light)]" 
              : "bg-[var(--gt-red-light)] text-[var(--gt-red)] border-[var(--gt-red-light)]"
          )}
        >
          {m.tipo === 'entrada'
            ? <ArrowUpCircle size={12} />
            : <ArrowDownCircle size={12} />
          }
          {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </span>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: m => (
        <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/40 font-medium">
          {CATEGORIAS[m.categoria] ?? m.categoria}
        </span>
      ),
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: m => <span className="text-sm font-semibold text-foreground leading-normal">{m.descricao}</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      render: m => (
        <MoneyDisplay 
          valor={m.valor} 
          tamanho="sm" 
          positivo={m.tipo === 'entrada'} 
          negativo={m.tipo === 'saida'} 
          className="font-bold font-mono"
        />
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Caixa">
      <div className="space-y-6">
        
        <PageHeader 
          titulo="Fluxo de Caixa" 
          descricao="Monitore todas as movimentações e entradas financeiras da empresa" 
          icone={Wallet}
          corIcone="var(--gt-blue)"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Saldo Atual"
            valor={formatarMoeda(saldoAtual)}
            icone={Wallet}
            corIcone="var(--gt-blue)"
            corFundo="var(--gt-blue-light)"
            delay={0}
          />
          <StatCard
            titulo="Saldo Inicial"
            valor={formatarMoeda(saldoInicial)}
            subtitulo="Base para o saldo do caixa"
            icone={Wallet}
            corIcone="var(--gt-gray)"
            corFundo="var(--gt-gray-light)"
            delay={0.07}
          />
          <StatCard
            titulo="Entradas no Período"
            valor={formatarMoeda(totalEntradas)}
            icone={TrendingUp}
            corIcone="var(--gt-green)"
            corFundo="var(--gt-green-light)"
            delay={0.14}
          />
          <StatCard
            titulo="Saídas no Período"
            valor={formatarMoeda(totalSaidas)}
            icone={TrendingDown}
            corIcone="var(--gt-red)"
            corFundo="var(--gt-red-light)"
            delay={0.21}
          />
        </div>

        {/* Filtros */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="p-2 bg-muted/40 border border-border/40 rounded-xl shrink-0 flex items-center justify-center">
                <Filter size={15} className="text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">De</span>
                <input
                  type="date"
                  value={filtroInicio}
                  onChange={e => setFiltroInicio(e.target.value)}
                  className="h-10 text-sm border border-border/60 rounded-xl px-3 text-foreground bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] focus-visible:border-[var(--gt-blue)] transition-all font-semibold"
                />
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">até</span>
                <input
                  type="date"
                  value={filtroFim}
                  onChange={e => setFiltroFim(e.target.value)}
                  className="h-10 text-sm border border-border/60 rounded-xl px-3 text-foreground bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] focus-visible:border-[var(--gt-blue)] transition-all font-semibold"
                />
              </div>
            </div>
            
            {/* Google segmented selection */}
            <div className="flex rounded-full border border-border/60 bg-muted/20 p-1 w-full sm:w-auto sm:ml-auto">
              {(['todos', 'entrada', 'saida'] as const).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 flex-1 sm:flex-none",
                    filtroTipo === t
                      ? "bg-[var(--gt-blue)] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
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
            <div className="px-6 py-4.5 border-t border-border/50 bg-muted/5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Exibindo {filtradas.length} movimentação(ões) no período de {formatarData(filtroInicio)} a {formatarData(filtroFim)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Saldo do Período:</span>
                <MoneyDisplay 
                  valor={saldoAtual} 
                  positivo={saldoAtual >= 0} 
                  negativo={saldoAtual < 0} 
                  tamanho="md"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
