'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, Calendar, AlertTriangle, Download, Eye, Clock, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { formatarMoeda, formatarData, formatarCPF } from '@/lib/utils/formatters'
import { exportarCSV } from '@/lib/utils/export'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ParcelaEmprestimo } from '@/lib/types/database'

type ParcelaReceber = ParcelaEmprestimo & {
  numero_contrato: string
  cliente_nome: string
  cliente_cpf: string | null
  cliente_telefone: string
}

type Filtros = {
  busca: string
  status: 'todos' | 'pendente' | 'atrasado' | 'vence_hoje' | 'vence_semana'
  de: string
  ate: string
}

function hoje() { return new Date().toISOString().slice(0, 10) }
function addDias(d: number) {
  const dt = new Date(); dt.setDate(dt.getDate() + d)
  return dt.toISOString().slice(0, 10)
}

export default function ContasReceberPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtros, setFiltros]   = useState<Filtros>({ busca: '', status: 'todos', de: '', ate: '' })

  const carregar = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: pData }, { data: cData }, { data: eData }] = await Promise.all([
        supabase
          .from('parcelas_emprestimo')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado'])
          .order('data_vencimento', { ascending: true }),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, telefone')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('emprestimos')
          .select('id, numero_contrato')
          .eq('empresa_id', empresaAtual.id),
      ])

      const clienteMap = Object.fromEntries((cData ?? []).map(c => [c.id, c]))
      const empMap     = Object.fromEntries((eData ?? []).map(e => [e.id, e]))

      const completas: ParcelaReceber[] = (pData ?? []).map(p => ({
        ...p,
        numero_contrato: empMap[p.emprestimo_id]?.numero_contrato ?? '—',
        cliente_nome:    clienteMap[p.cliente_id]?.nome ?? '—',
        cliente_cpf:     clienteMap[p.cliente_id]?.cpf ?? null,
        cliente_telefone: clienteMap[p.cliente_id]?.telefone ?? '—',
      }))

      setParcelas(completas)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregar() }, [carregar])

  const filtradas = useMemo(() => {
    const hj      = hoje()
    const semana  = addDias(7)
    const busca   = filtros.busca.toLowerCase()

    return parcelas.filter(p => {
      if (busca && !p.cliente_nome.toLowerCase().includes(busca) &&
          !p.numero_contrato.toLowerCase().includes(busca) &&
          !(p.cliente_cpf ?? '').includes(busca)) return false

      if (filtros.status === 'atrasado'    && p.status !== 'atrasado') return false
      if (filtros.status === 'pendente'    && p.status !== 'pendente') return false
      if (filtros.status === 'vence_hoje'  && p.data_vencimento !== hj) return false
      if (filtros.status === 'vence_semana' && (p.data_vencimento < hj || p.data_vencimento > semana)) return false

      if (filtros.de  && p.data_vencimento < filtros.de)  return false
      if (filtros.ate && p.data_vencimento > filtros.ate) return false

      return true
    })
  }, [parcelas, filtros])

  const stats = useMemo(() => {
    const hj     = hoje()
    const semana = addDias(7)
    return {
      total:         filtradas.reduce((s, p) => s + (p.valor + p.multa + p.juros_mora), 0),
      atrasado:      parcelas.filter(p => p.status === 'atrasado').reduce((s, p) => s + p.valor + p.multa + p.juros_mora, 0),
      vence_hoje:    parcelas.filter(p => p.data_vencimento === hj).length,
      vence_semana:  parcelas.filter(p => p.data_vencimento >= hj && p.data_vencimento <= semana).length,
      qtd_atrasadas: parcelas.filter(p => p.status === 'atrasado').length,
    }
  }, [parcelas, filtradas])

  function exportar() {
    const headers = [
      { key: 'contrato',    label: 'Contrato'    },
      { key: 'cliente',     label: 'Cliente'     },
      { key: 'cpf',         label: 'CPF'         },
      { key: 'parcela',     label: 'Parcela'     },
      { key: 'vencimento',  label: 'Vencimento'  },
      { key: 'valor',       label: 'Valor'       },
      { key: 'multa',       label: 'Multa'       },
      { key: 'juros_mora',  label: 'Juros Diários'  },
      { key: 'total',       label: 'Total'       },
      { key: 'dias_atraso', label: 'Dias Atraso' },
      { key: 'status',      label: 'Status'      },
    ]
    const rows = filtradas.map(p => ({
      contrato:    p.numero_contrato,
      cliente:     p.cliente_nome,
      cpf:         p.cliente_cpf ?? '',
      parcela:     `${p.numero_parcela}/${p.total_parcelas}`,
      vencimento:  formatarData(p.data_vencimento),
      valor:       p.valor,
      multa:       p.multa,
      juros_mora:  p.juros_mora,
      total:       p.valor + p.multa + p.juros_mora,
      dias_atraso: p.dias_atraso,
      status:      p.status,
    }))
    exportarCSV(`contas-receber-${hoje()}`, rows, headers)
  }

  return (
    <AppShell empresa="factoring" titulo="Contas a Receber">
      <div className="space-y-6">

        {/* Header */}
        <PageHeader 
          titulo="Contas a Receber"
          descricao="Acompanhe todas as parcelas pendentes e cobranças em aberto"
          icone={TrendingUp}
          corIcone="var(--gt-blue)"
          acoes={
            temPermissao('financeiro') && filtradas.length > 0 && (
              <Button
                onClick={exportar}
                size="default"
                className="h-10 gap-2 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-5 shadow-m3-1 hover:shadow-m3-2 transition-all duration-200"
              >
                <Download size={15} />
                Exportar CSV
              </Button>
            )
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Total a Receber"
            valor={formatarMoeda(stats.total)}
            icone={TrendingUp}
            corIcone="var(--gt-blue)"
            corFundo="var(--gt-blue-light)"
            subtitulo={`${filtradas.length} parcelas`}
            delay={0}
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(stats.atrasado)}
            icone={AlertTriangle}
            corIcone="var(--gt-red)"
            corFundo="var(--gt-red-light)"
            subtitulo={`${stats.qtd_atrasadas} parcelas`}
            delay={0.07}
          />
          <StatCard
            titulo="Vencem Hoje"
            valor={String(stats.vence_hoje)}
            icone={Clock}
            corIcone="var(--gt-yellow)"
            corFundo="var(--gt-yellow-light)"
            subtitulo="parcelas"
            delay={0.14}
          />
          <StatCard
            titulo="Próximos 7 dias"
            valor={String(stats.vence_semana)}
            icone={Calendar}
            corIcone="var(--gt-purple)"
            corFundo="var(--gt-purple-light)"
            subtitulo="vencem esta semana"
            delay={0.21}
          />
        </div>

        {/* Filtros */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-m3-1 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
            <SearchInput
              value={filtros.busca}
              onChange={val => setFiltros(f => ({ ...f, busca: val }))}
              placeholder="Buscar por cliente, contrato ou CPF..."
              className="max-w-md"
            />

            {/* Status chips selector */}
            <div className="flex rounded-full border border-border/60 bg-muted/20 p-1 overflow-x-auto scrollbar-none items-center max-w-full">
              {([
                ['todos',        'Todas'],
                ['atrasado',     'Atrasadas'],
                ['pendente',     'Pendentes'],
                ['vence_hoje',   'Vencem Hoje'],
                ['vence_semana', 'Esta Semana'],
              ] as const).map(([v, l]) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setFiltros(f => ({ ...f, status: v }))}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                    filtros.status === v
                      ? "bg-[var(--gt-blue)] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 md:ml-auto">
            <input
              type="date" 
              value={filtros.de}
              onChange={e => setFiltros(f => ({ ...f, de: e.target.value }))}
              className="h-10 px-3 text-sm rounded-xl border border-border/60 bg-card text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
            />
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">até</span>
            <input
              type="date" 
              value={filtros.ate}
              onChange={e => setFiltros(f => ({ ...f, ate: e.target.value }))}
              className="h-10 px-3 text-sm rounded-xl border border-border/60 bg-card text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
            />
            {(filtros.de || filtros.ate) && (
              <button 
                type="button" 
                onClick={() => setFiltros(f => ({ ...f, de: '', ate: '' }))} 
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted"
                aria-label="Limpar datas"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-m3-1">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground text-sm font-semibold animate-pulse">
              Carregando carteira de recebíveis...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--gt-green-light)] dark:bg-[var(--gt-green)]/10 flex items-center justify-center shadow-sm">
                <Clock size={22} className="text-[var(--gt-green)]" />
              </div>
              <p className="text-muted-foreground text-sm font-bold">Nenhuma conta a receber encontrada no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Contrato</th>
                    <th className="text-left px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="text-center px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Parcela</th>
                    <th className="text-center px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vencimento</th>
                    <th className="text-right px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Principal</th>
                    <th className="text-right px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Encargos</th>
                    <th className="text-right px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-center px-5 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtradas.map(p => {
                    const total    = p.valor + p.multa + p.juros_mora
                    const encargos = p.multa + p.juros_mora
                    return (
                      <tr key={p.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-5 py-4.5 font-mono text-xs font-bold text-[var(--gt-blue)] dark:text-blue-400">{p.numero_contrato}</td>
                        <td className="px-5 py-4.5">
                          <div className="font-bold text-foreground leading-none">{p.cliente_nome}</div>
                          {p.cliente_cpf && (
                            <div className="text-xs text-muted-foreground mt-1.5 font-medium">{formatarCPF(p.cliente_cpf)}</div>
                          )}
                        </td>
                        <td className="px-5 py-4.5 text-center text-muted-foreground font-mono font-medium">
                          {p.numero_parcela}<span className="text-muted-foreground/50">/{p.total_parcelas}</span>
                        </td>
                        <td className="px-5 py-4.5 text-center">
                          <div className={cn(
                            "text-sm font-semibold leading-none", 
                            p.status === 'atrasado' ? 'text-[var(--gt-red)]' : 'text-foreground'
                          )}>
                            {formatarData(p.data_vencimento)}
                          </div>
                          {p.dias_atraso > 0 && (
                            <div className="text-xs text-[var(--gt-red)] font-bold mt-1.5">{p.dias_atraso}d em atraso</div>
                          )}
                        </td>
                        <td className="px-5 py-4.5 text-right"><MoneyDisplay valor={p.valor} tamanho="sm" /></td>
                        <td className="px-5 py-4.5 text-right">
                          {encargos > 0
                            ? <MoneyDisplay valor={encargos} tamanho="sm" negativo />
                            : <span className="text-muted-foreground/30 font-medium text-xs">—</span>
                          }
                        </td>
                        <td className="px-5 py-4.5 text-right"><MoneyDisplay valor={total} tamanho="sm" /></td>
                        <td className="px-5 py-4.5 text-center">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-5 py-4.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/factoring/emprestimos/${p.emprestimo_id}`)}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center shadow-sm border border-border/40 bg-card"
                            title="Ver contrato"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Footer com totais */}
                <tfoot>
                  <tr className="border-t border-border/60 bg-muted/20">
                    <td colSpan={4} className="px-5 py-4 text-xs font-bold text-muted-foreground">
                      Totalizador: {filtradas.length} parcela{filtradas.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <MoneyDisplay valor={filtradas.reduce((s, p) => s + p.valor, 0)} tamanho="sm" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <MoneyDisplay valor={filtradas.reduce((s, p) => s + p.multa + p.juros_mora, 0)} tamanho="sm" negativo />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <MoneyDisplay valor={stats.total} tamanho="sm" />
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
