'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { 
  User, Mail, Phone, Lock, Save, ShieldCheck, Loader2, KeyRound, Building2
} from 'lucide-react'

export default function MeuPerfilPage() {
  const router = useRouter()
  const { user, perfil, atualizarPerfil } = useAuth()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  // Form profile states
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  // Form security states
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? '')
      setTelefone(perfil.telefone ?? '')
      setAvatarUrl(perfil.avatar_url ?? '')
    }
  }, [perfil])

  const formatarTelefoneInput = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11)
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    }
    return d
  }

  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    setSalvandoPerfil(true)
    try {
      await atualizarPerfil({
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, '') || null,
        avatar_url: avatarUrl || null
      })
      toast.success('Perfil atualizado com sucesso!')
    } catch (err) {
      toast.error('Erro ao atualizar perfil')
      console.error(err)
    } finally {
      setSalvandoPerfil(false)
    }
  }

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!senhaNova) {
      toast.error('Senha nova é obrigatória')
      return
    }
    if (senhaNova.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (senhaNova !== senhaConfirma) {
      toast.error('As senhas não coincidem')
      return
    }

    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senhaNova })
      if (error) throw error

      toast.success('Senha atualizada com sucesso!')
      setSenhaNova('')
      setSenhaConfirma('')
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao atualizar senha')
      console.error(err)
    } finally {
      setSalvandoSenha(false)
    }
  }

  const iniciais = nome
    ? nome.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'US'

  return (
    <AppShell titulo="Meu Perfil">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Profile Info Card */}
        <div className="bg-card border border-border/80 shadow-m3-1 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-primary/20 shadow-md">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={nome} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-extrabold">
                  {iniciais}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <h2 className="text-2xl font-extrabold text-foreground tracking-tight">{nome || 'Usuário'}</h2>
                <Badge variant="secondary" className="w-fit mx-auto md:mx-0 bg-primary/10 text-primary hover:bg-primary/20 border-primary/10">
                  Operador
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center justify-center md:justify-start gap-1.5 font-medium">
                <Mail size={14} className="text-muted-foreground/60" /> {user?.email}
              </p>
              {empresaAtual && (
                <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1.5">
                  <Building2 size={13} className="text-muted-foreground/60" /> Empresa: <span className="font-semibold text-foreground">{empresaAtual.nome}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Dados Cadastrais */}
          <Card className="rounded-2xl border border-border/80 shadow-m3-1">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <User size={18} className="text-primary" />
                <CardTitle className="text-lg font-bold">Dados Pessoais</CardTitle>
              </div>
              <CardDescription>Atualize seu nome e dados de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSalvarPerfil} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="perfil-nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome Completo</Label>
                  <div className="relative">
                    <Input
                      id="perfil-nome"
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="pl-9 h-11 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                    />
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perfil-telefone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Input
                      id="perfil-telefone"
                      value={telefone}
                      onChange={e => setTelefone(formatarTelefoneInput(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="pl-9 h-11 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                    />
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perfil-avatar" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL do Avatar</Label>
                  <div className="relative">
                    <Input
                      id="perfil-avatar"
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      placeholder="https://exemplo.com/foto.jpg"
                      className="pl-9 h-11 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                    />
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                </div>

                <Button type="submit" disabled={salvandoPerfil} className="w-full gap-2 h-11 rounded-xl font-semibold text-sm">
                  {salvandoPerfil ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar Alterações
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Card: Segurança & Senha */}
          <Card className="rounded-2xl border border-border/80 shadow-m3-1">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-primary" />
                <CardTitle className="text-lg font-bold">Segurança</CardTitle>
              </div>
              <CardDescription>Altere sua senha de acesso</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAlterarSenha} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="perfil-senha-nova" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="perfil-senha-nova"
                      type="password"
                      value={senhaNova}
                      onChange={e => setSenhaNova(e.target.value)}
                      placeholder="No mínimo 6 caracteres"
                      className="pl-9 h-11 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                    />
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perfil-senha-confirma" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="perfil-senha-confirma"
                      type="password"
                      value={senhaConfirma}
                      onChange={e => setSenhaConfirma(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="pl-9 h-11 focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                    />
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  </div>
                </div>

                <Button type="submit" disabled={salvandoSenha} className="w-full gap-2 h-11 rounded-xl font-semibold text-sm">
                  {salvandoSenha ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Atualizar Senha
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
