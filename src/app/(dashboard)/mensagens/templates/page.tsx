'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { VARIAVEIS_FACTORING, VARIAVEIS_EMPORIO, previewMensagem } from '@/lib/utils/mensagens'
import { toast } from 'sonner'
import { Save, Eye, FileText } from 'lucide-react'

// ── Template definitions ────────────────────────────────────────────────────

type TemplateFactoring = {
  chave: keyof ConfigFactoring
  nome: string
}

type TemplateEmporio = {
  chave: keyof ConfigEmporio
  nome: string
}

type ConfigFactoring = {
  msg_boas_vindas: string
  msg_aprovacao: string
  msg_liberacao: string
  msg_vencimento: string
  msg_cobranca: string
  msg_quitacao: string
}

type ConfigEmporio = {
  msg_orcamento: string
  msg_aprovacao: string
  msg_entrega: string
  msg_cobranca: string
  msg_aniversario: string
}

const TEMPLATES_FACTORING: TemplateFactoring[] = [
  { chave: 'msg_boas_vindas', nome: 'Boas-vindas' },
  { chave: 'msg_aprovacao', nome: 'Aprovação' },
  { chave: 'msg_liberacao', nome: 'Liberação' },
  { chave: 'msg_vencimento', nome: 'Aviso vencimento' },
  { chave: 'msg_cobranca', nome: 'Cobrança' },
  { chave: 'msg_quitacao', nome: 'Quitação' },
]

const TEMPLATES_EMPORIO: TemplateEmporio[] = [
  { chave: 'msg_orcamento', nome: 'Orçamento' },
  { chave: 'msg_aprovacao', nome: 'Aprovação' },
  { chave: 'msg_entrega', nome: 'Entrega' },
  { chave: 'msg_cobranca', nome: 'Cobrança' },
  { chave: 'msg_aniversario', nome: 'Aniversário' },
]

// ── Variable insertion ──────────────────────────────────────────────────────

function inserirVariavel(
  ref: React.RefObject<HTMLTextAreaElement | undefined>,
  chave: string,
  setValue: (v: string) => void,
) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  const tag = `{{${chave}}}`
  setValue(before + tag + after)
  setTimeout(() => {
    el.focus()
    el.setSelectionRange(start + tag.length, start + tag.length)
  }, 0)
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TemplatesMensagensPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const isEmporio = empresaAtual?.tipo === 'emporio'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Factoring config
  const [configFactoring, setConfigFactoring] = useState<ConfigFactoring>({
    msg_boas_vindas: '',
    msg_aprovacao: '',
    msg_liberacao: '',
    msg_vencimento: '',
    msg_cobranca: '',
    msg_quitacao: '',
  })

  // Emporio config
  const [configEmporio, setConfigEmporio] = useState<ConfigEmporio>({
    msg_orcamento: '',
    msg_aprovacao: '',
    msg_entrega: '',
    msg_cobranca: '',
    msg_aniversario: '',
  })

  const templates = isEmporio ? TEMPLATES_EMPORIO : TEMPLATES_FACTORING
  const [selectedKey, setSelectedKey] = useState<string>(templates[0].chave)

  const textareaRef = useRef<HTMLTextAreaElement | undefined>(undefined)

  const currentValue = isEmporio
    ? configEmporio[selectedKey as keyof ConfigEmporio] ?? ''
    : configFactoring[selectedKey as keyof ConfigFactoring] ?? ''

  function setCurrentValue(v: string) {
    if (isEmporio) {
      setConfigEmporio(prev => ({ ...prev, [selectedKey]: v }))
    } else {
      setConfigFactoring(prev => ({ ...prev, [selectedKey]: v }))
    }
  }

  const load = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    try {
      if (isEmporio) {
        const { data } = await supabase
          .from('config_emporio')
          .select('msg_orcamento, msg_aprovacao, msg_entrega, msg_cobranca, msg_aniversario')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle()
        if (data) {
          setConfigEmporio({
            msg_orcamento: data.msg_orcamento ?? '',
            msg_aprovacao: data.msg_aprovacao ?? '',
            msg_entrega: data.msg_entrega ?? '',
            msg_cobranca: data.msg_cobranca ?? '',
            msg_aniversario: data.msg_aniversario ?? '',
          })
        }
      } else {
        const { data } = await supabase
          .from('config_factoring')
          .select('msg_aprovacao, msg_liberacao, msg_vencimento, msg_cobranca, msg_quitacao, msg_boas_vindas')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle()
        if (data) {
          setConfigFactoring({
            msg_boas_vindas: data.msg_boas_vindas ?? '',
            msg_aprovacao: data.msg_aprovacao ?? '',
            msg_liberacao: data.msg_liberacao ?? '',
            msg_vencimento: data.msg_vencimento ?? '',
            msg_cobranca: data.msg_cobranca ?? '',
            msg_quitacao: data.msg_quitacao ?? '',
          })
        }
      }
    } catch {
      toast.error('Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual?.id, isEmporio])

  useEffect(() => { load() }, [load])

  // Reset selected key when empresa type changes
  useEffect(() => {
    const newTemplates = isEmporio ? TEMPLATES_EMPORIO : TEMPLATES_FACTORING
    setSelectedKey(newTemplates[0].chave)
  }, [isEmporio])

  async function salvar() {
    if (!empresaAtual?.id) return
    setSaving(true)
    try {
      if (isEmporio) {
        const { error } = await supabase
          .from('config_emporio')
          .upsert(
            {
              empresa_id: empresaAtual.id,
              ...configEmporio,
            },
            { onConflict: 'empresa_id' },
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('config_factoring')
          .upsert(
            {
              empresa_id: empresaAtual.id,
              ...configFactoring,
            },
            { onConflict: 'empresa_id' },
          )
        if (error) throw error
      }
      toast.success('Templates salvos com sucesso')
    } catch {
      toast.error('Erro ao salvar templates')
    } finally {
      setSaving(false)
    }
  }

  const variaveis = isEmporio ? VARIAVEIS_EMPORIO : VARIAVEIS_FACTORING
  const preview = currentValue ? previewMensagem(currentValue, isEmporio ? 'emporio' : 'factoring') : ''

  const selectedTemplateName = templates.find(t => t.chave === selectedKey)?.nome ?? ''

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Templates de Mensagens">
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Templates</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {templates.map((t) => (
              <button
                key={t.chave}
                onClick={() => setSelectedKey(t.chave)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedKey === t.chave
                    ? 'bg-[#EDF4FE] text-[#1E5AA8]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="flex-shrink-0" />
                  {t.nome}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
          {/* Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-800">{selectedTemplateName}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                WhatsApp
              </span>
            </div>
            <Button
              onClick={salvar}
              disabled={saving}
              className="bg-[#1E5AA8] hover:bg-[#1a4f94] text-white"
              size="sm"
            >
              <Save size={14} className="mr-2" />
              {saving ? 'Salvando...' : 'Salvar templates'}
            </Button>
          </div>

          {/* Variables */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">
              Variáveis disponíveis — clique para inserir
            </Label>
            <div className="flex flex-wrap gap-2">
              {variaveis.map((v) => (
                <button
                  key={v.chave}
                  onClick={() =>
                    inserirVariavel(
                      textareaRef as React.RefObject<HTMLTextAreaElement | undefined>,
                      v.chave,
                      setCurrentValue,
                    )
                  }
                  title={`${v.descricao} — ex: ${v.exemplo}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700 hover:bg-[#EDF4FE] hover:text-[#1E5AA8] border border-transparent hover:border-[#1E5AA8]/20 transition-colors cursor-pointer"
                >
                  {`{{${v.chave}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Mensagem
            </Label>
            <Textarea
              ref={(el) => { textareaRef.current = el ?? undefined }}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder={`Digite o template para "${selectedTemplateName}"...\n\nUse {{nome}}, {{numero_contrato}} etc. para personalizar.`}
              rows={8}
              className="font-mono text-sm resize-none focus:ring-[#1E5AA8] focus:border-[#1E5AA8]"
            />
            <p className="text-xs text-slate-400 mt-2">
              {currentValue.length} caracteres
            </p>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-[#1E5AA8]" />
              <Label className="text-sm font-medium text-slate-700">Preview ao vivo</Label>
              <span className="text-xs text-slate-400">(com valores de exemplo)</span>
            </div>
            {preview ? (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                {/* WhatsApp bubble mock */}
                <div className="max-w-sm">
                  <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 border border-green-100">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {preview}
                    </p>
                    <p className="text-right text-xs text-slate-400 mt-1">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-center">
                <p className="text-sm text-slate-400">
                  Digite uma mensagem acima para ver o preview
                </p>
              </div>
            )}
          </div>

          {/* Variable reference table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">
              Referência de variáveis
            </Label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">Variável</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">Descrição</th>
                    <th className="text-left py-2 text-xs font-medium text-slate-500">Exemplo</th>
                  </tr>
                </thead>
                <tbody>
                  {variaveis.map((v, idx) => (
                    <tr
                      key={v.chave}
                      className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}
                    >
                      <td className="py-1.5 pr-4">
                        <code className="text-xs bg-slate-100 text-[#1E5AA8] px-1.5 py-0.5 rounded font-mono">
                          {`{{${v.chave}}}`}
                        </code>
                      </td>
                      <td className="py-1.5 pr-4 text-xs text-slate-600">{v.descricao}</td>
                      <td className="py-1.5 text-xs text-slate-500 font-mono">{v.exemplo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
