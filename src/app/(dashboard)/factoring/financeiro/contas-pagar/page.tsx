'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
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
    bg: 'bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/10',
    text: 'text-[var(--gt-blue)] dark:text-blue-400',
    border: 'border-[var(--gt-blue-light)] dark:border-[var(--gt-blue)]/20',
  },
  aluguel: {
    bg: 'bg-[var(--gt-orange-light)] dark:bg-[var(--gt-orange)]/10',
    text: 'text-[var(--gt-orange)] dark:text-orange-400',
    border: 'border-[var(--gt-orange-light)] dark:border-[var(--gt-orange)]/20',
  },
  salario: {
    bg: 'bg-[var(--gt-green-light)] dark:bg-[var(--gt-green)]/10',
    text: 'text-[var(--gt-green)] dark:text-green-400',
    border: 'border-[var(--gt-green-light)] dark:border-[var(--gt-green)]/20',
  },
  imposto: {
    bg: 'bg-[var(--gt-red-light)] dark:bg-[var(--gt-red)]/10',
    text: 'text-[var(--gt-red)] dark:text-red-400',
    border: 'border-[var(--gt-red-light)] dark:border-[var(--gt-red)]/20',
  },
  servico: {
    bg: 'bg-[var(--gt-purple-light)] dark:bg-[var(--gt-purple)]/10',
    text: 'text-[var(--gt-purple)] dark:text-purple-400',
    border: 'border-[var(--gt-purple-light)] dark:border-[var(--gt-purple)]/20',
  },
  outros: {
    bg: 'bg-muted dark:bg-card/40',
    text: 'text-muted-foreground dark:text-muted-foreground',
    border: 'border-border/60 dark:border-border/40',
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
          .eq('empresa_id', empresaAtual.id)
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
    if (!pagarForm.valor_pago || pagarForm.valor_pago <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    if (!pagarForm.data_pagamento) {
      toast.error('Informe a data do pagamento')
      return
    }
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
        .eq('empresa_id', empresaAtual.id)

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
    if (!conta || !empresaAtual) return
    setDeletando(true)
    try {
      const { error } = await supabase
        .from('contas_pagar')
        .delete()
        .eq('id', conta.id)
        .eq('empresa_id', empresaAtual.id)
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
          <p className="font-bold text-sm text-foreground leading-tight">{row.descricao}</p>
          {row.fornecedor_nome && (
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{row.fornecedor_nome}</p>
          )}
          {row.numero_documento && (
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
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
              'text-[10px] font-bold border rounded-full px-2.5 py-0.5 whitespace-nowrap',
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
                'text-sm font-semibold font-mono',
                row.status === 'atrasado' ? 'text-[var(--gt-red)]' : 'text-muted-foreground',
              )}
            >
              {formatarData(row.data_vencimento)}
            </p>
            {diasAtraso > 0 && (
              <p className="text-xs text-[var(--gt-red)] font-bold mt-1">{diasAtraso}d em atraso</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} />
      ),
    },
    {
      key: 'acoes',
      header: '',
      className: 'text-right w-[150px]',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {['pendente', 'atrasado'].includes(row.status) && (
            <Button
              size="default"
              className="text-[11px] font-bold h-7.5 px-3 bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] text-white border-0 rounded-full shadow-sm shrink-0 mr-1.5"
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
            className="h-7.5 w-7.5 rounded-full text-muted-foreground/60 hover:text-foreground flex items-center justify-center border border-border/40 shadow-sm bg-card hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation()
              abrirEditarConta(row)
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {row.status !== 'pago' && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Excluir conta"
              className="h-7.5 w-7.5 rounded-full text-muted-foreground/60 hover:text-[var(--gt-red)] hover:bg-[var(--gt-red-light)]/20 hover:border-[var(--gt-red-light)] flex items-center justify-center border border-border/40 shadow-sm bg-card"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialog({ open: true, conta: row })
              }}
            >
              <Trash2 className="h-3 w-3" />
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
      <div className="space-y-6">
        
        {/* Header */}
        <PageHeader 
          titulo="Contas a Pagar"
          descricao="Gerencie todas as despesas operacionais e saídas de caixa"
          icone={TrendingDown}
          corIcone="var(--gt-red)"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Total Pendente"
            valor={formatarMoeda(totalPendente)}
            subtitulo={`${pendentes.length} conta${pendentes.length !== 1 ? 's' : ''}`}
            icone={TrendingDown}
            corIcone="var(--gt-red)"
            corFundo="var(--gt-red-light)"
            delay={0}
          />
          <StatCard
            titulo="Vence Hoje"
            valor={`${vencendoHoje.length} conta${vencendoHoje.length !== 1 ? 's' : ''}`}
            subtitulo={formatarData(hoje)}
            icone={Calendar}
            corIcone="var(--gt-yellow)"
            corFundo="var(--gt-yellow-light)"
            delay={0.07}
          />
          <StatCard
            titulo="Em Atraso"
            valor={`${atrasadas.length} conta${atrasadas.length !== 1 ? 's' : ''}`}
            subtitulo="Contas vencidas"
            icone={AlertTriangle}
            corIcone="var(--gt-red)"
            corFundo="var(--gt-red-light)"
            delay={0.14}
          />
          <StatCard
            titulo="Pago este Mês"
            valor={formatarMoeda(pagoMes)}
            subtitulo="Mês de competência"
            icone={CheckCircle2}
            corIcone="var(--gt-green)"
            corFundo="var(--gt-green-light)"
            delay={0.21}
          />
        </div>

        {/* Tabs */}
        <Tabs
          value={tabAtiva}
          onValueChange={(v) => setTabAtiva(v as TabAtiva)}
          className="space-y-6"
        >
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            
            {/* Google Filter chips selector */}
            <div className="flex rounded-full border border-border/60 bg-muted/20 p-1 overflow-x-auto scrollbar-none items-center max-w-full">
              <button
                type="button"
                onClick={() => setTabAtiva('todas')}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                  tabAtiva === 'todas' ? "bg-[var(--gt-blue)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setTabAtiva('pendentes')}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                  tabAtiva === 'pendentes' ? "bg-[var(--gt-blue)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setTabAtiva('vencendo')}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5",
                  tabAtiva === 'vencendo' ? "bg-[var(--gt-blue)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Vencendo (7d)
                {vencendoSete.length > 0 && (
                  <span className={cn(
                    "h-4.5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center border border-transparent shadow-sm",
                    tabAtiva === 'vencendo' ? "bg-white text-[var(--gt-blue)]" : "bg-[var(--gt-yellow)] text-white"
                  )}>
                    {vencendoSete.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTabAtiva('atrasadas')}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5",
                  tabAtiva === 'atrasadas' ? "bg-[var(--gt-blue)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Atrasadas
                {atrasadas.length > 0 && (
                  <span className={cn(
                    "h-4.5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center border border-transparent shadow-sm",
                    tabAtiva === 'atrasadas' ? "bg-white text-[var(--gt-blue)]" : "bg-[var(--gt-red)] text-white"
                  )}>
                    {atrasadas.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTabAtiva('pagas')}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                  tabAtiva === 'pagas' ? "bg-[var(--gt-blue)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pagas
              </button>
            </div>

            {/* Actions bar */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar conta..."
                className="flex-1 min-w-[200px] sm:flex-none sm:w-56"
              />
              <Select
                value={categoriaFiltro}
                onValueChange={(v) => setCategoriaFiltro(v as Categoria | 'todas')}
              >
                <SelectTrigger className="w-40 h-11 text-xs rounded-full border-border/60 bg-card">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
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
                className="bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] text-white border-0 h-11 px-5 text-sm shrink-0 rounded-full font-medium shadow-sm transition-all duration-200"
              >
                <Plus className="h-4.5 w-4.5 mr-1.5" />
                Nova Conta
              </Button>
            </div>
          </div>

          <TabsContent value={tabAtiva} className="mt-0">
            <div className="bg-card border border-border/50 rounded-2xl shadow-m3-1 overflow-hidden">
              <DataTable
                columns={columns}
                data={contasFiltradas}
                keyExtractor={(row) => row.id}
                loading={loading}
                emptyMessage="Nenhuma conta encontrada"
                perPage={20}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sheet: Nova / Editar Conta */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto border-l border-border/50 shadow-m3-3">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-foreground font-bold text-lg flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/20 flex items-center justify-center">
                <Plus size={16} className="text-[var(--gt-blue)]" />
              </div>
              {contaEditando ? 'Editar Conta' : 'Nova Conta a Pagar'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmitConta)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="font-semibold text-xs text-foreground/85">
                Descrição <span className="text-[var(--gt-red)]">*</span>
              </Label>
              <Input
                id="descricao"
                placeholder="Ex: Nota fiscal fornecedor XYZ"
                {...register('descricao')}
                className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
              {errors.descricao && (
                <p className="text-xs text-[var(--gt-red)] font-bold">{errors.descricao.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-foreground/85">
                  Categoria <span className="text-[var(--gt-red)]">*</span>
                </Label>
                <Controller
                  name="categoria"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-11 rounded-xl border-border/60">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
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
                  <p className="text-xs text-[var(--gt-red)] font-bold">{errors.categoria.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fornecedor_nome" className="font-semibold text-xs text-foreground/85">Fornecedor</Label>
                <Input
                  id="fornecedor_nome"
                  placeholder="Nome do fornecedor"
                  {...register('fornecedor_nome')}
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="valor" className="font-semibold text-xs text-foreground/85">
                  Valor (R$) <span className="text-[var(--gt-red)]">*</span>
                </Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('valor', { valueAsNumber: true })}
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-mono font-bold"
                />
                {errors.valor && (
                  <p className="text-xs text-[var(--gt-red)] font-bold">{errors.valor.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_vencimento" className="font-semibold text-xs text-foreground/85">
                  Vencimento <span className="text-[var(--gt-red)]">*</span>
                </Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  {...register('data_vencimento')}
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
                />
                {errors.data_vencimento && (
                  <p className="text-xs text-[var(--gt-red)] font-bold">{errors.data_vencimento.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero_documento" className="font-semibold text-xs text-foreground/85">Nº Documento</Label>
              <Input
                id="numero_documento"
                placeholder="Ex: NF-001, Boleto 123..."
                {...register('numero_documento')}
                className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="font-semibold text-xs text-foreground/85">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais ou notas..."
                rows={3}
                {...register('observacoes')}
                className="rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
            </div>

            <Separator className="my-2" />

            <SheetFooter className="flex flex-row items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetAberto(false)}
                disabled={salvandoConta}
                className="h-10 rounded-full border-border hover:bg-muted text-sm font-medium px-5 flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoConta}
                className="h-10 rounded-full text-sm font-medium px-5 flex-1 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 transition-all duration-200 shadow-m3-1"
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
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border border-border/50 shadow-m3-3 bg-card gap-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-bold text-foreground tracking-tight leading-snug">Registrar Pagamento</DialogTitle>
            <DialogDescription className="text-sm font-semibold text-foreground/80 mt-1">{pagarDialog.conta?.descricao}</DialogDescription>
          </DialogHeader>

          {pagarDialog.conta && (
            <div className="space-y-4 py-1">
              <div className="rounded-2xl border-l-4 border-y border-r border-y-border/40 border-r-border/40 border-l-[var(--gt-blue)] bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/5 p-4 text-center shadow-sm">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Valor da conta</p>
                <MoneyDisplay valor={Number(pagarDialog.conta.valor)} tamanho="lg" />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  Vencimento original em {formatarData(pagarDialog.conta.data_vencimento)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="valor_pago" className="font-semibold text-xs text-foreground/85">Valor Efetivamente Pago (R$)</Label>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagarForm.valor_pago}
                  onChange={(e) =>
                    setPagarForm((f) => ({ ...f, valor_pago: Number(e.target.value) }))
                  }
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_pagamento" className="font-semibold text-xs text-foreground/85">Data do Pagamento</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={pagarForm.data_pagamento}
                  onChange={(e) =>
                    setPagarForm((f) => ({ ...f, data_pagamento: e.target.value }))
                  }
                  className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-xs text-foreground/85">Meio de Pagamento</Label>
                <Select
                  value={pagarForm.tipo_pagamento}
                  onValueChange={(v) =>
                    setPagarForm((f) => ({ ...f, tipo_pagamento: v ?? '' }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl border-border/60">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto Bancário</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => setPagarDialog({ open: false, conta: null })}
              disabled={salvandoPagamento}
              className="h-10 rounded-full border-border hover:bg-muted text-sm font-medium px-5 flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarPagamento}
              disabled={salvandoPagamento}
              className="h-10 rounded-full text-sm font-medium px-5 flex-1 sm:flex-none text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 transition-all duration-200 shadow-m3-1 min-w-[130px]"
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
