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
import { UserPlus, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

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
      const client = createClient()
      const [configRes, usuariosRes] = await Promise.all([
        client
          .from('config_factoring')
          .select('*')
          .eq('empresa_id', empresaAtual.id)
          .maybeSingle(),
        client
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
  }, [empresaAtual])

  useEffect(() => {
    if (!ctxLoading && empresaAtual) carregarDados()
  }, [ctxLoading, empresaAtual, carregarDados])

  async function salvarFinanceiro() {
    if (!empresaAtual) return
    setSaving(true)
    try {
      const parseSaldo = parseFloat(saldoInicialCaixa)
      const payload = {
        empresa_id: empresaAtual.id,
        taxa_juros_padrao: parseFloat(taxaJurosPadrao) || 5,
        juros_mora_diario: parseFloat(jurosMoraDiario) || 0.033,
        saldo_inicial_caixa: isNaN(parseSaldo) ? 0 : parseSaldo,
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
      const { data: saved, error } = await supabase
        .from('config_factoring')
        .upsert(payload, { onConflict: 'empresa_id' })
        .select()
        .single()
      if (error) throw error
      if (saved) setConfig(saved as ConfigFactoring)
      toast.success('Configurações salvas!')
    } catch (err) {
      console.error('Erro ao salvar configurações:', err)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  async function alterarPapel(ueId: string, papel: PapelUsuario) {
    if (!empresaAtual) return
    try {
      const { error } = await supabase.from('usuario_empresa').update({ papel }).eq('id', ueId).eq('empresa_id', empresaAtual.id)
      if (error) throw error
      setUsuarios(prev => prev.map(u => u.ue_id === ueId ? { ...u, papel } : u))
      toast.success('Papel atualizado')
    } catch {
      toast.error('Erro ao atualizar papel')
    }
  }

  async function toggleAtivo(ueId: string, ativo: boolean) {
    if (!empresaAtual) return
    try {
      const { error } = await supabase.from('usuario_empresa').update({ ativo: !ativo }).eq('id', ueId).eq('empresa_id', empresaAtual.id)
      if (error) throw error
      setUsuarios(prev => prev.map(u => u.ue_id === ueId ? { ...u, ativo: !ativo } : u))
      toast.success(ativo ? 'Usuário desativado' : 'Usuário ativado')
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  async function removerUsuario(ueId: string) {
    if (!empresaAtual) return
    if (!confirm('Remover este usuário da empresa?')) return
    try {
      const { error } = await supabase.from('usuario_empresa').delete().eq('id', ueId).eq('empresa_id', empresaAtual.id)
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
          <p className="font-bold text-foreground leading-none">{row.nome}</p>
          <p className="text-xs text-muted-foreground mt-1">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'papel',
      header: 'Papel',
      render: row => (
        <Select value={row.papel} onValueChange={(v) => alterarPapel(row.ue_id, (v ?? 'operador') as PapelUsuario)}>
          <SelectTrigger className="h-8 text-xs w-36 rounded-full border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
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
          className={cn(
            "px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 border",
            row.ativo 
              ? "bg-[var(--gt-green-light)] text-[var(--gt-green)] border-[var(--gt-green-light)] hover:bg-[var(--gt-green-light)]/85" 
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          )}
        >
          {row.ativo ? 'Ativo' : 'Inativo'}
        </button>
      ),
    },
    {
      key: 'acoes',
      header: '',
      render: row => (
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full h-8 w-8 p-0 flex items-center justify-center" onClick={() => removerUsuario(row.ue_id)}>
          <Trash2 size={15} />
        </Button>
      ),
    },
  ]

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
              value="usuarios" 
              className="rounded-full px-5 py-2 font-bold text-xs tracking-tight transition-all duration-200 data-[state=active]:bg-[var(--gt-blue)] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Usuários
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
                    type="number"
                    step="0.01"
                    min={0}
                    value={taxaJurosPadrao}
                    onChange={e => setTaxaJurosPadrao(e.target.value)}
                    placeholder="5.00"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Taxa padrão aplicada ao criar um novo empréstimo.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="juros-mora" className="font-semibold text-xs text-foreground/80">Juros de mora diário (%)</Label>
                  <Input
                    id="juros-mora"
                    type="number"
                    step="0.001"
                    min={0}
                    value={jurosMoraDiario}
                    onChange={e => setJurosMoraDiario(e.target.value)}
                    placeholder="0.033"
                    className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
                  />
                  <p className="text-xs text-muted-foreground/60 leading-normal">Cobrado a cada dia corrido após o vencimento (juros simples acumulado).</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="saldo-inicial" className="font-semibold text-xs text-foreground/80">Saldo inicial do caixa (R$)</Label>
                  <Input
                    id="saldo-inicial"
                    type="number"
                    step="0.01"
                    min={0}
                    value={saldoInicialCaixa}
                    onChange={e => setSaldoInicialCaixa(e.target.value)}
                    placeholder="0.00"
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

          {/* ── Usuários ── */}
          <TabsContent value="usuarios">
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Membros da Equipe</h2>
                  <p className="text-sm text-muted-foreground mt-1">Controle quem tem acesso operacional ao sistema.</p>
                </div>
                <Button 
                  onClick={() => setDialogConvidar(true)} 
                  className="h-10 text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 rounded-full px-5 font-medium shadow-sm flex items-center gap-2 transition-all duration-200 shrink-0"
                >
                  <UserPlus size={16} />
                  Adicionar Usuário
                </Button>
              </div>

              <div className="border-t border-border/40 pt-5">
                <DataTable<UsuarioRow>
                  columns={colunasUsuarios}
                  data={usuarios}
                  keyExtractor={r => r.ue_id}
                  loading={loadingUsuarios}
                  emptyMessage="Nenhum usuário cadastrado nesta factoring."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Novo Usuário */}
      <Dialog open={dialogConvidar} onOpenChange={setDialogConvidar}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border border-border/50 shadow-m3-3 bg-card gap-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-bold text-foreground tracking-tight leading-snug">
              Adicionar Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="novo-nome" className="font-semibold text-xs text-foreground/80">Nome completo</Label>
              <Input 
                id="novo-nome" 
                value={novoNome} 
                onChange={e => setNovoNome(e.target.value)} 
                placeholder="Nome do usuário" 
                className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novo-email" className="font-semibold text-xs text-foreground/80">E-mail corporativo</Label>
              <Input 
                id="novo-email" 
                type="email" 
                value={novoEmail} 
                onChange={e => setNovoEmail(e.target.value)} 
                placeholder="email@exemplo.com" 
                className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-senha" className="font-semibold text-xs text-foreground/80">Senha temporária</Label>
              <Input 
                id="nova-senha" 
                type="password" 
                value={novaSenha} 
                onChange={e => setNovaSenha(e.target.value)} 
                placeholder="Mínimo 6 caracteres" 
                className="h-11 rounded-xl bg-card border-border/60 focus-visible:ring-1 focus-visible:ring-[var(--gt-blue)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novo-papel" className="font-semibold text-xs text-foreground/80">Nível de Permissão (Papel)</Label>
              <Select value={novoPapel} onValueChange={(v) => setNovoPapel((v ?? 'operador') as PapelUsuario)}>
                <SelectTrigger id="novo-papel" className="h-11 rounded-xl border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="admin">Admin (Acesso Total)</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="operador">Operador (Apenas Operações)</SelectItem>
                  <SelectItem value="visualizador">Visualizador (Apenas Leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2.5 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogConvidar(false)} 
              disabled={criandoUsuario}
              className="h-10 rounded-full border-border hover:bg-muted text-sm font-medium px-5 flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button 
              onClick={convidarUsuario} 
              disabled={criandoUsuario} 
              className="h-10 rounded-full text-sm font-medium px-5 flex-1 sm:flex-none text-white bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] border-0 transition-all duration-200 shadow-m3-1"
            >
              {criandoUsuario ? 'Adicionando...' : 'Adicionar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
