'use client'

import { useState } from 'react'
import { UserPlus, Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { parseSupabaseError, logError } from '@/lib/utils/errors'
import { toast } from 'sonner'
import type { ClienteFactoring } from '@/lib/types/database'

type ClienteSumario = Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'limite_credito' | 'credito_disponivel' | 'score_interno'>

function validarCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i)
  let r = (s * 10) % 11; if (r >= 10) r = 0
  if (r !== +c[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i)
  r = (s * 10) % 11; if (r >= 10) r = 0
  return r === +c[10]
}

function mascaraCPF(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function mascaraCNPJ(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

interface QuickNovoClienteSheetProps {
  open: boolean
  onClose: () => void
  onClienteCriado: (cliente: ClienteSumario) => void
}

export function QuickNovoClienteSheet({ open, onClose, onClienteCriado }: QuickNovoClienteSheetProps) {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [salvando, setSalvando] = useState(false)
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica'>('fisica')
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')

  const resetForm = () => {
    setTipoPessoa('fisica')
    setNome('')
    setDocumento('')
    setTelefone('')
    setEmail('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleDocumento = (v: string) => {
    if (tipoPessoa === 'fisica') setDocumento(mascaraCPF(v))
    else setDocumento(mascaraCNPJ(v))
  }

  const cadastrar = async () => {
    if (!empresaAtual) return

    if (!nome.trim()) { toast.error('Nome é obrigatório'); return }
    const telDigitos = telefone.replace(/\D/g, '')
    if (telDigitos.length < 10) { toast.error('Telefone inválido — mínimo 10 dígitos'); return }

    const docRaw = documento.replace(/\D/g, '')
    if (tipoPessoa === 'fisica' && docRaw.length > 0 && !validarCPF(docRaw)) {
      toast.error('CPF inválido — verifique o número')
      return
    }

    setSalvando(true)
    try {
      const { data, error } = await supabase
        .from('clientes_factoring')
        .insert({
          empresa_id: empresaAtual.id,
          nome: nome.trim(),
          cpf: tipoPessoa === 'fisica' ? (docRaw || null) : null,
          telefone: telDigitos,
          email: email.trim() || null,
          limite_credito: 0,
          credito_utilizado: 0,
          score_interno: 50,
          total_emprestimos: 0,
          valor_total_emprestado: 0,
          documentos: [],
          status: 'ativo',
        })
        .select('id, nome, cpf, telefone, limite_credito, credito_disponivel, score_interno')
        .single()

      if (error) throw error
      if (!data) throw new Error('Nenhum dado retornado')

      toast.success(`${nome.trim()} cadastrado com sucesso!`)
      onClienteCriado(data as ClienteSumario)
      handleClose()
    } catch (err) {
      logError('quickNovoCliente', err)
      toast.error(parseSupabaseError(err, 'Erro ao cadastrar cliente'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0 border-l border-border">
        <SheetHeader className="px-6 pt-6 pb-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gt-blue-light)' }}>
              <UserPlus size={16} style={{ color: 'var(--gt-blue)' }} />
            </div>
            Cadastro de Cliente
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Preencha os dados essenciais. Informações complementares podem ser adicionadas no perfil do cliente depois.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-5 py-6">
          {/* Tipo de pessoa */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de Pessoa</Label>
            <div className="flex gap-2 p-1 rounded-xl border border-border bg-muted/30">
              {(['fisica', 'juridica'] as const).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => { setTipoPessoa(tipo); setDocumento('') }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={tipoPessoa === tipo
                    ? { backgroundColor: 'var(--gt-blue)', color: '#fff', boxShadow: 'var(--shadow-m3-1)' }
                    : { backgroundColor: 'transparent', color: 'var(--muted-foreground)' }}
                >
                  {tipo === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{tipoPessoa === 'fisica' ? 'Nome Completo' : 'Razão Social'} <span style={{ color: 'var(--gt-red)' }}>*</span></Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder={tipoPessoa === 'fisica' ? 'João da Silva' : 'Empresa Ltda'}
              autoFocus
              className="h-11 rounded-xl"
            />
          </div>

          {/* CPF / CNPJ */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'}</Label>
            <Input
              value={documento}
              onChange={e => handleDocumento(e.target.value)}
              placeholder={tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
              inputMode="numeric"
              className="h-11 rounded-xl tabular-nums"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Telefone <span style={{ color: 'var(--gt-red)' }}>*</span></Label>
            <Input
              value={telefone}
              onChange={e => setTelefone(mascaraTelefone(e.target.value))}
              placeholder="(11) 90000-0000"
              inputMode="tel"
              className="h-11 rounded-xl tabular-nums"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="px-6 py-5 border-t border-border flex gap-3 bg-card">
          <Button variant="outline" className="flex-1 h-11 rounded-xl font-medium" onClick={handleClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2 h-11 rounded-xl font-semibold text-white"
            style={{ backgroundColor: 'var(--gt-blue)' }}
            onClick={cadastrar}
            disabled={salvando}
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {salvando ? 'Cadastrando...' : 'Cadastrar Cliente'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
