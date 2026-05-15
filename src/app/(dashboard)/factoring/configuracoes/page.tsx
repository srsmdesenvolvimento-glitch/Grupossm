'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { VARIAVEIS_FACTORING, previewMensagem } from '@/lib/utils/mensagens'
import type { ConfigFactoring, Empresa, PapelUsuario, TipoTaxa } from '@/lib/types/database'
import { UserPlus, Trash2, TrendingUp, TrendingDown, Sliders } from 'lucide-react'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import {
  REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO, calcularScore,
  type RegraScore, type FaixaRisco, type DadosScore,
} from '@/lib/utils/calculos'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UsuarioRow = {
  ue_id: string
  usuario_id: string
  nome: string
  email: string
  papel: PapelUsuario
  ativo: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inserirVariavel(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  chave: string,
  setValue: (v: string) => void,
) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  const inserted = `{{${chave}}}`
  setValue(before + inserted + after)
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(start + inserted.length, start + inserted.length)
  }, 0)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TemplateEditorProps {
  label: string
  value: string
  onChange: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

function TemplateEditor({ label, value, onChange, textareaRef }: TemplateEditorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-700 font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {VARIAVEIS_FACTORING.map(v => (
          <button
            key={v.chave}
            type="button"
            title={v.descricao}
            onClick={() => inserirVariavel(textareaRef, v.chave, onChange)}
          >
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono border border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors">
              {'{{' + v.chave + '}}'}
            </span>
          </button>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        placeholder={`Digite o template de ${label.toLowerCase()}...`}
        className="font-mono text-sm resize-none"
      />
      {value && (
        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 whitespace-pre-wrap border border-slate-200">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Pré-visualização</p>
          {previewMensagem(value, 'factoring')}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ConfiguracoesFactoringPage() {
  const supabase = createClient()
  const { empresaAtual, loading: ctxLoading } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Config state
  const [config, setConfig] = useState<ConfigFactoring | null>(null)

  // Financeiro
  const [taxaJurosPadrao, setTaxaJurosPadrao] = useState('5')
  const [tipoTaxaPadrao, setTipoTaxaPadrao] = useState<TipoTaxa>('mensal')
  const [multaAtraso, setMultaAtraso] = useState('2')
  const [jurosMoraDiario, setJurosMoraDiario] = useState('0.033')
  const [diasCarencia, setDiasCarencia] = useState('0')
  const [prazoMinimoMeses, setPrazoMinimoMeses] = useState('3')
  const [prazoMaximoMeses, setPrazoMaximoMeses] = useState('60')
  const [valorMinimoEmprestimo, setValorMinimoEmprestimo] = useState('500')
  const [valorMaximoEmprestimo, setValorMaximoEmprestimo] = useState('50000')
  const [whatsappPadrao, setWhatsappPadrao] = useState('')

  // Score e Risco — configurable weights (persisted in localStorage)
  const [regras, setRegras] = useState<RegraScore[]>(REGRAS_SCORE_PADRAO)
  const [faixas, setFaixas] = useState<FaixaRisco[]>(FAIXAS_RISCO_PADRAO)
  const [simDados, setSimDados] = useState<DadosScore>({
    total_parcelas: 12, pagas_pontualmente: 10, pagas_antecipado: 2,
    emprestimos_quitados: 1, parcelas_atrasadas_atuais: 0, max_dias_atraso: 0,
    cliente_bloqueado: false, cadastro_completo: true, volume_total_pago: 15000,
  })
  const [salvandoScore, setSalvandoScore] = useState(false)

  // Mensagens
  const [msgBoasVindas, setMsgBoasVindas] = useState('')
  const [msgAprovacao, setMsgAprovacao] = useState('')
  const [msgLiberacao, setMsgLiberacao] = useState('')
  const [msgVencimento, setMsgVencimento] = useState('')
  const [msgCobranca, setMsgCobranca] = useState('')
  const [msgQuitacao, setMsgQuitacao] = useState('')

  // Refs for message textareas
  const refBoasVindas = useRef<HTMLTextAreaElement | null>(null)
  const refAprovacao = useRef<HTMLTextAreaElement | null>(null)
  const refLiberacao = useRef<HTMLTextAreaElement | null>(null)
  const refVencimento = useRef<HTMLTextAreaElement | null>(null)
  const refCobranca = useRef<HTMLTextAreaElement | null>(null)
  const refQuitacao = useRef<HTMLTextAreaElement | null>(null)

  // Contrato
  const [prefixoContrato, setPrefixoContrato] = useState('FAC')
  const [totalContratos, setTotalContratos] = useState(0)

  // Empresa
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefoneEmpresa, setTelefoneEmpresa] = useState('')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [enderecoEmpresa, setEnderecoEmpresa] = useState('')
  const [cidadeEmpresa, setCidadeEmpresa] = useState('')
  const [estadoEmpresa, setEstadoEmpresa] = useState('')

  // Usuários
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loadingUsuarios] = useState(false)
  const [dialogConvidar, setDialogConvidar] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoPapel, setNovoPapel] = useState<PapelUsuario>('operador')
  const [criandoUsuario, setCriandoUsuario] = useState(false)

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)

    try {
      const [configRes, empresaRes, usuariosRes, contratosRes] = await Promise.all([
        supabase
          .from('config_factoring')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
        supabase
          .from('empresas')
          .select('*')
          .eq('id', empresaAtual.id)
          .single(),
        supabase
          .from('usuario_empresa')
          .select('id, usuario_id, papel, ativo, usuarios(id, nome, email)')
          .eq('empresa_id', empresaAtual.id),
        supabase
          .from('emprestimos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaAtual.id),
      ])

      // Config
      if (configRes.data) {
        const c = configRes.data as ConfigFactoring
        setConfig(c)
        setTaxaJurosPadrao(String(c.taxa_juros_padrao))
        setTipoTaxaPadrao(c.tipo_taxa_padrao)
        setMultaAtraso(String(c.multa_atraso))
        setJurosMoraDiario(String(c.juros_mora_diario))
        setDiasCarencia(String(c.dias_carencia))
        setPrazoMinimoMeses(String(c.prazo_minimo_meses))
        setPrazoMaximoMeses(String(c.prazo_maximo_meses))
        setValorMinimoEmprestimo(String(c.valor_minimo_emprestimo))
        setValorMaximoEmprestimo(String(c.valor_maximo_emprestimo))
        setWhatsappPadrao(c.whatsapp_padrao ?? '')
        setPrefixoContrato(c.prefixo_contrato)
        setMsgBoasVindas(c.msg_boas_vindas ?? '')
        setMsgAprovacao(c.msg_aprovacao ?? '')
        setMsgLiberacao(c.msg_liberacao ?? '')
        setMsgVencimento(c.msg_vencimento ?? '')
        setMsgCobranca(c.msg_cobranca ?? '')
        setMsgQuitacao(c.msg_quitacao ?? '')
      }

      // Empresa
      if (empresaRes.data) {
        const e = empresaRes.data as Empresa
        setNomeEmpresa(e.nome)
        setCnpj(e.cnpj ?? '')
        setTelefoneEmpresa(e.telefone ?? '')
        setEmailEmpresa(e.email ?? '')
        setEnderecoEmpresa(e.endereco ?? '')
        setCidadeEmpresa(e.cidade ?? '')
        setEstadoEmpresa(e.estado ?? '')
      }

      // Usuários
      if (usuariosRes.data) {
        const rows: UsuarioRow[] = usuariosRes.data.map((ue) => {
          const u = ue.usuarios as unknown as { id: string; nome: string; email: string } | null
          return {
            ue_id: ue.id,
            usuario_id: ue.usuario_id,
            nome: u?.nome ?? '—',
            email: u?.email ?? '—',
            papel: ue.papel as PapelUsuario,
            ativo: ue.ativo,
          }
        })
        setUsuarios(rows)
      }

      // Total contratos
      if (contratosRes.count !== null) {
        setTotalContratos(contratosRes.count)
      }
    } catch {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, supabase])

  useEffect(() => {
    if (!ctxLoading && empresaAtual) {
      carregarDados()
      // Load score config from localStorage
      try {
        const saved = localStorage.getItem(`score_config_${empresaAtual.id}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.regras) setRegras(parsed.regras)
          if (parsed.faixas) setFaixas(parsed.faixas)
        }
      } catch { /* ignore */ }
    }
  }, [ctxLoading, empresaAtual, carregarDados])

  // ---------------------------------------------------------------------------
  // Helpers for upsert
  // ---------------------------------------------------------------------------

  function buildBasePayload() {
    return {
      empresa_id: empresaAtual!.id,
      whatsapp_padrao: whatsappPadrao.trim() || null,
      prefixo_contrato: prefixoContrato.trim() || 'FAC',
      taxa_juros_padrao: parseFloat(taxaJurosPadrao) || 5,
      tipo_taxa_padrao: tipoTaxaPadrao,
      prazo_minimo_meses: parseInt(prazoMinimoMeses, 10) || 3,
      prazo_maximo_meses: parseInt(prazoMaximoMeses, 10) || 60,
      valor_minimo_emprestimo: parseFloat(valorMinimoEmprestimo) || 500,
      valor_maximo_emprestimo: parseFloat(valorMaximoEmprestimo) || 50000,
      dias_carencia: parseInt(diasCarencia, 10) || 0,
      multa_atraso: parseFloat(multaAtraso) || 2,
      juros_mora_diario: parseFloat(jurosMoraDiario) || 0.033,
      msg_aprovacao: msgAprovacao.trim() || null,
      msg_liberacao: msgLiberacao.trim() || null,
      msg_vencimento: msgVencimento.trim() || null,
      msg_cobranca: msgCobranca.trim() || null,
      msg_quitacao: msgQuitacao.trim() || null,
      msg_boas_vindas: msgBoasVindas.trim() || null,
    }
  }

  async function upsertConfig(partial: Partial<ReturnType<typeof buildBasePayload>>) {
    if (!empresaAtual) return

    const payload = { ...buildBasePayload(), ...partial }

    if (config) {
      const { error } = await supabase
        .from('config_factoring')
        .update(payload)
        .eq('id', config.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('config_factoring')
        .insert(payload)
      if (error) throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  async function salvarFinanceiro() {
    setSaving(true)
    try {
      await upsertConfig({})
      toast.success('Configurações financeiras salvas!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar configurações financeiras')
    } finally {
      setSaving(false)
    }
  }

  async function salvarMensagens() {
    setSaving(true)
    try {
      await upsertConfig({
        msg_boas_vindas: msgBoasVindas.trim() || null,
        msg_aprovacao: msgAprovacao.trim() || null,
        msg_liberacao: msgLiberacao.trim() || null,
        msg_vencimento: msgVencimento.trim() || null,
        msg_cobranca: msgCobranca.trim() || null,
        msg_quitacao: msgQuitacao.trim() || null,
      })
      toast.success('Mensagens salvas com sucesso!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar mensagens')
    } finally {
      setSaving(false)
    }
  }

  async function salvarContrato() {
    setSaving(true)
    try {
      await upsertConfig({ prefixo_contrato: prefixoContrato.trim() || 'FAC' })
      toast.success('Configurações de contrato salvas!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar configurações de contrato')
    } finally {
      setSaving(false)
    }
  }

  async function salvarEmpresa() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome: nomeEmpresa.trim(),
          cnpj: cnpj.trim() || null,
          telefone: telefoneEmpresa.trim() || null,
          email: emailEmpresa.trim() || null,
          endereco: enderecoEmpresa.trim() || null,
          cidade: cidadeEmpresa.trim() || null,
          estado: estadoEmpresa.trim() || null,
        })
        .eq('id', empresaAtual.id)

      if (error) throw error
      toast.success('Dados da empresa atualizados!')
    } catch {
      toast.error('Erro ao salvar dados da empresa')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Usuários handlers
  // ---------------------------------------------------------------------------

  async function alterarPapel(ueId: string, papel: PapelUsuario) {
    try {
      const { error } = await supabase
        .from('usuario_empresa')
        .update({ papel })
        .eq('id', ueId)
      if (error) throw error
      setUsuarios(prev => prev.map(u => u.ue_id === ueId ? { ...u, papel } : u))
      toast.success('Papel atualizado')
    } catch {
      toast.error('Erro ao atualizar papel')
    }
  }

  async function toggleAtivo(ueId: string, ativo: boolean) {
    try {
      const { error } = await supabase
        .from('usuario_empresa')
        .update({ ativo: !ativo })
        .eq('id', ueId)
      if (error) throw error
      setUsuarios(prev => prev.map(u => u.ue_id === ueId ? { ...u, ativo: !ativo } : u))
      toast.success(ativo ? 'Usuário desativado' : 'Usuário ativado')
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  async function removerUsuario(ueId: string) {
    if (!confirm('Remover este usuário da empresa?')) return
    try {
      const { error } = await supabase
        .from('usuario_empresa')
        .delete()
        .eq('id', ueId)
      if (error) throw error
      setUsuarios(prev => prev.filter(u => u.ue_id !== ueId))
      toast.success('Usuário removido')
    } catch {
      toast.error('Erro ao remover usuário')
    }
  }

  async function convidarUsuario() {
    if (!empresaAtual) return
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setCriandoUsuario(true)
    try {
      const res = await fetch('/api/auth/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoNome.trim(),
          email: novoEmail.trim(),
          senha: novaSenha,
          papel: novoPapel,
          empresa_id: empresaAtual.id,
        }),
      })

      const data = await res.json() as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar usuário')
        return
      }

      toast.success('Usuário criado com sucesso!')
      setDialogConvidar(false)
      setNovoNome('')
      setNovoEmail('')
      setNovaSenha('')
      setNovoPapel('operador')
      await carregarDados()
    } catch {
      toast.error('Erro ao criar usuário')
    } finally {
      setCriandoUsuario(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------

  const colunasUsuarios: Column<UsuarioRow>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: row => (
        <div>
          <p className="font-medium text-slate-800">{row.nome}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'papel',
      header: 'Papel',
      render: row => (
        <Select
          value={row.papel}
          onValueChange={(v) => alterarPapel(row.ue_id, (v ?? 'operador') as PapelUsuario)}
        >
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="gerente">Gerente</SelectItem>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="visualizador">Visualizador</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'ativo',
      header: 'Status',
      render: row => (
        <button
          type="button"
          onClick={() => toggleAtivo(row.ue_id, row.ativo)}
          className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
            row.ativo
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {row.ativo ? 'Ativo' : 'Inativo'}
        </button>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      render: row => (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => removerUsuario(row.ue_id)}
        >
          <Trash2 size={15} />
        </Button>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const proximoNumeroContrato = `${prefixoContrato}-${new Date().getFullYear()}-${String(totalContratos + 1).padStart(5, '0')}`

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (ctxLoading || loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Configurações">
      <div className="max-w-4xl mx-auto space-y-6">
        <Tabs defaultValue="financeiro" className="w-full">
          <TabsList className="mb-6 bg-[#EDF4FE] border border-[#1E5AA8]/20 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger
              value="financeiro"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="score"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Score e Risco
            </TabsTrigger>
            <TabsTrigger
              value="mensagens"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Mensagens
            </TabsTrigger>
            <TabsTrigger
              value="contrato"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Contrato
            </TabsTrigger>
            <TabsTrigger
              value="empresa"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Empresa
            </TabsTrigger>
            <TabsTrigger
              value="usuarios"
              className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
            >
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Financeiro                                                     */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="financeiro">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Configurações Financeiras</h2>
                <p className="text-sm text-slate-500">Parâmetros padrão para novos contratos de empréstimo.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Taxa de juros */}
                <div className="space-y-2">
                  <Label htmlFor="taxa-juros">Taxa de juros padrão (%)</Label>
                  <Input
                    id="taxa-juros"
                    type="number"
                    step="0.01"
                    min={0}
                    value={taxaJurosPadrao}
                    onChange={e => setTaxaJurosPadrao(e.target.value)}
                    placeholder="5.00"
                  />
                </div>

                {/* Tipo de taxa */}
                <div className="space-y-2">
                  <Label htmlFor="tipo-taxa">Tipo de taxa</Label>
                  <Select
                    value={tipoTaxaPadrao}
                    onValueChange={(v) => setTipoTaxaPadrao((v ?? 'mensal') as TipoTaxa)}
                  >
                    <SelectTrigger id="tipo-taxa">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Multa atraso */}
                <div className="space-y-2">
                  <Label htmlFor="multa-atraso">Multa por atraso (%)</Label>
                  <Input
                    id="multa-atraso"
                    type="number"
                    step="0.01"
                    min={0}
                    value={multaAtraso}
                    onChange={e => setMultaAtraso(e.target.value)}
                    placeholder="2.00"
                  />
                  <p className="text-xs text-slate-400">Percentual aplicado uma vez sobre o valor da parcela</p>
                </div>

                {/* Juros mora */}
                <div className="space-y-2">
                  <Label htmlFor="juros-mora">Juros de mora diário (%)</Label>
                  <Input
                    id="juros-mora"
                    type="number"
                    step="0.001"
                    min={0}
                    value={jurosMoraDiario}
                    onChange={e => setJurosMoraDiario(e.target.value)}
                    placeholder="0.033"
                  />
                  <p className="text-xs text-slate-400">Percentual por dia de atraso (0,033% ≈ 1%/mês)</p>
                </div>

                {/* Carência */}
                <div className="space-y-2">
                  <Label htmlFor="dias-carencia">Dias de carência</Label>
                  <Input
                    id="dias-carencia"
                    type="number"
                    min={0}
                    value={diasCarencia}
                    onChange={e => setDiasCarencia(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-400">Dias antes de começar a cobrar multa/mora</p>
                </div>

                {/* Prazo mínimo */}
                <div className="space-y-2">
                  <Label htmlFor="prazo-minimo">Prazo mínimo (meses)</Label>
                  <Input
                    id="prazo-minimo"
                    type="number"
                    min={1}
                    value={prazoMinimoMeses}
                    onChange={e => setPrazoMinimoMeses(e.target.value)}
                    placeholder="3"
                  />
                </div>

                {/* Prazo máximo */}
                <div className="space-y-2">
                  <Label htmlFor="prazo-maximo">Prazo máximo (meses)</Label>
                  <Input
                    id="prazo-maximo"
                    type="number"
                    min={1}
                    value={prazoMaximoMeses}
                    onChange={e => setPrazoMaximoMeses(e.target.value)}
                    placeholder="60"
                  />
                </div>

                {/* Valor mínimo */}
                <div className="space-y-2">
                  <Label htmlFor="valor-minimo">Valor mínimo (R$)</Label>
                  <Input
                    id="valor-minimo"
                    type="number"
                    step="0.01"
                    min={0}
                    value={valorMinimoEmprestimo}
                    onChange={e => setValorMinimoEmprestimo(e.target.value)}
                    placeholder="500.00"
                  />
                </div>

                {/* Valor máximo */}
                <div className="space-y-2">
                  <Label htmlFor="valor-maximo">Valor máximo (R$)</Label>
                  <Input
                    id="valor-maximo"
                    type="number"
                    step="0.01"
                    min={0}
                    value={valorMaximoEmprestimo}
                    onChange={e => setValorMaximoEmprestimo(e.target.value)}
                    placeholder="50000.00"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-padrao">WhatsApp padrão</Label>
                  <Input
                    id="whatsapp-padrao"
                    type="tel"
                    value={whatsappPadrao}
                    onChange={e => setWhatsappPadrao(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarFinanceiro}
                  disabled={saving}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Score e Risco                                                  */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="score">
            <div className="space-y-6">

              {/* ── Regras de Score ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Regras de Score</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Ajuste o peso de cada regra (0 = desativado, 1 = impacto máximo)</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRegras(REGRAS_SCORE_PADRAO)}
                    className="text-xs text-slate-500"
                  >
                    Restaurar padrão
                  </Button>
                </div>

                <div className="space-y-3">
                  {regras.map((regra, i) => (
                    <div key={regra.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                      <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center`}
                        style={{ backgroundColor: regra.tipo === 'positivo' ? '#dcfce7' : '#fee2e2' }}>
                        {regra.tipo === 'positivo'
                          ? <TrendingUp size={12} className="text-green-600" />
                          : <TrendingDown size={12} className="text-red-500" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{regra.label}</p>
                        <p className="text-xs text-slate-400 truncate">{regra.descricao}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col items-center gap-0.5 w-28">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={regra.peso}
                            onChange={e => {
                              const v = parseFloat(e.target.value)
                              setRegras(prev => prev.map((r, j) => j === i ? { ...r, peso: v } : r))
                            }}
                            className="w-full accent-[#1E5AA8]"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">{regra.peso.toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => setRegras(prev => prev.map((r, j) => j === i ? { ...r, ativo: !r.ativo } : r))}
                          className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${regra.ativo ? 'bg-[#1E5AA8]' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${regra.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Faixas de Risco ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Faixas de Risco</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Defina os intervalos de score e a taxa sugerida para cada faixa</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFaixas(FAIXAS_RISCO_PADRAO)}
                    className="text-xs text-slate-500"
                  >
                    Restaurar padrão
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {faixas.map((faixa, i) => (
                    <div key={faixa.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor: faixa.cor + '60', backgroundColor: faixa.cor + '08' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: faixa.cor }} />
                        <p className="text-sm font-bold text-slate-700">{faixa.nome}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 mb-0.5">Score mín.</p>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={faixa.min}
                              onChange={e => setFaixas(prev => prev.map((f, j) => j === i ? { ...f, min: parseInt(e.target.value) || 0 } : f))}
                              className="h-7 text-xs px-2"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 mb-0.5">Score máx.</p>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={faixa.max}
                              onChange={e => setFaixas(prev => prev.map((f, j) => j === i ? { ...f, max: parseInt(e.target.value) || 100 } : f))}
                              className="h-7 text-xs px-2"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Taxa sugerida (% a.m.)</p>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            value={faixa.taxaSugerida ?? ''}
                            onChange={e => setFaixas(prev => prev.map((f, j) => j === i ? { ...f, taxaSugerida: parseFloat(e.target.value) || 0 } : f))}
                            className="h-7 text-xs px-2"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Recomendação</p>
                          <select
                            value={faixa.recomendacao}
                            onChange={e => setFaixas(prev => prev.map((f, j) => j === i ? { ...f, recomendacao: e.target.value as FaixaRisco['recomendacao'] } : f))}
                            className="w-full text-xs border border-slate-200 rounded-md h-7 px-1 bg-white"
                          >
                            <option value="aprovar">Aprovar</option>
                            <option value="analisar">Analisar</option>
                            <option value="negar">Negar</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Simulação ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sliders size={16} className="text-[#1E5AA8]" />
                  <h2 className="text-base font-bold text-slate-800">Simulação de Score</h2>
                  <p className="text-xs text-slate-400">Ajuste os dados para ver o score calculado com os pesos acima</p>
                </div>
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  {/* Sliders */}
                  <div className="flex-1 space-y-4">
                    {[
                      { label: 'Total de parcelas', key: 'total_parcelas', max: 60 },
                      { label: 'Pagas pontualmente', key: 'pagas_pontualmente', max: 60 },
                      { label: 'Parcelas atrasadas (atual)', key: 'parcelas_atrasadas_atuais', max: 20 },
                      { label: 'Máx. dias em atraso já tido', key: 'max_dias_atraso', max: 180 },
                      { label: 'Empréstimos quitados', key: 'emprestimos_quitados', max: 10 },
                    ].map(({ label, key, max }) => (
                      <div key={key}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-600">{label}</span>
                          <span className="text-xs font-mono text-slate-800">{simDados[key as keyof DadosScore] as number}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={max}
                          value={simDados[key as keyof DadosScore] as number}
                          onChange={e => setSimDados(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                          className="w-full accent-[#1E5AA8]"
                        />
                      </div>
                    ))}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={simDados.cadastro_completo}
                          onChange={e => setSimDados(p => ({ ...p, cadastro_completo: e.target.checked }))}
                          className="accent-[#1E5AA8]" />
                        Cadastro completo
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={simDados.cliente_bloqueado}
                          onChange={e => setSimDados(p => ({ ...p, cliente_bloqueado: e.target.checked }))}
                          className="accent-[#1E5AA8]" />
                        Cliente bloqueado
                      </label>
                    </div>
                  </div>
                  {/* Live gauge */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <ScoreGauge
                      score={calcularScore(simDados, regras, faixas).score}
                      size="lg"
                      showLabel
                      showDescription
                      animated={false}
                    />
                    <p className="text-xs text-slate-400 text-center max-w-[160px]">
                      {calcularScore(simDados, regras, faixas).recomendacao === 'aprovar' ? '✅ Aprovação recomendada' :
                       calcularScore(simDados, regras, faixas).recomendacao === 'analisar' ? '⚠️ Análise manual' : '❌ Não recomendado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setSalvandoScore(true)
                    try {
                      localStorage.setItem(`score_config_${empresaAtual!.id}`, JSON.stringify({ regras, faixas }))
                      toast.success('Configurações de score salvas com sucesso!')
                    } catch {
                      toast.error('Erro ao salvar configurações.')
                    } finally {
                      setSalvandoScore(false)
                    }
                  }}
                  disabled={salvandoScore}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
                >
                  {salvandoScore ? 'Salvando...' : 'Salvar Score e Risco'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Mensagens                                                      */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="mensagens">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-8">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Templates de Mensagem</h2>
                <p className="text-sm text-slate-500">
                  Personalize as mensagens enviadas aos clientes. Clique nas variáveis para inserir no texto.
                </p>
              </div>

              <TemplateEditor
                label="Boas-vindas"
                value={msgBoasVindas}
                onChange={setMsgBoasVindas}
                textareaRef={refBoasVindas}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Aprovação de empréstimo"
                value={msgAprovacao}
                onChange={setMsgAprovacao}
                textareaRef={refAprovacao}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Liberação do empréstimo"
                value={msgLiberacao}
                onChange={setMsgLiberacao}
                textareaRef={refLiberacao}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Aviso de vencimento"
                value={msgVencimento}
                onChange={setMsgVencimento}
                textareaRef={refVencimento}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Cobrança"
                value={msgCobranca}
                onChange={setMsgCobranca}
                textareaRef={refCobranca}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Quitação de contrato"
                value={msgQuitacao}
                onChange={setMsgQuitacao}
                textareaRef={refQuitacao}
              />

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarMensagens}
                  disabled={saving}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Mensagens'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Contrato                                                       */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="contrato">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Numeração de Contratos</h2>
                <p className="text-sm text-slate-500">Configure o formato do número dos contratos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="prefixo-contrato">Prefixo do contrato</Label>
                  <Input
                    id="prefixo-contrato"
                    value={prefixoContrato}
                    onChange={e => setPrefixoContrato(e.target.value.toUpperCase())}
                    placeholder="FAC"
                    maxLength={10}
                  />
                  <p className="text-xs text-slate-400">Letras que precedem o número sequencial</p>
                </div>

                <div className="space-y-2">
                  <Label>Próximo número de contrato</Label>
                  <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-sm">
                    {proximoNumeroContrato}
                  </div>
                  <p className="text-xs text-slate-400">
                    Baseado em {totalContratos} contrato{totalContratos !== 1 ? 's' : ''} existente{totalContratos !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">Formato gerado</p>
                <p className="text-xs text-slate-500">
                  <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {prefixoContrato}-ANO-NNNNN
                  </span>
                  {' '}→ ex.:{' '}
                  <span className="font-mono text-[#1E5AA8]">{proximoNumeroContrato}</span>
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarContrato}
                  disabled={saving}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Contrato'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Empresa                                                        */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="empresa">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Dados da Empresa</h2>
                <p className="text-sm text-slate-500">Informações cadastrais da factoring.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nome-empresa">Nome da empresa</Label>
                  <Input
                    id="nome-empresa"
                    value={nomeEmpresa}
                    onChange={e => setNomeEmpresa(e.target.value)}
                    placeholder="Nome da factoring"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={e => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone-empresa">Telefone</Label>
                  <Input
                    id="telefone-empresa"
                    type="tel"
                    value={telefoneEmpresa}
                    onChange={e => setTelefoneEmpresa(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email-empresa">E-mail</Label>
                  <Input
                    id="email-empresa"
                    type="email"
                    value={emailEmpresa}
                    onChange={e => setEmailEmpresa(e.target.value)}
                    placeholder="contato@factoring.com.br"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="endereco-empresa">Endereço</Label>
                  <Input
                    id="endereco-empresa"
                    value={enderecoEmpresa}
                    onChange={e => setEnderecoEmpresa(e.target.value)}
                    placeholder="Rua, número, bairro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade-empresa">Cidade</Label>
                  <Input
                    id="cidade-empresa"
                    value={cidadeEmpresa}
                    onChange={e => setCidadeEmpresa(e.target.value)}
                    placeholder="Sua cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado-empresa">Estado (UF)</Label>
                  <Input
                    id="estado-empresa"
                    value={estadoEmpresa}
                    onChange={e => setEstadoEmpresa(e.target.value.toUpperCase())}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarEmpresa}
                  disabled={saving}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Empresa'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------------------ */}
          {/* TAB: Usuários                                                       */}
          {/* ------------------------------------------------------------------ */}
          <TabsContent value="usuarios">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Usuários</h2>
                  <p className="text-sm text-slate-500">Gerencie quem tem acesso a esta factoring.</p>
                </div>
                <Button
                  onClick={() => setDialogConvidar(true)}
                  className="bg-[#1E5AA8] hover:bg-[#174d93] text-white gap-2"
                >
                  <UserPlus size={16} />
                  Convidar Usuário
                </Button>
              </div>

              <DataTable<UsuarioRow>
                columns={colunasUsuarios}
                data={usuarios}
                keyExtractor={r => r.ue_id}
                loading={loadingUsuarios}
                emptyMessage="Nenhum usuário cadastrado nesta factoring."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog: Convidar Usuário                                            */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={dialogConvidar} onOpenChange={setDialogConvidar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome completo *</Label>
              <Input
                id="novo-nome"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="novo-email">E-mail *</Label>
              <Input
                id="novo-email"
                type="email"
                value={novoEmail}
                onChange={e => setNovoEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha inicial *</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="novo-papel">Papel</Label>
              <Select
                value={novoPapel}
                onValueChange={(v) => setNovoPapel((v ?? 'operador') as PapelUsuario)}
              >
                <SelectTrigger id="novo-papel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogConvidar(false)}
              disabled={criandoUsuario}
            >
              Cancelar
            </Button>
            <Button
              onClick={convidarUsuario}
              disabled={criandoUsuario}
              className="bg-[#1E5AA8] hover:bg-[#174d93] text-white"
            >
              {criandoUsuario ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
