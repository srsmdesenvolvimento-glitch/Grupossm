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
import { DataTable, type Column } from '@/components/shared/DataTable'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { CriarUsuarioDialog } from '@/components/shared/CriarUsuarioDialog'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { VARIAVEIS_EMPORIO, previewMensagem } from '@/lib/utils/mensagens'
import type { ConfigEmporio, Empresa, PapelUsuario } from '@/lib/types/database'
import { UserPlus, Trash2 } from 'lucide-react'

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
        {VARIAVEIS_EMPORIO.map(v => (
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
          {previewMensagem(value, 'emporio')}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ConfiguracoesEmporioPage() {
  const supabase = createClient()
  const { empresaAtual, loading: ctxLoading } = useEmpresa()

  // Loading state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Config state
  const [config, setConfig] = useState<ConfigEmporio | null>(null)
  const [diasVencimento, setDiasVencimento] = useState('30')
  const [prefixoNumeroVenda, setPrefixoNumeroVenda] = useState('EMP')
  const [whatsappPadrao, setWhatsappPadrao] = useState('')
  const [saldoInicialCaixa, setSaldoInicialCaixa] = useState('0')

  // Mensagens state
  const [msgOrcamento, setMsgOrcamento] = useState('')
  const [msgAprovacao, setMsgAprovacao] = useState('')
  const [msgEntrega, setMsgEntrega] = useState('')
  const [msgCobranca, setMsgCobranca] = useState('')
  const [msgAniversario, setMsgAniversario] = useState('')

  // Refs for textarea cursor tracking
  const refOrcamento = useRef<HTMLTextAreaElement | null>(null)
  const refAprovacao = useRef<HTMLTextAreaElement | null>(null)
  const refEntrega = useRef<HTMLTextAreaElement | null>(null)
  const refCobranca = useRef<HTMLTextAreaElement | null>(null)
  const refAniversario = useRef<HTMLTextAreaElement | null>(null)

  // Empresa state
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefoneEmpresa, setTelefoneEmpresa] = useState('')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [enderecoEmpresa, setEnderecoEmpresa] = useState('')
  const [cidadeEmpresa, setCidadeEmpresa] = useState('')
  const [estadoEmpresa, setEstadoEmpresa] = useState('')

  // Usuários state
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [dialogConvidar, setDialogConvidar] = useState(false)

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)

    try {
      const [configRes, empresaRes, usuariosRes] = await Promise.all([
        supabase
          .from('config_emporio')
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
      ])

      // Config
      if (configRes.data) {
        const c = configRes.data as ConfigEmporio
        setConfig(c)
        setDiasVencimento(String(c.dias_vencimento_padrao))
        setPrefixoNumeroVenda(c.prefixo_numero_venda)
        setWhatsappPadrao(c.whatsapp_padrao ?? '')
        setSaldoInicialCaixa(String(c.saldo_inicial_caixa ?? 0))
        setMsgOrcamento(c.msg_orcamento ?? '')
        setMsgAprovacao(c.msg_aprovacao ?? '')
        setMsgEntrega(c.msg_entrega ?? '')
        setMsgCobranca(c.msg_cobranca ?? '')
        setMsgAniversario(c.msg_aniversario ?? '')
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
    } catch {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, supabase])

  useEffect(() => {
    if (!ctxLoading && empresaAtual) {
      carregarDados()
    }
  }, [ctxLoading, empresaAtual, carregarDados])

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  async function salvarFinanceiro() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresaAtual.id,
        dias_vencimento_padrao: parseInt(diasVencimento, 10) || 30,
        prefixo_numero_venda: prefixoNumeroVenda.trim() || 'EMP',
        whatsapp_padrao: whatsappPadrao.trim() || null,
        saldo_inicial_caixa: parseFloat(saldoInicialCaixa) || 0,
        ...(config ? { msg_orcamento: config.msg_orcamento, msg_aprovacao: config.msg_aprovacao, msg_entrega: config.msg_entrega, msg_cobranca: config.msg_cobranca, msg_aniversario: config.msg_aniversario } : {}),
      }

      if (config) {
        const { error } = await supabase
          .from('config_emporio')
          .update(payload)
          .eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('config_emporio')
          .insert(payload)
        if (error) throw error
      }

      toast.success('Configurações financeiras salvas!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar configurações financeiras')
    } finally {
      setSaving(false)
    }
  }

  async function salvarMensagens() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresaAtual.id,
        msg_orcamento: msgOrcamento.trim() || null,
        msg_aprovacao: msgAprovacao.trim() || null,
        msg_entrega: msgEntrega.trim() || null,
        msg_cobranca: msgCobranca.trim() || null,
        msg_aniversario: msgAniversario.trim() || null,
        ...(config ? {
          dias_vencimento_padrao: parseInt(diasVencimento, 10) || 30,
          prefixo_numero_venda: prefixoNumeroVenda.trim() || 'EMP',
          whatsapp_padrao: whatsappPadrao.trim() || null,
        } : {
          dias_vencimento_padrao: 30,
          prefixo_numero_venda: 'EMP',
          whatsapp_padrao: null,
        }),
      }

      if (config) {
        const { error } = await supabase
          .from('config_emporio')
          .update(payload)
          .eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('config_emporio')
          .insert(payload)
        if (error) throw error
      }

      toast.success('Mensagens salvas com sucesso!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar mensagens')
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
  // Render
  // ---------------------------------------------------------------------------

  if (ctxLoading || loading) return <LoadingPage />

  return (
    <AppShell empresa="emporio" titulo="Configurações">
      <div className="max-w-4xl mx-auto space-y-6">
        <Tabs defaultValue="financeiro" className="w-full">
          <TabsList className="mb-6 bg-[#FEF9E7] border border-[#D4A528]/20">
            <TabsTrigger
              value="financeiro"
              className="data-[state=active]:bg-[#D4A528] data-[state=active]:text-white"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="mensagens"
              className="data-[state=active]:bg-[#D4A528] data-[state=active]:text-white"
            >
              Mensagens
            </TabsTrigger>
            <TabsTrigger
              value="empresa"
              className="data-[state=active]:bg-[#D4A528] data-[state=active]:text-white"
            >
              Empresa
            </TabsTrigger>
            <TabsTrigger
              value="usuarios"
              className="data-[state=active]:bg-[#D4A528] data-[state=active]:text-white"
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
                <p className="text-sm text-slate-500">Defina os padrões de venda do empório.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dias-vencimento">Dias de vencimento padrão</Label>
                  <Input
                    id="dias-vencimento"
                    type="number"
                    min={1}
                    max={365}
                    value={diasVencimento}
                    onChange={e => setDiasVencimento(e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-xs text-slate-400">Número de dias para vencimento das parcelas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prefixo-venda">Prefixo do número de venda</Label>
                  <Input
                    id="prefixo-venda"
                    value={prefixoNumeroVenda}
                    onChange={e => setPrefixoNumeroVenda(e.target.value.toUpperCase())}
                    placeholder="EMP"
                    maxLength={10}
                  />
                  <p className="text-xs text-slate-400">Ex.: EMP → EMP-2026-00001</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp-padrao">WhatsApp padrão</Label>
                  <Input
                    id="whatsapp-padrao"
                    type="tel"
                    value={whatsappPadrao}
                    onChange={e => setWhatsappPadrao(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                  <p className="text-xs text-slate-400">Número utilizado para envio de mensagens automáticas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saldo-inicial-caixa">Saldo inicial do caixa (R$)</Label>
                  <Input
                    id="saldo-inicial-caixa"
                    type="number"
                    min={0}
                    step="0.01"
                    value={saldoInicialCaixa}
                    onChange={e => setSaldoInicialCaixa(e.target.value)}
                    placeholder="0,00"
                  />
                  <p className="text-xs text-slate-400">Valor em caixa antes das movimentações do sistema</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarFinanceiro}
                  disabled={saving}
                  className="bg-[#D4A528] hover:bg-[#b88e22] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Configurações'}
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
                label="Orçamento gerado"
                value={msgOrcamento}
                onChange={setMsgOrcamento}
                textareaRef={refOrcamento}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Venda aprovada"
                value={msgAprovacao}
                onChange={setMsgAprovacao}
                textareaRef={refAprovacao}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Confirmação de entrega"
                value={msgEntrega}
                onChange={setMsgEntrega}
                textareaRef={refEntrega}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Cobrança / Lembrete"
                value={msgCobranca}
                onChange={setMsgCobranca}
                textareaRef={refCobranca}
              />

              <div className="border-t border-slate-100" />

              <TemplateEditor
                label="Aniversário do cliente"
                value={msgAniversario}
                onChange={setMsgAniversario}
                textareaRef={refAniversario}
              />

              <div className="flex justify-end pt-2">
                <Button
                  onClick={salvarMensagens}
                  disabled={saving}
                  className="bg-[#D4A528] hover:bg-[#b88e22] text-white"
                >
                  {saving ? 'Salvando...' : 'Salvar Mensagens'}
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
                <p className="text-sm text-slate-500">Informações cadastrais do empório.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nome-empresa">Nome da empresa</Label>
                  <Input
                    id="nome-empresa"
                    value={nomeEmpresa}
                    onChange={e => setNomeEmpresa(e.target.value)}
                    placeholder="Nome do empório"
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
                    placeholder="contato@emporio.com.br"
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
                  className="bg-[#D4A528] hover:bg-[#b88e22] text-white"
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
                  <p className="text-sm text-slate-500">Gerencie quem tem acesso a este empório.</p>
                </div>
                <Button
                  onClick={() => setDialogConvidar(true)}
                  className="bg-[#D4A528] hover:bg-[#b88e22] text-white gap-2"
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
                emptyMessage="Nenhum usuário cadastrado neste empório."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {empresaAtual && (
        <CriarUsuarioDialog
          empresaId={empresaAtual.id}
          open={dialogConvidar}
          onOpenChange={setDialogConvidar}
          onSuccess={carregarDados}
        />
      )}
    </AppShell>
  )
}
