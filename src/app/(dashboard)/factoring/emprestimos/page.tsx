'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Plus, TrendingUp, CheckCircle2, Clock, Download } from 'lucide-react'
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
import { toast } from 'sonner'

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
  const [filtroAssinatura, setFiltroAssinatura] = useState('todos')

  const isAssinado = (e: any) => {
    if (!e.documentos || !Array.isArray(e.documentos)) return false
    return e.documentos.some((doc: any) => doc.tipo === 'assinatura_digital')
  }

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
    } catch {
      toast.error('Erro ao carregar empréstimos')
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
    if (filtroAssinatura !== 'todos') {
      const assinado = isAssinado(e)
      if (filtroAssinatura === 'assinado' && !assinado) return false
      if (filtroAssinatura === 'pendente' && assinado) return false
    }
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

  const columns: Column<EmprestimoComCliente>[] = [
    {
      key: 'contrato',
      header: 'Contrato',
      render: e => (
        <span className="font-mono text-xs font-bold text-[var(--gt-blue)] dark:text-blue-400">
          {e.numero_contrato}
        </span>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente / Tomador',
      render: e => {
        const nome = e.cliente?.nome ?? '—'
        const init = iniciais(nome)
        const bgCores = ['#E8F0FE', '#E6F4EA', '#FCE8E6', '#FEF7E0', '#F3E8FD', '#FEF0E1']
        const textCores = ['#1A73E8', '#34A853', '#EA4335', '#FBBC04', '#A142F4', '#FA903E']
        const charSum = nome.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
        const idx = charSum % bgCores.length

        return (
          <div className="flex items-center gap-3 group/row">
            <div
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm transition-transform duration-200 group-hover/row:scale-105"
              style={{ backgroundColor: bgCores[idx], color: textCores[idx] }}
            >
              {init}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">{nome}</p>
              <p className="text-[10px] text-muted-foreground/80 font-mono font-medium">{e.cliente?.cpf ? formatarCPF(e.cliente.cpf) : ''}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'valor',
      header: 'Valor Principal',
      render: e => <span className="font-bold text-sm tracking-tight text-foreground">{formatarMoeda(e.valor_principal)}</span>,
    },
    {
      key: 'parcelas',
      header: 'Parcelas Amortizadas',
      render: e => (
        <span className="text-xs text-muted-foreground font-mono font-semibold">
          {e.parcelas_pagas} de {e.prazo_meses}
        </span>
      ),
    },
    {
      key: 'taxa',
      header: 'Taxa Pactuada',
      render: e => <span className="text-xs text-muted-foreground font-semibold">{e.taxa_juros}% a.m.</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: e => (
        <StatusBadge status={e.status} />
      ),
    },
    {
      key: 'assinatura',
      header: 'Assinatura',
      render: e => {
        const assinado = isAssinado(e)
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
            assinado 
              ? 'bg-[#E6F4EA] text-[#34A853] border-[#34A853]/20 dark:bg-emerald-500/10 dark:text-emerald-400' 
              : 'bg-[#FEF7E0] text-[#FBBC04] border-[#FBBC04]/20 dark:bg-amber-500/10 dark:text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${assinado ? 'bg-[#34A853] animate-pulse' : 'bg-[#FBBC04]'}`} />
            {assinado ? 'Assinado' : 'Pendente'}
          </span>
        )
      }
    },
    {
      key: 'data',
      header: 'Data de Liberação',
      render: e => <span className="text-xs text-muted-foreground font-medium">{e.data_liberacao ? formatarData(e.data_liberacao) : '—'}</span>,
    },
    {
      key: 'saldo',
      header: 'Saldo Devedor',
      render: e => <MoneyDisplay valor={e.status === 'quitado' ? 0 : e.saldo_devedor} tamanho="sm" negativo={e.status !== 'quitado' && e.saldo_devedor > 0} />,
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Empréstimos">
      <div className="space-y-6 animate-fade-in-up">

        <PageHeader
          titulo="Contratos de Empréstimo"
          descricao="Monitore a liquidez, saldo devedor e fluxos de amortização de parcelas da factoring"
          icone={Banknote}
          corIcone="var(--gt-blue)"
          acoes={
            <Button
              size="default"
              className="h-10 gap-2 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-5 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => router.push('/factoring/emprestimos/novo')}
              style={{ boxShadow: '0 4px 12px -3px var(--gt-blue)' }}
            >
              <Plus size={16} />
              <span>Novo Empréstimo</span>
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Contratos Ativos" 
            valor={ativos.length} 
            icone={Banknote} 
            corIcone="var(--gt-blue)" 
            corFundo="var(--gt-blue-light)"
            ativo={filtroCard === 'ativos'}
            onClick={() => setFiltroCard(filtroCard === 'ativos' ? 'todos' : 'ativos')}
            atalho={filtroCard === 'ativos' ? 'Filtro por Ativos ativo' : 'Exibir contratos ativos'}
            delay={0}
          />
          <StatCard 
            titulo="Capital Alocado (Mesa)" 
            valor={formatarMoeda(capitalNaRua)} 
            icone={TrendingUp} 
            corIcone="var(--gt-yellow)" 
            corFundo="var(--gt-yellow-light)" 
            delay={0.07} 
          />
          <StatCard
            titulo="Liberado no Mês" 
            valor={formatarMoeda(liberadoMes)} 
            icone={Clock} 
            corIcone="var(--gt-green)" 
            corFundo="var(--gt-green-light)"
            ativo={filtroCard === 'liberadoMes'}
            onClick={() => setFiltroCard(filtroCard === 'liberadoMes' ? 'todos' : 'liberadoMes')}
            atalho={filtroCard === 'liberadoMes' ? 'Filtro por Liberados ativo' : 'Exibir repasses do mês'}
            delay={0.14}
          />
          <StatCard
            titulo="Quitados no Mês" 
            valor={quitadosMes} 
            icone={CheckCircle2} 
            corIcone="var(--gt-purple)" 
            corFundo="var(--gt-purple-light)"
            ativo={filtroCard === 'quitadosMes'}
            onClick={() => setFiltroCard(filtroCard === 'quitadosMes' ? 'todos' : 'quitadosMes')}
            atalho={filtroCard === 'quitadosMes' ? 'Filtro por Quitados ativo' : 'Exibir contratos liquidados'}
            delay={0.21}
          />
        </div>

        <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 overflow-hidden transition-all duration-300 hover:shadow-m3-2">
          <div className="px-5 py-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-4 bg-muted/20">
            <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
              <SearchInput
                value={busca}
                onChange={setBusca}
                placeholder="Buscar por contrato ou cliente..."
                className="flex-1 min-w-48 max-w-md"
              />
              <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v ?? 'todos')}>
                <SelectTrigger className="h-9.5 text-xs font-semibold rounded-full px-5 border-border bg-background focus:ring-[var(--gt-blue)] focus:border-[var(--gt-blue)] w-44 hover:bg-accent transition-colors">
                  <SelectValue placeholder="Filtrar por Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border bg-card">
                  <SelectItem value="todos" className="text-xs font-semibold">Todos Status</SelectItem>
                  <SelectItem value="analise" className="text-xs font-semibold">Em análise</SelectItem>
                  <SelectItem value="aprovado" className="text-xs font-semibold text-[#34A853]">Aprovados</SelectItem>
                  <SelectItem value="ativo" className="text-xs font-semibold text-[#1A73E8]">Ativos</SelectItem>
                  <SelectItem value="quitado" className="text-xs font-semibold text-muted-foreground">Quitados</SelectItem>
                  <SelectItem value="inadimplente" className="text-xs font-semibold text-[#EA4335]">Inadimplentes</SelectItem>
                  <SelectItem value="cancelado" className="text-xs font-semibold text-muted-foreground/60">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filtroAssinatura} onValueChange={v => setFiltroAssinatura(v ?? 'todos')}>
                <SelectTrigger className="h-9.5 text-xs font-semibold rounded-full px-5 border-border bg-background focus:ring-[var(--gt-blue)] focus:border-[var(--gt-blue)] w-44 hover:bg-accent transition-colors">
                  <SelectValue placeholder="Assinatura" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-border bg-card">
                  <SelectItem value="todos" className="text-xs font-semibold">Qualquer Assinatura</SelectItem>
                  <SelectItem value="assinado" className="text-xs font-semibold text-[#34A853]">Assinados</SelectItem>
                  <SelectItem value="pendente" className="text-xs font-semibold text-[#FBBC04]">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {temPermissao('financeiro') && filtrados.length > 0 && (
              <Button
                size="default"
                variant="outline"
                className="h-9.5 gap-1.5 rounded-full border-border/80 hover:bg-[var(--gt-blue-light)] hover:text-[var(--gt-blue)] hover:border-[var(--gt-blue)]/30 text-xs font-bold transition-all duration-150 shrink-0"
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
                <Download size={13} />
                <span>Exportar CSV</span>
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={filtrados}
            keyExtractor={e => e.id}
            emptyMessage="Nenhum contrato de empréstimo atende a estes critérios de filtragem."
            onRowClick={e => router.push(`/factoring/emprestimos/${e.id}`)}
            perPage={20}
          />
        </div>
      </div>
    </AppShell>
  )
}
