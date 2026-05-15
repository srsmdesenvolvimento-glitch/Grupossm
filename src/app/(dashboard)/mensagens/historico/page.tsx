'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatarData } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import {
  CheckCircle2,
  AlertCircle,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Mail,
  Smartphone,
  Bell,
  History,
} from 'lucide-react'

type NotificacaoLog = {
  id: string
  empresa_id: string
  canal: 'whatsapp' | 'sms' | 'email' | 'sistema'
  destinatario: string
  assunto: string | null
  mensagem: string
  referencia_tipo: string | null
  referencia_id: string | null
  status: string
  enviado_em: string | null
  erro: string | null
  created_at: string
}

const CANAL_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare size={16} className="text-green-600" />,
  email: <Mail size={16} className="text-blue-600" />,
  sms: <Smartphone size={16} className="text-orange-500" />,
  sistema: <Bell size={16} className="text-slate-500" />,
}

const CANAL_BG: Record<string, string> = {
  whatsapp: 'bg-green-100',
  email: 'bg-blue-100',
  sms: 'bg-orange-100',
  sistema: 'bg-slate-100',
}

const CANAL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
  sistema: 'Sistema',
}

function isEnviado(status: string) {
  return status === 'enviado' || status === 'sucesso' || status === 'delivered'
}

function getDefaultDates() {
  const hoje = new Date()
  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(hoje.getDate() - 30)
  return {
    inicio: trintaDiasAtras.toISOString().slice(0, 10),
    fim: hoje.toISOString().slice(0, 10),
  }
}

function groupByDay(items: NotificacaoLog[]): Record<string, NotificacaoLog[]> {
  const groups: Record<string, NotificacaoLog[]> = {}
  for (const item of items) {
    const day = (item.enviado_em ?? item.created_at).slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(item)
  }
  return groups
}

export default function HistoricoMensagensPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()
  const defaults = getDefaultDates()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificacaoLog[]>([])
  const [search, setSearch] = useState('')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState(defaults.inicio)
  const [dataFim, setDataFim] = useState(defaults.fim)

  const load = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('notificacoes_log')
        .select('*')
        .eq('empresa_id', empresaAtual.id)
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (canalFiltro !== 'todos') query = query.eq('canal', canalFiltro)

      const { data, error } = await query
      if (error) throw error
      setItems((data as NotificacaoLog[]) ?? [])
    } catch {
      toast.error('Erro ao carregar histórico de mensagens')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, canalFiltro, dataInicio, dataFim])

  useEffect(() => { load() }, [load])

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const enviadas = items.filter(i => isEnviado(i.status)).length
  const comErro = items.filter(i => i.erro !== null).length
  const totalMes = items.filter(i => i.created_at >= monthStart).length
  const taxaSucesso = items.length > 0 ? Math.round((enviadas / items.length) * 100) : 0

  const filtered = items.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      i.destinatario.toLowerCase().includes(q) ||
      (i.assunto ?? '').toLowerCase().includes(q) ||
      i.mensagem.toLowerCase().includes(q)
    )
  })

  const groups = groupByDay(filtered)
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Histórico de Mensagens">
      <div className="space-y-6">
        {/* StatCards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Enviadas" valor={enviadas} icone={CheckCircle2} corIcone="#22c55e" />
          <StatCard titulo="Erros" valor={comErro} icone={AlertCircle} corIcone="#ef4444" />
          <StatCard titulo="Total mês" valor={totalMes} icone={BarChart3} corIcone="#1E5AA8" />
          <StatCard titulo="Taxa de sucesso" valor={`${taxaSucesso}%`} icone={TrendingUp} corIcone="#22c55e" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar destinatário, assunto ou mensagem..."
              />
            </div>

            <Select value={canalFiltro} onValueChange={(v) => setCanalFiltro(v ?? 'todos')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-[150px] text-sm"
              />
              <span className="text-slate-400 text-sm">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[150px] text-sm"
              />
            </div>

            {(search || canalFiltro !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setCanalFiltro('todos')
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        {days.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-16 h-16 rounded-2xl bg-[#EDF4FE] flex items-center justify-center mb-4">
              <History size={28} className="text-[#1E5AA8]" />
            </div>
            <p className="text-slate-700 font-medium">Nenhum registro encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Tente ajustar os filtros ou o período</p>
          </div>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <div key={day}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {formatarData(day)}
                </p>
                <div className="space-y-2">
                  {groups[day].map((m) => (
                    <div
                      key={m.id}
                      className="flex gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      {/* Canal icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${CANAL_BG[m.canal] ?? 'bg-slate-100'}`}>
                        {CANAL_ICON[m.canal] ?? <Bell size={16} className="text-slate-500" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {m.destinatario}
                            </p>
                            <p className="text-xs text-slate-400">
                              {m.assunto || CANAL_LABEL[m.canal] || m.canal}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                isEnviado(m.status)
                                  ? 'bg-green-100 text-green-700'
                                  : m.erro
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isEnviado(m.status) ? 'Enviado' : m.erro ? 'Erro' : m.status}
                            </span>
                            {m.enviado_em && (
                              <span className="text-xs text-slate-400">
                                {new Date(m.enviado_em).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{m.mensagem}</p>
                        {m.erro && (
                          <p className="text-xs text-red-500 mt-1 line-clamp-1" title={m.erro}>
                            Erro: {m.erro}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
