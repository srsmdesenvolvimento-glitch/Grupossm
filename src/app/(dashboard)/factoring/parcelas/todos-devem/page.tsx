'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, AlertTriangle, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { formatarMoeda, formatarData, formatarCPF, iniciais } from '@/lib/utils/formatters'
import { logError } from '@/lib/utils/errors'

type ClienteDevendo = {
  id: string
  nome: string
  cpf: string | null
  score_interno: number
  emAberto: number
  emAtraso: number
  contratosAtivos: number
  ultimaOperacao: string | null
}

export default function TodosDevemPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [clientes, setClientes] = useState<ClienteDevendo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: clientesData }, { data: parcelasData }, { data: empsData }] = await Promise.all([
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, score_interno, ultima_operacao')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('parcelas_emprestimo')
          .select('cliente_id, valor, valor_pago, status')
          .eq('empresa_id', empresaAtual.id)
          .in('status', ['pendente', 'atrasado']),
        supabase
          .from('emprestimos')
          .select('cliente_id')
          .eq('empresa_id', empresaAtual.id)
          .eq('status', 'ativo'),
      ])

      const parcelasPorCliente: Record<string, { aberto: number; atraso: number }> = {}
      for (const p of parcelasData ?? []) {
        const devido = (p.valor ?? 0) - (p.valor_pago ?? 0)
        if (!parcelasPorCliente[p.cliente_id]) parcelasPorCliente[p.cliente_id] = { aberto: 0, atraso: 0 }
        parcelasPorCliente[p.cliente_id].aberto += devido
        if (p.status === 'atrasado') parcelasPorCliente[p.cliente_id].atraso += devido
      }

      const contratosPorCliente: Record<string, number> = {}
      for (const e of empsData ?? []) {
        contratosPorCliente[e.cliente_id] = (contratosPorCliente[e.cliente_id] ?? 0) + 1
      }

      const result: ClienteDevendo[] = (clientesData ?? [])
        .filter(c => (parcelasPorCliente[c.id]?.aberto ?? 0) > 0)
        .map(c => ({
          id: c.id,
          nome: c.nome,
          cpf: c.cpf,
          score_interno: c.score_interno,
          emAberto: parcelasPorCliente[c.id]?.aberto ?? 0,
          emAtraso: parcelasPorCliente[c.id]?.atraso ?? 0,
          contratosAtivos: contratosPorCliente[c.id] ?? 0,
          ultimaOperacao: c.ultima_operacao,
        }))
        .sort((a, b) => b.emAberto - a.emAberto)

      setClientes(result)
    } catch (error) {
      logError('carregarDados', error)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  const totalEmAberto = clientes.reduce((s, c) => s + c.emAberto, 0)
  const totalEmAtraso = clientes.reduce((s, c) => s + c.emAtraso, 0)
  const comAtraso = clientes.filter(c => c.emAtraso > 0).length

  const filtrados = clientes.filter(c => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return c.nome.toLowerCase().includes(q) || (c.cpf ?? '').includes(q)
  })

  const columns: Column<ClienteDevendo>[] = [
    {
      key: 'cliente',
      header: 'Cliente Beneficiário',
      render: c => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm select-none"
            style={{ backgroundColor: '#1A73E8' }}
          >
            {iniciais(c.nome)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground truncate">{c.nome}</p>
            <p className="text-[10px] text-muted-foreground/60 font-semibold">{c.cpf ? formatarCPF(c.cpf) : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'emAberto',
      header: 'Em Aberto',
      render: c => <span className="tabular-nums font-bold text-sm text-foreground">{formatarMoeda(c.emAberto)}</span>,
    },
    {
      key: 'emAtraso',
      header: 'Em Atraso',
      render: c => c.emAtraso > 0
        ? <span className="tabular-nums font-bold text-sm text-[#EA4335]">{formatarMoeda(c.emAtraso)}</span>
        : <span className="text-muted-foreground/40 text-sm font-semibold">—</span>,
    },
    {
      key: 'contratos',
      header: 'Títulos ativos',
      render: c => <span className="text-sm font-semibold text-muted-foreground tabular-nums">{c.contratosAtivos}</span>,
    },
    {
      key: 'ultimaOp',
      header: 'Última operação',
      render: c => (
        <span className="text-sm font-semibold text-muted-foreground/60">
          {c.ultimaOperacao ? formatarData(c.ultimaOperacao) : '—'}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: c => (
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: c.score_interno >= 70 ? '#34A853' : c.score_interno >= 50 ? '#FBBC04' : '#EA4335' }}
        >
          {c.score_interno}
        </span>
      ),
    },
    {
      key: 'acoes',
      header: '',
      render: c => (
        <Button
          size="sm"
          className="text-white text-xs h-7 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] font-bold shadow-sm"
          onClick={e => { e.stopPropagation(); router.push(`/factoring/clientes/${c.id}`) }}
        >
          Registrar Pagamento
        </Button>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Todos Devem">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Clientes devedores" valor={clientes.length} icone={Users} corIcone="#1A73E8" corFundo="#E8F0FE" />
          <StatCard titulo="Total em aberto" valor={formatarMoeda(totalEmAberto)} icone={DollarSign} corIcone="#FBBC04" corFundo="#FEF7E0" />
          <StatCard titulo="Em atraso" valor={formatarMoeda(totalEmAtraso)} icone={AlertTriangle} corIcone="#EA4335" corFundo="#FCE8E6" />
          <StatCard titulo="Com atraso" valor={comAtraso} icone={TrendingDown} corIcone="#FA903E" corFundo="#FEF0E1" />
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-m3-1 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/10">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Pesquisar por nome ou CPF..."
              className="max-w-sm"
            />
          </div>
          <DataTable
            columns={columns}
            data={filtrados}
            keyExtractor={c => c.id}
            emptyMessage="Nenhum devedor registrado no período"
            onRowClick={c => router.push(`/factoring/clientes/${c.id}`)}
            perPage={25}
          />
        </div>
      </div>
    </AppShell>
  )
}
