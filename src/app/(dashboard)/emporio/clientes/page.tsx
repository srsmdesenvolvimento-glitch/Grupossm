'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Users,
  ShoppingCart,
  AlertTriangle,
  Eye,
  MessageCircle,
  Edit2,
  Loader2,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'
import { Download } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { buscarRelatorioAssertiva } from '@/lib/assertiva/client'
import type { RelatorioCompleto } from '@/lib/assertiva/types'
import { RelatorioView } from '@/components/factoring/analise-credito/RelatorioView'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4')
    .replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3')
    .replace(/(\d{2})(\d{3})/, '$1.$2')
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const clienteSchema = z.object({
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

type ClienteFormData = z.infer<typeof clienteSchema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [clientes, setClientes] = useState<ClienteEmporio[]>([])
  const [totalReceber, setTotalReceber] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEmporio | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [buscandoAssertiva, setBuscandoAssertiva] = useState(false)
  const [dadosAssertiva, setDadosAssertiva] = useState<RelatorioCompleto | null>(null)

  const consultarAssertiva = async (docRaw: string) => {
    const doc = (docRaw ?? '').replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error('Informe um CPF ou CNPJ válido de 11 ou 14 dígitos')
      return
    }
    setBuscandoAssertiva(true)
    try {
      const tipo = doc.length === 11 ? 'pf' : 'pj'
      const { data, erro } = await buscarRelatorioAssertiva(doc, tipo)
      if (erro || !data) {
        toast.error(erro ?? 'Nenhum dado retornado da Assertiva')
        return
      }
      setDadosAssertiva(data)
      
      // Preenche dados cadastrais no form
      if (data.nome) setValue('nome', data.nome)
      
      if (data.data_nascimento) {
        let dt = data.data_nascimento
        if (dt.includes('T')) dt = dt.split('T')[0]
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dt)) {
          const [d, m, y] = dt.split('/')
          dt = `${y}-${m}-${d}`
        }
        setValue('data_nascimento', dt)
      } else if (data.data_abertura) {
        let dt = data.data_abertura
        if (dt.includes('T')) dt = dt.split('T')[0]
        setValue('data_nascimento', dt)
      }

      if (data.telefones?.length) {
        const t = data.telefones.find((x: any) => x.tipo?.toLowerCase() === 'celular' || x.whatsapp) ?? data.telefones[0]
        const num = (t.ddd ?? '') + (t.numero ?? '')
        const cleanNum = num.replace(/\D/g, '')
        if (cleanNum.length >= 10) setValue('telefone', maskPhone(cleanNum))
      }

      if (data.emails?.length) {
        const sorted = [...data.emails].sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
        if (sorted[0]?.email) setValue('email', sorted[0].email)
      }

      if (data.enderecos?.length) {
        const end = data.enderecos[0]
        if (end.cep) setValue('cep', maskCEP(end.cep))
        if (end.logradouro) setValue('endereco', end.logradouro)
        if (end.numero) setValue('numero', end.numero)
        if (end.complemento) setValue('complemento', end.complemento)
        if (end.bairro) setValue('bairro', end.bairro)
        if (end.municipio) setValue('cidade', end.municipio)
        if (end.uf) setValue('estado', end.uf)
      }

      toast.success('Dados importados com sucesso da Assertiva!')
    } catch (err) {
      toast.error('Erro ao consultar a API Assertiva')
    } finally {
      setBuscandoAssertiva(false)
    }
  }

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { status: 'ativo' },
  })

  // ─── Data loading ─────────────────────────────────────────────────────────

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: clientesData }, { data: parcelasData }] = await Promise.all([
        supabase
          .from('clientes_emporio')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .order('nome'),
        supabase
          .from('parcelas_receber')
          .select('valor')
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado']),
      ])

      setClientes((clientesData as ClienteEmporio[]) ?? [])

      const soma = ((parcelasData ?? []) as { valor: number }[]).reduce(
        (acc, p) => acc + (p.valor ?? 0),
        0,
      )
      setTotalReceber(soma)
    } catch {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // ─── CEP lookup ──────────────────────────────────────────────────────────

  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCEP(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setValue('endereco', data.logradouro ?? '')
        setValue('bairro', data.bairro ?? '')
        setValue('cidade', data.localidade ?? '')
        setValue('estado', data.uf ?? '')
      }
    } catch {
      // silently ignore
    } finally {
      setBuscandoCEP(false)
    }
  }

  // ─── Sheet helpers ────────────────────────────────────────────────────────

  const abrirNovoCliente = () => {
    setClienteSelecionado(null)
    setDadosAssertiva(null)
    reset({ status: 'ativo' })
    setSheetOpen(true)
  }

  const abrirEditarCliente = (cliente: ClienteEmporio) => {
    setClienteSelecionado(cliente)
    setDadosAssertiva((cliente as any).dados_assertiva ?? null)
    reset({
      nome: cliente.nome,
      cpf: cliente.cpf ? maskCPF(cliente.cpf) : '',
      rg: cliente.rg ?? '',
      data_nascimento: cliente.data_nascimento ?? '',
      telefone: cliente.telefone ? maskPhone(cliente.telefone) : '',
      telefone2: cliente.telefone2 ? maskPhone(cliente.telefone2) : '',
      email: cliente.email ?? '',
      cep: cliente.cep ? maskCEP(cliente.cep) : '',
      endereco: cliente.endereco ?? '',
      numero: cliente.numero ?? '',
      complemento: cliente.complemento ?? '',
      bairro: cliente.bairro ?? '',
      cidade: cliente.cidade ?? '',
      estado: cliente.estado ?? '',
      status: cliente.status,
      observacoes: cliente.observacoes ?? '',
    })
    setSheetOpen(true)
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: ClienteFormData) => {
    if (!empresaAtual) return
    setSalvando(true)
    try {
      const payload: Record<string, any> = {
        empresa_id: empresaAtual.id,
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

      if (dadosAssertiva && dadosAssertiva.documento === payload.cpf) {
        payload.dados_assertiva = dadosAssertiva
        payload.score_assertiva = dadosAssertiva.score ?? null
        payload.faixa_risco_assertiva = dadosAssertiva.faixa_risco ?? null
        payload.renda_estimada_assertiva = dadosAssertiva.renda_estimada ?? null
        payload.assertiva_consultado_em = new Date().toISOString()
        payload.total_negativacoes_assertiva = dadosAssertiva.total_negativacoes ?? 0
        payload.valor_total_negativacoes_assertiva = dadosAssertiva.valor_total_negativacoes ?? 0.00
        payload.total_protestos_assertiva = dadosAssertiva.total_protestos ?? 0
        payload.valor_total_protestos_assertiva = dadosAssertiva.valor_total_protestos ?? 0.00
        payload.total_acoes_judiciais_assertiva = dadosAssertiva.total_acoes_judiciais ?? 0
        payload.valor_total_acoes_assertiva = dadosAssertiva.valor_total_acoes ?? 0.00
        payload.total_ccf_assertiva = dadosAssertiva.total_ccf ?? 0
        payload.total_dividas_assertiva = dadosAssertiva.total_dividas ?? 0
        payload.valor_total_dividas_assertiva = dadosAssertiva.valor_total_dividas ?? 0.00
        payload.pep_assertiva = dadosAssertiva.pep ?? false
        payload.indicador_obito_assertiva = dadosAssertiva.indicador_obito ?? false
        payload.situacao_documento_assertiva = dadosAssertiva.tipo === 'pf' ? (dadosAssertiva.situacao_cpf ?? null) : (dadosAssertiva.situacao_cnpj ?? null)
        payload.faturamento_presumido_assertiva = dadosAssertiva.faturamento_presumido ? (typeof dadosAssertiva.faturamento_presumido === 'number' ? dadosAssertiva.faturamento_presumido : parseFloat(dadosAssertiva.faturamento_presumido as string)) : null
      }

      if (clienteSelecionado) {
        const { error } = await supabase
          .from('clientes_emporio')
          .update(payload)
          .eq('id', clienteSelecionado.id)
        if (error) throw error
        toast.success('Cliente atualizado com sucesso!')
      } else {
        const { error } = await supabase.from('clientes_emporio').insert(payload)
        if (error) throw error
        toast.success('Cliente cadastrado com sucesso!')
      }

      setSheetOpen(false)
      carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar cliente'
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const now = new Date()
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)

  const filtrados = clientes.filter(
    (c) =>
      busca === '' ||
      [c.nome, c.cpf ?? '', c.telefone].some((v) =>
        v.toLowerCase().includes(busca.toLowerCase()),
      ),
  )

  const totalClientes = clientes.length
  const novosMes = clientes.filter((c) => new Date(c.created_at) >= inicioMes).length
  const comCompras = clientes.filter((c) => c.total_compras > 0).length

  // ─── Table columns ────────────────────────────────────────────────────────

  const columns: Column<ClienteEmporio>[] = [
    {
      key: 'avatar',
      header: '',
      className: 'w-10',
      render: (row) => (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: '#D4A528' }}
        >
          {iniciais(row.nome)}
        </div>
      ),
    },
    {
      key: 'nome',
      header: 'Nome',
      render: (row) => <span className="font-medium">{row.nome}</span>,
    },
    {
      key: 'cpf',
      header: 'CPF',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.cpf ? formatarCPF(row.cpf) : '—'}
        </span>
      ),
    },
    {
      key: 'telefone',
      header: 'Telefone',
      render: (row) => (
        <span className="text-muted-foreground">{formatarTelefone(row.telefone)}</span>
      ),
    },
    {
      key: 'compras',
      header: 'Compras',
      render: (row) => (
        <span className="text-muted-foreground">{row.total_compras}x</span>
      ),
    },
    {
      key: 'total_gasto',
      header: 'Total Gasto',
      render: (row) => <MoneyDisplay valor={row.valor_total_compras} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      className: 'w-28',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/emporio/clientes/${row.id}`)
            }}
            title="Ver detalhes"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`https://wa.me/55${row.telefone.replace(/\D/g, '')}`, '_blank')
            }}
            title="WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              abrirEditarCliente(row)
            }}
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!empresaAtual) return <LoadingPage />

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell empresa="emporio" titulo="Clientes">

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Total de Clientes"
          valor={String(totalClientes)}
          icone={Users}
          corIcone="#1E5AA8"
          corFundo="#EDF4FE"
        />
        <StatCard
          titulo="Novos este Mês"
          valor={String(novosMes)}
          icone={Plus}
          corIcone="#16A34A"
          corFundo="#F0FDF4"
        />
        <StatCard
          titulo="Com Compras"
          valor={String(comCompras)}
          icone={ShoppingCart}
          corIcone="#7C3AED"
          corFundo="#F5F3FF"
        />
        <StatCard
          titulo="A Receber"
          valor={totalReceber.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icone={AlertTriangle}
          corIcone="#D4A528"
          corFundo="#FEF9E7"
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full sm:max-w-sm"
        />
        <div className="flex items-center gap-2 shrink-0">
          {temPermissao('financeiro') && filtrados.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportarCSV('clientes-emporio', filtrados.map((c: ClienteEmporio) => ({
                nome: c.nome,
                telefone: c.telefone,
                email: c.email ?? '',
                cidade: c.cidade ?? '',
                data_cadastro: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
              })), [
                { key: 'nome', label: 'Nome' },
                { key: 'telefone', label: 'Telefone' },
                { key: 'email', label: 'E-mail' },
                { key: 'cidade', label: 'Cidade' },
                { key: 'data_cadastro', label: 'Data Cadastro' },
              ])}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          )}
          <Button
            onClick={abrirNovoCliente}
            className="gap-2 text-white"
            style={{ backgroundColor: '#D4A528' }}
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtrados}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage="Nenhum cliente encontrado"
        onRowClick={(row) => router.push(`/emporio/clientes/${row.id}`)}
      />

      {/* Sheet new/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {clienteSelecionado ? 'Editar Cliente' : 'Novo Cliente'}
            </SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-6 py-4"
          >
            {/* Dados Pessoais */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados Pessoais
              </p>
              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input id="nome" {...register('nome')} placeholder="Nome completo" />
                {errors.nome && (
                  <p className="text-xs text-red-500">{errors.nome.message}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF/CNPJ</Label>
                  <div className="flex gap-2">
                    <Controller
                      name="cpf"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="cpf"
                          placeholder="000.000.000-00 ou 00.000.000/0000-00"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            if (val.length <= 11) {
                              field.onChange(maskCPF(e.target.value))
                            } else {
                              field.onChange(maskCNPJ(e.target.value))
                            }
                          }}
                          className="flex-1"
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const values = control._formValues
                        consultarAssertiva(values.cpf)
                      }}
                      disabled={buscandoAssertiva}
                      className="shrink-0 h-10 px-3"
                    >
                      {buscandoAssertiva ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : 'Consultar API'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <Input id="rg" {...register('rg')} placeholder="RG" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    {...register('data_nascimento')}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Contato */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contato
              </p>
              <div className="space-y-2">
                <Label htmlFor="telefone">
                  Telefone <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="telefone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="telefone"
                      placeholder="(00) 00000-0000"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(maskPhone(e.target.value))}
                    />
                  )}
                />
                {errors.telefone && (
                  <p className="text-xs text-red-500">{errors.telefone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone2">Telefone 2</Label>
                <Controller
                  name="telefone2"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="telefone2"
                      placeholder="(00) 00000-0000"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(maskPhone(e.target.value))}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="email@exemplo.com"
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
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
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Controller
                    name="cep"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="cep"
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
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  {...register('endereco')}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...register('numero')} placeholder="Nº" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    {...register('complemento')}
                    placeholder="Apto, Sala..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" {...register('bairro')} placeholder="Bairro" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...register('cidade')} placeholder="Cidade" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">UF</Label>
                  <Input
                    id="estado"
                    {...register('estado')}
                    placeholder="UF"
                    maxLength={2}
                    className="uppercase"
                  />
                </div>
              </div>
            </div>

            {dadosAssertiva && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Relatório de Crédito Assertiva
                  </p>
                  <div className="rounded-xl border border-border p-4 bg-muted/10 max-h-[350px] overflow-y-auto">
                    <RelatorioView relatorio={dadosAssertiva} />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Outros */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outros
              </p>
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  {...register('observacoes')}
                  placeholder="Anotações internas..."
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <SheetFooter className="mt-auto gap-2 pt-4">
              <Button type="button" variant="outline" disabled={salvando} onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="gap-2 text-white"
                style={{ backgroundColor: '#D4A528' }}
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
