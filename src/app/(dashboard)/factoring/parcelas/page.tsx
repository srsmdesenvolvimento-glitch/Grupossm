'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, Download, CalendarDays, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { formatarMoeda, formatarData, formatarCPF } from '@/lib/utils/formatters'
import type { ParcelaEmprestimo } from '@/lib/types/database'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'

type ParcelaCompleta = ParcelaEmprestimo & {
  numero_contrato: string
  cliente_nome: string
  cliente_cpf: string | null
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pendente:    { color: '#eab308', bg: '#fefce8', label: 'Pendente' },
  pago:        { color: '#22c55e', bg: '#f0fdf4', label: 'Pago' },
  atrasado:    { color: '#ef4444', bg: '#fef2f2', label: 'Atrasado' },
  renegociado: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Renegociado' },
  cancelado:   { color: '#94a3b8', bg: '#f8fafc', label: 'Cancelado' },
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
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const supabase = createClient()

  const [parcelas, setParcelas] = useState<ParcelaCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [tab, setTab] = useState('todos')

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

  const agora = new Date()
  const hojeStr = agora.toISOString().split('T')[0]
  const em7Dias = new Date(agora); em7Dias.setDate(em7Dias.getDate() + 7)
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
    if (tab === 'hoje') return p.status === 'pendente' && p.data_vencimento === hojeStr
    if (tab === 'proximos7') return p.status === 'pendente' && p.data_vencimento > hojeStr && p.data_vencimento <= em7DiasStr
    if (tab !== 'todos' && p.status !== tab) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (
        !p.numero_contrato.toLowerCase().includes(q) &&
        !p.cliente_nome.toLowerCase().includes(q) &&
        !(p.cliente_cpf ?? '').includes(q)
      ) return false
    }
    return true
  })

  const columns: Column<ParcelaCompleta>[] = [
    {
      key: 'contrato',
      header: 'Contrato',
      render: p => <span className="font-mono text-xs font-semibold" style={{ color: '#1E5AA8' }}>{p.numero_contrato}</span>,
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: p => (
        <div>
          <p className="text-sm font-medium text-foreground">{p.cliente_nome}</p>
          <p className="text-xs text-muted-foreground/60">{p.cliente_cpf ? formatarCPF(p.cliente_cpf) : ''}</p>
        </div>
      ),
    },
    {
      key: 'parcela',
      header: 'Parcela',
      render: p => <span className="tabular-nums text-sm text-muted-foreground">{p.numero_parcela}/{p.total_parcelas}</span>,
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: p => (
        <span className={`tabular-nums text-sm ${p.status === 'atrasado' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          {formatarData(p.data_vencimento)}
        </span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      render: p => <span className="tabular-nums text-sm">{formatarMoeda(p.valor)}</span>,
    },
    {
      key: 'mora',
      header: 'Juros Diários',
      render: p => {
        const mora = p.multa + p.juros_mora
        return mora > 0
          ? <span className="tabular-nums text-sm text-red-600">{formatarMoeda(mora)}</span>
          : <span className="text-muted-foreground/30 text-sm">—</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: p => {
        const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.pendente
        return (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: s.color, backgroundColor: s.bg }}
          >
            {s.label}
          </span>
        )
      },
    },
    {
      key: 'pagamento',
      header: 'Pago em',
      render: p => (
        <span className="tabular-nums text-sm text-muted-foreground">
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
          size="sm"
          className="h-7 text-xs gap-1 text-white"
          style={{ backgroundColor: '#1E5AA8' }}
          onClick={e => {
            e.stopPropagation()
            router.push(`/factoring/emprestimos/${p.emprestimo_id}?parcela=${p.id}`)
          }}
        >
          <CreditCard size={12} />
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
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            titulo="Total a Receber"
            valor={formatarMoeda(totalEmAberto)}
            subtitulo={`${parcelas.filter(p => ['pendente','atrasado'].includes(p.status)).length} parcelas`}
            icone={Clock}
            corIcone="#1E5AA8"
            corFundo="#EDF4FE"
            ativo={tab === 'pendente'}
            onClick={() => setTab(tab === 'pendente' ? 'todos' : 'pendente')}
            atalho={tab === 'pendente' ? 'Filtrando ↑' : 'Ver pendentes →'}
          />
          <StatCard
            titulo="Em Atraso"
            valor={formatarMoeda(totalAtrasado)}
            subtitulo={`${parcelas.filter(p => p.status === 'atrasado').length} parcelas`}
            icone={AlertTriangle}
            corIcone="#ef4444"
            corFundo="#FEF2F2"
            ativo={tab === 'atrasado'}
            onClick={() => setTab(tab === 'atrasado' ? 'todos' : 'atrasado')}
            atalho={tab === 'atrasado' ? 'Filtrando ↑' : 'Ver atrasadas →'}
          />
          <StatCard
            titulo="Vencem Hoje"
            valor={qtdVencemHoje}
            subtitulo="parcelas"
            icone={CheckCircle2}
            corIcone="#D4A528"
            corFundo="#FEFCE8"
            ativo={tab === 'hoje'}
            onClick={() => setTab(tab === 'hoje' ? 'todos' : 'hoje')}
            atalho={tab === 'hoje' ? 'Filtrando ↑' : 'Ver hoje →'}
          />
          <StatCard
            titulo="Próximos 7 dias"
            valor={qtdProximos7}
            subtitulo="vencem esta semana"
            icone={CalendarDays}
            corIcone="#7C3AED"
            corFundo="#F5F3FF"
            ativo={tab === 'proximos7'}
            onClick={() => setTab(tab === 'proximos7' ? 'todos' : 'proximos7')}
            atalho={tab === 'proximos7' ? 'Filtrando ↑' : 'Ver esta semana →'}
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 pt-4 flex gap-1 border-b border-border/60 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 shrink-0 text-muted-foreground"
                style={tab === t.key
                  ? { color: '#1E5AA8', borderColor: '#1E5AA8' }
                  : { borderColor: 'transparent' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por contrato ou cliente..."
              className="flex-1 max-w-sm"
            />
            {temPermissao('financeiro') && filtradas.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 shrink-0"
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
                <Download size={14} />
                CSV
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
              if (p.status === 'atrasado') return 'bg-red-50 hover:bg-red-100'
              if (p.status === 'pago') return 'bg-green-50/60 hover:bg-green-100/60'
              if (p.status === 'pendente') return 'bg-amber-50/40 hover:bg-amber-100/40'
              return ''
            }}
          />
        </div>
      </div>
    </AppShell>
  )
}
