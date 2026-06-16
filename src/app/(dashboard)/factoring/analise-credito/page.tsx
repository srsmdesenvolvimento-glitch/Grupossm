'use client'

import { useState } from 'react'
import { Search, Loader2, AlertCircle, ShieldCheck, BarChart3, MapPin, Phone, CreditCard, UserPlus, RotateCcw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { RelatorioView } from '@/components/factoring/analise-credito/RelatorioView'
import { buscarRelatorioAssertiva, detectarTipo, maskDoc, formatCpf, formatCnpj } from '@/lib/assertiva/client'
import type { RelatorioCompleto } from '@/lib/assertiva/types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function AnaliseCreditoPage() {
  const router = useRouter()
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [relatorio, setRelatorio]   = useState<RelatorioCompleto | null>(null)
  const [erro, setErro]             = useState<string | null>(null)

  function handleInput(v: string) {
    setInput(maskDoc(v))
    setErro(null)
  }

  async function analisar() {
    const doc  = input.replace(/\D/g, '')
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
    if (data) setRelatorio(data)
  }

  function irParaCadastro() {
    if (!relatorio) return
    const doc = relatorio.tipo === 'pf'
      ? formatCpf(relatorio.documento)
      : formatCnpj(relatorio.documento)
    const nome = relatorio.nome ?? relatorio.razao_social ?? ''
    router.push(`/factoring/clientes/novo?cpf=${relatorio.documento}&nome=${encodeURIComponent(nome)}&from=analise-credito`)
  }

  function nova() {
    setRelatorio(null)
    setInput('')
    setErro(null)
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
          <Button onClick={analisar} disabled={loading || !input.trim()}>
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

      {/* Empty state */}
      {!loading && !relatorio && !erro && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center">
            <ShieldCheck size={36} className="text-primary/40" />
          </div>
          <div>
            <p className="font-semibold">Consulte CPF ou CNPJ</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
              Acesse score, negativações, protestos, renda estimada e muito mais
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 w-full max-w-[360px]">
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
