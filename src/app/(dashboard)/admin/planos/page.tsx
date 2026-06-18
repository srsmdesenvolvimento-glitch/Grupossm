'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { formatarMoeda } from '@/lib/utils/formatters'
import { Plus, Pencil, CheckCircle, Star, Users, Building2 } from 'lucide-react'

type Plano = {
  id: string
  nome: string
  descricao: string | null
  preco_mensal: number
  preco_anual: number | null
  max_usuarios: number
  max_empresas: number
  recursos: Record<string, unknown>
  destaque: boolean
  ordem: number
  ativo: boolean
}

const FORM_INITIAL = {
  nome: '',
  descricao: '',
  preco_mensal: '',
  preco_anual: '',
  max_usuarios: '5',
  max_empresas: '1',
  destaque: false,
  ativo: true,
}

const RECURSOS_LABELS: Record<string, string> = {
  emporio: 'Módulo Empório',
  factoring: 'Módulo Factoring',
  whatsapp: 'Notificações WhatsApp',
  relatorios_basicos: 'Relatórios Básicos',
  relatorios_avancados: 'Relatórios Avançados',
  assinatura_digital: 'Assinatura Digital',
  api_access: 'Acesso à API',
  sla_99_9: 'SLA 99.9%',
  suporte_email: 'Suporte por E-mail',
  suporte_prioritario: 'Suporte Prioritário',
  suporte_dedicado: 'Suporte Dedicado',
  onboarding_personalizado: 'Onboarding Personalizado',
}

export default function PlanosAdminPage() {
  const { empresaAtual } = useEmpresa()
  const [loading, setLoading] = useState(true)
  const [planos, setPlanos] = useState<Plano[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Plano | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [recursos, setRecursos] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/planos')
      if (res.ok) setPlanos(await res.json())
    } catch {
      toast.error('Erro ao carregar planos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditItem(null)
    setForm(FORM_INITIAL)
    setRecursos({})
    setDialogOpen(true)
  }

  function openEdit(item: Plano) {
    setEditItem(item)
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? '',
      preco_mensal: item.preco_mensal.toString(),
      preco_anual: item.preco_anual?.toString() ?? '',
      max_usuarios: item.max_usuarios.toString(),
      max_empresas: item.max_empresas.toString(),
      destaque: item.destaque,
      ativo: item.ativo,
    })
    const rec: Record<string, boolean> = {}
    Object.keys(RECURSOS_LABELS).forEach(k => { rec[k] = !!(item.recursos as Record<string, unknown>)[k] })
    setRecursos(rec)
    setDialogOpen(true)
  }

  async function save() {
    if (!form.nome || !form.preco_mensal) {
      toast.error('Nome e preço mensal são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editItem ? { id: editItem.id } : {}),
        nome: form.nome,
        descricao: form.descricao || null,
        preco_mensal: parseFloat(form.preco_mensal),
        preco_anual: form.preco_anual ? parseFloat(form.preco_anual) : null,
        max_usuarios: parseInt(form.max_usuarios) || 5,
        max_empresas: parseInt(form.max_empresas) || 1,
        recursos,
        destaque: form.destaque,
        ativo: form.ativo,
      }

      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/planos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro || 'Erro ao salvar')
      }

      toast.success(editItem ? 'Plano atualizado!' : 'Plano criado!')
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa={empresaAtual?.tipo ?? 'factoring'} titulo="Planos de Assinatura">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Planos</h2>
            <p className="text-sm text-slate-400">{planos.length} plano(s) cadastrado(s)</p>
          </div>
          <Button size="sm" onClick={openNew} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white">
            <Plus size={14} className="mr-1.5" />
            Novo Plano
          </Button>
        </div>

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planos.map(plano => (
            <div
              key={plano.id}
              className={`relative bg-white rounded-2xl border p-6 flex flex-col gap-4 ${
                plano.destaque ? 'border-[#1E5AA8] shadow-lg shadow-blue-100' : 'border-slate-200'
              } ${!plano.ativo ? 'opacity-60' : ''}`}
            >
              {plano.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-[#1E5AA8] text-white text-xs font-bold px-3 py-1 rounded-full">
                    <Star size={10} fill="currentColor" />
                    Recomendado
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900">{plano.nome}</h3>
                {plano.descricao && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{plano.descricao}</p>
                )}
              </div>

              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  {formatarMoeda(plano.preco_mensal)}
                  <span className="text-sm font-normal text-slate-500">/mês</span>
                </p>
                {plano.preco_anual && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    ou {formatarMoeda(plano.preco_anual)}/ano
                  </p>
                )}
              </div>

              <div className="flex gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <Users size={12} className="text-slate-400" />
                  {plano.max_usuarios === 100 ? 'Ilimitado' : `${plano.max_usuarios}`} usuários
                </span>
                <span className="flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  {plano.max_empresas} empresa(s)
                </span>
              </div>

              <ul className="space-y-1.5 flex-1">
                {Object.keys(RECURSOS_LABELS).filter(k => plano.recursos[k]).map(k => (
                  <li key={k} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                    {RECURSOS_LABELS[k]}
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                size="sm"
                className="mt-auto w-full"
                onClick={() => openEdit(plano)}
              >
                <Pencil size={13} className="mr-1.5" />
                Editar
              </Button>
            </div>
          ))}

          {planos.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500 font-medium">Nenhum plano cadastrado</p>
              <p className="text-slate-400 text-sm mt-1">Execute a migration SQL para carregar os planos padrão</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do plano</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Profissional"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                rows={2}
                placeholder="Descrição breve do plano..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço mensal (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.preco_mensal}
                  onChange={e => setForm(p => ({ ...p, preco_mensal: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço anual (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.preco_anual}
                  onChange={e => setForm(p => ({ ...p, preco_anual: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Máx. usuários</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_usuarios}
                  onChange={e => setForm(p => ({ ...p, max_usuarios: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Máx. empresas</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_empresas}
                  onChange={e => setForm(p => ({ ...p, max_empresas: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Recursos incluídos</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(RECURSOS_LABELS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={!!recursos[k]}
                      onCheckedChange={v => setRecursos(p => ({ ...p, [k]: v }))}
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={form.destaque}
                  onCheckedChange={v => setForm(p => ({ ...p, destaque: v }))}
                />
                <span className="text-sm text-slate-700">Marcar como destaque</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
                />
                <span className="text-sm text-slate-700">Ativo</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#1E5AA8] hover:bg-[#174d92] text-white"
            >
              {saving ? 'Salvando...' : editItem ? 'Salvar alterações' : 'Criar plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
