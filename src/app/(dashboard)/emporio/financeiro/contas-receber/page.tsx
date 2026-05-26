'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState, useEffect, useMemo } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Parcela = {
  id: string
  empresa_id: string
  venda_id: string | null
  cliente_id: string | null
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes: string | null
  clientes_emporio?: { nome: string; telefone: string | null } | null
  vendas?: { numero_venda: string | number } | null
}

type ReceberForm = {
  valor_recebido: number
  data_pagamento: string
  forma_pagamento: string
  observacoes: string
}

type TabAtiva = 'todas' | 'pendentes' | 'vencendo' | 'atrasadas' | 'pagas'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ContasReceberPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tabAtiva, setTabAtiva] = useState<TabAtiva>('todas')
  const [receberDialog, setReceberDialog] = useState<{
    open: boolean
    parcela: Parcela | null
  }>({ open: false, parcela: null })
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<ReceberForm>({
    valor_recebido: 0,
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: '',
    observacoes: '',
  })

  // ─── Load ─────────────────────────────────────────────────────────────────

  async function carregarParcelas() {
    if (!empresaAtual?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('parcelas_receber')
      .select('*, clientes_emporio(nome, telefone), vendas(numero_venda)')
      .eq('empresa_id', empresaAtual.id)
      .order('data_vencimento')

    if (error) {
      toast.error('Erro ao carregar parcelas')
    } else {
      setParcelas((data as Parcela[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    carregarParcelas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual?.id])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const hoje = new Date().toISOString().split('T')[0]
  const mesAtual = new Date().toISOString().slice(0, 7)

  const totalReceber = useMemo(
    () =>
      parcelas
        .filter((p) => ['pendente', 'atrasado'].includes(p.status))
        .reduce((s, p) => s + Number(p.valor), 0),
    [parcelas],
  )

  const vencendoHoje = useMemo(
    () =>
      parcelas.filter(
        (p) => p.status === 'pendente' && p.data_vencimento === hoje,
      ),
    [parcelas, hoje],
  )

  const atrasadas = useMemo(
    () => parcelas.filter((p) => p.status === 'atrasado'),
    [parcelas],
  )

  const recebidoMes = useMemo(
    () =>
      parcelas
        .filter(
          (p) => p.status === 'pago' && p.data_pagamento?.startsWith(mesAtual),
        )
        .reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0),
    [parcelas, mesAtual],
  )

  // ─── Filter ───────────────────────────────────────────────────────────────

  const parcelasFiltradas = useMemo(() => {
    let lista = parcelas

    switch (tabAtiva) {
      case 'pendentes':
        lista = lista.filter((p) => p.status === 'pendente')
        break
      case 'vencendo':
        lista = lista.filter(
          (p) => p.status === 'pendente' && p.data_vencimento === hoje,
        )
        break
      case 'atrasadas':
        lista = lista.filter((p) => p.status === 'atrasado')
        break
      case 'pagas':
        lista = lista.filter((p) => p.status === 'pago')
        break
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      lista = lista.filter((p) =>
        p.clientes_emporio?.nome?.toLowerCase().includes(q),
      )
    }

    return lista
  }, [parcelas, tabAtiva, search, hoje])

  // ─── Dialog helpers ───────────────────────────────────────────────────────

  function abrirReceberDialog(parcela: Parcela) {
    setForm({
      valor_recebido: Number(parcela.valor),
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: '',
      observacoes: '',
    })
    setReceberDialog({ open: true, parcela })
  }

  async function confirmarRecebimento() {
    const parcela = receberDialog.parcela
    if (!parcela || !empresaAtual?.id) return
    if (!form.forma_pagamento) {
      toast.error('Selecione a forma de pagamento')
      return
    }

    setSalvando(true)
    try {
      const clienteNome =
        parcela.clientes_emporio?.nome ?? 'Cliente não informado'

      const { error: errUpdate } = await supabase
        .from('parcelas_receber')
        .update({
          status: 'pago',
          valor_pago: form.valor_recebido,
          data_pagamento: form.data_pagamento,
          tipo_pagamento: form.forma_pagamento,
          observacoes: form.observacoes || null,
        })
        .eq('id', parcela.id)

      if (errUpdate) throw errUpdate

      const { error: errMov } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          empresa_id: empresaAtual.id,
          tipo: 'entrada',
          categoria: 'recebimento',
          descricao: `Parcela ${parcela.numero_parcela}/${parcela.total_parcelas} - ${clienteNome}`,
          valor: form.valor_recebido,
          referencia_tipo: 'parcela_receber',
          referencia_id: parcela.id,
          data_movimentacao: form.data_pagamento,
        })

      if (errMov) throw errMov

      toast.success('Pagamento registrado com sucesso!')
      setReceberDialog({ open: false, parcela: null })
      await carregarParcelas()
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setSalvando(false)
    }
  }

  // ─── Columns ──────────────────────────────────────────────────────────────

  const columns: Column<Parcela>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (row) => (
        <div>
          <p className="font-medium text-sm">
            {row.clientes_emporio?.nome ?? 'Sem cliente'}
          </p>
          {row.clientes_emporio?.telefone && (
            <p className="text-xs text-muted-foreground">
              {row.clientes_emporio.telefone}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'parcela',
      header: 'Parcela',
      render: (row) =>
        row.total_parcelas > 1 ? (
          <Badge variant="outline" className="font-mono text-xs">
            {row.numero_parcela}/{row.total_parcelas}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Avulso</span>
        ),
    },
    {
      key: 'venda',
      header: 'Venda',
      render: (row) =>
        row.vendas?.numero_venda ? (
          <span className="font-mono text-xs text-muted-foreground">
            #{row.vendas.numero_venda}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: (row) => <MoneyDisplay valor={Number(row.valor)} tamanho="sm" />,
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: (row) => {
        const diasAtraso =
          row.status === 'atrasado'
            ? Math.floor(
                (Date.now() - new Date(row.data_vencimento).getTime()) /
                  86400000,
              )
            : 0
        return (
          <div>
            <p
              className={cn(
                'text-sm',
                row.status === 'atrasado' && 'text-red-500 font-medium',
              )}
            >
              {formatarData(row.data_vencimento)}
            </p>
            {diasAtraso > 0 && (
              <p className="text-xs text-red-500">{diasAtraso}d em atraso</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const diasAtraso =
          row.status === 'atrasado'
            ? Math.floor(
                (Date.now() - new Date(row.data_vencimento).getTime()) /
                  86400000,
              )
            : 0
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            {row.status === 'atrasado' && diasAtraso > 0 && (
              <Badge
                variant="destructive"
                className="text-xs px-1.5 py-0.5 font-normal"
              >
                {diasAtraso}d
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'acoes',
      header: '',
      className: 'text-right w-[80px]',
      render: (row) =>
        ['pendente', 'atrasado'].includes(row.status) ? (
          <Button
            size="sm"
            className="text-xs h-7 px-3 bg-[#D4A528] hover:bg-[#B8891F] text-white border-0 shadow-sm"
            onClick={(e) => {
              e.stopPropagation()
              abrirReceberDialog(row)
            }}
          >
            Receber
          </Button>
        ) : null,
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell titulo="Contas a Receber" empresa="emporio">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          titulo="Total a Receber"
          valor={formatarMoeda(totalReceber)}
          subtitulo="Pendente + Atrasado"
          icone={TrendingUp}
          corIcone="#D4A528"
          corFundo="#FFFBEB"
        />
        <StatCard
          titulo="Vencendo Hoje"
          valor={`${vencendoHoje.length} parcelas`}
          subtitulo={formatarData(hoje)}
          icone={Calendar}
          corIcone="#F59E0B"
          corFundo="#FFFBEB"
        />
        <StatCard
          titulo="Vencidas"
          valor={`${atrasadas.length} parcelas`}
          subtitulo="Em atraso"
          icone={AlertTriangle}
          corIcone="#EF4444"
          corFundo="#FEF2F2"
        />
        <StatCard
          titulo="Recebido este Mês"
          valor={formatarMoeda(recebidoMes)}
          subtitulo="Mês atual"
          icone={CheckCircle2}
          corIcone="#22C55E"
          corFundo="#F0FDF4"
        />
      </div>

      {/* Tabs + Search */}
      <Tabs
        value={tabAtiva}
        onValueChange={(v) => setTabAtiva(v as TabAtiva)}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/60 h-9">
            <TabsTrigger value="todas" className="text-xs">
              Todas
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="text-xs">
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="vencendo" className="text-xs">
              Vencendo Hoje
              {vencendoHoje.length > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-[#F59E0B] text-white border-0">
                  {vencendoHoje.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="atrasadas" className="text-xs">
              Atrasadas
              {atrasadas.length > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-red-500 text-white border-0">
                  {atrasadas.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagas" className="text-xs">
              Pagas
            </TabsTrigger>
          </TabsList>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente..."
            className="w-full sm:w-64"
          />
        </div>

        <TabsContent value={tabAtiva} className="mt-0">
          <DataTable
            columns={columns}
            data={parcelasFiltradas}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage="Nenhuma parcela encontrada"
            perPage={20}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog: Receber */}
      <Dialog
        open={receberDialog.open}
        onOpenChange={(open) => {
          if (!salvando) setReceberDialog((prev) => ({ ...prev, open }))
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A2E]">
              Registrar Recebimento
            </DialogTitle>
            <DialogDescription>
              Recebendo parcela de{' '}
              <span className="font-semibold text-foreground">
                {receberDialog.parcela?.clientes_emporio?.nome ??
                  'cliente não informado'}
              </span>
            </DialogDescription>
          </DialogHeader>

          {receberDialog.parcela && (
            <div className="space-y-4 py-2">
              {/* Valor highlight */}
              <div className="rounded-xl bg-[#FFFBEB] border border-[#D4A528]/30 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Valor da parcela
                </p>
                <p className="text-2xl font-bold text-[#D4A528]">
                  {formatarMoeda(Number(receberDialog.parcela.valor))}
                </p>
                {receberDialog.parcela.total_parcelas > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Parcela {receberDialog.parcela.numero_parcela}/
                    {receberDialog.parcela.total_parcelas}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_recebido">Valor Recebido (R$)</Label>
                <Input
                  id="valor_recebido"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_recebido}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      valor_recebido: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_pagamento">Data do Pagamento</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={form.data_pagamento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data_pagamento: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, forma_pagamento: v ?? '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">
                      Cartão de Crédito
                    </SelectItem>
                    <SelectItem value="cartao_debito">
                      Cartão de Débito
                    </SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs_receber">Observações</Label>
                <Textarea
                  id="obs_receber"
                  placeholder="Observações opcionais..."
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, observacoes: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReceberDialog({ open: false, parcela: null })}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarRecebimento}
              disabled={salvando}
              className="bg-[#D4A528] hover:bg-[#B8891F] text-white border-0 min-w-[130px]"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
