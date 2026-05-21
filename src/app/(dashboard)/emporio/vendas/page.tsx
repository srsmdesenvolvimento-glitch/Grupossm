'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHelp } from '@/components/shared/PageHelp'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarData } from '@/lib/utils/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShoppingCart,
  Plus,
  TrendingUp,
  TrendingDown,
  X,
  Eye,
  BarChart3,
} from 'lucide-react'

interface Venda {
  id: string
  numero_venda: number
  cliente_id: string | null
  subtotal: number
  desconto: number
  total: number
  tipo_pagamento: string | null
  parcelas: number
  status: 'orcamento' | 'aprovada' | 'entregue' | 'cancelada'
  created_at: string
  clientes_emporio: { nome: string; telefone: string | null } | null
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cheque: 'Cheque',
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelada', label: 'Cancelada' },
]

const PAGAMENTO_OPTIONS = [
  { value: 'todos', label: 'Todas formas' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Crédito' },
  { value: 'cartao_debito', label: 'Débito' },
  { value: 'boleto', label: 'Boleto' },
]

export default function VendasPage() {
  const router = useRouter()
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [cancelarDialog, setCancelarDialog] = useState<{ open: boolean; venda?: Venda }>({
    open: false,
  })
  const [cancelando, setCancelando] = useState(false)

  const carregarVendas = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select('*, clientes_emporio(nome, telefone)')
        .eq('empresa_id', empresaAtual.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setVendas(data as Venda[])
    } catch (e) {
      toast.error('Erro ao carregar vendas')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id])

  useEffect(() => {
    carregarVendas()
  }, [carregarVendas])

  // Stats
  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const vendasHoje = vendas.filter(
    (v) => v.created_at.startsWith(hoje) && v.status !== 'cancelada',
  )
  const vendasMes = vendas.filter(
    (v) => v.created_at >= inicioMes && v.status !== 'cancelada',
  )
  const vendasAprovadas = vendas.filter((v) => v.status === 'aprovada' || v.status === 'entregue')
  const canceladasMes = vendas.filter(
    (v) => v.created_at >= inicioMes && v.status === 'cancelada',
  )

  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.total), 0)
  const totalMes = vendasMes.reduce((s, v) => s + Number(v.total), 0)
  const ticketMedio =
    vendasAprovadas.length > 0
      ? vendasAprovadas.reduce((s, v) => s + Number(v.total), 0) / vendasAprovadas.length
      : 0

  // Filtered data
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const termo = busca.toLowerCase()
      const matchBusca =
        !busca ||
        String(v.numero_venda).includes(termo) ||
        (v.clientes_emporio?.nome ?? 'balcão').toLowerCase().includes(termo)

      const matchStatus = filtroStatus === 'todos' || v.status === filtroStatus
      const matchPagamento =
        filtroPagamento === 'todos' || v.tipo_pagamento === filtroPagamento

      const dataVenda = v.created_at.split('T')[0]
      const matchInicio = !dataInicio || dataVenda >= dataInicio
      const matchFim = !dataFim || dataVenda <= dataFim

      return matchBusca && matchStatus && matchPagamento && matchInicio && matchFim
    })
  }, [vendas, busca, filtroStatus, filtroPagamento, dataInicio, dataFim])

  const cancelarVenda = async () => {
    if (!cancelarDialog.venda) return
    setCancelando(true)
    try {
      const { error } = await supabase
        .from('vendas')
        .update({ status: 'cancelada' })
        .eq('id', cancelarDialog.venda.id)

      if (error) throw error

      await supabase
        .from('parcelas_receber')
        .update({ status: 'cancelado' })
        .eq('venda_id', cancelarDialog.venda.id)

      toast.success(`Venda #${cancelarDialog.venda.numero_venda} cancelada`)
      setCancelarDialog({ open: false })
      carregarVendas()
    } catch (e) {
      toast.error('Erro ao cancelar venda')
      console.error(e)
    } finally {
      setCancelando(false)
    }
  }

  const columns: Column<Venda>[] = [
    {
      key: 'numero_venda',
      header: 'Nº',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-slate-700">#{row.numero_venda}</span>
      ),
      className: 'w-20',
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (row) => (
        <span className="text-sm text-slate-600">{formatarData(row.created_at)}</span>
      ),
      className: 'w-28',
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row) => (
        <span className="text-sm text-slate-800">
          {row.clientes_emporio?.nome ?? (
            <span className="text-slate-400 italic">Balcão</span>
          )}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <MoneyDisplay valor={Number(row.total)} tamanho="sm" />,
      className: 'w-28 text-right',
    },
    {
      key: 'tipo_pagamento',
      header: 'Pagamento',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.tipo_pagamento ? PAYMENT_LABELS[row.tipo_pagamento] ?? row.tipo_pagamento : '—'}
          {row.parcelas > 1 && (
            <span className="text-slate-400 ml-1 text-xs">{row.parcelas}x</span>
          )}
        </span>
      ),
      className: 'w-28',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
      className: 'w-28',
    },
    {
      key: 'acoes',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/emporio/vendas/${row.id}`)
            }}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {row.status !== 'cancelada' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setCancelarDialog({ open: true, venda: row })
              }}
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: 'w-20',
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="emporio" titulo="Vendas">
      <div className="space-y-6">
        <PageHelp
          storageKey="help.emporio.vendas.v1"
          titulo="Vendas"
          oQueE="Registre e acompanhe todas as vendas do empório: à vista, a prazo ou orçamentos. Cada venda gera automaticamente as parcelas a receber quando necessário."
          passos={[
            'Clique em "Nova Venda" para registrar uma venda ou criar um orçamento.',
            'Use a busca para localizar uma venda pelo número ou nome do cliente.',
            'Filtre por status: Em aberto, Pago, Cancelado.',
            'Clique em uma venda para ver detalhes, parcelas e imprimir.',
          ]}
          dicas={[
            'Vendas a prazo geram parcelas automaticamente na seção "A Receber".',
            'Orçamentos não afetam o estoque até serem confirmados como venda.',
            'Use o botão de impressão na venda para gerar o comprovante.',
          ]}
        />
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Vendas Hoje"
            valor={`${vendasHoje.length} venda${vendasHoje.length !== 1 ? 's' : ''}`}
            subtitulo={`R$ ${totalHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icone={ShoppingCart}
            corIcone="#D4A528"
            corFundo="#FEF9E7"
          />
          <StatCard
            titulo="Este Mês"
            valor={`${vendasMes.length} venda${vendasMes.length !== 1 ? 's' : ''}`}
            subtitulo={`R$ ${totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icone={TrendingUp}
            corIcone="#16A34A"
            corFundo="#F0FDF4"
          />
          <StatCard
            titulo="Ticket Médio"
            valor={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitulo="Vendas aprovadas"
            icone={BarChart3}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
          />
          <StatCard
            titulo="Canceladas"
            valor={String(canceladasMes.length)}
            subtitulo="Este mês"
            icone={TrendingDown}
            corIcone="#DC2626"
            corFundo="#FEF2F2"
          />
        </div>

        {/* Main table */}
        <div className="bg-white rounded-xl border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Histórico de Vendas</h2>
            <Button
              onClick={() => router.push('/emporio/vendas/nova')}
              className="bg-[#D4A528] hover:bg-[#C09020] text-white"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Venda
            </Button>
          </div>

          {/* Filters */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Input
                placeholder="Buscar por cliente ou nº da venda..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? 'todos')}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroPagamento} onValueChange={(v) => setFiltroPagamento(v ?? 'todos')}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGAMENTO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 text-sm w-36"
                placeholder="De"
              />
              <span className="text-slate-400 text-sm">—</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 text-sm w-36"
                placeholder="Até"
              />
            </div>
            {(busca || filtroStatus !== 'todos' || filtroPagamento !== 'todos' || dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-slate-400 hover:text-slate-600 px-2"
                onClick={() => {
                  setBusca('')
                  setFiltroStatus('todos')
                  setFiltroPagamento('todos')
                  setDataInicio('')
                  setDataFim('')
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={vendasFiltradas}
            keyExtractor={(row) => row.id}
            emptyMessage="Nenhuma venda encontrada"
            onRowClick={(row) => router.push(`/emporio/vendas/${row.id}`)}
            perPage={20}
          />
        </div>
      </div>

      <ConfirmDialog
        open={cancelarDialog.open}
        onOpenChange={(open) => !cancelando && setCancelarDialog({ open })}
        titulo="Cancelar Venda"
        descricao={`Tem certeza que deseja cancelar a venda #${cancelarDialog.venda?.numero_venda}? Esta ação não pode ser desfeita.`}
        labelConfirmar="Cancelar Venda"
        onConfirmar={cancelarVenda}
        carregando={cancelando}
        variante="danger"
      />
    </AppShell>
  )
}
