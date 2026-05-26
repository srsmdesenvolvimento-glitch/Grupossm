'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, MessageCircle, Eye, PlusCircle, AlertTriangle, TrendingUp } from 'lucide-react'
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
import { formatarCPF, formatarTelefone, iniciais, formatarMoeda } from '@/lib/utils/formatters'
import type { ClienteFactoring } from '@/lib/types/database'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'
import { Download } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

type ClienteComSaldo = ClienteFactoring & {
  emAberto: number
  emAtraso: number
}

function getRisco(score: number) {
  if (score >= 70) return { label: 'Baixo', color: '#22c55e', bg: '#f0fdf4' }
  if (score >= 50) return { label: 'Médio', color: '#eab308', bg: '#fefce8' }
  if (score >= 30) return { label: 'Alto', color: '#f97316', bg: '#fff7ed' }
  return { label: 'Crítico', color: '#ef4444', bg: '#fef2f2' }
}

function ScoreBar({ score }: { score: number }) {
  const risco = getRisco(score)
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div className="h-1.5 rounded-full" style={{ width: `${score}%`, backgroundColor: risco.color }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color: risco.color }}>{score}</span>
      </div>
      <span
        className="sm:hidden text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
        style={{ color: risco.color, backgroundColor: risco.bg }}
      >
        {score}
      </span>
    </div>
  )
}

export default function FactoringClientesPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [clientes, setClientes] = useState<ClienteComSaldo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroRisco, setFiltroRisco] = useState('todos')
  const [filtroCard, setFiltroCard] = useState<'todos' | 'novos' | 'bloqueados'>('todos')

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: clientesData }, { data: parcelasData }] = await Promise.all([
        supabase
          .from('clientes_factoring')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .order('nome'),
        supabase
          .from('parcelas_emprestimo')
          .select('cliente_id, valor, valor_pago, juros_mora, multa, status')
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado']),
      ])

      const parcelasPorCliente: Record<string, { aberto: number; atraso: number }> = {}
      for (const p of parcelasData ?? []) {
        const devido = (p.valor ?? 0) + (p.juros_mora ?? 0) + (p.multa ?? 0) - (p.valor_pago ?? 0)
        if (!parcelasPorCliente[p.cliente_id]) parcelasPorCliente[p.cliente_id] = { aberto: 0, atraso: 0 }
        parcelasPorCliente[p.cliente_id].aberto += devido
        if (p.status === 'atrasado') parcelasPorCliente[p.cliente_id].atraso += devido
      }

      setClientes(
        (clientesData ?? []).map(c => ({
          ...c,
          emAberto: parcelasPorCliente[c.id]?.aberto ?? 0,
          emAtraso: parcelasPorCliente[c.id]?.atraso ?? 0,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

  const total = clientes.length
  const novosMes = clientes.filter(c => c.created_at >= inicioMes).length
  const scoreMedia = total ? Math.round(clientes.reduce((s, c) => s + c.score_interno, 0) / total) : 0
  const bloqueados = clientes.filter(c => c.status === 'bloqueado').length

  const filtrados = clientes.filter(c => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!c.nome.toLowerCase().includes(q) && !(c.cpf ?? '').includes(q) && !c.telefone.includes(q)) return false
    }
    if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
    if (filtroRisco !== 'todos') {
      const risco = getRisco(c.score_interno).label.toLowerCase()
      if (risco !== filtroRisco) return false
    }
    if (filtroCard === 'novos' && c.created_at < inicioMes) return false
    if (filtroCard === 'bloqueados' && c.status !== 'bloqueado') return false
    return true
  })

  const columns: Column<ClienteComSaldo>[] = [
    {
      key: 'nome',
      header: 'Cliente',
      render: c => (
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: '#1E5AA8' }}
          >
            {iniciais(c.nome)}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{c.nome}</p>
            {c.cidade && <p className="text-xs text-muted-foreground/60">{c.cidade}/{c.estado}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'cpf',
      header: 'CPF/CNPJ',
      render: c => <span className="text-sm text-muted-foreground tabular-nums">{c.cpf ? formatarCPF(c.cpf) : '—'}</span>,
    },
    {
      key: 'telefone',
      header: 'Telefone',
      render: c => <span className="text-sm text-muted-foreground">{formatarTelefone(c.telefone)}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      render: c => <ScoreBar score={c.score_interno} />,
    },
    {
      key: 'risco',
      header: 'Risco',
      render: c => {
        const r = getRisco(c.score_interno)
        return (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: r.color, backgroundColor: r.bg }}
          >
            {r.label}
          </span>
        )
      },
    },
    {
      key: 'emAberto',
      header: 'Em Aberto',
      render: c => c.emAberto > 0 ? <MoneyDisplay valor={c.emAberto} /> : <span className="text-muted-foreground/30 text-sm">—</span>,
    },
    {
      key: 'emAtraso',
      header: 'Em Atraso',
      render: c => c.emAtraso > 0
        ? <span className="text-red-600 font-semibold text-sm">{formatarMoeda(c.emAtraso)}</span>
        : <span className="text-muted-foreground/30 text-sm">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status} />,
    },
    {
      key: 'acoes',
      header: '',
      render: c => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
              onClick={() => router.push(`/factoring/clientes/${c.id}`)}
            >
              <Eye size={14} />
            </TooltipTrigger>
            <TooltipContent><p>Ver ficha</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-green-600"
              onClick={() => window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageCircle size={14} />
            </TooltipTrigger>
            <TooltipContent><p>Enviar WhatsApp</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors text-blue-600"
              onClick={() => router.push(`/factoring/emprestimos/novo?cliente=${c.id}`)}
            >
              <PlusCircle size={14} />
            </TooltipTrigger>
            <TooltipContent><p>Novo empréstimo</p></TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Clientes">
      <div className="space-y-6">

        <PageHeader
          titulo="Clientes"
          descricao="Gerencie os clientes da carteira de factoring"
          icone={Users}
          acoes={
            <Button
              size="sm"
              className="h-8 gap-1.5 text-white"
              style={{ backgroundColor: '#1E5AA8' }}
              onClick={() => router.push('/factoring/clientes/novo')}
            >
              <UserPlus size={14} />
              Novo Cliente
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Total Clientes" valor={total} icone={Users} corIcone="#1E5AA8" corFundo="#EDF4FE"
            ativo={filtroCard === 'todos'}
            onClick={() => setFiltroCard('todos')}
            atalho={filtroCard === 'todos' ? 'Mostrando todos' : 'Ver todos'}
          />
          <StatCard
            titulo="Novos este mês" valor={novosMes} icone={UserPlus} corIcone="#D4A528" corFundo="#FEFCE8"
            ativo={filtroCard === 'novos'}
            onClick={() => setFiltroCard(filtroCard === 'novos' ? 'todos' : 'novos')}
            atalho={filtroCard === 'novos' ? 'Filtrando ↑' : 'Clique para filtrar →'}
          />
          <StatCard titulo="Score Médio" valor={scoreMedia} icone={TrendingUp} corIcone={getRisco(scoreMedia).color} />
          <StatCard
            titulo="Bloqueados" valor={bloqueados} icone={AlertTriangle} corIcone="#ef4444" corFundo="#FEF2F2"
            ativo={filtroCard === 'bloqueados'}
            onClick={() => setFiltroCard(filtroCard === 'bloqueados' ? 'todos' : 'bloqueados')}
            atalho={filtroCard === 'bloqueados' ? 'Filtrando ↑' : 'Clique para filtrar →'}
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-border/60 flex flex-wrap items-center gap-3">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por nome, CPF ou telefone..."
              className="flex-1 min-w-48"
            />
            <Select value={filtroRisco} onValueChange={v => setFiltroRisco(v ?? 'todos')}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os riscos</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="médio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="crítico">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v ?? 'todos')}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            {temPermissao('financeiro') && filtrados.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => exportarCSV('clientes-factoring', filtrados.map(c => ({
                  nome: c.nome,
                  cpf: c.cpf ?? '',
                  telefone: c.telefone,
                  email: c.email ?? '',
                  score_interno: c.score_interno,
                  status: c.status,
                })), [
                  { key: 'nome', label: 'Nome' },
                  { key: 'cpf', label: 'CPF' },
                  { key: 'telefone', label: 'Telefone' },
                  { key: 'email', label: 'E-mail' },
                  { key: 'score_interno', label: 'Score' },
                  { key: 'status', label: 'Status' },
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
            keyExtractor={c => c.id}
            emptyMessage="Nenhum cliente encontrado"
            onRowClick={c => router.push(`/factoring/clientes/${c.id}`)}
            perPage={20}
          />
        </div>
      </div>
    </AppShell>
  )
}
