'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import {
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Categoria =
  | 'fornecedor'
  | 'aluguel'
  | 'salario'
  | 'imposto'
  | 'servico'
  | 'outros'

type ContaPagar = {
  id: string
  empresa_id: string
  descricao: string
  categoria: Categoria
  fornecedor_id: string | null
  fornecedor_nome: string | null
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: string | null
  numero_documento: string | null
  observacoes: string | null
  comprovante_url: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
}

type TabAtiva = 'todas' | 'pendentes' | 'vencendo' | 'atrasadas' | 'pagas'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<Categoria, string> = {
  fornecedor: 'Fornecedor',
  aluguel: 'Aluguel',
  salario: 'Salário',
  imposto: 'Imposto',
  servico: 'Serviço',
  outros: 'Outros',
}

const CATEGORIA_COLORS: Record<
  Categoria,
  { bg: string; text: string; border: string }
> = {
  fornecedor: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  aluguel: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  salario: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  imposto: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  servico: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  outros: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
}

// ─── Zod schema ────────────────────────────────────────────────────────────────

const contaSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  categoria: z.enum([
    'fornecedor',
    'aluguel',
    'salario',
    'imposto',
    'servico',
    'outros',
  ]),
  fornecedor_nome: z.string().optional(),
  valor: z.number({ message: 'Valor inválido' }).min(0.01, 'Valor deve ser positivo'),
  data_vencimento: z.string().min(1, 'Data obrigatória'),
  numero_documento: z.string().optional(),
  observacoes: z.string().optional(),
})

type ContaForm = z.infer<typeof contaSchema>

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ContasPagarFactoringPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | 'todas'>('todas')
  const [tabAtiva, setTabAtiva] = useState<TabAtiva>('todas')

  // Nova conta sheet
  const [sheetAberto, setSheetAberto] = useState(false)
  const [contaEditando, setContaEditando] = useState<ContaPagar | null>(null)
  const [salvandoConta, setSalvandoConta] = useState(false)

  // Pagar dialog
  const [pagarDialog, setPagarDialog] = useState<{
    open: boolean
    conta: ContaPagar | null
  }>({ open: false, conta: null })
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)
  const [pagarForm, setPagarForm] = useState({
    valor_pago: 0,
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo_pagamento: '',
  })

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    conta: ContaPagar | null
  }>({ open: false, conta: null })
  const [deletando, setDeletando] = useState(false)

  // React Hook Form
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ContaForm>({
    resolver: zodResolver(contaSchema) as Resolver<ContaForm>,
    defaultValues: {
      descricao: '',
      categoria: 'outros',
      fornecedor_nome: '',
      valor: 0,
      data_vencimento: '',
      numero_documento: '',
      observacoes: '',
    },
  })

  // ─── Load ───────────────────────────────────────────────────────────────

  async function carregarContas() {
    if (!empresaAtual?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('contas_pagar')
      .select('*')
      .eq('empresa_id', empresaAtual.id)
      .order('data_vencimento')

    if (error) {
      toast.error('Erro ao carregar contas')
    } else {
      setContas((data as ContaPagar[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    carregarContas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual?.id])

  // ─── Computed ─────────────────────────────────────────────────────────

  const hoje = new Date().toISOString().split('T')[0]
  const mesAtual = new Date().toISOString().slice(0, 7)

  const seteProximosDias = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() + 7)
    return limite.toISOString().split('T')[0]
  }, [])

  const pendentes = useMemo(
    () => contas.filter((c) => c.status === 'pendente'),
    [contas],
  )
  const totalPendente = useMemo(
    () => pendentes.reduce((s, c) => s + Number(c.valor), 0),
    [pendentes],
  )
  const vencendoHoje = useMemo(
    () => contas.filter((c) => c.status === 'pendente' && c.data_vencimento === hoje),
    [contas, hoje],
  )
  const vencendoSete = useMemo(
    () =>
      contas.filter(
        (c) =>
          c.status === 'pendente' &&
          c.data_vencimento >= hoje &&
          c.data_vencimento <= seteProximosDias,
      ),
    [contas, hoje, seteProximosDias],
  )
  const atrasadas = useMemo(
    () => contas.filter((c) => c.status === 'atrasado'),
    [contas],
  )
  const pagoMes = useMemo(
    () =>
      contas
        .filter(
          (c) => c.status === 'pago' && c.data_pagamento?.startsWith(mesAtual),
        )
        .reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0),
    [contas, mesAtual],
  )

  // ─── Filter ───────────────────────────────────────────────────────────

  const contasFiltradas = useMemo(() => {
    let lista = contas

    switch (tabAtiva) {
      case 'pendentes':
        lista = lista.filter((c) => c.status === 'pendente')
        break
      case 'vencendo':
        lista = lista.filter(
          (c) =>
            c.status === 'pendente' &&
            c.data_vencimento >= hoje &&
            c.data_vencimento <= seteProximosDias,
        )
        break
      case 'atrasadas':
        lista = lista.filter((c) => c.status === 'atrasado')
        break
      case 'pagas':
        lista = lista.filter((c) => c.status === 'pago')
        break
    }

    if (categoriaFiltro !== 'todas') {
      lista = lista.filter((c) => c.categoria === categoriaFiltro)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      lista = lista.filter(
        (c) =>
          c.descricao.toLowerCase().includes(q) ||
          c.fornecedor_nome?.toLowerCase().includes(q),
      )
    }

    return lista
  }, [contas, tabAtiva, categoriaFiltro, search, hoje, seteProximosDias])

  // ─── Sheet handlers ───────────────────────────────────────────────────

  function abrirNovaConta() {
    setContaEditando(null)
    reset({
      descricao: '',
      categoria: 'outros',
      fornecedor_nome: '',
      valor: 0,
      data_vencimento: '',
      numero_documento: '',
      observacoes: '',
    })
    setSheetAberto(true)
  }

  function abrirEditarConta(conta: ContaPagar) {
    setContaEditando(conta)
    reset({
      descricao: conta.descricao,
      categoria: conta.categoria,
      fornecedor_nome: conta.fornecedor_nome ?? '',
      valor: Number(conta.valor),
      data_vencimento: conta.data_vencimento,
      numero_documento: conta.numero_documento ?? '',
      observacoes: conta.observacoes ?? '',
    })
    setSheetAberto(true)
  }

  async function onSubmitConta(data: ContaForm) {
    if (!empresaAtual?.id) return
    setSalvandoConta(true)
    try {
      const payload = {
        empresa_id: empresaAtual.id,
        descricao: data.descricao,
        categoria: data.categoria,
        fornecedor_nome: data.fornecedor_nome || null,
        valor: data.valor,
        data_vencimento: data.data_vencimento,
        numero_documento: data.numero_documento || null,
        observacoes: data.observacoes || null,
      }

      if (contaEditando) {
        const { error } = await supabase
          .from('contas_pagar')
          .update(payload)
          .eq('id', contaEditando.id)
        if (error) throw error
        toast.success('Conta atualizada com sucesso!')
      } else {
        const { error } = await supabase
          .from('contas_pagar')
          .insert({ ...payload, status: 'pendente' })
        if (error) throw error
        toast.success('Conta criada com sucesso!')
      }

      setSheetAberto(false)
      await carregarContas()
    } catch {
      toast.error('Erro ao salvar conta')
    } finally {
      setSalvandoConta(false)
    }
  }

  // ─── Pagar dialog ─────────────────────────────────────────────────────

  function abrirPagarDialog(conta: ContaPagar) {
    setPagarForm({
      valor_pago: Number(conta.valor),
      data_pagamento: new Date().toISOString().split('T')[0],
      tipo_pagamento: '',
    })
    setPagarDialog({ open: true, conta })
  }

  async function confirmarPagamento() {
    const conta = pagarDialog.conta
    if (!conta || !empresaAtual?.id) return
    if (!pagarForm.tipo_pagamento) {
      toast.error('Selecione a forma de pagamento')
      return
    }

    setSalvandoPagamento(true)
    try {
      const { error: errUpdate } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          valor_pago: pagarForm.valor_pago,
          data_pagamento: pagarForm.data_pagamento,
          tipo_pagamento: pagarForm.tipo_pagamento,
        })
        .eq('id', conta.id)

      if (errUpdate) throw errUpdate

      const { error: errMov } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          empresa_id: empresaAtual.id,
          tipo: 'saida',
          categoria: conta.categoria,
          descricao: conta.descricao,
          valor: pagarForm.valor_pago,
          referencia_tipo: 'conta_pagar',
          referencia_id: conta.id,
          data_movimentacao: pagarForm.data_pagamento,
        })

      if (errMov) throw errMov

      toast.success('Pagamento registrado com sucesso!')
      setPagarDialog({ open: false, conta: null })
      await carregarContas()
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setSalvandoPagamento(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async function confirmarDelete() {
    const conta = deleteDialog.conta
    if (!conta) return
    setDeletando(true)
    try {
      const { error } = await supabase
        .from('contas_pagar')
        .delete()
        .eq('id', conta.id)
      if (error) throw error
      toast.success('Conta excluída')
      setDeleteDialog({ open: false, conta: null })
      await carregarContas()
    } catch {
      toast.error('Erro ao excluir conta')
    } finally {
      setDeletando(false)
    }
  }

  // ─── Columns ──────────────────────────────────────────────────────────

  const columns: Column<ContaPagar>[] = [
    {
      key: 'descricao',
      header: 'Descrição',
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.descricao}</p>
          {row.fornecedor_nome && (
            <p className="text-xs text-muted-foreground">{row.fornecedor_nome}</p>
          )}
          {row.numero_documento && (
            <p className="text-xs text-muted-foreground font-mono">
              Doc: {row.numero_documento}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (row) => {
        const colors = CATEGORIA_COLORS[row.categoria]
        return (
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-normal border',
              colors.bg,
              colors.text,
              colors.border,
            )}
          >
            {CATEGORIA_LABELS[row.categoria]}
          </Badge>
        )
      },
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
                (Date.now() - new Date(row.data_vencimento).getTime()) / 86400000,
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
        const map: Record<ContaPagar['status'], { label: string; cls: string }> = {
          pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
          pago: { label: 'Pago', cls: 'bg-green-50 text-green-700 border-green-200' },
          atrasado: { label: 'Atrasado', cls: 'bg-red-50 text-red-700 border-red-200' },
          cancelado: { label: 'Cancelado', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
        }
        const s = map[row.status]
        return (
          <Badge variant="outline" className={cn('text-xs font-normal border', s.cls)}>
            {s.label}
          </Badge>
        )
      },
    },
    {
      key: 'acoes',
      header: '',
      className: 'text-right w-[140px]',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {['pendente', 'atrasado'].includes(row.status) && (
            <Button
              size="sm"
              className="text-xs h-7 px-2.5 bg-[#D4A528] hover:bg-[#B8891F] text-white border-0"
              onClick={(e) => {
                e.stopPropagation()
                abrirPagarDialog(row)
              }}
            >
              Pagar
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Editar conta"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              abrirEditarConta(row)
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {row.status !== 'pago' && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Excluir conta"
              className="h-7 w-7 text-muted-foreground hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialog({ open: true, conta: row })
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell titulo="Contas a Pagar" empresa="factoring">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          titulo="Total Pendente"
          valor={formatarMoeda(totalPendente)}
          subtitulo={`${pendentes.length} conta${pendentes.length !== 1 ? 's' : ''}`}
          icone={TrendingDown}
          corIcone="#EF4444"
          corFundo="#FEF2F2"
        />
        <StatCard
          titulo="Vence Hoje"
          valor={`${vencendoHoje.length} conta${vencendoHoje.length !== 1 ? 's' : ''}`}
          subtitulo={formatarData(hoje)}
          icone={Calendar}
          corIcone="#F59E0B"
          corFundo="#FFFBEB"
        />
        <StatCard
          titulo="Em Atraso"
          valor={`${atrasadas.length} conta${atrasadas.length !== 1 ? 's' : ''}`}
          subtitulo="Vencidas"
          icone={AlertTriangle}
          corIcone="#EF4444"
          corFundo="#FEF2F2"
        />
        <StatCard
          titulo="Pago este Mês"
          valor={formatarMoeda(pagoMes)}
          subtitulo="Mês atual"
          icone={CheckCircle2}
          corIcone="#22C55E"
          corFundo="#F0FDF4"
        />
      </div>

      {/* Tabs */}
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
              Vencendo (7d)
              {vencendoSete.length > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-[#F59E0B] text-white border-0">
                  {vencendoSete.length}
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

          {/* Actions bar */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar conta..."
              className="flex-1 sm:w-52"
            />
            <Select
              value={categoriaFiltro}
              onValueChange={(v) => setCategoriaFiltro(v as Categoria | 'todas')}
            >
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="aluguel">Aluguel</SelectItem>
                <SelectItem value="salario">Salário</SelectItem>
                <SelectItem value="imposto">Imposto</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={abrirNovaConta}
              className="bg-[#1E5AA8] hover:bg-[#174a8c] text-white border-0 h-9 px-4 text-sm shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Conta
            </Button>
          </div>
        </div>

        <TabsContent value={tabAtiva} className="mt-0">
          <DataTable
            columns={columns}
            data={contasFiltradas}
            keyExtractor={(row) => row.id}
            loading={loading}
            emptyMessage="Nenhuma conta encontrada"
            perPage={20}
          />
        </TabsContent>
      </Tabs>

      {/* Sheet: Nova / Editar Conta */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-[#1A1A2E]">
              {contaEditando ? 'Editar Conta' : 'Nova Conta a Pagar'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmitConta)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="descricao">
                Descrição <span className="text-red-500">*</span>
              </Label>
              <Input
                id="descricao"
                placeholder="Ex: Nota fiscal fornecedor XYZ"
                {...register('descricao')}
              />
              {errors.descricao && (
                <p className="text-xs text-red-500">{errors.descricao.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Categoria <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="categoria"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="aluguel">Aluguel</SelectItem>
                        <SelectItem value="salario">Salário</SelectItem>
                        <SelectItem value="imposto">Imposto</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.categoria && (
                  <p className="text-xs text-red-500">{errors.categoria.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fornecedor_nome">Fornecedor</Label>
                <Input
                  id="fornecedor_nome"
                  placeholder="Nome do fornecedor"
                  {...register('fornecedor_nome')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="valor">
                  Valor (R$) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('valor', { valueAsNumber: true })}
                />
                {errors.valor && (
                  <p className="text-xs text-red-500">{errors.valor.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_vencimento">
                  Vencimento <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  {...register('data_vencimento')}
                />
                {errors.data_vencimento && (
                  <p className="text-xs text-red-500">{errors.data_vencimento.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero_documento">Nº Documento</Label>
              <Input
                id="numero_documento"
                placeholder="Ex: NF-001, Boleto 123..."
                {...register('numero_documento')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações opcionais..."
                rows={3}
                {...register('observacoes')}
              />
            </div>

            <Separator />

            <SheetFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetAberto(false)}
                disabled={salvandoConta}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoConta}
                className="flex-1 bg-[#1E5AA8] hover:bg-[#174a8c] text-white border-0"
              >
                {salvandoConta ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : contaEditando ? (
                  'Salvar alterações'
                ) : (
                  'Criar conta'
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialog: Pagar */}
      <Dialog
        open={pagarDialog.open}
        onOpenChange={(open) => {
          if (!salvandoPagamento) setPagarDialog((prev) => ({ ...prev, open }))
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A1A2E]">Registrar Pagamento</DialogTitle>
            <DialogDescription>{pagarDialog.conta?.descricao}</DialogDescription>
          </DialogHeader>

          {pagarDialog.conta && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Valor da conta</p>
                <p className="text-2xl font-bold text-[#1E5AA8]">
                  {formatarMoeda(Number(pagarDialog.conta.valor))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vence em {formatarData(pagarDialog.conta.data_vencimento)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_pago">Valor Pago (R$)</Label>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagarForm.valor_pago}
                  onChange={(e) =>
                    setPagarForm((f) => ({ ...f, valor_pago: Number(e.target.value) }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_pagamento">Data do Pagamento</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={pagarForm.data_pagamento}
                  onChange={(e) =>
                    setPagarForm((f) => ({ ...f, data_pagamento: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={pagarForm.tipo_pagamento}
                  onValueChange={(v) =>
                    setPagarForm((f) => ({ ...f, tipo_pagamento: v ?? '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPagarDialog({ open: false, conta: null })}
              disabled={salvandoPagamento}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarPagamento}
              disabled={salvandoPagamento}
              className="bg-[#1E5AA8] hover:bg-[#174a8c] text-white border-0 min-w-[130px]"
            >
              {salvandoPagamento ? (
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

      {/* Dialog: Delete */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        titulo="Excluir conta"
        descricao={`Tem certeza que deseja excluir "${deleteDialog.conta?.descricao}"? Esta ação não pode ser desfeita.`}
        onConfirmar={confirmarDelete}
        variante="danger"
        carregando={deletando}
        labelConfirmar="Excluir"
      />
    </AppShell>
  )
}
