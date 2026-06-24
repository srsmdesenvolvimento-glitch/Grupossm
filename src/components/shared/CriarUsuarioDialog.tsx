'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  empresaId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CriarUsuarioDialog({ empresaId, open, onOpenChange, onSuccess }: Props) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function reset() {
    setNome('')
    setEmail('')
    setSenha('')
    setMostrarSenha(false)
  }

  function fechar() {
    if (salvando) return
    onOpenChange(false)
    reset()
  }

  async function criar() {
    const nomeTrimmed = nome.trim()
    const emailTrimmed = email.trim().toLowerCase()

    if (!nomeTrimmed || nomeTrimmed.length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error('E-mail inválido')
      return
    }
    if (senha.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch('/api/auth/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeTrimmed,
          email: emailTrimmed,
          senha,
          papel: 'admin', // acesso total — sem hierarquia
          empresa_id: empresaId,
        }),
      })
      const data = await res.json() as { error?: string; sucesso?: boolean }
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar usuário')
        return
      }
      toast.success(`Usuário "${nomeTrimmed}" criado com sucesso!`)
      onOpenChange(false)
      reset()
      onSuccess()
    } catch {
      toast.error('Erro ao criar usuário. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) fechar(); else onOpenChange(true) }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus size={18} className="text-slate-600" />
            Novo Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cu-nome" className="text-sm font-medium">
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cu-nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Maria Silva"
              autoComplete="off"
              disabled={salvando}
              onKeyDown={e => e.key === 'Enter' && criar()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-email" className="text-sm font-medium">
              E-mail <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              autoComplete="off"
              disabled={salvando}
              onKeyDown={e => e.key === 'Enter' && criar()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cu-senha" className="text-sm font-medium">
              Senha inicial <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="cu-senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
                autoComplete="new-password"
                disabled={salvando}
                onKeyDown={e => e.key === 'Enter' && criar()}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {senha.length > 0 && senha.length < 6 && (
              <p className="text-xs text-red-500">Senha muito curta</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar usuário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
