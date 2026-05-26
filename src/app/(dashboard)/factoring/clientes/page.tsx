'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, UserPlus, MessageCircle, Eye, PlusCircle, AlertTriangle, TrendingUp, Download, ArrowUpRight } from 'lucide-react'
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

type ClienteComSaldo = ClienteFactoring & {
  emAberto: number
  emAtraso: number
}

function getRisco(score: number) {
  if (score >= 70) return { label: 'Baixo', color: '#34A853', bg: '#E6F4EA' }
  if (score >= 50) return { label: 'Médio', color: '#FBBC04', bg: '#FEF7E0' }
  if (score >= 30) return { label: 'Alto', color: '#FA903E', bg: '#FEF0E1' }
  return { label: 'Crítico', color: '#EA4335', bg: '#FCE8E6' }
}

function ScoreBar({ score }: { score: number }) {
  const risco = getRisco(score)
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 min-w-[110px]">
        <div className="flex-1 bg-muted rounded-full h-1.5 shadow-inner">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: risco.color }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums" style={{ color: risco.color }}>{score}</span>
      </div>
      <span
        className="sm:hidden text-[10px] font-bold tabular-nums px-2.5 py-0.5 rounded-full"
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
          .select('cliente_id, valor, valor_pago, status')
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado']),
      ])

      const parcelasPorCliente: Record<string, { aberto: number; atraso: number }> = {}
      for (const p of parcelasData ?? []) {
        const devido = (p.valor ?? 0) - (p.valor_pago ?? 0)
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
      header: 'Cliente / Tomador',
      render: c => {
        const bgCores = ['#E8F0FE', '#E6F4EA', '#FCE8E6', '#FEF7E0', '#F3E8FD', '#FEF0E1']
        const textCores = ['#1A73E8', '#34A853', '#EA4335', '#FBBC04', '#A142F4', '#FA903E']
        const charSum = c.nome.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
        const idx = charSum % bgCores.length

        return (
          <div className="flex items-center gap-3 group/client">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm transition-transform duration-200 group-hover/client:scale-105"
              style={{ backgroundColor: bgCores[idx], color: textCores[idx] }}
            >
              {iniciais(c.nome)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate max-w-[140px] sm:max-w-[200px]">{c.nome}</p>
              {c.cidade && <p className="text-[10px] text-muted-foreground font-medium">{c.cidade}/{c.estado}</p>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'cpf',
      header: 'CPF/CNPJ',
      render: c => <span className="text-xs text-muted-foreground font-mono font-medium">{c.cpf ? formatarCPF(c.cpf) : '—'}</span>,
    },
    {
      key: 'telefone',
      header: 'Telefone',
      render: c => <span className="text-xs text-muted-foreground font-medium">{formatarTelefone(c.telefone)}</span>,
    },
    {
      key: 'score',
      header: 'Score Operacional',
      render: c => <ScoreBar score={c.score_interno} />,
    },
    {
      key: 'risco',
      header: 'Mesa de Risco',
      render: c => {
        const r = getRisco(c.score_interno)
        return (
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
            style={{ color: r.color, backgroundColor: r.bg, border: `1px solid ${r.color}15` }}
          >
            {r.label}
          </span>
        )
      },
    },
    {
      key: 'emAberto',
      header: 'Total em Aberto',
      render: c => c.emAberto > 0 ? <div className="font-bold text-sm text-foreground"><MoneyDisplay valor={c.emAberto} /></div> : <span className="text-muted-foreground/30 text-xs font-medium">—</span>,
    },
    {
      key: 'emAtraso',
      header: 'Passivo Atrasado',
      render: c => c.emAtraso > 0
        ? <span className="font-extrabold text-sm" style={{ color: '#EA4335' }}>{formatarMoeda(c.emAtraso)}</span>
        : <span className="text-muted-foreground/30 text-xs font-medium">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: c => <StatusBadge status={c.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações Rápidas',
      className: 'w-[120px] text-right',
      render: c => (
        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger
              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border/40 hover:border-border hover:bg-accent/80 transition-all duration-150 text-muted-foreground hover:text-foreground shadow-sm hover:scale-105 active:scale-95 shrink-0"
              onClick={() => router.push(`/factoring/clientes/${c.id}`)}
            >
              <Eye size={14} />
            </TooltipTrigger>
            <TooltipContent><p className="text-xs font-bold">Ver Ficha</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border/40 hover:border-[#34A853]/35 hover:bg-[#E6F4EA] transition-all duration-150 shadow-sm hover:scale-105 active:scale-95 shrink-0"
              style={{ color: '#34A853' }}
              onClick={() => window.open(`https://wa.me/55${c.telefone.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageCircle size={14} />
            </TooltipTrigger>
            <TooltipContent><p className="text-xs font-bold text-[#34A853]">Enviar WhatsApp</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border/40 hover:border-[#1A73E8]/35 hover:bg-[#E8F0FE] transition-all duration-150 shadow-sm hover:scale-105 active:scale-95 shrink-0"
              style={{ color: '#1A73E8' }}
              onClick={() => router.push(`/factoring/emprestimos/novo?cliente_id=${c.id}`)}
            >
              <PlusCircle size={14} />
            </TooltipTrigger>
            <TooltipContent><p className="text-xs font-bold text-[#1A73E8]">Novo Empréstimo</p></TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Clientes">
      <div className="space-y-7 animate-fade-in-up">

        <PageHeader
          titulo="Carteira de Clientes"
          descricao="Gerenciamento cadastral, histórico e análise de risco integrado de tomadores"
          icone={Users}
          acoes={
            <Button
              size="sm"
              className="h-9.5 gap-2 text-white rounded-full px-5 font-bold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#1A73E8', boxShadow: '0 4px 12px -3px #1A73E850' }}
              onClick={() => router.push('/factoring/clientes/novo')}
            >
              <UserPlus size={15} />
              <span>Novo Cliente</span>
            </Button>
          }
        />

        {/* Dynamic Metric StatCards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Clientes Cadastrados" valor={total} icone={Users} corIcone="#1A73E8" corFundo="#E8F0FE"
            ativo={filtroCard === 'todos'}
            onClick={() => setFiltroCard('todos')}
            atalho={filtroCard === 'todos' ? 'Mostrando toda a base' : 'Exibir todos os clientes'}
            delay={0}
          />
          <StatCard
            titulo="Novos este Mês" valor={novosMes} icone={UserPlus} corIcone="#FBBC04" corFundo="#FEF7E0"
            ativo={filtroCard === 'novos'}
            onClick={() => setFiltroCard(filtroCard === 'novos' ? 'todos' : 'novos')}
            atalho={filtroCard === 'novos' ? 'Filtro por Novos ativo' : 'Clique para filtrar novos'}
            delay={0.07}
          />
          <StatCard 
            titulo="Score Operacional Médio" 
            valor={scoreMedia} 
            icone={TrendingUp} 
            corIcone={getRisco(scoreMedia).color} 
            corFundo={getRisco(scoreMedia).bg}
            delay={0.14} 
          />
          <StatCard
            titulo="Bloqueados / Mesa" valor={bloqueados} icone={AlertTriangle} corIcone="#EA4335" corFundo="#FCE8E6"
            ativo={filtroCard === 'bloqueados'}
            onClick={() => setFiltroCard(filtroCard === 'bloqueados' ? 'todos' : 'bloqueados')}
            atalho={filtroCard === 'bloqueados' ? 'Filtro por Bloqueados ativo' : 'Filtrar inadimplentes críticos'}
            delay={0.21}
          />
        </div>

        {/* Filter and Listing Table */}
        <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 overflow-hidden transition-all duration-300 hover:shadow-m3-2">
          
          {/* Header toolbar */}
          <div className="px-5 py-4.5 border-b border-border/40 flex flex-wrap items-center gap-3 bg-muted/20">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
              className="flex-1 min-w-56"
            />
            
            <div className="flex gap-2 items-center flex-wrap shrink-0">
              <Select value={filtroRisco} onValueChange={v => setFiltroRisco(v ?? 'todos')}>
                <SelectTrigger className="h-9 text-xs font-semibold w-40 rounded-full bg-background border-border hover:bg-accent transition-colors">
                  <SelectValue placeholder="Mesa de Risco" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border bg-card">
                  <SelectItem value="todos" className="text-xs font-semibold">Todos os riscos</SelectItem>
                  <SelectItem value="baixo" className="text-xs font-semibold text-[#34A853]">Baixo Risco</SelectItem>
                  <SelectItem value="médio" className="text-xs font-semibold text-[#FBBC04]">Médio Risco</SelectItem>
                  <SelectItem value="alto" className="text-xs font-semibold text-[#FA903E]">Alto Risco</SelectItem>
                  <SelectItem value="crítico" className="text-xs font-semibold text-[#EA4335]">Risco Crítico</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v ?? 'todos')}>
                <SelectTrigger className="h-9 text-xs font-semibold w-36 rounded-full bg-background border-border hover:bg-accent transition-colors">
                  <SelectValue placeholder="Status Cadastral" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border bg-card">
                  <SelectItem value="todos" className="text-xs font-semibold">Todos</SelectItem>
                  <SelectItem value="ativo" className="text-xs font-semibold text-[#34A853]">Ativos</SelectItem>
                  <SelectItem value="inativo" className="text-xs font-semibold text-muted-foreground">Inativos</SelectItem>
                  <SelectItem value="bloqueado" className="text-xs font-semibold text-[#EA4335]">Bloqueados</SelectItem>
                </SelectContent>
              </Select>

              {temPermissao('financeiro') && filtrados.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-full px-4 text-xs font-bold border-border/80 hover:bg-[var(--gt-blue-light)] hover:text-[var(--gt-blue)] hover:border-[var(--gt-blue)]/30 transition-all duration-150 shrink-0"
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
                  <Download size={13} />
                  Exportar CSV
                </Button>
              )}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filtrados}
            keyExtractor={c => c.id}
            emptyMessage="Nenhum cliente tomador localizado na carteira sob estes filtros."
            onRowClick={c => router.push(`/factoring/clientes/${c.id}`)}
            perPage={20}
          />
        </div>
      </div>
    </AppShell>
  )
}
