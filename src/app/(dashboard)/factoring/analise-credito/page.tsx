'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, AlertCircle, ShieldCheck, BarChart3, MapPin, Phone, CreditCard, UserPlus, RotateCcw, Clock, Building2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { RelatorioView } from '@/components/factoring/analise-credito/RelatorioView'
import { buscarRelatorioAssertiva, detectarTipo, maskDoc, formatCpf, formatCnpj } from '@/lib/assertiva/client'
import type { RelatorioCompleto } from '@/lib/assertiva/types'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useRouter } from 'next/navigation'

type ConsultaRecente = {
  chave: string
  resultado: RelatorioCompleto
  consultado_em: string
}

export default function AnaliseCreditoPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [relatorio, setRelatorio]   = useState<RelatorioCompleto | null>(null)
  const [erro, setErro]             = useState<string | null>(null)
  const [recentes, setRecentes]     = useState<ConsultaRecente[]>([])

  const carregarRecentes = useCallback(async () => {
    if (!empresaAtual) return
    const { data } = await supabase
      .from('assertiva_cache_factoring')
      .select('chave, resultado, consultado_em')
      .order('consultado_em', { ascending: false })
      .limit(6)
    setRecentes((data ?? []) as ConsultaRecente[])
  }, [empresaAtual])

  useEffect(() => { carregarRecentes() }, [carregarRecentes])

  function handleInput(v: string) {
    setInput(maskDoc(v))
    setErro(null)
  }

  async function analisar(docOverride?: string) {
    const raw = docOverride ?? input
    const doc  = raw.replace(/\D/g, '')
    const tipo = detectarTipo(doc)

    if (!tipo) {
      setErro('Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido')
      return
    }

    setLoading(true)
    setErro(null)
    setRelatorio(null)

    const { data, erro: err } = await buscarRelatorioAssertiva(doc, tipo)
    setLoading(false)

    if (err) { setErro(err); return }
    if (data) {
      setRelatorio(data)
      carregarRecentes()
    }
  }

  function irParaCadastro() {
    if (!relatorio) return
    const nome = relatorio.nome ?? relatorio.razao_social ?? ''
    router.push(`/factoring/clientes/novo?cpf=${relatorio.documento}&nome=${encodeURIComponent(nome)}&from=analise-credito`)
  }

  function nova() {
    setRelatorio(null)
    setInput('')
    setErro(null)
  }

  function formatarDocRecente(chave: string) {
    // Chave tem o formato `tipo:vN:documento` (versionada) ou `tipo:documento` (legado)
    const partes = chave.split(':')
    const tipo = partes[0]
    const doc = partes[partes.length - 1]
    if (!doc) return chave
    return tipo === 'pf' ? formatCpf(doc) : formatCnpj(doc)
  }

  function nomeRecente(r: ConsultaRecente) {
    return r.resultado?.nome ?? r.resultado?.razao_social ?? formatarDocRecente(r.chave)
  }

  return (
    <AppShell empresa="factoring" titulo="Análise de Crédito">
      <PageHeader
        titulo="Análise de Crédito"
        descricao="Consulte CPF ou CNPJ · Relatório completo via Assertiva"
        icone={BarChart3}
      />

      {/* Barra de busca */}
      <SectionCard className="mb-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && analisar()}
            placeholder="CPF (000.000.000-00) ou CNPJ (00.000.000/0001-00)"
            className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={() => analisar()} disabled={loading || !input.trim()}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {!loading && <span className="hidden sm:inline">Analisar</span>}
          </Button>
        </div>
      </SectionCard>

      {/* Erro */}
      {erro && !loading && (
        <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-4">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600">Erro na consulta</p>
            <p className="text-sm text-red-500/80 mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="font-semibold">Consultando Assertiva...</p>
            <p className="text-sm text-muted-foreground mt-1">Buscando dados cadastrais e financeiros</p>
          </div>
        </div>
      )}

      {/* Empty state com histórico */}
      {!loading && !relatorio && !erro && (
        <div className="space-y-5">
          {/* Consultas recentes */}
          {recentes.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
                <Clock size={14} className="text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consultadas Recentemente</span>
              </div>
              <div className="divide-y divide-border/30">
                {recentes.map(r => {
                  const isPj = r.chave.startsWith('pj:')
                  const score = r.resultado?.score
                  const temRestricoes = (r.resultado?.total_dividas ?? 0) > 0
                  return (
                    <button
                      key={r.chave}
                      onClick={() => analisar(r.chave.split(':').pop()!)}
                      className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
                        {isPj ? <Building2 size={14} className="text-muted-foreground" /> : <ShieldCheck size={14} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{nomeRecente(r)}</p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{formatarDocRecente(r.chave)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {temRestricoes && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">Restrições</span>
                        )}
                        {score != null && (
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${score >= 600 ? 'bg-emerald-500/10 text-emerald-600' : score >= 400 ? 'bg-yellow-500/10 text-yellow-700' : 'bg-red-500/10 text-red-600'}`}>
                            {score}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {new Date(r.consultado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="flex flex-col items-center py-10 gap-3 text-center">
            <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center">
              <ShieldCheck size={28} className="text-primary/40" />
            </div>
            <div>
              <p className="font-semibold">Consulte CPF ou CNPJ</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                Score, negativações, protestos, renda estimada e muito mais
              </p>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 w-full max-w-[360px]">
              {[
                { label: 'Score de crédito', icon: BarChart3 },
                { label: 'Negativações', icon: AlertCircle },
                { label: 'Protestos', icon: CreditCard },
                { label: 'Endereços', icon: MapPin },
                { label: 'Telefones', icon: Phone },
                { label: 'Renda Estimada', icon: ShieldCheck },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-left">
                  <Icon size={14} className="text-muted-foreground mb-1" />
                  <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Relatório */}
      {relatorio && !loading && (
        <>
          <RelatorioView relatorio={relatorio} />

          {/* Ações pós-consulta */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button onClick={irParaCadastro} className="flex-1">
              <UserPlus size={16} />
              Cadastrar como Cliente
            </Button>
            <Button variant="outline" onClick={nova}>
              <RotateCcw size={16} />
              Nova Consulta
            </Button>
          </div>
        </>
      )}
    </AppShell>
  )
}
