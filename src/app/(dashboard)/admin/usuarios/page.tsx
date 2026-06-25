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
import { useEmpresa } from '@/contexts/EmpresaContext'
import { toast } from 'sonner'
import { formatarData } from '@/lib/utils/formatters'
import { UserPlus, Users, Building2, ShieldCheck, Eye, EyeOff, Check, Pencil, Trash2, AlertCircle } from 'lucide-react'

type EmpresaRow = { id: string; nome: string; tipo: string }

type UsuarioRow = {
  id: string
  nome: string
  email: string
  status: 'ativo' | 'inativo'
  created_at: string
  empresas_vinculadas: { empresa_id: string; papel: string; nome: string; tipo: string }[]
}

const FORM_INITIAL = { nome: '', email: '', senha: '', senhaVisivel: false as boolean }
const EDIT_INITIAL = { nome: '', email: '', senha: '', senhaVisivel: false as boolean }

export default function UsuariosAdminPage() {
  const { empresaAtual } = useEmpresa()

  const [loading, setLoading]               = useState(true)
  const [usuarios, setUsuarios]             = useState<UsuarioRow[]>([])
  const [empresas, setEmpresas]             = useState<EmpresaRow[]>([])
  const [search, setSearch]                 = useState('')
  const [erroGeral, setErroGeral]           = useState<string | null>(null)

  // Criar usuário
  const [criarOpen, setCriarOpen]           = useState(false)
  const [form, setForm]                     = useState(FORM_INITIAL)
  const [selectedEmpresas, setSelectedEmpresas] = useState<Set<string>>(new Set())
  const [saving, setSaving]                 = useState(false)
  const [errosCriar, setErrosCriar]         = useState<Partial<typeof FORM_INITIAL>>({})

  // Editar usuário
  const [editOpen, setEditOpen]             = useState(false)
  const [editTarget, setEditTarget]         = useState<UsuarioRow | null>(null)
  const [editForm, setEditForm]             = useState(EDIT_INITIAL)
  const [editando, setEditando]             = useState(false)
  const [errosEdit, setErrosEdit]           = useState<Partial<typeof EDIT_INITIAL>>({})

  // Excluir usuário
  const [deleteTarget, setDeleteTarget]     = useState<UsuarioRow | null>(null)
  const [excluindo, setExcluindo]           = useState(false)
  const [confirmNome, setConfirmNome]       = useState('')

  // Limpar dados de teste
  const [limpandoDados, setLimpandoDados]   = useState(false)
  const [confirmLimpar, setConfirmLimpar]   = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setErroGeral(null)
    try {
      const res  = await fetch('/api/admin/usuarios')
      const data = await res.json()
      if (!res.ok) {
        setErroGeral(data.erro ?? 'Erro ao carregar usuários')
        return
      }
      setUsuarios(data.usuarios ?? [])
      setEmpresas(data.empresas ?? [])
    } catch {
      setErroGeral('Falha de conexão ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Limpar dados de teste ────────────────────────────────────────────────────
  async function limparDados() {
    setLimpandoDados(true)
    try {
      const res  = await fetch('/api/admin/limpar-dados', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erro ?? 'Erro ao limpar dados'); return }
      toast.success(`Dados de teste removidos! (${data.limpos?.length ?? 0} tabelas limpas)`)
      setConfirmLimpar(false)
    } catch {
      toast.error('Falha de conexão')
    } finally {
      setLimpandoDados(false)
    }
  }

  // ── Criar ───────────────────────────────────────────────────────────────────
  function openCriar() {
    setForm(FORM_INITIAL)
    setErrosCriar({})
    setSelectedEmpresas(new Set(empresas.map(e => e.id)))
    setCriarOpen(true)
  }

  function toggleEmpresa(id: string) {
    setSelectedEmpresas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validarCriar() {
    const erros: Partial<typeof FORM_INITIAL> = {}
    if (!form.nome.trim() || form.nome.trim().length < 2) erros.nome = 'Nome deve ter ao menos 2 caracteres'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) erros.email = 'E-mail inválido'
    if (form.senha.length < 6) erros.senha = 'Senha deve ter ao menos 6 caracteres'
    setErrosCriar(erros)
    return Object.keys(erros).length === 0
  }

  async function criar() {
    if (!validarCriar()) return
    if (selectedEmpresas.size === 0) {
      toast.error('Selecione ao menos uma empresa')
      return
    }
    setSaving(true)
    try {
      const res  = await fetch('/api/auth/criar-usuario', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:     form.nome.trim(),
          email:    form.email.trim().toLowerCase(),
          senha:    form.senha,
          empresas: Array.from(selectedEmpresas).map(id => ({ empresa_id: id, papel: 'admin' })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.erro ?? data.error ?? 'Erro ao criar usuário'
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('e-mail')) {
          setErrosCriar(p => ({ ...p, email: 'Este e-mail já está em uso' }))
        } else {
          toast.error(msg)
        }
        return
      }
      toast.success(`Usuário "${form.nome.trim()}" criado com sucesso!`)
      setCriarOpen(false)
      await load()
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Editar ──────────────────────────────────────────────────────────────────
  function openEditar(u: UsuarioRow) {
    setEditTarget(u)
    setEditForm({ nome: u.nome, email: u.email, senha: '', senhaVisivel: false })
    setErrosEdit({})
    setEditOpen(true)
  }

  function validarEdit() {
    const erros: Partial<typeof EDIT_INITIAL> = {}
    if (editForm.nome.trim().length < 2) erros.nome = 'Nome deve ter ao menos 2 caracteres'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) erros.email = 'E-mail inválido'
    if (editForm.senha && editForm.senha.length < 6) erros.senha = 'Senha deve ter ao menos 6 caracteres'
    setErrosEdit(erros)
    return Object.keys(erros).length === 0
  }

  async function salvarEdicao() {
    if (!editTarget || !validarEdit()) return
    setEditando(true)
    try {
      const body: Record<string, string> = { id: editTarget.id }
      if (editForm.nome.trim()  !== editTarget.nome)  body.nome  = editForm.nome.trim()
      if (editForm.email.trim() !== editTarget.email) body.email = editForm.email.trim().toLowerCase()
      if (editForm.senha)                              body.senha = editForm.senha

      if (Object.keys(body).length === 1) { // só o id
        toast.info('Nenhuma alteração detectada')
        setEditOpen(false)
        return
      }

      const res  = await fetch('/api/admin/usuarios', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.erro ?? 'Erro ao salvar alterações'
        if (msg.toLowerCase().includes('email')) {
          setErrosEdit(p => ({ ...p, email: 'Este e-mail já está em uso' }))
        } else {
          toast.error(msg)
        }
        return
      }
      toast.success('Usuário atualizado com sucesso!')
      setEditOpen(false)
      await load()
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
    } finally {
      setEditando(false)
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────────
  async function confirmarExclusao() {
    if (!deleteTarget) return
    setExcluindo(true)
    try {
      const res  = await fetch(`/api/admin/usuarios?id=${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erro ?? 'Erro ao excluir usuário')
        return
      }
      toast.success(`Usuário "${deleteTarget.nome}" removido`)
      setDeleteTarget(null)
      setConfirmNome('')
      await load()
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
    } finally {
      setExcluindo(false)
    }
  }

  // ── Tabela ──────────────────────────────────────────────────────────────────
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
          {row.empresas_vinculadas.length === 0
            ? <span className="text-xs text-slate-400">Sem vínculo</span>
            : row.empresas_vinculadas.map(ev => (
              <span key={ev.empresa_id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">
                <Building2 size={10} />
                {ev.nome}
              </span>
            ))
          }
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
      render: row => <span className="text-xs text-slate-500">{formatarData(row.created_at)}</span>,
    },
    {
      key: 'id' as any,
      header: '',
      render: row => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditar(row)}
            className="h-7 w-7 p-0 text-slate-400 hover:text-[#1E5AA8]" title="Editar">
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(row); setConfirmNome('') }}
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" title="Excluir">
            <Trash2 size={13} />
          </Button>
        </div>
      ),
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa={empresaAtual?.tipo ?? 'factoring'} titulo="Gestão de Usuários">
      <div className="space-y-6">

        {/* Erro geral */}
        {erroGeral && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {erroGeral}
            <button onClick={load} className="ml-auto text-xs underline hover:no-underline">Tentar novamente</button>
          </div>
        )}

        {/* Stats */}
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
              <p className="text-2xl font-bold text-slate-900">{usuarios.length}</p>
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

        {/* Barra de busca + botões */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar usuário..." />
          <div className="flex items-center gap-2">
            {!confirmLimpar ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmLimpar(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs"
              >
                <Trash2 size={13} className="mr-1.5" />
                Limpar dados de teste
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-700 font-medium">Confirmar limpeza?</span>
                <Button
                  size="sm"
                  onClick={limparDados}
                  disabled={limpandoDados}
                  className="h-6 text-[11px] bg-red-600 hover:bg-red-700 text-white px-2.5"
                >
                  {limpandoDados ? 'Limpando...' : 'Sim, limpar'}
                </Button>
                <button onClick={() => setConfirmLimpar(false)} className="text-xs text-red-600 underline ml-1">Cancelar</button>
              </div>
            )}
            <Button size="sm" onClick={openCriar} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white">
              <UserPlus size={14} className="mr-1.5" />
              Novo Usuário
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200">
          <DataTable
            data={filtered}
            columns={columns}
            keyExtractor={u => u.id}
            emptyMessage="Nenhum usuário encontrado"
          />
        </div>
      </div>

      {/* ── Dialog: Criar Usuário ─────────────────────────────────────────────── */}
      <Dialog open={criarOpen} onOpenChange={v => { if (!v && !saving) setCriarOpen(false) }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl">
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
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome completo</Label>
              <Input
                value={form.nome}
                onChange={e => { setForm(p => ({ ...p, nome: e.target.value })); setErrosCriar(p => ({ ...p, nome: undefined })) }}
                placeholder="João da Silva"
                className={errosCriar.nome ? 'border-red-400 focus-visible:ring-red-300' : ''}
                disabled={saving}
              />
              {errosCriar.nome && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosCriar.nome}</p>}
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrosCriar(p => ({ ...p, email: undefined })) }}
                placeholder="joao@empresa.com.br"
                className={errosCriar.email ? 'border-red-400 focus-visible:ring-red-300' : ''}
                disabled={saving}
              />
              {errosCriar.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosCriar.email}</p>}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Senha inicial</Label>
              <div className="relative">
                <Input
                  type={form.senhaVisivel ? 'text' : 'password'}
                  value={form.senha}
                  onChange={e => { setForm(p => ({ ...p, senha: e.target.value })); setErrosCriar(p => ({ ...p, senha: undefined })) }}
                  placeholder="Mínimo 6 caracteres"
                  className={`pr-10 ${errosCriar.senha ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                  disabled={saving}
                />
                <button type="button" onClick={() => setForm(p => ({ ...p, senhaVisivel: !p.senhaVisivel }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {form.senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errosCriar.senha && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosCriar.senha}</p>}
            </div>

            {/* Empresas */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Acesso às empresas</Label>
              <div className="space-y-2">
                {empresas.map(e => {
                  const checked = selectedEmpresas.has(e.id)
                  return (
                    <button key={e.id} type="button" onClick={() => toggleEmpresa(e.id)} disabled={saving}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        checked ? 'border-[#1E5AA8]/40 bg-[#EDF4FE]' : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${checked ? 'bg-[#1E5AA8]' : 'bg-slate-200'}`}>
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

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-2.5 justify-end">
            <Button variant="outline" size="sm" onClick={() => setCriarOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={criar} disabled={saving} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white gap-1.5">
              {saving ? 'Criando...' : <><Check size={13} /> Criar usuário</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar Usuário ────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={v => { if (!v && !editando) setEditOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil size={16} className="text-slate-500" />
              Editar Usuário
            </DialogTitle>
            {editTarget && (
              <p className="text-xs text-slate-400 mt-0.5">{editTarget.email}</p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome completo</Label>
              <Input
                value={editForm.nome}
                onChange={e => { setEditForm(p => ({ ...p, nome: e.target.value })); setErrosEdit(p => ({ ...p, nome: undefined })) }}
                placeholder="Nome completo"
                className={errosEdit.nome ? 'border-red-400' : ''}
                disabled={editando}
              />
              {errosEdit.nome && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosEdit.nome}</p>}
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => { setEditForm(p => ({ ...p, email: e.target.value })); setErrosEdit(p => ({ ...p, email: undefined })) }}
                placeholder="email@empresa.com"
                className={errosEdit.email ? 'border-red-400' : ''}
                disabled={editando}
              />
              {errosEdit.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosEdit.email}</p>}
            </div>

            {/* Nova senha (opcional) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Nova senha <span className="text-slate-400 font-normal">(deixe em branco para manter)</span>
              </Label>
              <div className="relative">
                <Input
                  type={editForm.senhaVisivel ? 'text' : 'password'}
                  value={editForm.senha}
                  onChange={e => { setEditForm(p => ({ ...p, senha: e.target.value })); setErrosEdit(p => ({ ...p, senha: undefined })) }}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className={`pr-10 ${errosEdit.senha ? 'border-red-400' : ''}`}
                  disabled={editando}
                />
                <button type="button" onClick={() => setEditForm(p => ({ ...p, senhaVisivel: !p.senhaVisivel }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {editForm.senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errosEdit.senha && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errosEdit.senha}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editando}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={editando} className="bg-[#1E5AA8] hover:bg-[#174d92] text-white">
              {editando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Dialog: Confirmar Exclusão ────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v && !excluindo) { setDeleteTarget(null); setConfirmNome('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={18} />
              Excluir usuário permanentemente
            </DialogTitle>
          </DialogHeader>

          {deleteTarget && (
            <div className="py-1 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm font-semibold text-slate-800">{deleteTarget.nome}</p>
                <p className="text-xs text-slate-500">{deleteTarget.email}</p>
              </div>

              <p className="text-sm text-slate-600">
                Esta ação é <strong className="text-red-600">irreversível</strong>. O usuário perderá acesso imediatamente e todos os vínculos com empresas serão removidos.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Para confirmar, digite o nome do usuário:
                  <span className="ml-1 font-bold text-slate-800 select-none">{deleteTarget.nome}</span>
                </Label>
                <Input
                  value={confirmNome}
                  onChange={e => setConfirmNome(e.target.value)}
                  placeholder={deleteTarget.nome}
                  disabled={excluindo}
                  className={`text-sm ${confirmNome === deleteTarget.nome ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                  onPaste={e => e.preventDefault()}
                />
                {confirmNome.length > 0 && confirmNome !== deleteTarget.nome && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={11} /> Nome não confere
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setConfirmNome('') }} disabled={excluindo}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarExclusao}
              disabled={excluindo || !deleteTarget || confirmNome !== deleteTarget.nome}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {excluindo ? 'Excluindo...' : 'Excluir permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
