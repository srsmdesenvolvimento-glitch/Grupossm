'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import {
  CreditCard, CheckCircle, AlertCircle, Clock, XCircle,
  Plus, Pencil, Building2, RefreshCw,
} from 'lucide-react'

type Plano = {
  id: string
  nome: string
  preco_mensal: number
  preco_anual: number | null
}

type Assinatura = {
  id: string
  empresa_id: string
  plano_id: string
  status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada' | 'suspensa' | 'expirada'
  periodicidade: 'mensal' | 'anual'
  data_inicio: string
  data_fim: string | null
  data_renovacao: string | null
  valor_cobrado: number | null
  desconto_pct: number
  contrato_url: string | null
  assinado_em: string | null
  created_at: string
  empresas: { id: string; nome: string; tipo: string; cnpj: string | null }
  planos_assinatura: { id: string; nome: string; preco_mensal: number }
}

const STATUS_CONFIG: Record<Assinatura['status'], { label: string; color: string; icon: React.ElementType }> = {
  trial:        { label: 'Trial',        color: 'bg-blue-100 text-blue-700',    icon: Clock },
  ativa:        { label: 'Ativa',        color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  inadimplente: { label: 'Inadimplente', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  cancelada:    { label: 'Cancelada',    color: 'bg-red-100 text-red-700',      icon: XCircle },
  suspensa:     { label: 'Suspensa',     color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  expirada:     { label: 'Expirada',     color: 'bg-slate-100 text-slate-600',  icon: XCircle },
}

const FORM_INITIAL = {
  empresa_id: '',
  plano_id: '',
  status: 'trial' as Assinatura['status'],
  periodicidade: 'mensal' as 'mensal' | 'anual',
  data_inicio: new Date().toISOString().slice(0, 10),
  valor_cobrado: '',
  desconto_pct: '0',
}

export default function AssinaturasAdminPage() {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Assinatura | null>(null)
  const [form, setForm] = useState(FORM_INITIAL)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [assinRes, planosRes, empRes] = await Promise.all([
        fetch('/api/admin/assinaturas'),
        fetch('/api/admin/planos'),
        supabase.from('empresas').select('id, nome').eq('ativo', true).order('nome'),
      ])

      if (assinRes.ok) setAssinaturas(await assinRes.json())
      if (planosRes.ok) setPlanos(await planosRes.json())
      if (!empRes.error) setEmpresas(empRes.data ?? [])
    } catch {
      toast.error('Erro ao carregar assinaturas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditItem(null)
    setForm(FORM_INITIAL)
    setDialogOpen(true)
  }

  function openEdit(item: Assinatura) {
    setEditItem(item)
    setForm({
      empresa_id: item.empresa_id,
      plano_id: item.plano_id,
      status: item.status,
      periodicidade: item.periodicidade,
      data_inicio: item.data_inicio,
      valor_cobrado: item.valor_cobrado?.toString() ?? '',
      desconto_pct: item.desconto_pct.toString(),
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.empresa_id || !form.plano_id) {
      toast.error('Selecione a empresa e o plano')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(editItem ? { id: editItem.id } : {}),
        empresa_id: form.empresa_id,
        plano_id: form.plano_id,
        status: form.status,
        periodicidade: form.periodicidade,
        data_inicio: form.data_inicio,
        valor_cobrado: form.valor_cobrado ? parseFloat(form.valor_cobrado) : null,
        desconto_pct: parseFloat(form.desconto_pct) || 0,
      }

      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/assinaturas', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro || 'Erro ao salvar')
      }

      toast.success(editItem ? 'Assinatura atualizada!' : 'Assinatura criada!')
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ativas   = assinaturas.filter(a => a.status === 'ativa').length
  const trial    = assinaturas.filter(a => a.status === 'trial').length
  const inadimp  = assinaturas.filter(a => a.status === 'inadimplente').length
  const mrr      = assinaturas
    .filter(a => a.status === 'ativa')
    .reduce((s, a) => s + (a.periodicidade === 'anual' ? (a.valor_cobrado ?? 0) / 12 : (a.valor_cobrado ?? 0)), 0)

  const columns: Column<Assinatura>[] = [
    {
      key: 'empresas',
      header: 'Empresa',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EDF4FE] flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-[#1E5AA8]" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{row.empresas?.nome ?? '—'}</p>
            <p className="text-xs text-slate-400">{row.empresas?.tipo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'planos_assinatura',
      header: 'Plano',
      render: (row) => (
        <span className="text-sm font-medium text-slate-700">
          {row.planos_assinatura?.nome ?? '—'}
        </span>
      ),
    },
    {
      key: 'periodicidade',
      header: 'Ciclo',
      render: (row) => (
        <span className="text-sm text-slate-600 capitalize">{row.periodicidade}</span>
      ),
    },
    {
      key: 'valor_cobrado',
      header: 'Valor',
      render: (row) => (
        <span className="text-sm font-semibold text-slate-800">
          {row.valor_cobrado != null ? formatarMoeda(row.valor_cobrado) : '—'}
        </span>
      ),
    },
    {
      key: 'data_renovacao',
      header: 'Renovação',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.data_renovacao ? formatarData(row.data_renovacao) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const cfg = STATUS_CONFIG[row.status]
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            <cfg.icon size={11} />
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'assinado_em',
      header: 'Contrato',
      render: (row) => (
        row.assinado_em
          ? <span className="text-xs text-green-600 font-medium">Assinado</span>
          : <span className="text-xs text-slate-400">Pendente</span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
          onClick={() => openEdit(row)}
        >
          <Pencil size={13} />
        </Button>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa={empresaAtual?.tipo ?? 'factoring'} titulo="Gestão de Assinaturas">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard titulo="Ativas" valor={ativas} icone={CheckCircle} corIcone="#22c55e" />
          <StatCard titulo="Trial" valor={trial} icone={Clock} corIcone="#3b82f6" />
          <StatCard titulo="Inadimplentes" valor={inadimp} icone={AlertCircle} corIcone="#f97316" />
          <StatCard titulo="MRR" valor={formatarMoeda(mrr)} icone={CreditCard} corIcone="#1E5AA8" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Assinaturas</h2>
            <p className="text-sm text-slate-400">{assinaturas.length} empresa(s) cadastrada(s)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw size={14} className="mr-1.5" />
              Atualizar
            </Button>
            <Button size="sm" onClick={openNew} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white">
              <Plus size={14} className="mr-1.5" />
              Nova Assinatura
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <DataTable
            data={assinaturas}
            columns={columns}
            keyExtractor={a => a.id}
            emptyMessage="Nenhuma assinatura cadastrada"
          />
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Assinatura' : 'Nova Assinatura'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select
                value={form.empresa_id}
                onValueChange={v => setForm(p => ({ ...p, empresa_id: v ?? '' }))}
                disabled={!!editItem}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select
                value={form.plano_id}
                onValueChange={v => setForm(p => ({ ...p, plano_id: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano..." />
                </SelectTrigger>
                <SelectContent>
                  {planos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {formatarMoeda(p.preco_mensal)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Periodicidade</Label>
                <Select
                  value={form.periodicidade}
                  onValueChange={v => setForm(p => ({ ...p, periodicidade: v as 'mensal' | 'anual' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(p => ({ ...p, status: v as Assinatura['status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor cobrado (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Automático pelo plano"
                  value={form.valor_cobrado}
                  onChange={e => setForm(p => ({ ...p, valor_cobrado: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.desconto_pct}
                  onChange={e => setForm(p => ({ ...p, desconto_pct: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#1E5AA8] hover:bg-[#174d92] text-white"
            >
              {saving ? 'Salvando...' : editItem ? 'Salvar alterações' : 'Criar assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
