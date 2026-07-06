'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, MessageCircle, Eye, CreditCard, Gavel,
  Users, DollarSign, Clock, Flame, Filter, RefreshCw, CheckCircle2, Loader2, Send
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { Button } from '@/components/ui/button'
import { formatarMoeda, formatarCPF, iniciais } from '@/lib/utils/formatters'
import type { ParcelaEmprestimo } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ClienteInadimplente = {
  id: string
  nome: string
  cpf: string | null
  telefone: string
  score_interno: number
  status: 'ativo' | 'inativo' | 'bloqueado'
  parcelas: (ParcelaEmprestimo & { emprestimos?: { numero_contrato: string } | null })[]
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
  leve:     { label: 'Leve',     color: 'var(--gt-blue)', bg: 'var(--gt-blue-light)', border: 'var(--gt-blue-light)', badge: 'rgba(26,115,232,0.15)', min: 1,  max: 7  },
  moderado: { label: 'Moderado', color: 'var(--gt-orange)', bg: 'var(--gt-orange-light)', border: 'var(--gt-orange-light)', badge: 'rgba(250,144,62,0.15)', min: 8,  max: 30 },
  critico:  { label: 'Crítico',  color: 'var(--gt-red)', bg: 'var(--gt-red-light)', border: 'var(--gt-red-light)', badge: 'rgba(234,67,53,0.15)', min: 31, max: 60 },
  grave:    { label: 'Grave',    color: '#B91C1C', bg: 'rgba(185,28,28,0.06)', border: 'rgba(185,28,28,0.15)', badge: 'rgba(185,28,28,0.12)', min: 61, max: Infinity },
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
  const [enviandoCobranca, setEnviandoCobranca] = useState<string | null>(null)
  const [pixPadrao, setPixPadrao] = useState('financeiro@srsm.com.br')

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const [{ data: parcelasData }, { data: clientesData }, { data: config }] = await Promise.all([
        supabase
          .from('parcelas_emprestimo')
          .select('*, emprestimos(numero_contrato)')
          .eq('empresa_id', empresaAtual.id)
          .eq('status', 'atrasado')
          .order('data_vencimento', { ascending: true }),
        supabase
          .from('clientes_factoring')
          .select('id, nome, cpf, telefone, score_interno, status')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('config_factoring')
          .select('whatsapp_padrao')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
      ])
      if (config?.whatsapp_padrao) setPixPadrao(config.whatsapp_padrao)

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
    } catch {
      toast.error('Erro ao carregar inadimplentes')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => { carregarDados() }, [carregarDados])

  function formatarDataBR(data: string) {
    const p = data.split('-')
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : data
  }

  async function enviarCobrancaWhatsApp(c: ClienteInadimplente) {
    if (!c.telefone || !empresaAtual) return
    setEnviandoCobranca(c.id)
    try {
      const parcela = c.parcelas[0]
      const res = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtual.id,
          destinatario: c.telefone,
          triggerKey: 'cobranca_pos_vencimento',
          variaveis: {
            nome: c.nome.split(' ')[0],
            numero_contrato: (parcela as any)?.emprestimos?.numero_contrato ?? `EMP-${parcela?.emprestimo_id?.slice(0,8)}`,
            numero_parcela: String(parcela?.numero_parcela ?? 1),
            total_parcelas: String(parcela?.total_parcelas ?? 1),
            data_vencimento: formatarDataBR(parcela?.data_vencimento ?? ''),
            dias_atraso: String(c.maxDiasAtraso),
            valor_total: c.totalDevido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            whatsapp_padrao: pixPadrao,
          },
          assunto: `Cobrança — ${c.qtdParcelas} parcela(s) em atraso`,
          referencia_tipo: 'cliente',
          referencia_id: c.id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cobrança enviada para ${c.nome.split(' ')[0]}!`)
      } else {
        toast.error(data.erro || 'Falha ao enviar cobrança')
      }
    } catch {
      toast.error('Erro de conexão ao enviar cobrança')
    } finally {
      setEnviandoCobranca(null)
    }
  }

  async function marcarBloqueado(clienteId: string) {
    setBloqueando(clienteId)
    try {
      const { error } = await supabase
        .from('clientes_factoring')
        .update({ status: 'bloqueado' })
        .eq('id', clienteId)
      if (error) throw error
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, status: 'bloqueado' } : c))
      toast.success('Cliente encaminhado ao jurídico')
    } catch {
      toast.error('Erro ao atualizar status do cliente')
    } finally {
      setBloqueando(null)
    }
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
        
        <PageHeader 
          titulo="Inadimplentes"
          descricao="Identifique clientes com parcelas vencidas e acompanhe as ações de cobrança"
          icone={AlertTriangle}
          corIcone="var(--gt-red)"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard titulo="Clientes Inadimplentes" valor={clientes.length} icone={Users} corIcone="var(--gt-blue)" corFundo="var(--gt-blue-light)" delay={0} />
          <StatCard titulo="Total Devido" valor={formatarMoeda(totalDevido)} icone={DollarSign} corIcone="var(--gt-red)" corFundo="var(--gt-red-light)" delay={0.07} />
          <StatCard titulo="Média de Atraso" valor={`${mediaAtraso}d`} icone={Clock} corIcone="var(--gt-orange)" corFundo="var(--gt-orange-light)" delay={0.14} />
          <StatCard titulo="Graves (+60d)" valor={graves} icone={Flame} corIcone="#B91C1C" corFundo="rgba(185,28,28,0.06)" delay={0.21} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
          <div className="flex items-center gap-3 w-full xl:max-w-md shrink-0">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por cliente, CPF ou telefone..."
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 bg-muted/40 border border-border/40 rounded-xl shrink-0 flex items-center justify-center">
              <Filter size={14} className="text-muted-foreground" />
            </div>
            
            {/* Google Filter chips */}
            <div className="flex rounded-full border border-border/60 bg-muted/20 p-1 items-center max-w-full">
              {(['todos', 'leve', 'moderado', 'critico', 'grave'] as Filtro[]).map(f => {
                const nivel = f === 'todos' ? null : NIVEIS[f]
                const active = filtro === f
                return (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={cn(
                      "px-3.5 py-1 text-xs font-bold rounded-full transition-all duration-200 flex items-center gap-1.5",
                      active 
                        ? "text-white shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={active ? {
                      backgroundColor: nivel?.color ?? 'var(--gt-blue)',
                    } : undefined}
                  >
                    {f === 'todos' ? 'Todos' : nivel!.label}
                    <span className={cn(
                      "h-4 px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center",
                      active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {contadorFiltros[f]}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={carregarDados}
              className="p-2.5 rounded-full text-muted-foreground/60 hover:text-foreground border border-border/40 shadow-sm bg-card hover:bg-muted transition-colors ml-1"
              title="Atualizar dados"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span>{filtrados.length} cliente(s) listado(s)</span>
          {bloqueados > 0 && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gt-red)]" />
              <span className="text-[var(--gt-red)]">{bloqueados} em processo jurídico</span>
            </>
          )}
        </p>

        {/* Cards Grid */}
        {filtrados.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/50 p-16 text-center shadow-m3-1 flex flex-col items-center justify-center max-w-xl mx-auto gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--gt-green-light)] flex items-center justify-center shadow-sm">
              <CheckCircle2 size={24} className="text-[var(--gt-green)]" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground tracking-tight">Tudo sob controle!</p>
              <p className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
                {clientes.length === 0 ? 'Todos os clientes estão com pagamentos em dia' : 'Tente ajustar o filtro ou a busca para encontrar registros'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtrados.map(c => {
                const nivel = getNivel(c.maxDiasAtraso)
                const nivelKey = getNivelKey(c.maxDiasAtraso)
                const bloqueadoAgora = c.status === 'bloqueado'
                const enviandoEste = enviandoCobranca === c.id

                return (
                  <div
                    key={c.id}
                    className="bg-card rounded-2xl border transition-all duration-200 hover:shadow-m3-2 hover:-translate-y-0.5 flex flex-col justify-between overflow-hidden shadow-m3-1"
                    style={{ borderColor: nivel.border }}
                  >
                    {/* Header */}
                    <div className="px-5 py-4.5 flex items-center justify-between border-b border-border/40" style={{ backgroundColor: nivel.bg }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm"
                          style={{ backgroundColor: bloqueadoAgora ? '#64748b' : 'var(--gt-blue)' }}
                        >
                          {iniciais(c.nome)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground truncate text-sm leading-none">{c.nome}</p>
                            {bloqueadoAgora && (
                              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded bg-[var(--gt-red-light)] text-[var(--gt-red)] uppercase tracking-wide border border-[var(--gt-red-light)]">
                                Jurídico
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 font-medium mt-1">{c.cpf ? formatarCPF(c.cpf) : 'CPF não informado'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        <span
                          className="text-xs font-black px-2.5 py-0.5 rounded-full border"
                          style={{ backgroundColor: nivel.badge, color: nivel.color, borderColor: nivel.border }}
                        >
                          {c.maxDiasAtraso} dias
                        </span>
                        <span className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: nivel.color }}>
                          Nível {nivelKey === 'leve' ? 'Leve' : nivelKey === 'moderado' ? 'Moderado' : nivelKey === 'critico' ? 'Crítico' : 'Grave'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5 space-y-4 flex-1 flex flex-col justify-between">
                      {/* Valor + parcelas */}
                      <div className="flex justify-between items-end border-b border-border/30 pb-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{c.qtdParcelas} parcela(s) em atraso</p>
                          <p className="text-xl font-black mt-1 leading-none" style={{ color: nivel.color }}>
                            {formatarMoeda(c.totalDevido)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-muted-foreground">Score Interno</p>
                          <p className="text-sm font-black text-foreground mt-1 leading-none">{c.score_interno}/100</p>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-muted dark:bg-card border border-border/40 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${c.score_interno}%`,
                              backgroundColor: c.score_interno >= 70 ? 'var(--gt-green)' : c.score_interno >= 40 ? 'var(--gt-orange)' : 'var(--gt-red)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9.5 gap-1.5 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/8 text-xs font-bold rounded-full transition-all duration-200"
                          onClick={() => enviarCobrancaWhatsApp(c)}
                          disabled={!c.telefone || enviandoEste || !!enviandoCobranca}
                        >
                          {enviandoEste ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {enviandoEste ? 'Enviando...' : 'Cobrar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9.5 gap-1.5 text-xs font-bold rounded-full border-border/60 hover:bg-muted flex items-center justify-center px-3"
                          onClick={() => router.push(`/factoring/clientes/${c.id}`)}
                          title="Ver detalhes do cliente"
                        >
                          <Eye size={13} />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-9.5 gap-1.5 text-white text-xs font-bold rounded-full bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 transition-all duration-200 shadow-sm"
                          onClick={() => {
                            const p = c.parcelas[0]
                            if (p) router.push(`/factoring/emprestimos/${p.emprestimo_id}?parcela=${p.id}`)
                          }}
                        >
                          <CreditCard size={13} />
                          Pagar
                        </Button>
                      </div>

                      {/* Juridico */}
                      {!bloqueadoAgora && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-9 gap-2 text-xs font-bold text-muted-foreground/80 hover:border-[var(--gt-red-light)] hover:text-[var(--gt-red)] hover:bg-[var(--gt-red-light)]/20 rounded-full transition-colors mt-1 flex items-center justify-center border-border/60"
                          onClick={() => marcarBloqueado(c.id)}
                          disabled={bloqueando === c.id}
                        >
                          <Gavel size={13} />
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
