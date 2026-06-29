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
import { Settings, Award } from 'lucide-react'
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
      // Se a config já existe → UPDATE simples (evita NOT NULL violations do upsert insert)
      // Se não existe → INSERT com defaults financeiros
      const { error } = config
        ? await supabase
            .from('config_factoring')
            .update({ regras_score: regrasScore })
            .eq('empresa_id', empresaAtual.id)
        : await supabase
            .from('config_factoring')
            .insert({
              empresa_id: empresaAtual.id,
              regras_score: regrasScore,
              taxa_juros_padrao: 5,
              tipo_taxa_padrao: 'mensal',
              dias_carencia: 0,
              prazo_minimo_meses: 3,
              prazo_maximo_meses: 60,
              valor_minimo_emprestimo: 500,
              valor_maximo_emprestimo: 50000,
              multa_atraso: 2,
              juros_mora_diario: 0.0333,
            })

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

  // WhatsApp & Cobranças (apenas campos financeiros — templates movidos para /mensagens/conexao)
  const [multaAtraso, setMultaAtraso] = useState('2')
  const [jurosMoraDiario, setJurosMoraDiario] = useState('0.0333')


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
        setMultaAtraso(String(c.multa_atraso ?? 2))
        setJurosMoraDiario(String(c.juros_mora_diario ?? 0.0333))
        // Merge: preserva pesos/ativo salvos pelo usuário e inclui regras novas com defaults
        const dbRules: RegraScore[] = Array.isArray(c.regras_score) ? c.regras_score : []
        const merged = REGRAS_SCORE_PADRAO.map(def => {
          const saved = dbRules.find(r => r.id === def.id)
          return saved ? { ...def, peso: saved.peso, ativo: saved.ativo, limite_maximo_pontos: saved.limite_maximo_pontos } : def
        })
        setRegrasScore(merged)
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
        juros_mora_diario: parseFloat(jurosMoraDiario.replace(',', '.')) || 0.0333,
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
                  <p className="text-xs text-muted-foreground/60 leading-normal">Taxa mensal pré-selecionada ao criar novo contrato (juros compostos — tabela Price).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxa-multa" className="font-semibold text-xs text-foreground/80">Multa por atraso (%)</Label>
                  <Input
                    id="taxa-multa"
                    inputMode="decimal"
                    value={multaAtraso}
                    onChange={e => setMultaAtraso(e.target.value)}
                    placeholder="2"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Percentual fixo cobrado uma única vez quando a parcela atrasa (ex: 2%).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="juros-mora" className="font-semibold text-xs text-foreground/80">Juros de mora diário (% a.d.)</Label>
                  <Input
                    id="juros-mora"
                    inputMode="decimal"
                    value={jurosMoraDiario}
                    onChange={e => setJurosMoraDiario(e.target.value)}
                    placeholder="0.0333"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Juros sobre juros (compostos) cobrados a cada dia de atraso. Padrão: 0,0333% a.d. ≈ 1% a.m.</p>
                </div>

                <div className="space-y-2">
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
                {['historico_pagamento', 'historico_contrato', 'relacionamento', 'capacidade', 'cadastro', 'inadimplencia', 'bureau', 'compliance', 'status'].map(cat => {
                  const regrasDaCat = regrasScore.filter(r => r.categoria === cat)
                  if (regrasDaCat.length === 0) return null

                  let catLabel = ''
                  switch(cat) {
                    case 'historico_pagamento': catLabel = 'Histórico de Pagamento'; break;
                    case 'historico_contrato': catLabel = 'Histórico de Contrato'; break;
                    case 'relacionamento': catLabel = 'Relacionamento Comercial'; break;
                    case 'capacidade': catLabel = 'Capacidade de Pagamento'; break;
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
