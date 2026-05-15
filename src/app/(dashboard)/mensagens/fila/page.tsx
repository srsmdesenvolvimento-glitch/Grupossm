'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatarData, formatarTelefone } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import { Eye, RotateCcw, X, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'

type FilaMensagem = {
  id: string
  empresa_id: string
  canal: 'whatsapp' | 'sms' | 'email' | 'sistema'
  destinatario: string
  tipo: string
  mensagem: string
  assunto: string | null
  agendar_para: string | null
  enviado_em: string | null
  status: 'pendente' | 'enviado' | 'erro' | 'cancelado'
  tentativas: number
  erro: string | null
  created_at: string
}

const CANAL_BADGE: Record<FilaMensagem['canal'], string> = {
  whatsapp: 'bg-green-100 text-green-700',
  email: 'bg-blue-100 text-blue-700',
  sms: 'bg-orange-100 text-orange-700',
  sistema: 'bg-slate-100 text-slate-600',
}

const CANAL_LABEL: Record<FilaMensagem['canal'], string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
  sistema: 'Sistema',
}

const STATUS_BADGE: Record<FilaMensagem['status'], string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  enviado: 'bg-green-100 text-green-700',
  erro: 'bg-red-100 text-red-700',
  cancelado: 'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<FilaMensagem['status'], string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  erro: 'Erro',
  cancelado: 'Cancelado',
}

export default function FilaMensagensPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<FilaMensagem[]>([])
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [canalFiltro, setCanalFiltro] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [viewItem, setViewItem] = useState<FilaMensagem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      let query = supabase
        .from('fila_mensagens')
        .select('*')
        .eq('empresa_id', empresaAtual.id)
        .order('created_at', { ascending: false })

      if (statusFiltro !== 'todos') query = query.eq('status', statusFiltro)
      if (canalFiltro !== 'todos') query = query.eq('canal', canalFiltro)
      if (dataInicio) query = query.gte('created_at', dataInicio)
      if (dataFim) query = query.lte('created_at', dataFim + 'T23:59:59')

      const { data, error } = await query
      if (error) throw error
      setItems((data as FilaMensagem[]) ?? [])
    } catch {
      toast.error('Erro ao carregar fila de mensagens')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, statusFiltro, canalFiltro, dataInicio, dataFim])

  useEffect(() => { load() }, [load])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const pendentes = items.filter(i => i.status === 'pendente').length
  const enviadasHoje = items.filter(i =>
    i.status === 'enviado' && i.enviado_em && new Date(i.enviado_em) >= todayStart
  ).length
  const erros = items.filter(i => i.status === 'erro').length
  const totalMes = items.filter(i => new Date(i.created_at) >= monthStart).length

  const filtered = items.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return i.destinatario.toLowerCase().includes(q) || i.tipo.toLowerCase().includes(q)
  })

  async function reenviar(item: FilaMensagem) {
    setActionLoading(item.id)
    try {
      const { error } = await supabase
        .from('fila_mensagens')
        .update({ status: 'pendente', erro: null, tentativas: 0 })
        .eq('id', item.id)
        .eq('empresa_id', empresaAtual!.id)
      if (error) throw error
      toast.success('Mensagem reenviada para a fila')
      await load()
    } catch {
      toast.error('Erro ao reenviar mensagem')
    } finally {
      setActionLoading(null)
    }
  }

  async function cancelar(item: FilaMensagem) {
    setActionLoading(item.id)
    try {
      const { error } = await supabase
        .from('fila_mensagens')
        .update({ status: 'cancelado' })
        .eq('id', item.id)
        .eq('empresa_id', empresaAtual!.id)
      if (error) throw error
      toast.success('Mensagem cancelada')
      await load()
    } catch {
      toast.error('Erro ao cancelar mensagem')
    } finally {
      setActionLoading(null)
    }
  }

  const columns: Column<FilaMensagem>[] = [
    {
      key: 'destinatario',
      header: 'Destinatário',
      render: (row) => (
        <span className="text-sm font-medium text-slate-800">
          {row.canal === 'email' ? row.destinatario : formatarTelefone(row.destinatario)}
        </span>
      ),
    },
    {
      key: 'canal',
      header: 'Canal',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CANAL_BADGE[row.canal]}`}>
          {CANAL_LABEL[row.canal]}
        </span>
      ),
    },
    {
      key: 'mensagem',
      header: 'Mensagem',
      render: (row) => (
        <span
          className="text-sm text-slate-600 truncate block max-w-[200px]"
          title={row.mensagem}
        >
          {row.mensagem.length > 50 ? row.mensagem.slice(0, 50) + '…' : row.mensagem}
        </span>
      ),
    },
    {
      key: 'agendar_para',
      header: 'Agendado para',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.agendar_para ? formatarData(row.agendar_para) : 'Imediato'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      ),
    },
    {
      key: 'tentativas',
      header: 'Tentativas',
      render: (row) => (
        <span className="text-sm text-slate-600 tabular-nums">{row.tentativas}</span>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'erro' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              disabled={actionLoading === row.id}
              onClick={() => reenviar(row)}
            >
              <RotateCcw size={12} className="mr-1" />
              Reenviar
            </Button>
          )}
          {(row.status === 'pendente') && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
              disabled={actionLoading === row.id}
              onClick={() => cancelar(row)}
            >
              <X size={12} className="mr-1" />
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            onClick={() => setViewItem(row)}
          >
            <Eye size={14} />
          </Button>
        </div>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Fila de Mensagens">
      <div className="space-y-6">
        {/* StatCards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Pendentes" valor={pendentes} icone={Clock} corIcone="#1E5AA8" />
          <StatCard titulo="Enviadas hoje" valor={enviadasHoje} icone={CheckCircle} corIcone="#22c55e" />
          <StatCard titulo="Erros" valor={erros} icone={AlertCircle} corIcone="#ef4444" />
          <StatCard titulo="Total mês" valor={totalMes} icone={MessageSquare} corIcone="#64748b" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar destinatário ou tipo..."
              />
            </div>

            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v ?? 'todos')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

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
                placeholder="De"
              />
              <span className="text-slate-400 text-sm">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[150px] text-sm"
                placeholder="Até"
              />
            </div>

            {(search || statusFiltro !== 'todos' || canalFiltro !== 'todos' || dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatusFiltro('todos')
                  setCanalFiltro('todos')
                  setDataInicio('')
                  setDataFim('')
                }}
                className="text-slate-500 hover:text-slate-800"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <DataTable
            data={filtered}
            columns={columns}
            keyExtractor={m => m.id}
            emptyMessage="Nenhuma mensagem na fila"
          />
        </div>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhe da mensagem</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Destinatário</p>
                  <p className="font-medium text-slate-800">
                    {viewItem.canal === 'email' ? viewItem.destinatario : formatarTelefone(viewItem.destinatario)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Canal</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CANAL_BADGE[viewItem.canal]}`}>
                    {CANAL_LABEL[viewItem.canal]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[viewItem.status]}`}>
                    {STATUS_LABEL[viewItem.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Tentativas</p>
                  <p className="font-medium text-slate-800">{viewItem.tentativas}</p>
                </div>
                {viewItem.agendar_para && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Agendado para</p>
                    <p className="font-medium text-slate-800">{formatarData(viewItem.agendar_para)}</p>
                  </div>
                )}
                {viewItem.enviado_em && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Enviado em</p>
                    <p className="font-medium text-slate-800">{formatarData(viewItem.enviado_em)}</p>
                  </div>
                )}
              </div>

              {viewItem.assunto && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Assunto</p>
                  <p className="text-sm font-medium text-slate-800">{viewItem.assunto}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400 mb-1">Mensagem</p>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
                  {viewItem.mensagem}
                </div>
              </div>

              {viewItem.erro && (
                <div>
                  <p className="text-xs text-red-400 mb-1">Erro</p>
                  <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 border border-red-200">
                    {viewItem.erro}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
