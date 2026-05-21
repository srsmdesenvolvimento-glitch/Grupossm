'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { formatarMoeda, formatarData, formatarCPF } from '@/lib/utils/formatters'
import type { ParcelaEmprestimo } from '@/lib/types/database'
import { PageHelp } from '@/components/shared/PageHelp'
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
  { key: 'todos',     label: 'Todas' },
  { key: 'pendente',  label: 'Pendentes' },
  { key: 'atrasado',  label: 'Atrasadas' },
  { key: 'pago',      label: 'Pagas' },
  { key: 'cancelado', label: 'Canceladas' },
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
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0]

  const totalEmAberto = parcelas
    .filter(p => p.status === 'pendente' || p.status === 'atrasado')
    .reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0)

  const totalAtrasado = parcelas
    .filter(p => p.status === 'atrasado')
    .reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0)

  const totalPagoMes = parcelas
    .filter(p => p.status === 'pago' && (p.data_pagamento ?? '') >= inicioMes)
    .reduce((s, p) => s + (p.valor_pago ?? 0), 0)

  const qtdAtrasadas = parcelas.filter(p => p.status === 'atrasado').length

  const filtradas = parcelas.filter(p => {
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
          <p className="text-sm font-medium text-slate-800">{p.cliente_nome}</p>
          <p className="text-xs text-slate-400">{p.cliente_cpf ? formatarCPF(p.cliente_cpf) : ''}</p>
        </div>
      ),
    },
    {
      key: 'parcela',
      header: 'Parcela',
      render: p => <span className="tabular-nums text-sm text-slate-600">{p.numero_parcela}/{p.total_parcelas}</span>,
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: p => (
        <span className={`tabular-nums text-sm ${p.status === 'atrasado' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
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
      header: 'Mora/Multa',
      render: p => {
        const mora = p.multa + p.juros_mora
        return mora > 0
          ? <span className="tabular-nums text-sm text-red-600">{formatarMoeda(mora)}</span>
          : <span className="text-slate-300 text-sm">—</span>
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
        <span className="tabular-nums text-sm text-slate-500">
          {p.data_pagamento ? formatarData(p.data_pagamento) : '—'}
        </span>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Parcelas">
      <div className="space-y-6">
        <PageHelp
          storageKey="help.factoring.parcelas.v1"
          titulo="Parcelas"
          oQueE="Acompanhe todas as parcelas de todos os contratos em um único lugar. Veja o que está pendente, em atraso e o que já foi recebido."
          passos={[
            'Use as abas (Todas, Pendentes, Atrasadas, Pagas) para filtrar por status.',
            'Busque por nome do cliente ou número do contrato.',
            'Clique em "Lançar Pagamento" para registrar o recebimento de uma parcela.',
            'Parcelas em vermelho estão vencidas — dê prioridade a elas.',
          ]}
          dicas={[
            'A aba "Atrasadas" mostra apenas o que está vencido e não pago.',
            'Use o filtro de datas para ver o que vence esta semana.',
            'Acesse o contrato pelo número para ver o histórico completo.',
          ]}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Em aberto" valor={formatarMoeda(totalEmAberto)} icone={Clock} corIcone="#1E5AA8" />
          <StatCard titulo="Em atraso" valor={formatarMoeda(totalAtrasado)} icone={AlertTriangle} corIcone="#ef4444" />
          <StatCard titulo="Recebido este mês" valor={formatarMoeda(totalPagoMes)} icone={CheckCircle2} corIcone="#22c55e" />
          <StatCard titulo="Parcelas atrasadas" valor={qtdAtrasadas} icone={TrendingDown} corIcone="#f97316" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 pt-4 flex gap-1 border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 shrink-0"
                style={tab === t.key
                  ? { color: '#1E5AA8', borderColor: '#1E5AA8' }
                  : { color: '#64748b', borderColor: 'transparent' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-3">
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
                  { key: 'juros_mora', label: 'Juros Mora' },
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
          />
        </div>
      </div>
    </AppShell>
  )
}
