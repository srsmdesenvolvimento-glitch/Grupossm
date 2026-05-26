'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, MessageCircle, Eye, CreditCard, Gavel,
  Users, DollarSign, Clock, Flame, Filter, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/shared/StatCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { formatarMoeda, formatarCPF, iniciais } from '@/lib/utils/formatters'
import type { ParcelaEmprestimo } from '@/lib/types/database'

type ClienteInadimplente = {
  id: string
  nome: string
  cpf: string | null
  telefone: string
  score_interno: number
  status: 'ativo' | 'inativo' | 'bloqueado'
  parcelas: ParcelaEmprestimo[]
  totalDevido: number
  maxDiasAtraso: number
  qtdParcelas: number
}

type Filtro = 'todos' | 'leve' | 'moderado' | 'critico' | 'grave'

type NivelAtraso = {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  min: number
  max: number
}

const NIVEIS: Record<string, NivelAtraso> = {
  leve:     { label: 'Leve',     color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', badge: '#e2e8f0', min: 1,  max: 7  },
  moderado: { label: 'Moderado', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', badge: '#fed7aa', min: 8,  max: 30 },
  critico:  { label: 'Crítico',  color: '#ef4444', bg: '#fff1f1', border: '#fecaca', badge: '#fecaca', min: 31, max: 60 },
  grave:    { label: 'Grave',    color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', badge: '#fca5a5', min: 61, max: Infinity },
}

function getNivel(dias: number): NivelAtraso {
  if (dias > 60) return NIVEIS.grave
  if (dias > 30) return NIVEIS.critico
  if (dias > 7)  return NIVEIS.moderado
  return NIVEIS.leve
}

function getNivelKey(dias: number): Filtro {
  if (dias > 60) return 'grave'
  if (dias > 30) return 'critico'
  if (dias > 7)  return 'moderado'
  return 'leve'
}

export default function InadimplentesPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [clientes, setClientes] = useState<ClienteInadimplente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [bloqueando, setBloqueando] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const [{ data: parcelasData }, { data: clientesData }] = await Promise.all([
        supabase
          .from('parcelas_emprestimo')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .eq('status', 'atrasado')
          .order('data_vencimento', { ascending: true }),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, telefone, score_interno, status')
          .eq('empresa_id', empresaAtual.id),
      ])

      const clienteMap: Record<string, { id: string; nome: string; cpf: string | null; telefone: string; score_interno: number; status: 'ativo' | 'inativo' | 'bloqueado' }> = {}
      for (const c of clientesData ?? []) clienteMap[c.id] = c

      const grouped: Record<string, ParcelaEmprestimo[]> = {}
      for (const p of parcelasData ?? []) {
        if (!grouped[p.cliente_id]) grouped[p.cliente_id] = []
        grouped[p.cliente_id].push(p)
      }

      const calcDias = (venc: string) => {
        const d = new Date(venc + 'T00:00:00')
        return Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / 86400000))
      }

      const result: ClienteInadimplente[] = Object.entries(grouped).map(([clienteId, pList]) => {
        const c = clienteMap[clienteId]
        const totalDevido = pList.reduce((s, p) => s + p.valor + p.multa + p.juros_mora - (p.valor_pago ?? 0), 0)
        const maxDiasAtraso = Math.max(...pList.map(p => calcDias(p.data_vencimento)))
        return {
          id: clienteId,
          nome: c?.nome ?? 'Cliente desconhecido',
          cpf: c?.cpf ?? null,
          telefone: c?.telefone ?? '',
          score_interno: c?.score_interno ?? 0,
          status: c?.status ?? 'ativo',
          parcelas: pList,
          totalDevido,
          maxDiasAtraso,
          qtdParcelas: pList.length,
        }
      }).sort((a, b) => b.maxDiasAtraso - a.maxDiasAtraso)

      setClientes(result)
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  async function marcarBloqueado(clienteId: string) {
    setBloqueando(clienteId)
    await supabase
      .from('clientes_factoring')
      .update({ status: 'bloqueado' })
      .eq('id', clienteId)
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, status: 'bloqueado' } : c))
    setBloqueando(null)
  }

  const filtrados = useMemo(() => {
    let lista = clientes
    if (busca) {
      const q = busca.toLowerCase()
      lista = lista.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf ?? '').includes(q) ||
        c.telefone.includes(q)
      )
    }
    if (filtro !== 'todos') {
      lista = lista.filter(c => getNivelKey(c.maxDiasAtraso) === filtro)
    }
    return lista
  }, [clientes, busca, filtro])

  const totalDevido   = clientes.reduce((s, c) => s + c.totalDevido, 0)
  const mediaAtraso   = clientes.length ? Math.round(clientes.reduce((s, c) => s + c.maxDiasAtraso, 0) / clientes.length) : 0
  const graves        = clientes.filter(c => c.maxDiasAtraso > 60).length
  const bloqueados    = clientes.filter(c => c.status === 'bloqueado').length

  const contadorFiltros = {
    todos:    clientes.length,
    leve:     clientes.filter(c => getNivelKey(c.maxDiasAtraso) === 'leve').length,
    moderado: clientes.filter(c => getNivelKey(c.maxDiasAtraso) === 'moderado').length,
    critico:  clientes.filter(c => getNivelKey(c.maxDiasAtraso) === 'critico').length,
    grave:    clientes.filter(c => getNivelKey(c.maxDiasAtraso) === 'grave').length,
  }

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Inadimplentes">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Inadimplentes" valor={clientes.length}          icone={Users}          corIcone="#1E5AA8" />
          <StatCard titulo="Total devido"   valor={formatarMoeda(totalDevido)} icone={DollarSign}    corIcone="#ef4444" />
          <StatCard titulo="Média de atraso" valor={`${mediaAtraso}d`}      icone={Clock}          corIcone="#f97316" />
          <StatCard titulo="Graves (+60d)"  valor={graves}                  icone={Flame}          corIcone="#b91c1c" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Nome, CPF ou telefone..."
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-slate-400 shrink-0" />
            {(['todos', 'leve', 'moderado', 'critico', 'grave'] as Filtro[]).map(f => {
              const nivel = f === 'todos' ? null : NIVEIS[f]
              const active = filtro === f
              return (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={active ? {
                    backgroundColor: nivel?.color ?? '#1E5AA8',
                    borderColor: nivel?.color ?? '#1E5AA8',
                    color: '#fff',
                  } : {
                    backgroundColor: '#fff',
                    borderColor: '#e2e8f0',
                    color: '#64748b',
                  }}
                >
                  {f === 'todos' ? 'Todos' : nivel!.label}
                  <span className="font-bold">{contadorFiltros[f]}</span>
                </button>
              )
            })}
            <button
              onClick={carregarDados}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Atualizar"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          {filtrados.length} cliente(s) · {bloqueados > 0 && `${bloqueados} em processo jurídico`}
        </p>

        {/* Cards */}
        {filtrados.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-16 text-center">
            <AlertTriangle size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">Nenhum resultado encontrado</p>
            <p className="text-sm text-slate-400 mt-1">
              {clientes.length === 0 ? 'Todos os clientes estão com pagamentos em dia' : 'Tente ajustar o filtro ou a busca'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map(c => {
                const nivel = getNivel(c.maxDiasAtraso)
                const nivelKey = getNivelKey(c.maxDiasAtraso)
                const telefoneNum = c.telefone.replace(/\D/g, '')
                const msgCobranca = encodeURIComponent(
                  `Olá ${c.nome.split(' ')[0]}! Identificamos ${c.qtdParcelas} parcela(s) em atraso totalizando ${formatarMoeda(c.totalDevido)}. Entre em contato para regularizar. Estamos à disposição.`
                )
                const bloqueadoAgora = c.status === 'bloqueado'

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    style={{ borderColor: nivel.border }}
                  >
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: nivel.bg }}>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: bloqueadoAgora ? '#64748b' : '#1E5AA8' }}
                      >
                        {iniciais(c.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 truncate text-sm">{c.nome}</p>
                          {bloqueadoAgora && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wide">
                              Jurídico
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{c.cpf ? formatarCPF(c.cpf) : 'CPF não informado'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: nivel.badge, color: nivel.color }}
                        >
                          {c.maxDiasAtraso}d
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: nivel.color }}>
                          {nivelKey === 'leve' ? 'Leve' : nivelKey === 'moderado' ? 'Moderado' : nivelKey === 'critico' ? 'Crítico' : 'Grave'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Valor + parcelas */}
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-400">{c.qtdParcelas} parcela(s) em atraso</p>
                          <p className="text-base font-bold" style={{ color: nivel.color }}>
                            {formatarMoeda(c.totalDevido)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Score</p>
                          <p className="text-sm font-bold text-slate-700">{c.score_interno}/100</p>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${c.score_interno}%`,
                            backgroundColor: c.score_interno >= 70 ? '#22c55e' : c.score_interno >= 40 ? '#f97316' : '#ef4444',
                          }}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/5 text-xs"
                          onClick={() => window.open(`https://wa.me/55${telefoneNum}?text=${msgCobranca}`, '_blank')}
                          disabled={!telefoneNum}
                        >
                          <MessageCircle size={12} />
                          Cobrar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => router.push(`/factoring/clientes/${c.id}`)}
                        >
                          <Eye size={12} />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1 text-white text-xs"
                          style={{ backgroundColor: '#1E5AA8' }}
                          onClick={() => {
                            const p = c.parcelas[0]
                            if (p) router.push(`/factoring/emprestimos/${p.emprestimo_id}?parcela=${p.id}`)
                          }}
                        >
                          <CreditCard size={12} />
                          Pagar
                        </Button>
                      </div>

                      {/* Juridico */}
                      {!bloqueadoAgora && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 text-xs text-slate-500 border-slate-200 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => marcarBloqueado(c.id)}
                          disabled={bloqueando === c.id}
                        >
                          <Gavel size={12} />
                          {bloqueando === c.id ? 'Atualizando...' : 'Encaminhar ao jurídico'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
