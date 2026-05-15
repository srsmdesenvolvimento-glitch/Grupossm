'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft,
  ShoppingCart,
  TrendingUp,
  Calendar,
  CreditCard,
  MessageCircle,
  Eye,
  Loader2,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import {
  formatarMoeda,
  formatarData,
  formatarCPF,
  formatarTelefone,
  iniciais,
} from '@/lib/utils/formatters'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
import { Separator } from '@/components/ui/separator'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClienteEmporio {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  telefone: string
  telefone2: string | null
  email: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  observacoes: string | null
  total_compras: number
  valor_total_compras: number
  ultima_compra: string | null
  status: 'ativo' | 'inativo' | 'bloqueado'
  created_at: string
  updated_at: string
}

interface Venda {
  id: string
  empresa_id: string
  numero_venda: number
  cliente_id: string
  subtotal: number
  desconto: number
  total: number
  tipo_pagamento: string
  parcelas: number
  valor_entrada: number
  observacoes: string | null
  status: 'orcamento' | 'aprovada' | 'entregue' | 'cancelada'
  created_at: string
}

interface Parcela {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes: string | null
}

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/(\d{3})(\d{3})/, '$1.$2')
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
      .replace(/(\d{2})(\d{4})/, '($1) $2')
      .replace(/(\d{2})/, '($1')
  }
  return d
    .replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    .replace(/(\d{2})(\d{5})/, '($1) $2')
    .replace(/(\d{2})/, '($1')
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.replace(/(\d{5})(\d{3})/, '$1-$2')
}

// ─── Payment label ────────────────────────────────────────────────────────────

const PAGAMENTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cheque: 'Cheque',
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const dadosSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  telefone2: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  status: z.enum(['ativo', 'inativo', 'bloqueado']),
  observacoes: z.string().optional(),
})

type DadosFormData = z.infer<typeof dadosSchema>

const receberSchema = z.object({
  data_pagamento: z.string().min(1, 'Informe a data'),
  tipo_pagamento: z.string().min(1, 'Informe a forma de pagamento'),
  observacoes: z.string().optional(),
})

type ReceberFormData = z.infer<typeof receberSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClienteDetalhePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [cliente, setCliente] = useState<ClienteEmporio | null>(null)
  const [vendas, setVendas] = useState<Venda[]>([])
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)

  // Receber dialog
  const [parcelaSelecionada, setParcelaSelecionada] = useState<Parcela | null>(null)
  const [dialogReceberOpen, setDialogReceberOpen] = useState(false)
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)

  // Dados tab
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)

  // Obs tab
  const [obsText, setObsText] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  // ─── Forms ─────────────────────────────────────────────────────────────────

  const dadosForm = useForm<DadosFormData>({
    resolver: zodResolver(dadosSchema),
    defaultValues: { status: 'ativo' },
  })

  const receberForm = useForm<ReceberFormData>({
    resolver: zodResolver(receberSchema),
    defaultValues: {
      data_pagamento: new Date().toISOString().split('T')[0],
      tipo_pagamento: '',
      observacoes: '',
    },
  })

  // ─── Data loading ─────────────────────────────────────────────────────────

  const carregarCliente = useCallback(async () => {
    if (!empresaAtual || !id) return
    setLoading(true)
    try {
      const [{ data: clienteData, error: clienteError }, { data: vendasData }, { data: parcelasData }] =
        await Promise.all([
          supabase
            .from('clientes_emporio')
            .select('*')
            .eq('id', id)
            .eq('empresa_id', empresaAtual.id)
            .single(),
          supabase
            .from('vendas')
            .select('*')
            .eq('cliente_id', id)
            .eq('empresa_id', empresaAtual.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('parcelas_receber')
            .select('*')
            .eq('cliente_id', id)
            .eq('empresa_id', empresaAtual.id)
            .order('data_vencimento'),
        ])

      if (clienteError || !clienteData) {
        toast.error('Cliente não encontrado')
        router.push('/emporio/clientes')
        return
      }

      const c = clienteData as ClienteEmporio
      setCliente(c)
      setObsText(c.observacoes ?? '')

      dadosForm.reset({
        nome: c.nome,
        cpf: c.cpf ? maskCPF(c.cpf) : '',
        rg: c.rg ?? '',
        data_nascimento: c.data_nascimento ?? '',
        telefone: c.telefone ? maskPhone(c.telefone) : '',
        telefone2: c.telefone2 ? maskPhone(c.telefone2) : '',
        email: c.email ?? '',
        cep: c.cep ? maskCEP(c.cep) : '',
        endereco: c.endereco ?? '',
        numero: c.numero ?? '',
        complemento: c.complemento ?? '',
        bairro: c.bairro ?? '',
        cidade: c.cidade ?? '',
        estado: c.estado ?? '',
        status: c.status,
        observacoes: c.observacoes ?? '',
      })

      setVendas((vendasData as Venda[]) ?? [])
      setParcelas((parcelasData as Parcela[]) ?? [])
    } catch {
      toast.error('Erro ao carregar dados do cliente')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregarCliente()
  }, [carregarCliente])

  // ─── CEP lookup ──────────────────────────────────────────────────────────

  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCEP(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        dadosForm.setValue('endereco', data.logradouro ?? '')
        dadosForm.setValue('bairro', data.bairro ?? '')
        dadosForm.setValue('cidade', data.localidade ?? '')
        dadosForm.setValue('estado', data.uf ?? '')
      }
    } catch {
      // silently ignore
    } finally {
      setBuscandoCEP(false)
    }
  }

  // ─── Save dados ───────────────────────────────────────────────────────────

  const onSaveDados = async (data: DadosFormData) => {
    if (!cliente) return
    setSalvandoDados(true)
    try {
      const payload = {
        nome: data.nome,
        cpf: data.cpf ? data.cpf.replace(/\D/g, '') : null,
        rg: data.rg || null,
        data_nascimento: data.data_nascimento || null,
        telefone: data.telefone.replace(/\D/g, ''),
        telefone2: data.telefone2 ? data.telefone2.replace(/\D/g, '') : null,
        email: data.email || null,
        cep: data.cep ? data.cep.replace(/\D/g, '') : null,
        endereco: data.endereco || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        estado: data.estado || null,
        status: data.status,
        observacoes: data.observacoes || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('clientes_emporio')
        .update(payload)
        .eq('id', cliente.id)
      if (error) throw error
      toast.success('Dados atualizados com sucesso!')
      carregarCliente()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSalvandoDados(false)
    }
  }

  // ─── Save obs ─────────────────────────────────────────────────────────────

  const salvarObs = async () => {
    if (!cliente) return
    setSalvandoObs(true)
    try {
      const { error } = await supabase
        .from('clientes_emporio')
        .update({ observacoes: obsText, updated_at: new Date().toISOString() })
        .eq('id', cliente.id)
      if (error) throw error
      toast.success('Observação salva com sucesso!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(msg)
    } finally {
      setSalvandoObs(false)
    }
  }

  // ─── Receber parcela ──────────────────────────────────────────────────────

  const abrirReceber = (parcela: Parcela) => {
    setParcelaSelecionada(parcela)
    receberForm.reset({
      data_pagamento: new Date().toISOString().split('T')[0],
      tipo_pagamento: '',
      observacoes: '',
    })
    setDialogReceberOpen(true)
  }

  const onConfirmarReceber = async (data: ReceberFormData) => {
    if (!parcelaSelecionada) return
    setSalvandoPagamento(true)
    try {
      const { error } = await supabase
        .from('parcelas_receber')
        .update({
          status: 'pago',
          valor_pago: parcelaSelecionada.valor,
          data_pagamento: data.data_pagamento,
          tipo_pagamento: data.tipo_pagamento,
          observacoes: data.observacoes || null,
        })
        .eq('id', parcelaSelecionada.id)
      if (error) throw error
      toast.success('Pagamento registrado com sucesso!')
      setDialogReceberOpen(false)
      setParcelaSelecionada(null)
      carregarCliente()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar pagamento'
      toast.error(msg)
    } finally {
      setSalvandoPagamento(false)
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const totalParcelasAbertas = parcelas
    .filter((p) => p.status === 'pendente' || p.status === 'atrasado')
    .reduce((acc, p) => acc + p.valor, 0)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const diasAtraso = (vencimento: string) => {
    const v = new Date(vencimento)
    v.setHours(0, 0, 0, 0)
    const diff = Math.floor((hoje.getTime() - v.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  // ─── Table columns ────────────────────────────────────────────────────────

  const vendasColumns: Column<Venda>[] = [
    {
      key: 'data',
      header: 'Data',
      render: (row) => (
        <span className="text-muted-foreground">{formatarData(row.created_at)}</span>
      ),
    },
    {
      key: 'numero',
      header: 'Nº Venda',
      render: (row) => <span className="font-medium">#{row.numero_venda}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <MoneyDisplay valor={row.total} />,
    },
    {
      key: 'pagamento',
      header: 'Pagamento',
      render: (row) => (
        <span className="text-muted-foreground">
          {PAGAMENTO_LABELS[row.tipo_pagamento] ?? row.tipo_pagamento}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'link',
      header: '',
      className: 'w-10',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/emporio/vendas/${row.id}`)
          }}
          title="Ver venda"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const parcelasColumns: Column<Parcela>[] = [
    {
      key: 'parcela',
      header: 'Parcela',
      render: (row) => (
        <span className="font-medium">
          {row.numero_parcela}/{row.total_parcelas}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: (row) => <MoneyDisplay valor={row.valor} />,
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: (row) => (
        <span className="text-muted-foreground">{formatarData(row.data_vencimento)}</span>
      ),
    },
    {
      key: 'atraso',
      header: 'Atraso',
      render: (row) => {
        if (row.status !== 'atrasado') return null
        const dias = diasAtraso(row.data_vencimento)
        if (dias <= 0) return null
        return (
          <Badge variant="destructive" className="text-xs">
            {dias}d
          </Badge>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'acao',
      header: '',
      className: 'w-24',
      render: (row) => {
        if (row.status !== 'pendente' && row.status !== 'atrasado') return null
        return (
          <Button
            size="sm"
            className="h-7 gap-1 text-xs text-white"
            style={{ backgroundColor: '#D4A528' }}
            onClick={(e) => {
              e.stopPropagation()
              abrirReceber(row)
            }}
          >
            Receber
          </Button>
        )
      },
    },
  ]

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (!empresaAtual) return <LoadingPage />
  if (loading) return <LoadingPage />

  // After loading, if not found we've already redirected
  if (!cliente) return null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell empresa="emporio" titulo="Detalhes do Cliente">
      {/* Header card */}
      <div className="mb-6 rounded-xl border bg-white p-6">
        <div className="mb-4">
          <Link
            href="/emporio/clientes"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Clientes
          </Link>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: '#D4A528' }}
            >
              {iniciais(cliente.nome)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{cliente.nome}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {cliente.cpf && <span>{formatarCPF(cliente.cpf)}</span>}
                <span>{formatarTelefone(cliente.telefone)}</span>
              </div>
              <div className="mt-2">
                <StatusBadge status={cliente.status} />
              </div>
            </div>
          </div>
          <Button
            className="gap-2 bg-green-500 text-white hover:bg-green-600 sm:self-start"
            onClick={() =>
              window.open(
                `https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`,
                '_blank',
              )
            }
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Total Gasto"
          valor={formatarMoeda(cliente.valor_total_compras)}
          icone={TrendingUp}
          corIcone="#16A34A"
          corFundo="#F0FDF4"
        />
        <StatCard
          titulo="Nº de Compras"
          valor={String(cliente.total_compras)}
          subtitulo="pedidos"
          icone={ShoppingCart}
          corIcone="#1E5AA8"
          corFundo="#EDF4FE"
        />
        <StatCard
          titulo="Última Compra"
          valor={cliente.ultima_compra ? formatarData(cliente.ultima_compra) : 'Nunca'}
          icone={Calendar}
          corIcone="#6B7280"
          corFundo="#F9FAFB"
        />
        <StatCard
          titulo="A Receber"
          valor={formatarMoeda(totalParcelasAbertas)}
          icone={CreditCard}
          corIcone="#D4A528"
          corFundo="#FEF9E7"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="compras">
        <TabsList className="mb-4">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
        </TabsList>

        {/* ── Compras ── */}
        <TabsContent value="compras">
          <div className="rounded-xl border bg-white">
            <DataTable
              columns={vendasColumns}
              data={vendas}
              keyExtractor={(row) => row.id}
              emptyMessage="Nenhuma compra registrada"
            />
          </div>
        </TabsContent>

        {/* ── Financeiro ── */}
        <TabsContent value="financeiro">
          <div className="rounded-xl border bg-white">
            <DataTable
              columns={parcelasColumns}
              data={parcelas}
              keyExtractor={(row) => row.id}
              emptyMessage="Nenhuma parcela encontrada"
            />
          </div>
        </TabsContent>

        {/* ── Dados ── */}
        <TabsContent value="dados">
          <div className="rounded-xl border bg-white p-6">
            <form onSubmit={dadosForm.handleSubmit(onSaveDados)} className="space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados Pessoais
                </p>
                <div className="space-y-2">
                  <Label htmlFor="d-nome">
                    Nome <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="d-nome"
                    {...dadosForm.register('nome')}
                    placeholder="Nome completo"
                  />
                  {dadosForm.formState.errors.nome && (
                    <p className="text-xs text-red-500">
                      {dadosForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="d-cpf">CPF</Label>
                    <Controller
                      name="cpf"
                      control={dadosForm.control}
                      render={({ field }) => (
                        <Input
                          id="d-cpf"
                          placeholder="000.000.000-00"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(maskCPF(e.target.value))}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-rg">RG</Label>
                    <Input id="d-rg" {...dadosForm.register('rg')} placeholder="RG" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-nascimento">Data de Nascimento</Label>
                  <Input
                    id="d-nascimento"
                    type="date"
                    {...dadosForm.register('data_nascimento')}
                  />
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contato
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="d-tel">
                      Telefone <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                      name="telefone"
                      control={dadosForm.control}
                      render={({ field }) => (
                        <Input
                          id="d-tel"
                          placeholder="(00) 00000-0000"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      )}
                    />
                    {dadosForm.formState.errors.telefone && (
                      <p className="text-xs text-red-500">
                        {dadosForm.formState.errors.telefone.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-tel2">Telefone 2</Label>
                    <Controller
                      name="telefone2"
                      control={dadosForm.control}
                      render={({ field }) => (
                        <Input
                          id="d-tel2"
                          placeholder="(00) 00000-0000"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-email">E-mail</Label>
                  <Input
                    id="d-email"
                    type="email"
                    {...dadosForm.register('email')}
                    placeholder="email@exemplo.com"
                  />
                  {dadosForm.formState.errors.email && (
                    <p className="text-xs text-red-500">
                      {dadosForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Endereço
                </p>
                <div className="space-y-2">
                  <Label htmlFor="d-cep">CEP</Label>
                  <div className="relative">
                    <Controller
                      name="cep"
                      control={dadosForm.control}
                      render={({ field }) => (
                        <Input
                          id="d-cep"
                          placeholder="00000-000"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(maskCEP(e.target.value))}
                          onBlur={(e) => {
                            field.onBlur()
                            buscarCEP(e.target.value)
                          }}
                        />
                      )}
                    />
                    {buscandoCEP && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-end">Endereço</Label>
                  <Input
                    id="d-end"
                    {...dadosForm.register('endereco')}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="d-num">Número</Label>
                    <Input id="d-num" {...dadosForm.register('numero')} placeholder="Nº" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="d-comp">Complemento</Label>
                    <Input
                      id="d-comp"
                      {...dadosForm.register('complemento')}
                      placeholder="Apto, Sala..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-bairro">Bairro</Label>
                  <Input
                    id="d-bairro"
                    {...dadosForm.register('bairro')}
                    placeholder="Bairro"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="d-cidade">Cidade</Label>
                    <Input
                      id="d-cidade"
                      {...dadosForm.register('cidade')}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="d-uf">UF</Label>
                    <Input
                      id="d-uf"
                      {...dadosForm.register('estado')}
                      placeholder="UF"
                      maxLength={2}
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Status */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="space-y-2">
                  <Label>Status do Cliente</Label>
                  <Controller
                    name="status"
                    control={dadosForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="bloqueado">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={salvandoDados}
                  className="gap-2 text-white"
                  style={{ backgroundColor: '#D4A528' }}
                >
                  {salvandoDados && <Loader2 className="h-4 w-4 animate-spin" />}
                  {salvandoDados ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* ── Observações ── */}
        <TabsContent value="observacoes">
          <div className="rounded-xl border bg-white p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Anotações internas sobre o cliente..."
                  rows={6}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={salvarObs}
                  disabled={salvandoObs}
                  className="gap-2 text-white"
                  style={{ backgroundColor: '#D4A528' }}
                >
                  {salvandoObs && <Loader2 className="h-4 w-4 animate-spin" />}
                  {salvandoObs ? 'Salvando...' : 'Salvar Observação'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Receber parcela */}
      <Dialog open={dialogReceberOpen} onOpenChange={setDialogReceberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              {parcelaSelecionada && (
                <>
                  Parcela {parcelaSelecionada.numero_parcela}/
                  {parcelaSelecionada.total_parcelas} —{' '}
                  <strong>{formatarMoeda(parcelaSelecionada.valor)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={receberForm.handleSubmit(onConfirmarReceber)}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="r-data">Data do Pagamento</Label>
              <Input
                id="r-data"
                type="date"
                {...receberForm.register('data_pagamento')}
              />
              {receberForm.formState.errors.data_pagamento && (
                <p className="text-xs text-red-500">
                  {receberForm.formState.errors.data_pagamento.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Controller
                name="tipo_pagamento"
                control={receberForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {receberForm.formState.errors.tipo_pagamento && (
                <p className="text-xs text-red-500">
                  {receberForm.formState.errors.tipo_pagamento.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="r-obs">Observações</Label>
              <Textarea
                id="r-obs"
                {...receberForm.register('observacoes')}
                placeholder="Opcional..."
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoPagamento}
                onClick={() => setDialogReceberOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoPagamento}
                className="gap-2 text-white"
                style={{ backgroundColor: '#D4A528' }}
              >
                {salvandoPagamento && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {salvandoPagamento ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
