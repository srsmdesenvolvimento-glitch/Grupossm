'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Plus, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatarMoeda, formatarData, formatarCPF, iniciais } from '@/lib/utils/formatters'
import type { Emprestimo, ClienteFactoring } from '@/lib/types/database'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'
import { Download } from 'lucide-react'

type EmprestimoComCliente = Emprestimo & {
  cliente?: Pick<ClienteFactoring, 'id' | 'nome' | 'cpf'>
  parcelas_pagas?: number
}

export default function EmprestimosPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [emprestimos, setEmprestimos] = useState<EmprestimoComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCard, setFiltroCard] = useState<'todos' | 'ativos' | 'liberadoMes' | 'quitadosMes'>('todos')

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: emps }, { data: clientes }, { data: parcelas }] = await Promise.all([
        supabase
          .from('emprestimos')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('parcelas_emprestimo')
          .select('emprestimo_id, status')
          .eq('empresa_id', empresaAtual.id),
      ])

      const clienteMap: Record<string, Pick<ClienteFactoring, 'id' | 'nome' | 'cpf'>> = {}
      for (const c of clientes ?? []) clienteMap[c.id] = c

      const pagasPorEmp: Record<string, number> = {}
      for (const p of parcelas ?? []) {
        if (p.status === 'pago') pagasPorEmp[p.emprestimo_id] = (pagasPorEmp[p.emprestimo_id] ?? 0) + 1
      }

      setEmprestimos(
        (emps ?? []).map(e => ({
          ...e,
          cliente: clienteMap[e.cliente_id],
          parcelas_pagas: pagasPorEmp[e.id] ?? 0,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

  const ativos = emprestimos.filter(e => e.status === 'ativo')
  const capitalNaRua = ativos.reduce((s, e) => s + e.saldo_devedor, 0)
  const liberadoMes = emprestimos
    .filter(e => (e.data_liberacao ?? '') >= inicioMes)
    .reduce((s, e) => s + e.valor_principal, 0)
  const quitadosMes = emprestimos.filter(e => e.status === 'quitado' && (e.data_quitacao ?? '') >= inicioMes).length

  const filtrados = emprestimos.filter(e => {
    if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false
    if (filtroCard === 'ativos' && e.status !== 'ativo') return false
    if (filtroCard === 'liberadoMes' && (e.data_liberacao ?? '') < inicioMes) return false
    if (filtroCard === 'quitadosMes' && !(e.status === 'quitado' && (e.data_quitacao ?? '') >= inicioMes)) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (
        !e.numero_contrato.toLowerCase().includes(q) &&
        !(e.cliente?.nome ?? '').toLowerCase().includes(q) &&
        !(e.cliente?.cpf ?? '').includes(q)
      ) return false
    }
    return true
  })

  const STATUS_COLORS: Record<string, string> = {
    analise: '#64748b', aprovado: '#D4A528', ativo: '#22c55e',
    quitado: '#1E5AA8', inadimplente: '#ef4444', cancelado: '#94a3b8',
  }

  const columns: Column<EmprestimoComCliente>[] = [
    {
      key: 'contrato',
      header: 'Contrato',
      render: e => (
        <span className="font-mono text-sm font-semibold" style={{ color: '#1E5AA8' }}>
          {e.numero_contrato}
        </span>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: e => (
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: '#1E5AA8' }}
          >
            {iniciais(e.cliente?.nome ?? '?')}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{e.cliente?.nome ?? '—'}</p>
            <p className="text-xs text-muted-foreground/60">{e.cliente?.cpf ? formatarCPF(e.cliente.cpf) : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: e => <span className="font-semibold text-sm">{formatarMoeda(e.valor_principal)}</span>,
    },
    {
      key: 'parcelas',
      header: 'Parcelas',
      render: e => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {e.parcelas_pagas}/{e.prazo_meses}
        </span>
      ),
    },
    {
      key: 'taxa',
      header: 'Taxa',
      render: e => <span className="text-sm text-muted-foreground">{e.taxa_juros}% a.m.</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: e => (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ color: STATUS_COLORS[e.status] ?? '#64748b', backgroundColor: `${STATUS_COLORS[e.status]}18` }}
        >
          {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
        </span>
      ),
    },
    {
      key: 'data',
      header: 'Liberação',
      render: e => <span className="text-sm text-muted-foreground">{e.data_liberacao ? formatarData(e.data_liberacao) : '—'}</span>,
    },
    {
      key: 'saldo',
      header: 'Saldo',
      render: e => <MoneyDisplay valor={e.saldo_devedor} />,
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Empréstimos">
      <div className="space-y-6">

        <PageHeader
          titulo="Empréstimos"
          descricao="Gerencie a carteira de contratos de factoring"
          icone={Banknote}
          acoes={
            <Button
              size="sm"
              className="h-8 gap-1.5 text-white"
              style={{ backgroundColor: '#1E5AA8' }}
              onClick={() => router.push('/factoring/emprestimos/novo')}
            >
              <Plus size={14} />
              Novo Empréstimo
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Contratos ativos" valor={ativos.length} icone={Banknote} corIcone="#1E5AA8" corFundo="#EDF4FE"
            ativo={filtroCard === 'ativos'}
            onClick={() => setFiltroCard(filtroCard === 'ativos' ? 'todos' : 'ativos')}
            atalho={filtroCard === 'ativos' ? 'Filtrando ↑' : 'Clique para filtrar →'}
          />
          <StatCard titulo="Capital na rua" valor={formatarMoeda(capitalNaRua)} icone={TrendingUp} corIcone="#D4A528" corFundo="#FEFCE8" />
          <StatCard
            titulo="Liberado este mês" valor={formatarMoeda(liberadoMes)} icone={Clock} corIcone="#22c55e" corFundo="#F0FDF4"
            ativo={filtroCard === 'liberadoMes'}
            onClick={() => setFiltroCard(filtroCard === 'liberadoMes' ? 'todos' : 'liberadoMes')}
            atalho={filtroCard === 'liberadoMes' ? 'Filtrando ↑' : 'Clique para filtrar →'}
          />
          <StatCard
            titulo="Quitados este mês" valor={quitadosMes} icone={CheckCircle2} corIcone="#7C3AED" corFundo="#F5F3FF"
            ativo={filtroCard === 'quitadosMes'}
            onClick={() => setFiltroCard(filtroCard === 'quitadosMes' ? 'todos' : 'quitadosMes')}
            atalho={filtroCard === 'quitadosMes' ? 'Filtrando ↑' : 'Clique para filtrar →'}
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-border/60 flex flex-wrap items-center gap-3">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por contrato ou cliente..."
              className="flex-1 min-w-48"
            />
            <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v ?? 'todos')}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="analise">Em análise</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="quitado">Quitado</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            {temPermissao('financeiro') && filtrados.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => exportarCSV('emprestimos', filtrados.map(e => ({
                  numero_contrato: e.numero_contrato,
                  cliente: e.cliente?.nome ?? '',
                  valor_principal: e.valor_principal,
                  taxa_juros: `${e.taxa_juros}%`,
                  prazo_meses: e.prazo_meses,
                  status: e.status,
                  saldo_devedor: e.saldo_devedor,
                })), [
                  { key: 'numero_contrato', label: 'Contrato' },
                  { key: 'cliente', label: 'Cliente' },
                  { key: 'valor_principal', label: 'Valor Principal' },
                  { key: 'taxa_juros', label: 'Taxa Juros' },
                  { key: 'prazo_meses', label: 'Prazo (meses)' },
                  { key: 'status', label: 'Status' },
                  { key: 'saldo_devedor', label: 'Saldo Devedor' },
                ])}
              >
                <Download size={14} />
                CSV
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={filtrados}
            keyExtractor={e => e.id}
            emptyMessage="Nenhum empréstimo encontrado"
            onRowClick={e => router.push(`/factoring/emprestimos/${e.id}`)}
            perPage={20}
          />
        </div>
      </div>
    </AppShell>
  )
}
