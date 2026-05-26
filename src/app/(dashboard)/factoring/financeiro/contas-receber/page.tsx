'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, Calendar, AlertTriangle, CheckCircle2,
  Download, Eye, Search, Filter, X, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { exportarCSV } from '@/lib/utils/export'
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

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pendente:  { label: 'Pendente',  color: '#D97706', bg: 'rgba(217,119,6,0.1)'  },
  atrasado:  { label: 'Atrasado',  color: '#DC2626', bg: 'rgba(220,38,38,0.1)'  },
  pago:      { label: 'Pago',      color: '#16A34A', bg: 'rgba(22,163,74,0.1)'  },
  renegociado:{ label: 'Renegociado', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)'},
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
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todas as parcelas pendentes e em atraso
          </p>
        </div>
        {temPermissao('financeiro') && filtradas.length > 0 && (
          <button
            onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Download size={15} />
            Exportar CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Total a Receber"
          value={formatarMoeda(stats.total)}
          color="#1E5AA8"
          sub={`${filtradas.length} parcelas`}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Em Atraso"
          value={formatarMoeda(stats.atrasado)}
          color="#DC2626"
          sub={`${stats.qtd_atrasadas} parcelas`}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Vencem Hoje"
          value={String(stats.vence_hoje)}
          color="#D97706"
          sub="parcelas"
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="Próximos 7 dias"
          value={String(stats.vence_semana)}
          color="#7C3AED"
          sub="vencem esta semana"
        />
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filtros.busca}
            onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
            placeholder="Cliente, contrato ou CPF..."
            className="w-full pl-9 pr-3 h-9 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status */}
        <div className="flex gap-1 flex-wrap">
          {([
            ['todos',        'Todos'],
            ['atrasado',     'Atrasados'],
            ['pendente',     'Pendentes'],
            ['vence_hoje',   'Vence hoje'],
            ['vence_semana', 'Esta semana'],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFiltros(f => ({ ...f, status: v }))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={filtros.status === v
                ? { background: '#1E5AA8', borderColor: '#1E5AA8', color: '#fff' }
                : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
              }
            >
              {l}
            </button>
          ))}
        </div>

        {/* Período */}
        <div className="flex items-center gap-2">
          <input
            type="date" value={filtros.de}
            onChange={e => setFiltros(f => ({ ...f, de: e.target.value }))}
            className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground text-sm">até</span>
          <input
            type="date" value={filtros.ate}
            onChange={e => setFiltros(f => ({ ...f, ate: e.target.value }))}
            className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {(filtros.de || filtros.ate) && (
            <button onClick={() => setFiltros(f => ({ ...f, de: '', ate: '' }))} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <CheckCircle2 size={32} className="text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhuma conta a receber encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parcela</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vencimento</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encargos</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtradas.map(p => {
                  const total    = p.valor + p.multa + p.juros_mora
                  const encargos = p.multa + p.juros_mora
                  const st       = STATUS_LABEL[p.status] ?? STATUS_LABEL.pendente
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.numero_contrato}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-none">{p.cliente_nome}</div>
                        {p.cliente_cpf && (
                          <div className="text-xs text-muted-foreground mt-0.5">{p.cliente_cpf}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {p.numero_parcela}<span className="text-muted-foreground/50">/{p.total_parcelas}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`text-sm ${p.status === 'atrasado' ? 'text-red-500 font-medium' : 'text-foreground'}`}>
                          {formatarData(p.data_vencimento)}
                        </div>
                        {p.dias_atraso > 0 && (
                          <div className="text-xs text-red-400 mt-0.5">{p.dias_atraso}d atraso</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatarMoeda(p.valor)}</td>
                      <td className="px-4 py-3 text-right">
                        {encargos > 0
                          ? <span className="text-red-500 font-medium">{formatarMoeda(encargos)}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatarMoeda(total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: st.color, backgroundColor: st.bg }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/factoring/emprestimos/${p.emprestimo_id}`)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver contrato"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Footer com totais */}
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                    {filtradas.length} parcela{filtradas.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground text-sm">
                    {formatarMoeda(filtradas.reduce((s, p) => s + p.valor, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-500 text-sm">
                    {formatarMoeda(filtradas.reduce((s, p) => s + p.multa + p.juros_mora, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground text-sm">
                    {formatarMoeda(stats.total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  sub: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground leading-none mb-1">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}
