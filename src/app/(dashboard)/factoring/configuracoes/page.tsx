'use client'

import { useState, useEffect, useCallback } from 'react'
import { parseBRL, formatBRL, handleCurrencyChange } from '@/lib/utils/currency'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { LoadingPage } from '@/components/shared/LoadingPage'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import type { ConfigFactoring } from '@/lib/types/database'
import { Settings, Award, MessageSquare, Bell, AlertCircle, Clock, Wallet, Copy, FileCheck, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const DEFAULT_TEMPLATES = {
  contrato_criado: `🏦 *SRS M FACTORING — CONTRATO APROVADO* ✅

Olá, *{{nome}}*! Ótimas notícias!

Seu contrato de crédito foi aprovado e gerado com sucesso.

📋 *Dados do Contrato:*
• Nº: {{numero_contrato}}
• Valor Liberado: *{{valor_principal}}*

✍️ *Assine agora (link exclusivo):*
{{link_assinatura}}

ℹ️ A assinatura é digital, segura e tem validade jurídica.

_SRS M Factoring — Crédito com Responsabilidade_`,

  contrato_assinado: `✅ *CONTRATO ASSINADO — SRS M FACTORING*

Olá, *{{nome}}*!

Seu contrato *{{numero_contrato}}* foi assinado digitalmente com sucesso. O documento tem plena validade jurídica conforme MP 2.200-2/2001.

📄 *Acesse e salve seu contrato:*
{{link_contrato}}

Dúvidas? Estamos à disposição.
_SRS M Factoring_`,

  lembrete_pre_vencimento: `🔔 *LEMBRETE DE VENCIMENTO — SRS M FACTORING*

Olá, *{{nome}}*!

Sua parcela vence em *{{dias_antes}} dias*. Não esqueça!

📋 *Detalhes:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Vencimento: *{{data_vencimento}}*
• Valor: *{{valor}}*

💳 *Pague via PIX:*
\`{{whatsapp_padrao}}\`

Pagando antes do vencimento você evita encargos. 😊

_SRS M Factoring — Financeiro_`,

  lembrete_vencimento: `📅 *PARCELA VENCE HOJE — SRS M FACTORING*

Olá, *{{nome}}*!

⚠️ Sua parcela vence *HOJE*. Evite multa e juros efetuando o pagamento.

📋 *Detalhes:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Valor: *{{valor}}*

💳 *Pague agora via PIX:*
\`{{whatsapp_padrao}}\`

Após o vencimento são cobrados multa + juros diários.
_SRS M Factoring — Setor Financeiro_`,

  cobranca_pos_vencimento: `⚠️ *PARCELA EM ATRASO — SRS M FACTORING*

Olá, *{{nome}}*.

Identificamos que há parcela(s) em aberto no seu contrato.

📋 *Situação atual:*
• Contrato: {{numero_contrato}}
• Parcela: {{numero_parcela}}/{{total_parcelas}}
• Vencimento: {{data_vencimento}}
• ⏱ Dias em atraso: *{{dias_atraso}} dias*

💰 *Valores atualizados:*
• Valor original: {{valor}}
• Multa: +{{multa}}
• Juros acumulados: +{{juros_mora}}
• *Total a pagar: {{valor_total}}*

💳 *Regularize via PIX:*
\`{{whatsapp_padrao}}\`

⚡ Os juros aumentam a cada dia. Regularize o quanto antes.

_SRS M Factoring — Departamento de Cobranças_`,
}
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { REGRAS_SCORE_PADRAO, type RegraScore } from '@/lib/utils/calculos'

export default function ConfiguracoesFactoringPage() {
  const supabase = createClient()
  const { empresaAtual, loading: ctxLoading } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ConfigFactoring | null>(null)

  // Financeiro
  const [taxaJurosPadrao, setTaxaJurosPadrao] = useState('5')
  const [saldoInicialCaixa, setSaldoInicialCaixa] = useState('0,00')

  // Score Engine Configurations
  const [regrasScore, setRegrasScore] = useState<RegraScore[]>([])
  const [salvandoScore, setSalvandoScore] = useState(false)

  const toggleRegraScore = (regraId: string) => {
    setRegrasScore(prev => prev.map(r => r.id === regraId ? { ...r, ativo: !r.ativo } : r))
  }

  const changePesoScore = (regraId: string, peso: number) => {
    setRegrasScore(prev => prev.map(r => r.id === regraId ? { ...r, peso } : r))
  }

  const changeMaxScore = (regraId: string, max: number) => {
    setRegrasScore(prev => prev.map(r => r.id === regraId ? { ...r, limite_maximo_pontos: max } : r))
  }

  async function salvarScore() {
    if (!empresaAtual) return
    setSalvandoScore(true)
    try {
      const { error } = await supabase
        .from('config_factoring')
        .upsert({
          empresa_id: empresaAtual.id,
          regras_score: regrasScore,
          taxa_juros_padrao: parseFloat(taxaJurosPadrao.replace(',', '.')) || 5,
          multa_atraso: parseFloat(multaAtraso.replace(',', '.')) || 2,
          saldo_inicial_caixa: parseBRL(saldoInicialCaixa),
        }, { onConflict: 'empresa_id' })

      if (error) throw error
      toast.success('Motor de Score atualizado com sucesso!')
    } catch (err) {
      console.error('Erro ao salvar score:', err)
      toast.error('Erro ao salvar configurações do score')
    } finally {
      setSalvandoScore(false)
    }
  }

  // Empresa
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaTelefone, setEmpresaTelefone] = useState('')
  const [empresaEmail, setEmpresaEmail] = useState('')
  const [empresaEndereco, setEmpresaEndereco] = useState('')
  const [empresaCidade, setEmpresaCidade] = useState('')
  const [empresaEstado, setEmpresaEstado] = useState('')
  const [empresaCep, setEmpresaCep] = useState('')
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)

  // WhatsApp & Cobranças
  const [pixChave, setPixChave] = useState('')
  const [multaAtraso, setMultaAtraso] = useState('2')
  const [horaEnvio, setHoraEnvio] = useState('09:00')
  const [diasPreVencimento, setDiasPreVencimento] = useState('3')
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false)
  const [msgContratoCriado, setMsgContratoCriado] = useState({ ativo: true, template: DEFAULT_TEMPLATES.contrato_criado })
  const [msgContratoAssinado, setMsgContratoAssinado] = useState({ ativo: true, template: DEFAULT_TEMPLATES.contrato_assinado })
  const [msgPreVencimento, setMsgPreVencimento] = useState({ ativo: true, template: DEFAULT_TEMPLATES.lembrete_pre_vencimento })
  const [msgVencimento, setMsgVencimento] = useState({ ativo: true, template: DEFAULT_TEMPLATES.lembrete_vencimento })
  const [msgPosVencimento, setMsgPosVencimento] = useState({ ativo: true, template: DEFAULT_TEMPLATES.cobranca_pos_vencimento })


  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const client = createClient()
      const [configRes] = await Promise.all([
        client
          .from('config_factoring')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
      ])

      if (configRes.data) {
        const c = configRes.data as any
        setConfig(c)
        setTaxaJurosPadrao(String(c.taxa_juros_padrao))
        setSaldoInicialCaixa(formatBRL(Number(c.saldo_inicial_caixa ?? 0)))
        setRegrasScore(c.regras_score || REGRAS_SCORE_PADRAO)

        // WhatsApp settings
        setPixChave(c.whatsapp_padrao ?? '')
        setMultaAtraso(String(c.multa_atraso ?? 2))
        const ws = c.whatsapp_settings || {}
        setHoraEnvio(ws.hora_envio ?? '09:00')
        setDiasPreVencimento(String(ws.lembrete_pre_vencimento?.dias_antes ?? 3))
        setMsgContratoCriado({ ativo: ws.contrato_criado?.ativo ?? true, template: ws.contrato_criado?.template || DEFAULT_TEMPLATES.contrato_criado })
        setMsgContratoAssinado({ ativo: ws.contrato_assinado?.ativo ?? true, template: ws.contrato_assinado?.template || DEFAULT_TEMPLATES.contrato_assinado })
        setMsgPreVencimento({ ativo: ws.lembrete_pre_vencimento?.ativo ?? true, template: ws.lembrete_pre_vencimento?.template || DEFAULT_TEMPLATES.lembrete_pre_vencimento })
        setMsgVencimento({ ativo: ws.lembrete_vencimento?.ativo ?? true, template: ws.lembrete_vencimento?.template || DEFAULT_TEMPLATES.lembrete_vencimento })
        setMsgPosVencimento({ ativo: ws.cobranca_pos_vencimento?.ativo ?? true, template: ws.cobranca_pos_vencimento?.template || DEFAULT_TEMPLATES.cobranca_pos_vencimento })
      } else {
        setRegrasScore(REGRAS_SCORE_PADRAO)
      }

    } catch {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual])

  useEffect(() => {
    if (!ctxLoading && empresaAtual) {
      carregarDados()
      setEmpresaNome(empresaAtual.nome ?? '')
      setEmpresaCnpj(empresaAtual.cnpj ?? '')
      setEmpresaTelefone(empresaAtual.telefone ?? '')
      setEmpresaEmail(empresaAtual.email ?? '')
      setEmpresaEndereco(empresaAtual.endereco ?? '')
      setEmpresaCidade(empresaAtual.cidade ?? '')
      setEmpresaEstado(empresaAtual.estado ?? '')
      setEmpresaCep(empresaAtual.cep ?? '')
    }
  }, [ctxLoading, empresaAtual, carregarDados])

  async function salvarFinanceiro() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const basePayload = {
        empresa_id: empresaAtual.id,
        taxa_juros_padrao: parseFloat(taxaJurosPadrao.replace(',', '.')) || 5,
        multa_atraso: parseFloat(multaAtraso.replace(',', '.')) || 2,
        tipo_taxa_padrao: config?.tipo_taxa_padrao ?? 'mensal',
        dias_carencia: config?.dias_carencia ?? 0,
        prazo_minimo_meses: config?.prazo_minimo_meses ?? 3,
        prazo_maximo_meses: config?.prazo_maximo_meses ?? 60,
        valor_minimo_emprestimo: config?.valor_minimo_emprestimo ?? 500,
        valor_maximo_emprestimo: config?.valor_maximo_emprestimo ?? 50000,
        whatsapp_padrao: config?.whatsapp_padrao ?? null,
        prefixo_contrato: config?.prefixo_contrato ?? 'FAC',
      }

      // Try with saldo; fall back without if column not in DB yet
      const { error: errComSaldo } = await supabase
        .from('config_factoring')
        .upsert({ ...basePayload, saldo_inicial_caixa: parseBRL(saldoInicialCaixa) }, { onConflict: 'empresa_id' })

      if (errComSaldo) {
        const { error: errSemSaldo } = await supabase
          .from('config_factoring')
          .upsert(basePayload, { onConflict: 'empresa_id' })
        if (errSemSaldo) throw errSemSaldo
        toast.success('Configurações salvas! (rode a migration add_saldo_inicial_caixa.sql para habilitar o saldo de caixa)')
      } else {
        toast.success('Configurações salvas!')
      }

      await carregarDados()
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err)
      toast.error(`Erro ao salvar: ${err?.message ?? 'verifique o console'}`)
    } finally {
      setSaving(false)
    }
  }

  async function salvarEmpresa() {
    if (!empresaAtual) return
    setSalvandoEmpresa(true)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome: empresaNome,
          cnpj: empresaCnpj,
          telefone: empresaTelefone,
          email: empresaEmail,
          endereco: empresaEndereco,
          cidade: empresaCidade,
          estado: empresaEstado.slice(0, 2).toUpperCase(),
          cep: empresaCep,
        })
        .eq('id', empresaAtual.id)
      if (error) throw error
      toast.success('Configurações da empresa atualizadas!')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar configurações da empresa')
    } finally {
      setSalvandoEmpresa(false)
    }
  }

  async function salvarWhatsapp() {
    if (!empresaAtual) return
    setSalvandoWhatsapp(true)
    try {
      const whatsappSettings = {
        hora_envio: horaEnvio,
        contrato_criado: { ativo: msgContratoCriado.ativo, template: msgContratoCriado.template },
        contrato_assinado: { ativo: msgContratoAssinado.ativo, template: msgContratoAssinado.template },
        lembrete_pre_vencimento: { ativo: msgPreVencimento.ativo, template: msgPreVencimento.template, dias_antes: parseInt(diasPreVencimento) || 3 },
        lembrete_vencimento: { ativo: msgVencimento.ativo, template: msgVencimento.template },
        cobranca_pos_vencimento: { ativo: msgPosVencimento.ativo, template: msgPosVencimento.template },
      }
      const { error } = await supabase
        .from('config_factoring')
        .upsert({
          empresa_id: empresaAtual.id,
          whatsapp_padrao: pixChave,
          multa_atraso: parseFloat(multaAtraso) || 2,
          whatsapp_settings: whatsappSettings,
        }, { onConflict: 'empresa_id' })
      if (error) throw error
      toast.success('Configurações de WhatsApp e cobranças salvas!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar configurações de WhatsApp')
    } finally {
      setSalvandoWhatsapp(false)
    }
  }

  if (ctxLoading || loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Configurações">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader 
          titulo="Configurações" 
          descricao="Defina os parâmetros operacionais e permissões da factoring" 
          icone={Settings}
          corIcone="var(--gt-blue)"
        />

        <Tabs defaultValue="financeiro" className="w-full">
          <TabsList className="mb-6 bg-muted/20 border border-border/40 h-auto gap-2 p-1.5 rounded-full w-full sm:w-auto">
            <TabsTrigger 
              value="financeiro" 
              className="rounded-full px-5 py-2 font-bold text-xs tracking-tight transition-all duration-200 data-[state=active]:bg-[var(--gt-blue)] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger 
              value="empresa" 
              className="rounded-full px-5 py-2 font-bold text-xs tracking-tight transition-all duration-200 data-[state=active]:bg-[var(--gt-blue)] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Empresa
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="rounded-full px-5 py-2 font-bold text-xs tracking-tight transition-all duration-200 data-[state=active]:bg-[var(--gt-blue)] data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5"
            >
              <MessageSquare size={13} />
              WhatsApp & Cobranças
            </TabsTrigger>
            <TabsTrigger
              value="score"
              className="rounded-full px-5 py-2 font-bold text-xs tracking-tight transition-all duration-200 data-[state=active]:bg-[var(--gt-blue)] data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center gap-1.5"
            >
              <Award size={13} />
              Motor de Score
            </TabsTrigger>
          </TabsList>

          {/* ── Financeiro ── */}
          <TabsContent value="financeiro">
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">Taxas Operacionais</h2>
                <p className="text-sm text-muted-foreground mt-1">Defina as taxas padrão aplicadas nos contratos de factoring.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-border/40 pt-5">
                <div className="space-y-2">
                  <Label htmlFor="taxa-juros" className="font-semibold text-xs text-foreground/80">Taxa de juros padrão (% a.m.)</Label>
                  <Input
                    id="taxa-juros"
                    inputMode="decimal"
                    value={taxaJurosPadrao}
                    onChange={e => setTaxaJurosPadrao(e.target.value)}
                    placeholder="5"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Taxa padrão aplicada ao criar um novo empréstimo.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxa-atraso" className="font-semibold text-xs text-foreground/80">Taxa de atraso diária (% a.d.)</Label>
                  <Input
                    id="taxa-atraso"
                    inputMode="decimal"
                    value={multaAtraso}
                    onChange={e => setMultaAtraso(e.target.value)}
                    placeholder="2"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Cobrada a partir do 1º dia de atraso, com juros compostos (sobre juros) a cada dia.</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="saldo-inicial" className="font-semibold text-xs text-foreground/80">Saldo inicial do caixa (R$)</Label>
                  <Input
                    id="saldo-inicial"
                    inputMode="numeric"
                    value={saldoInicialCaixa}
                    onChange={e => setSaldoInicialCaixa(handleCurrencyChange(e.target.value))}
                    placeholder="0,00"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Valor de partida do caixa — base para o saldo atual exibido no dashboard e fluxo.</p>
                </div>
              </div>

              <div className="flex justify-end border-t border-border/40 pt-5">
                <Button 
                  onClick={salvarFinanceiro} 
                  disabled={saving} 
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-6 font-medium shadow-sm transition-all duration-200"
                >
                  {saving ? 'Salvando...' : 'Salvar Financeiro'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Empresa ── */}
          <TabsContent value="empresa">
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">Dados da Empresa</h2>
                <p className="text-sm text-muted-foreground mt-1">Essas informações aparecerão no cabeçalho de todos os contratos, recibos e termos gerados pelo sistema.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-border/40 pt-5">
                <div className="space-y-2">
                  <Label htmlFor="empresa-nome" className="font-semibold text-xs text-foreground/80">Nome Fantasia / Razão Social</Label>
                  <Input
                    id="empresa-nome"
                    value={empresaNome}
                    onChange={e => setEmpresaNome(e.target.value)}
                    placeholder="Ex: SRS M Factoring Ltda"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa-cnpj" className="font-semibold text-xs text-foreground/80">CNPJ</Label>
                  <Input
                    id="empresa-cnpj"
                    value={empresaCnpj}
                    onChange={e => setEmpresaCnpj(e.target.value)}
                    placeholder="Ex: 21.707.455/0001-11"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa-telefone" className="font-semibold text-xs text-foreground/80">Telefone para Contato</Label>
                  <Input
                    id="empresa-telefone"
                    value={empresaTelefone}
                    onChange={e => setEmpresaTelefone(e.target.value)}
                    placeholder="Ex: (62) 98560-6974"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa-email" className="font-semibold text-xs text-foreground/80">E-mail Comercial</Label>
                  <Input
                    id="empresa-email"
                    type="email"
                    value={empresaEmail}
                    onChange={e => setEmpresaEmail(e.target.value)}
                    placeholder="Ex: contato@srsm.com"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="empresa-endereco" className="font-semibold text-xs text-foreground/80">Endereço Comercial</Label>
                  <Input
                    id="empresa-endereco"
                    value={empresaEndereco}
                    onChange={e => setEmpresaEndereco(e.target.value)}
                    placeholder="Ex: Rua Três Marias, Quadra 10, Lote 02"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empresa-cep" className="font-semibold text-xs text-foreground/80">CEP</Label>
                  <Input
                    id="empresa-cep"
                    value={empresaCep}
                    onChange={e => setEmpresaCep(e.target.value)}
                    placeholder="Ex: 74465-445"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="empresa-cidade" className="font-semibold text-xs text-foreground/80">Cidade</Label>
                    <Input
                      id="empresa-cidade"
                      value={empresaCidade}
                      onChange={e => setEmpresaCidade(e.target.value)}
                      placeholder="Goiânia"
                      className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa-estado" className="font-semibold text-xs text-foreground/80">UF</Label>
                    <Input
                      id="empresa-estado"
                      maxLength={2}
                      value={empresaEstado}
                      onChange={e => setEmpresaEstado(e.target.value)}
                      placeholder="GO"
                      className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] text-center uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-border/40 pt-5">
                <Button 
                  onClick={salvarEmpresa} 
                  disabled={salvandoEmpresa} 
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-6 font-medium shadow-sm transition-all duration-200"
                >
                  {salvandoEmpresa ? 'Salvando...' : 'Salvar Dados da Empresa'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── WhatsApp & Cobranças ── */}
          <TabsContent value="whatsapp">
            <div className="space-y-6">

              {/* PIX + Multa + Horário */}
              <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Wallet size={16} className="text-[var(--gt-blue)]" />
                    Dados de Recebimento e Encargos
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Configure a chave PIX para pagamento e os encargos por atraso que aparecem nas mensagens.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-border/40 pt-5">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="font-semibold text-xs text-foreground/80">Chave PIX para recebimento</Label>
                    <div className="relative">
                      <Input
                        value={pixChave}
                        onChange={e => setPixChave(e.target.value)}
                        placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                        className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(pixChave); toast.success('Chave PIX copiada!') }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/60">Esta chave aparece em todas as mensagens de cobrança como {`{{whatsapp_padrao}}`}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-xs text-foreground/80">Horário de envio automático</Label>
                    <Input
                      type="time"
                      value={horaEnvio}
                      onChange={e => setHoraEnvio(e.target.value)}
                      className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                    />
                    <p className="text-xs text-muted-foreground/60">Hora de Brasília para disparar cobranças automáticas.</p>
                  </div>
                </div>
              </div>

              {/* Variáveis disponíveis */}
              <div className="bg-muted/20 rounded-2xl border border-border/40 p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Variáveis disponíveis nos templates</p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {[
                    ['{{nome}}','Nome do cliente'],
                    ['{{numero_contrato}}','Nº do contrato'],
                    ['{{numero_parcela}}','Nº da parcela'],
                    ['{{total_parcelas}}','Total de parcelas'],
                    ['{{data_vencimento}}','Data de vencimento'],
                    ['{{valor}}','Valor da parcela'],
                    ['{{valor_total}}','Total com encargos'],
                    ['{{multa}}','Multa de atraso'],
                    ['{{juros_mora}}','Juros acumulados'],
                    ['{{dias_atraso}}','Dias em atraso'],
                    ['{{dias_antes}}','Dias antes do vencimento'],
                    ['{{whatsapp_padrao}}','Chave PIX acima'],
                    ['{{link_assinatura}}','Link do contrato p/ assinar'],
                    ['{{link_contrato}}','Link do PDF assinado'],
                  ].map(([v, d]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(v); toast.success(`${v} copiado!`) }}
                      className="flex items-center gap-1 bg-card border border-border/50 rounded-lg px-2 py-1 font-mono hover:border-[var(--gt-blue)] hover:text-[var(--gt-blue)] transition-colors"
                      title={d}
                    >
                      <Copy size={9} className="shrink-0" />
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Templates de mensagem */}
              {([
                { key: 'contrato_criado', icon: FileCheck, label: 'Contrato Criado / Link de Assinatura', desc: 'Enviado automaticamente ao criar um novo empréstimo.', state: msgContratoCriado, setState: setMsgContratoCriado, defaultTpl: DEFAULT_TEMPLATES.contrato_criado },
                { key: 'contrato_assinado', icon: FileCheck, label: 'Contrato Assinado com Sucesso', desc: 'Enviado após o cliente assinar digitalmente o contrato.', state: msgContratoAssinado, setState: setMsgContratoAssinado, defaultTpl: DEFAULT_TEMPLATES.contrato_assinado },
                { key: 'pre_vencimento', icon: Bell, label: 'Lembrete Pré-Vencimento', desc: 'Enviado X dias antes do vencimento da parcela.', state: msgPreVencimento, setState: setMsgPreVencimento, defaultTpl: DEFAULT_TEMPLATES.lembrete_pre_vencimento, extra: (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground font-semibold whitespace-nowrap">Enviar com antecedência de:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={diasPreVencimento}
                      onChange={e => setDiasPreVencimento(e.target.value)}
                      className="w-20 h-8 text-xs text-center rounded-lg border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                    />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                )},
                { key: 'vencimento', icon: Clock, label: 'Alerta no Dia do Vencimento', desc: 'Enviado no próprio dia do vencimento da parcela.', state: msgVencimento, setState: setMsgVencimento, defaultTpl: DEFAULT_TEMPLATES.lembrete_vencimento },
                { key: 'pos_vencimento', icon: AlertCircle, label: 'Cobrança Pós-Vencimento (Diária)', desc: 'Enviada todos os dias após o vencimento com valores atualizados (multa + juros).', state: msgPosVencimento, setState: setMsgPosVencimento, defaultTpl: DEFAULT_TEMPLATES.cobranca_pos_vencimento },
              ] as any[]).map(({ icon: Icon, label, desc, state, setState, defaultTpl, extra }) => (
                <div key={label} className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--gt-blue)]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={16} className="text-[var(--gt-blue)]" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={state.ativo}
                      onCheckedChange={(v: boolean) => setState((p: any) => ({ ...p, ativo: v }))}
                    />
                  </div>

                  {extra && <div className="pl-12">{extra}</div>}

                  <div className={cn('space-y-2 pl-12 transition-opacity', !state.ativo && 'opacity-40 pointer-events-none')}>
                    <Textarea
                      value={state.template}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setState((p: any) => ({ ...p, template: e.target.value }))}
                      rows={10}
                      className="text-xs font-mono resize-y rounded-xl border-border/60 bg-card focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)] leading-relaxed"
                      placeholder="Template da mensagem..."
                    />
                    <button
                      type="button"
                      onClick={() => setState((p: any) => ({ ...p, template: defaultTpl }))}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-[var(--gt-blue)] transition-colors"
                    >
                      <RefreshCw size={10} />
                      Restaurar template padrão
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button
                  onClick={salvarWhatsapp}
                  disabled={salvandoWhatsapp}
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-6 font-medium shadow-sm transition-all duration-200"
                >
                  {salvandoWhatsapp ? 'Salvando...' : 'Salvar WhatsApp & Cobranças'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Motor de Score ── */}
          <TabsContent value="score">
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Parametrização do Score</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ative, desative e ajuste os pesos de cada fator que compõe a análise de risco dos clientes.
                  </p>
                </div>
                <Button 
                  onClick={salvarScore} 
                  disabled={salvandoScore} 
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-6 font-medium shadow-sm transition-all duration-200 shrink-0"
                >
                  {salvandoScore ? 'Salvando...' : 'Salvar Regras de Score'}
                </Button>
              </div>

              <div className="border-t border-border/40 pt-5 space-y-8">
                {/* Agrupa por Categoria */}
                {['historico_pagamento', 'historico_contrato', 'relacionamento', 'cadastro', 'inadimplencia', 'bureau', 'compliance', 'status'].map(cat => {
                  const regrasDaCat = regrasScore.filter(r => r.categoria === cat)
                  if (regrasDaCat.length === 0) return null

                  let catLabel = ''
                  switch(cat) {
                    case 'historico_pagamento': catLabel = 'Histórico de Pagamento'; break;
                    case 'historico_contrato': catLabel = 'Histórico de Contrato'; break;
                    case 'relacionamento': catLabel = 'Relacionamento Comercial'; break;
                    case 'cadastro': catLabel = 'Ficha Cadastral'; break;
                    case 'inadimplencia': catLabel = 'Inadimplência Interna'; break;
                    case 'bureau': catLabel = 'Bureau de Crédito (Assertiva)'; break;
                    case 'compliance': catLabel = 'Compliance e Restrições'; break;
                    case 'status': catLabel = 'Status Administrativo'; break;
                    default: catLabel = cat;
                  }

                  return (
                    <div key={cat} className="space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg w-fit">
                        {catLabel}
                      </h3>
                      
                      <div className="space-y-2.5">
                        {regrasDaCat.map(r => (
                          <div 
                            key={r.id} 
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-4",
                              r.ativo 
                                ? "bg-card border-border/80" 
                                : "bg-muted/15 border-border/30 opacity-60"
                            )}
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">{r.label}</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase",
                                  r.tipo === 'positivo' 
                                    ? "bg-[var(--gt-green-light)] text-[var(--gt-green)]" 
                                    : "bg-red-500/10 text-red-500"
                                )}>
                                  {r.tipo === 'positivo' ? 'Bônus (+)' : 'Penalidade (-)'}
                                </span>
                                {r.categoria.startsWith('bureau') || r.categoria.startsWith('compliance') ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-500/10 text-indigo-500">
                                    Assertiva API
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600">
                                    Interno
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-normal">{r.descricao}</p>
                            </div>

                            <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                              {/* Peso */}
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor={`peso-${r.id}`} className="text-[10px] font-bold text-muted-foreground uppercase">Peso:</Label>
                                <Input
                                  id={`peso-${r.id}`}
                                  type="number"
                                  value={r.peso}
                                  onChange={e => changePesoScore(r.id, parseInt(e.target.value) || 0)}
                                  disabled={!r.ativo}
                                  className="w-16 h-8 text-xs font-bold text-center rounded-lg bg-card focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                                />
                              </div>

                              {/* Limite Máximo */}
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor={`max-${r.id}`} className="text-[10px] font-bold text-muted-foreground uppercase">Máx:</Label>
                                <Input
                                  id={`max-${r.id}`}
                                  type="number"
                                  value={r.limite_maximo_pontos}
                                  onChange={e => changeMaxScore(r.id, Math.abs(parseInt(e.target.value)) || 0)}
                                  disabled={!r.ativo}
                                  className="w-16 h-8 text-xs font-bold text-center rounded-lg bg-card focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                                />
                              </div>

                              {/* Toggle Ativo */}
                              <button
                                type="button"
                                onClick={() => toggleRegraScore(r.id)}
                                className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 border w-20",
                                  r.ativo 
                                    ? "bg-[var(--gt-green-light)] text-[var(--gt-green)] border-[var(--gt-green-light)] hover:bg-[var(--gt-green-light)]/85" 
                                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                )}
                              >
                                {r.ativo ? 'Ativo' : 'Inativo'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end border-t border-border/40 pt-5">
                <Button 
                  onClick={salvarScore} 
                  disabled={salvandoScore} 
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-6 font-medium shadow-sm transition-all duration-200"
                >
                  {salvandoScore ? 'Salvando...' : 'Salvar Regras de Score'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

    </AppShell>
  )
}
