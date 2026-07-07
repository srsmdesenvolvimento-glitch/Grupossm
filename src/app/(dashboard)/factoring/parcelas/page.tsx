'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, Download, CalendarDays, CreditCard } from 'lucide-react'
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
import { formatarMoeda, formatarData, formatarCPF } from '@/lib/utils/formatters'
import type { ParcelaEmprestimo } from '@/lib/types/database'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'
import { cn } from '@/lib/utils'

type ParcelaCompleta = ParcelaEmprestimo & {
  numero_contrato: string
  cliente_nome: string
  cliente_cpf: string | null
}

const TABS = [
  { key: 'todos',      label: 'Todas' },
  { key: 'pendente',   label: 'Pendentes' },
  { key: 'atrasado',   label: 'Atrasadas' },
  { key: 'hoje',       label: 'Vencem Hoje' },
  { key: 'proximos7',  label: 'Próx. 7 dias' },
  { key: 'pago',       label: 'Pagas' },
  { key: 'cancelado',  label: 'Canceladas' },
]

export default function ParcelasPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [parcelas, setParcelas] = useState<ParcelaCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const validTabs = TABS.map(t => t.key)
  const paramFiltro = searchParams.get('filtro') ?? ''
  const [tab, setTab] = useState(validTabs.includes(paramFiltro) ? paramFiltro : 'todos')

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: parcelasData }, { data: clientesData }, { data: empsData }] = await Promise.all([
        supabase
          .from('parcelas_emprestimo')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .order('data_vencimento', { ascending: false }),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('emprestimos')
          .select('id, numero_contrato')
          .eq('empresa_id', empresaAtual.id),
      ])

      const clienteMap: Record<string, { nome: string; cpf: string | null }> = {}
      for (const c of clientesData ?? []) clienteMap[c.id] = { nome: c.nome, cpf: c.cpf }

      const contratoMap: Record<string, string> = {}
      for (const e of empsData ?? []) contratoMap[e.id] = e.numero_contrato

      setParcelas((parcelasData ?? []).map(p => ({
        ...p,
        numero_contrato: contratoMap[p.emprestimo_id] ?? '—',
        cliente_nome: clienteMap[p.cliente_id]?.nome ?? '—',
        cliente_cpf: clienteMap[p.cliente_id]?.cpf ?? null,
      })))
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  const hojeStr = new Date().toISOString().split('T')[0]
  const em7Dias = new Date(); em7Dias.setDate(em7Dias.getDate() + 7)
  const em7DiasStr = em7Dias.toISOString().split('T')[0]

  const totalEmAberto = parcelas
    .filter(p => p.status === 'pendente' || p.status === 'atrasado')
    .reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0)

  const totalAtrasado = parcelas
    .filter(p => p.status === 'atrasado')
    .reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0)

  const qtdVencemHoje = parcelas.filter(p => p.status === 'pendente' && p.data_vencimento === hojeStr).length
  const qtdProximos7 = parcelas.filter(p => p.status === 'pendente' && p.data_vencimento > hojeStr && p.data_vencimento <= em7DiasStr).length

  const filtradas = parcelas.filter(p => {
    if (busca) {
      const q = busca.toLowerCase()
      if (
        !p.numero_contrato.toLowerCase().includes(q) &&
        !p.cliente_nome.toLowerCase().includes(q) &&
        !(p.cliente_cpf ?? '').includes(q)
      ) return false
    }
    if (tab === 'hoje') return p.status === 'pendente' && p.data_vencimento === hojeStr
    if (tab === 'proximos7') return p.status === 'pendente' && p.data_vencimento > hojeStr && p.data_vencimento <= em7DiasStr
    if (tab !== 'todos' && p.status !== tab) return false
    return true
  })

  const columns: Column<ParcelaCompleta>[] = [
    {
      key: 'contrato',
      header: 'Contrato',
      render: p => <span className="font-mono text-sm font-bold text-[var(--gt-blue)] dark:text-blue-400">{p.numero_contrato}</span>,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: p => (
        <div>
          <p className="text-sm font-bold text-foreground leading-none">{p.cliente_nome}</p>
          <p className="text-xs text-muted-foreground mt-1">{p.cliente_cpf ? formatarCPF(p.cliente_cpf) : ''}</p>
        </div>
      ),
    },
    {
      key: 'parcela',
      header: 'Parcela',
      render: p => <span className="tabular-nums text-sm text-muted-foreground font-mono font-medium">{p.numero_parcela}/{p.total_parcelas}</span>,
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: p => (
        <span className={cn(
          "tabular-nums text-sm font-semibold", 
          p.status === 'atrasado' ? 'text-[var(--gt-red)]' : 'text-muted-foreground'
        )}>
          {formatarData(p.data_vencimento)}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: p => <MoneyDisplay valor={p.valor} tamanho="sm" />,
    },
    {
      key: 'mora',
      header: 'Encargos',
      render: p => {
        const multa = Number(p.multa ?? 0)
        const juros = Number(p.juros_mora ?? 0)
        const mora = multa + juros
        if (mora <= 0) return <span className="text-muted-foreground/30 text-sm">—</span>
        return (
          <div>
            <MoneyDisplay valor={mora} tamanho="sm" negativo />
            {multa > 0 && juros > 0 && (
              <p className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">
                M {formatarMoeda(multa)} + J {formatarMoeda(juros)}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: p => (
        <StatusBadge status={p.status} />
      ),
    },
    {
      key: 'pagamento',
      header: 'Pago em',
      render: p => (
        <span className="tabular-nums text-sm text-muted-foreground font-medium">
          {p.data_pagamento ? formatarData(p.data_pagamento) : '—'}
        </span>
      ),
    },
    {
      key: 'acao',
      header: '',
      className: 'w-44',
      render: p => ['pendente', 'atrasado'].includes(p.status) ? (
        <Button
          size="default"
          className="h-8.5 text-xs gap-1.5 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-4.5 shadow-sm transition-all duration-200"
          onClick={e => {
            e.stopPropagation()
            router.push(`/factoring/emprestimos/${p.emprestimo_id}?parcela=${p.id}`)
          }}
        >
          <CreditCard size={13} />
          Registrar Pagamento
        </Button>
      ) : null,
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Parcelas">
      <div className="space-y-6">
        <PageHeader
          titulo="Parcelas"
          descricao="Acompanhe e registre pagamentos de parcelas"
          icone={CreditCard}
          corIcone="var(--gt-blue)"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            titulo="Total a Receber"
            valor={formatarMoeda(totalEmAberto)}
            subtitulo={`${parcelas.filter(p => ['pendente','atrasado'].includes(p.status)).length} parcelas`}
            icone={Clock}
            corIcone="var(--gt-blue)"
            corFundo="var(--gt-blue-light)"
            ativo={tab === 'pendente'}
            onClick={() => setTab(tab === 'pendente' ? 'todos' : 'pendente')}
            atalho={tab === 'pendente' ? 'Filtrando ↑' : 'Ver pendentes →'}
            delay={0}
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(totalAtrasado)}
            subtitulo={`${parcelas.filter(p => p.status === 'atrasado').length} parcelas`}
            icone={AlertTriangle}
            corIcone="var(--gt-red)"
            corFundo="var(--gt-red-light)"
            ativo={tab === 'atrasado'}
            onClick={() => setTab(tab === 'atrasado' ? 'todos' : 'atrasado')}
            atalho={tab === 'atrasado' ? 'Filtrando ↑' : 'Ver atrasadas →'}
            delay={0.07}
          />
          <StatCard
            titulo="Vencem Hoje"
            valor={qtdVencemHoje}
            subtitulo="parcelas"
            icone={CheckCircle2}
            corIcone="var(--gt-yellow)"
            corFundo="var(--gt-yellow-light)"
            ativo={tab === 'hoje'}
            onClick={() => setTab(tab === 'hoje' ? 'todos' : 'hoje')}
            atalho={tab === 'hoje' ? 'Filtrando ↑' : 'Ver hoje →'}
            delay={0.14}
          />
          <StatCard
            titulo="Próximos 7 dias"
            valor={qtdProximos7}
            subtitulo="vencem esta semana"
            icone={CalendarDays}
            corIcone="var(--gt-purple)"
            corFundo="var(--gt-purple-light)"
            ativo={tab === 'proximos7'}
            onClick={() => setTab(tab === 'proximos7' ? 'todos' : 'proximos7')}
            atalho={tab === 'proximos7' ? 'Filtrando ↑' : 'Ver esta semana →'}
            delay={0.21}
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 overflow-hidden">
          {/* Google filter chips */}
          <div className="px-6 py-4 flex gap-2 border-b border-border/50 overflow-x-auto scrollbar-none items-center">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200 shrink-0 border",
                  tab === t.key
                    ? "bg-[var(--gt-blue)] text-white border-transparent shadow-sm"
                    : "bg-card text-muted-foreground hover:bg-muted/85 border-border/60 hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between gap-4">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por contrato ou cliente..."
              className="flex-1 min-w-48 max-w-md"
            />
            {temPermissao('financeiro') && filtradas.length > 0 && (
              <Button
                size="default"
                variant="outline"
                className="h-10 gap-2 rounded-full border-border/60 hover:bg-muted font-medium px-4"
                onClick={() => exportarCSV('parcelas', filtradas.map(p => ({
                  contrato: p.numero_contrato,
                  cliente: p.cliente_nome,
                  cpf: p.cliente_cpf ?? '',
                  parcela: `${p.numero_parcela}/${p.total_parcelas}`,
                  vencimento: p.data_vencimento,
                  valor: p.valor,
                  multa: p.multa,
                  juros_mora: p.juros_mora,
                  status: p.status,
                  pago_em: p.data_pagamento ?? '',
                })), [
                  { key: 'contrato', label: 'Contrato' },
                  { key: 'cliente', label: 'Cliente' },
                  { key: 'cpf', label: 'CPF' },
                  { key: 'parcela', label: 'Parcela' },
                  { key: 'vencimento', label: 'Vencimento' },
                  { key: 'valor', label: 'Valor' },
                  { key: 'multa', label: 'Multa' },
                  { key: 'juros_mora', label: 'Juros Diários' },
                  { key: 'status', label: 'Status' },
                  { key: 'pago_em', label: 'Pago em' },
                ])}
              >
                <Download size={15} />
                Exportar CSV
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={filtradas}
            keyExtractor={p => p.id}
            emptyMessage="Nenhuma parcela encontrada"
            onRowClick={p => router.push(`/factoring/emprestimos/${p.emprestimo_id}`)}
            perPage={25}
            rowClassName={p => {
              if (p.status === 'atrasado') return 'bg-[var(--gt-red-light)]/20 hover:bg-[var(--gt-red-light)]/40 dark:bg-[var(--gt-red)]/5 dark:hover:bg-[var(--gt-red)]/10'
              if (p.status === 'pago') return 'bg-[var(--gt-green-light)]/15 hover:bg-[var(--gt-green-light)]/30 dark:bg-[var(--gt-green)]/5 dark:hover:bg-[var(--gt-green)]/10'
              if (p.status === 'pendente') return 'bg-[var(--gt-yellow-light)]/15 hover:bg-[var(--gt-yellow-light)]/30 dark:bg-[var(--gt-yellow)]/5 dark:hover:bg-[var(--gt-yellow)]/10'
              return ''
            }}
          />
        </div>
      </div>
    </AppShell>
  )
}
