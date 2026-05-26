'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { ConfigFactoring, PapelUsuario } from '@/lib/types/database'
import { UserPlus, Trash2 } from 'lucide-react'

type UsuarioRow = {
  ue_id: string
  usuario_id: string
  nome: string
  email: string
  papel: PapelUsuario
  ativo: boolean
}

export default function ConfiguracoesFactoringPage() {
  const supabase = createClient()
  const { empresaAtual, loading: ctxLoading } = useEmpresa()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ConfigFactoring | null>(null)

  // Financeiro
  const [taxaJurosPadrao, setTaxaJurosPadrao] = useState('5')
  const [jurosMoraDiario, setJurosMoraDiario] = useState('0.033')
  const [saldoInicialCaixa, setSaldoInicialCaixa] = useState('0')

  // Usuários
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loadingUsuarios] = useState(false)
  const [dialogConvidar, setDialogConvidar] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoPapel, setNovoPapel] = useState<PapelUsuario>('operador')
  const [criandoUsuario, setCriandoUsuario] = useState(false)

  const carregarDados = useCallback(async () => {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [configRes, usuariosRes] = await Promise.all([
        supabase
          .from('config_factoring')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
        supabase
          .from('usuario_empresa')
          .select('id, usuario_id, papel, ativo, usuarios(id, nome, email)')
          .eq('empresa_id', empresaAtual.id),
      ])

      if (configRes.data) {
        const c = configRes.data as ConfigFactoring
        setConfig(c)
        setTaxaJurosPadrao(String(c.taxa_juros_padrao))
        setJurosMoraDiario(String(c.juros_mora_diario))
        setSaldoInicialCaixa(String(c.saldo_inicial_caixa ?? 0))
      }

      if (usuariosRes.data) {
        setUsuarios(usuariosRes.data.map((ue) => {
          const u = ue.usuarios as unknown as { id: string; nome: string; email: string } | null
          return {
            ue_id: ue.id,
            usuario_id: ue.usuario_id,
            nome: u?.nome ?? '—',
            email: u?.email ?? '—',
            papel: ue.papel as PapelUsuario,
            ativo: ue.ativo,
          }
        }))
      }
    } catch {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [empresaAtual, supabase])

  useEffect(() => {
    if (!ctxLoading && empresaAtual) carregarDados()
  }, [ctxLoading, empresaAtual, carregarDados])

  async function salvarFinanceiro() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const payload = {
        empresa_id: empresaAtual.id,
        taxa_juros_padrao: parseFloat(taxaJurosPadrao) || 5,
        juros_mora_diario: parseFloat(jurosMoraDiario) || 0.033,
        saldo_inicial_caixa: parseFloat(saldoInicialCaixa) || 0,
        // preserva valores existentes para campos não expostos na UI
        tipo_taxa_padrao: config?.tipo_taxa_padrao ?? 'mensal',
        multa_atraso: config?.multa_atraso ?? 2,
        dias_carencia: config?.dias_carencia ?? 0,
        prazo_minimo_meses: config?.prazo_minimo_meses ?? 3,
        prazo_maximo_meses: config?.prazo_maximo_meses ?? 60,
        valor_minimo_emprestimo: config?.valor_minimo_emprestimo ?? 500,
        valor_maximo_emprestimo: config?.valor_maximo_emprestimo ?? 50000,
        whatsapp_padrao: config?.whatsapp_padrao ?? null,
        prefixo_contrato: config?.prefixo_contrato ?? 'FAC',
      }
      if (config) {
        const { error } = await supabase.from('config_factoring').update(payload).eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('config_factoring').insert(payload)
        if (error) throw error
      }
      toast.success('Configurações salvas!')
      await carregarDados()
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  async function alterarPapel(ueId: string, papel: PapelUsuario) {
    try {
      const { error } = await supabase.from('usuario_empresa').update({ papel }).eq('id', ueId)
      if (error) throw error
      setUsuarios(prev => prev.map(u => u.ue_id === ueId ? { ...u, papel } : u))
      toast.success('Papel atualizado')
    } catch {
      toast.error('Erro ao atualizar papel')
    }
  }

  async function toggleAtivo(ueId: string, ativo: boolean) {
    try {
      const { error } = await supabase.from('usuario_empresa').update({ ativo: !ativo }).eq('id', ueId)
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
      const { error } = await supabase.from('usuario_empresa').delete().eq('id', ueId)
      if (error) throw error
      setUsuarios(prev => prev.filter(u => u.ue_id !== ueId))
      toast.success('Usuário removido')
    } catch {
      toast.error('Erro ao remover usuário')
    }
  }

  async function convidarUsuario() {
    if (!empresaAtual) return
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
      if (!res.ok) { toast.error(data.error ?? 'Erro ao criar usuário'); return }
      toast.success('Usuário criado com sucesso!')
      setDialogConvidar(false)
      setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoPapel('operador')
      await carregarDados()
    } catch {
      toast.error('Erro ao criar usuário')
    } finally {
      setCriandoUsuario(false)
    }
  }

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
        <Select value={row.papel} onValueChange={(v) => alterarPapel(row.ue_id, (v ?? 'operador') as PapelUsuario)}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
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
            row.ativo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {row.ativo ? 'Ativo' : 'Inativo'}
        </button>
      ),
    },
    {
      key: 'acoes',
      header: '',
      render: row => (
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removerUsuario(row.ue_id)}>
          <Trash2 size={15} />
        </Button>
      ),
    },
  ]

  if (ctxLoading || loading) return <LoadingPage />

  return (
    <AppShell empresa="factoring" titulo="Configurações">
      <div className="max-w-3xl mx-auto space-y-6">
        <Tabs defaultValue="financeiro" className="w-full">
          <TabsList className="mb-6 bg-[#EDF4FE] border border-[#1E5AA8]/20 h-auto gap-1 p-1">
            <TabsTrigger value="financeiro" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white">
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white">
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* ── Financeiro ── */}
          <TabsContent value="financeiro">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Taxas</h2>
                <p className="text-sm text-slate-500">Defina as taxas padrão aplicadas nos contratos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="taxa-juros">Taxa de juros (%)</Label>
                  <Input
                    id="taxa-juros"
                    type="number"
                    step="0.01"
                    min={0}
                    value={taxaJurosPadrao}
                    onChange={e => setTaxaJurosPadrao(e.target.value)}
                    placeholder="5.00"
                  />
                  <p className="text-xs text-slate-400">Taxa padrão aplicada ao criar um novo empréstimo</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="juros-mora">Taxa por dia de atraso (%)</Label>
                  <Input
                    id="juros-mora"
                    type="number"
                    step="0.001"
                    min={0}
                    value={jurosMoraDiario}
                    onChange={e => setJurosMoraDiario(e.target.value)}
                    placeholder="0.033"
                  />
                  <p className="text-xs text-slate-400">Cobrado a cada dia corrido após o vencimento — acumula diariamente</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saldo-inicial">Saldo inicial do caixa (R$)</Label>
                  <Input
                    id="saldo-inicial"
                    type="number"
                    step="0.01"
                    min={0}
                    value={saldoInicialCaixa}
                    onChange={e => setSaldoInicialCaixa(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-400">Valor de partida do caixa — base para o saldo atual exibido no dashboard</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={salvarFinanceiro} disabled={saving} className="bg-[#1E5AA8] hover:bg-[#174d93] text-white">
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Usuários ── */}
          <TabsContent value="usuarios">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Usuários</h2>
                  <p className="text-sm text-slate-500">Gerencie quem tem acesso a esta factoring.</p>
                </div>
                <Button onClick={() => setDialogConvidar(true)} className="bg-[#1E5AA8] hover:bg-[#174d93] text-white gap-2">
                  <UserPlus size={16} />
                  Novo Usuário
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

      {/* Dialog: Novo Usuário */}
      <Dialog open={dialogConvidar} onOpenChange={setDialogConvidar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="novo-nome">Nome completo</Label>
              <Input id="novo-nome" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-email">E-mail</Label>
              <Input id="novo-email" type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha inicial</Label>
              <Input id="nova-senha" type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-papel">Papel</Label>
              <Select value={novoPapel} onValueChange={(v) => setNovoPapel((v ?? 'operador') as PapelUsuario)}>
                <SelectTrigger id="novo-papel"><SelectValue /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setDialogConvidar(false)} disabled={criandoUsuario}>Cancelar</Button>
            <Button onClick={convidarUsuario} disabled={criandoUsuario} className="bg-[#1E5AA8] hover:bg-[#174d93] text-white">
              {criandoUsuario ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
