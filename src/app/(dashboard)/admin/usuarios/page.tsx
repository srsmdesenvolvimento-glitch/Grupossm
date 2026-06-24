'use client'

import { useEffect, useState, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { formatarData } from '@/lib/utils/formatters'
import { UserPlus, Users, Building2, ShieldCheck, Eye, EyeOff, Check } from 'lucide-react'

type EmpresaRow = { id: string; nome: string; tipo: string }

type UsuarioRow = {
  id: string
  nome: string
  email: string
  status: 'ativo' | 'inativo'
  created_at: string
  empresas_vinculadas: { empresa_id: string; papel: string; nome: string; tipo: string }[]
}


const FORM_INITIAL = {
  nome: '', email: '', senha: '', senhaVisivel: false as boolean,
}

export default function UsuariosAdminPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)
  const [selectedEmpresas, setSelectedEmpresas] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Carrega todas as empresas
      const { data: emps } = await supabase
        .from('empresas')
        .select('id, nome, tipo')
        .eq('ativo', true)
        .order('nome')
      setEmpresas(emps ?? [])

      // Carrega usuários com seus vínculos
      const { data: ues } = await supabase
        .from('usuario_empresa')
        .select('usuario_id, papel, empresa_id, empresas(id, nome, tipo)')
        .eq('ativo', true)

      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nome, email, status, created_at')
        .order('nome')

      if (!users) return

      const grouped = users.map(u => ({
        ...u,
        empresas_vinculadas: (ues ?? [])
          .filter(ue => ue.usuario_id === u.id)
          .map(ue => ({
            empresa_id: ue.empresa_id,
            papel: ue.papel,
            nome: (ue.empresas as any)?.nome ?? '',
            tipo: (ue.empresas as any)?.tipo ?? '',
          })),
      }))

      setUsuarios(grouped)
    } catch {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm(FORM_INITIAL)
    setSelectedEmpresas(new Set(empresas.map(e => e.id)))
    setDialogOpen(true)
  }

  function toggleEmpresa(id: string) {
    setSelectedEmpresas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    if (!form.nome || !form.email || !form.senha) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    if (selectedEmpresas.size === 0) {
      toast.error('Selecione ao menos uma empresa')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          empresas: Array.from(selectedEmpresas).map(id => ({ empresa_id: id, papel: 'admin' })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao criar usuário')

      toast.success(`Usuário criado! Vinculado a ${data.empresas_vinculadas} empresa(s)`)
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = usuarios.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const columns: Column<UsuarioRow>[] = [
    {
      key: 'nome',
      header: 'Usuário',
      render: row => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.nome}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'empresas_vinculadas',
      header: 'Empresas',
      render: row => (
        <div className="flex flex-wrap gap-1">
          {row.empresas_vinculadas.length === 0 && (
            <span className="text-xs text-slate-400">Sem vínculo</span>
          )}
          {row.empresas_vinculadas.map(ev => (
            <span
              key={ev.empresa_id}
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full"
            >
              <Building2 size={10} />
              {ev.nome}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Acesso',
      render: () => (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
          Acesso Total
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: row => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          row.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Criado em',
      render: row => (
        <span className="text-xs text-slate-500">{formatarData(row.created_at)}</span>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa={empresaAtual?.tipo ?? 'factoring'} titulo="Gestão de Usuários">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EDF4FE] flex items-center justify-center">
              <Users size={18} className="text-[#1E5AA8]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{usuarios.length}</p>
              <p className="text-xs text-slate-500">Total de usuários</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <ShieldCheck size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {usuarios.length}
              </p>
              <p className="text-xs text-slate-500">Com acesso total</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <Building2 size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {usuarios.filter(u => u.empresas_vinculadas.length >= 2).length}
              </p>
              <p className="text-xs text-slate-500">Acesso multi-empresa</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar usuário..." />
          <Button size="sm" onClick={openNew} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white">
            <UserPlus size={14} className="mr-1.5" />
            Novo Usuário
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <DataTable
            data={filtered}
            columns={columns}
            keyExtractor={u => u.id}
            emptyMessage="Nenhum usuário encontrado"
          />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
          {/* Header escuro premium */}
          <div className="bg-gradient-to-br from-[#07101E] to-[#0d1f3a] px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8AB4F8]/15 border border-[#8AB4F8]/20 flex items-center justify-center">
              <UserPlus size={18} className="text-[#8AB4F8]" />
            </div>
            <div>
              <DialogTitle className="text-white text-base font-bold tracking-tight">Novo Usuário</DialogTitle>
              <p className="text-white/40 text-xs mt-0.5">Acesso liberado para todas as empresas do grupo</p>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-white max-h-[70vh] overflow-y-auto">
            {/* Dados pessoais */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome completo</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="João da Silva"
                  className="h-10 border-slate-200 focus-visible:ring-[#1E5AA8]/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="joao@empresa.com.br"
                  className="h-10 border-slate-200 focus-visible:ring-[#1E5AA8]/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Senha inicial</Label>
                <div className="relative">
                  <Input
                    type={form.senhaVisivel ? 'text' : 'password'}
                    value={form.senha}
                    onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    className="h-10 border-slate-200 pr-10 focus-visible:ring-[#1E5AA8]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, senhaVisivel: !p.senhaVisivel }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {form.senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Acesso a empresas */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Acesso às empresas
              </Label>
              <div className="space-y-2">
                {empresas.map(e => {
                  const checked = selectedEmpresas.has(e.id)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEmpresa(e.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        checked
                          ? 'border-[#1E5AA8]/40 bg-[#EDF4FE]'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        checked ? 'bg-[#1E5AA8]' : 'bg-slate-200'
                      }`}>
                        <Building2 size={13} className={checked ? 'text-white' : 'text-slate-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{e.nome}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{e.tipo}</p>
                      </div>
                      {checked && <Check size={14} className="text-[#1E5AA8] shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 justify-end">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 px-4">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="h-9 px-5 bg-[#1E5AA8] hover:bg-[#174d92] text-white gap-1.5"
            >
              {saving ? (
                'Criando...'
              ) : (
                <>
                  <Check size={13} />
                  Criar usuário
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
