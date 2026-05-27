'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  User, Phone, MapPin, CreditCard, Users, FileText, CheckCircle2,
  ChevronLeft, ChevronRight, Search, Building2, CheckCircle, XCircle,
  Loader2, AlertCircle, Camera, Home, Banknote, Paperclip, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatarCPF, formatarTelefone } from '@/lib/utils/formatters'
import { parseSupabaseError, logError } from '@/lib/utils/errors'
import { buscarEnderecoPorCep } from '@/lib/utils/cep'
import {
  CATEGORIAS_DOCUMENTO, uploadDocumentoCliente, formatarTamanho, ehImagem,
  type DocumentoMeta,
} from '@/lib/utils/storage'
import { toast } from 'sonner'

// ── Validadores locais ────────────────────────────────────────────────────────
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

function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const calc = (s: string, w: number[]) => {
    const rem = w.reduce((a, x, i) => a + +s[i] * x, 0) % 11
    return rem < 2 ? 0 : 11 - rem
  }
  return calc(c, [5,4,3,2,9,8,7,6,5,4,3,2]) === +c[12] &&
         calc(c, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === +c[13]
}

function mascaraCPF(v: string) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})$/,'$1-$2')
}

function mascaraCNPJ(v: string) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/(\d{2})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2')
    .replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}

const STEPS = [
  { label: 'Dados Pessoais', icon: User },
  { label: 'Contato', icon: Phone },
  { label: 'Endereço', icon: MapPin },
  { label: 'Bancário', icon: CreditCard },
  { label: 'Referências', icon: Users },
  { label: 'Documentos', icon: FileText },
  { label: 'Revisão', icon: CheckCircle2 },
]

type Referencia = { nome: string; parentesco: string; telefone: string }

const emptyRef = (): Referencia => ({ nome: '', parentesco: '', telefone: '' })

const ICONES_CATEGORIA: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  foto:                   Camera,
  rg_cnh:                 CreditCard,
  cpf:                    FileText,
  comprovante_residencia: Home,
  comprovante_renda:      Banknote,
  outro:                  Paperclip,
}

export default function NovoClienteFactoringPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [clienteCriadoId, setClienteCriadoId] = useState<string | null>(null)

  // Tipo de pessoa
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica'>('fisica')
  const [cnpj, setCnpj] = useState('')
  const [cnpjConsultado, setCnpjConsultado] = useState<Record<string, unknown> | null>(null)

  // Step 1 — Dados pessoais
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [rg, setRg] = useState('')
  const [orgaoEmissor, setOrgaoEmissor] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [estadoCivil, setEstadoCivil] = useState('')
  const [profissao, setProfissao] = useState('')
  const [rendaMensal, setRendaMensal] = useState('')

  // Step 2 — Contato
  const [telefone, setTelefone] = useState('')
  const [telefone2, setTelefone2] = useState('')
  const [email, setEmail] = useState('')

  // Step 3 — Endereço
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')

  // Step 4 — Bancário
  const [banco, setBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [tipoConta, setTipoConta] = useState('')
  const [pix, setPix] = useState('')

  // Step 5 — Referências
  const [referencias, setReferencias] = useState<Referencia[]>([emptyRef(), emptyRef(), emptyRef()])

  const setRef = (idx: number, field: keyof Referencia, value: string) => {
    setReferencias(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  // Step 6 — Documentos
  const [arquivosPendentes, setArquivosPendentes] = useState<Map<string, File>>(new Map())
  const [previews, setPreviews] = useState<Map<string, string>>(new Map())

  const adicionarArquivo = useCallback((categoriaId: string, file: File) => {
    setArquivosPendentes(prev => new Map(prev).set(categoriaId, file))
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreviews(prev => new Map(prev).set(categoriaId, e.target?.result as string))
      reader.readAsDataURL(file)
    } else {
      setPreviews(prev => { const m = new Map(prev); m.delete(categoriaId); return m })
    }
  }, [])

  const removerArquivo = useCallback((categoriaId: string) => {
    setArquivosPendentes(prev => { const m = new Map(prev); m.delete(categoriaId); return m })
    setPreviews(prev => { const m = new Map(prev); m.delete(categoriaId); return m })
  }, [])

  const buscarCep = useCallback(async (cepDigitos?: string) => {
    const c = (cepDigitos ?? cep).replace(/\D/g, '')
    if (c.length !== 8) { toast.error('CEP inválido — deve ter 8 dígitos'); return }
    setBuscandoCep(true)
    try {
      const end = await buscarEnderecoPorCep(c)
      setEndereco(end.logradouro)
      setBairro(end.bairro)
      setCidade(end.cidade)
      setEstado(end.estado)
      toast.success(`Endereço preenchido — ${end.cidade}/${end.estado}`)
    } catch (err) {
      logError('buscarCep', err)
      const msg = err instanceof Error ? err.message : 'Erro ao buscar CEP'
      toast.error(msg)
    } finally {
      setBuscandoCep(false)
    }
  }, [cep])

  // Auto-busca ao completar 8 dígitos
  useEffect(() => {
    const c = cep.replace(/\D/g, '')
    if (c.length === 8) buscarCep(c)
  }, [cep, buscarCep])

  const buscarCNPJ = async () => {
    const c = cnpj.replace(/\D/g, '')
    if (!validarCNPJ(c)) { toast.error('CNPJ inválido — verifique o número'); return }
    setBuscandoCnpj(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`)
      if (!res.ok) throw new Error()
      const data = await res.json()

      setNome(data.razao_social ?? '')

      // Telefone: BrasilAPI retorna "11 912345678"
      const tel1 = (data.ddd_telefone_1 ?? '').replace(/\D/g, '')
      if (tel1) setTelefone(tel1)

      if (data.email) setEmail(data.email.toLowerCase())

      // Endereço
      if (data.cep) setCep(data.cep.replace(/\D/g, ''))
      if (data.logradouro) setEndereco(data.logradouro)
      if (data.numero) setNumero(data.numero)
      if (data.complemento) setComplemento(data.complemento)
      if (data.bairro) setBairro(data.bairro)
      if (data.municipio) setCidade(data.municipio)
      if (data.uf) setEstado(data.uf)

      // Sócios como referências
      if (data.qsa?.length) {
        const refs = (data.qsa as Array<{ nome_socio?: string; qualificacao_socio?: string }>)
          .slice(0, 3)
          .map(s => ({ nome: s.nome_socio ?? '', parentesco: s.qualificacao_socio ?? 'Sócio', telefone: '' }))
        setReferencias([...refs, ...Array(Math.max(0, 3 - refs.length)).fill(emptyRef())])
      }

      setCnpjConsultado(data)
      const situacao = data.descricao_situacao_cadastral ?? ''
      toast.success(`${data.razao_social} — Situação: ${situacao}`)
    } catch (err) {
      logError('buscarCNPJ', err)
      toast.error('CNPJ não encontrado na Receita Federal')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  const validarStep = (): boolean => {
    if (step === 1 && !nome.trim()) { toast.error('Nome é obrigatório'); return false }
    if (step === 2 && !telefone.trim()) { toast.error('Telefone é obrigatório'); return false }
    return true
  }

  const avancar = () => {
    if (!validarStep()) return
    setStep(s => Math.min(s + 1, 7))
  }

  const voltar = () => setStep(s => Math.max(s - 1, 1))

  const cadastrar = async () => {
    if (!empresaAtual) return
    setSalvando(true)
    try {
      const { data: clienteData, error } = await supabase
        .from('clientes_factoring')
        .insert({
          empresa_id: empresaAtual.id,
          nome: nome.trim(),
          cpf: tipoPessoa === 'fisica' ? (cpf.replace(/\D/g,'') || null) : null,
          rg: rg || null,
          orgao_emissor: orgaoEmissor || null,
          data_nascimento: dataNascimento || null,
          estado_civil: estadoCivil || null,
          profissao: profissao || null,
          renda_mensal: rendaMensal ? Number(rendaMensal) : null,
          telefone: telefone.trim(),
          telefone2: telefone2 || null,
          email: email || null,
          cep: cep || null,
          endereco: endereco || null,
          numero: numero || null,
          complemento: complemento || null,
          bairro: bairro || null,
          cidade: cidade || null,
          estado: estado || null,
          banco: banco || null,
          agencia: agencia || null,
          conta: conta || null,
          tipo_conta: tipoConta || null,
          pix: pix || null,
          limite_credito: 0,
          credito_utilizado: 0,
          score_interno: 50,
          total_emprestimos: 0,
          valor_total_emprestado: 0,
          documentos: [],
          status: 'ativo',
        })
        .select('id')
        .single()

      if (error) throw error
      if (!clienteData) throw new Error('Nenhum dado retornado após inserção')

      const refs = referencias.filter(r => r.nome.trim())
      if (refs.length > 0) {
        const { error: refError } = await supabase.from('referencias_cliente_factoring').insert(
          refs.map(r => ({
            cliente_id: clienteData.id,
            nome: r.nome.trim(),
            parentesco: r.parentesco || null,
            telefone: r.telefone.trim(),
          }))
        )
        if (refError) {
          logError('cadastrar:referencias', refError)
          toast.warning('Cliente salvo, mas erro ao salvar referências')
        }
      }

      // Upload de documentos (opcional — falha não bloqueia o cadastro)
      if (arquivosPendentes.size > 0) {
        const uploads: DocumentoMeta[] = []
        for (const [categoriaId, arquivo] of arquivosPendentes) {
          try {
            const meta = await uploadDocumentoCliente(
              supabase, empresaAtual.id, clienteData.id, categoriaId, arquivo,
            )
            uploads.push(meta)
          } catch (uploadErr) {
            logError(`upload:${categoriaId}`, uploadErr)
          }
        }
        if (uploads.length > 0) {
          const { error: updateError } = await supabase
            .from('clientes_factoring')
            .update({ documentos: uploads })
            .eq('id', clienteData.id)
            .eq('empresa_id', empresaAtual.id)
          if (updateError) throw updateError
        }
        if (uploads.length < arquivosPendentes.size) {
          toast.warning(`${uploads.length} de ${arquivosPendentes.size} documentos enviados — verifique o bucket de storage`)
        }
      }

      toast.success('Cliente cadastrado com sucesso!')
      if (redirectParam) {
        router.push(`${redirectParam}?cliente_id=${clienteData.id}`)
      } else {
        setClienteCriadoId(clienteData.id)
      }
    } catch (err) {
      logError('cadastrar:cliente', err)
      toast.error(parseSupabaseError(err, 'Erro ao cadastrar cliente'))
    } finally {
      setSalvando(false)
    }
  }

  if (clienteCriadoId) {
    return (
      <AppShell empresa="factoring" titulo="Novo Cliente">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-2 p-10 flex flex-col items-center text-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#34A853]" />
            <div className="w-24 h-24 rounded-full flex items-center justify-center relative bg-[#E6F4EA] animate-pulse">
              <div className="absolute inset-2 rounded-full bg-[#34A853]/10" />
              <CheckCircle2 size={48} className="text-[#34A853] z-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Cliente Cadastrado!</h2>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                <span className="font-semibold text-foreground">{nome}</span> foi adicionado com sucesso ao sistema e já está apto para operações.
              </p>
            </div>
            <p className="text-base text-muted-foreground font-medium">
              Deseja criar um empréstimo para este cliente agora?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 h-11 rounded-full border-border hover:bg-muted/50"
                onClick={() => router.push(`/factoring/clientes/${clienteCriadoId}`)}
              >
                <User size={16} />
                Ver Perfil
              </Button>
              <Button
                className="flex-1 gap-2 text-white h-11 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] shadow-sm transition-all"
                onClick={() => router.push(`/factoring/emprestimos/novo?cliente_id=${clienteCriadoId}`)}
              >
                <Banknote size={16} />
                Criar Empréstimo
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell empresa="factoring" titulo="Novo Cliente">
      <div className="max-w-2xl mx-auto space-y-6">
        {redirectParam && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm bg-[#E8F0FE] text-[#1A73E8] border border-[#1A73E8]/20 font-medium">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>Após cadastrar, você será redirecionado automaticamente de volta ao fluxo de contratação.</span>
          </div>
        )}

        {/* Step indicator */}
        <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-5 overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none justify-between">
            {STEPS.map((s, i) => {
              const num = i + 1
              const done = step > num
              const active = step === num
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-center shrink-0 flex-1">
                  <div className="flex flex-col items-center gap-1.5 min-w-[70px] flex-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative border-2"
                      style={done
                        ? { backgroundColor: '#34A853', borderColor: '#34A853', color: '#fff' }
                        : active
                          ? { backgroundColor: '#E8F0FE', borderColor: '#1A73E8', color: '#1A73E8' }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                      {active && (
                        <span className="absolute -inset-1 rounded-full border border-[#1A73E8] animate-ping opacity-25 pointer-events-none" />
                      )}
                    </div>
                    <span
                      className="text-[11px] font-semibold text-center leading-tight transition-colors duration-300 max-w-[80px]"
                      style={{ color: active ? '#1A73E8' : done ? '#34A853' : 'var(--muted-foreground)' }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="h-0.5 w-full mx-1 rounded shrink-1 hidden sm:block transition-colors duration-500" style={{ backgroundColor: step > num ? '#34A853' : 'var(--border)' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 1: Dados Pessoais */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Identificação do Cliente</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 1 de 7</span>
            </div>

            {/* Toggle tipo pessoa */}
            <div className="flex gap-1.5 p-1 bg-muted/60 rounded-full w-fit">
              <button
                type="button"
                onClick={() => { setTipoPessoa('fisica'); setCnpj(''); setCnpjConsultado(null) }}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all ${tipoPessoa === 'fisica' ? 'bg-card shadow-sm text-[#1A73E8]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <User size={14} />
                Pessoa Física
              </button>
              <button
                type="button"
                onClick={() => { setTipoPessoa('juridica'); setCpf(''); }}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all ${tipoPessoa === 'juridica' ? 'bg-card shadow-sm text-[#1A73E8]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Building2 size={14} />
                Pessoa Jurídica
              </button>
            </div>

            {/* CPF (Pessoa Física) */}
            {tipoPessoa === 'fisica' && (() => {
              const cpfLimpo = cpf.replace(/\D/g, '')
              const cpfCompleto = cpfLimpo.length === 11
              const cpfOk = cpfCompleto && validarCPF(cpfLimpo)
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPF</Label>
                  <div className="relative">
                    <Input
                      value={cpf}
                      onChange={e => setCpf(mascaraCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={`h-11 px-4 pr-10 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all ${cpfCompleto ? (cpfOk ? 'border-[#34A853] focus-visible:ring-[#34A853]' : 'border-[#EA4335] focus-visible:ring-[#EA4335]') : ''}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cpfCompleto && (cpfOk
                        ? <CheckCircle size={18} className="text-[#34A853]" />
                        : <XCircle size={18} className="text-[#EA4335]" />
                      )}
                    </div>
                  </div>
                  {cpfCompleto && !cpfOk && (
                    <p className="text-xs text-[#EA4335] flex items-center gap-1 font-medium">
                      <AlertCircle size={13} /> CPF inválido — verifique os dígitos informados
                    </p>
                  )}
                  {cpfCompleto && cpfOk && (
                    <p className="text-xs text-[#34A853] flex items-center gap-1 font-medium">
                      <CheckCircle size={13} /> CPF validado com sucesso
                    </p>
                  )}
                </div>
              )
            })()}

            {/* CNPJ (Pessoa Jurídica) */}
            {tipoPessoa === 'juridica' && (() => {
              const cnpjLimpo = cnpj.replace(/\D/g, '')
              const cnpjCompleto = cnpjLimpo.length === 14
              const cnpjOk = cnpjCompleto && validarCNPJ(cnpjLimpo)
              return (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CNPJ</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={cnpj}
                          onChange={e => { setCnpj(mascaraCNPJ(e.target.value)); setCnpjConsultado(null) }}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          className={`h-11 px-4 pr-10 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all ${cnpjCompleto ? (cnpjOk ? 'border-[#34A853]' : 'border-[#EA4335]') : ''}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {cnpjCompleto && (cnpjOk
                            ? <CheckCircle size={18} className="text-[#34A853]" />
                            : <XCircle size={18} className="text-[#EA4335]" />
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={buscarCNPJ}
                        disabled={!cnpjOk || buscandoCnpj}
                        className="shrink-0 gap-1.5 h-11 rounded-lg border-border hover:bg-muted/50"
                      >
                        {buscandoCnpj
                          ? <Loader2 size={16} className="animate-spin text-[#1A73E8]" />
                          : <Search size={16} className="text-muted-foreground" />
                        }
                        Consultar Receita
                      </Button>
                    </div>
                    {cnpjCompleto && !cnpjOk && (
                      <p className="text-xs text-[#EA4335] flex items-center gap-1 font-medium">
                        <AlertCircle size={13} /> CNPJ inválido — verifique a numeração
                      </p>
                    )}
                  </div>

                  {/* Card com resultado da consulta */}
                  {cnpjConsultado && (() => {
                    const d = cnpjConsultado as Record<string, string | null>
                    return (
                      <div className="rounded-xl border border-[#34A853]/20 bg-[#E6F4EA] p-4 space-y-2 text-sm transition-all duration-300 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#34A853]" />
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-[#34A853] shrink-0" />
                          <p className="font-bold text-[#15803d]">{d.razao_social ?? ''}</p>
                        </div>
                        {d.nome_fantasia && (
                          <p className="text-xs text-[#15803d]/80 font-medium pl-6">Nome fantasia: {d.nome_fantasia}</p>
                        )}
                        <p className="text-xs text-[#15803d] pl-6 font-medium">
                          Situação Cadastral: <strong className="uppercase">{d.descricao_situacao_cadastral ?? ''}</strong>
                          {d.data_situacao_cadastral && ` desde ${d.data_situacao_cadastral.split('T')[0]}`}
                        </p>
                        {d.cnae_fiscal_descricao && (
                          <p className="text-xs text-muted-foreground pl-6 font-medium line-clamp-1">Atividade: {d.cnae_fiscal_descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 pl-6 mt-1 font-medium italic">Dados cadastrais, endereço e sócios foram preenchidos automaticamente.</p>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tipoPessoa === 'fisica' ? 'Nome completo *' : 'Razão social *'}</Label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder={tipoPessoa === 'fisica' ? 'Nome completo' : 'Razão social'}
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>

            {/* Campos exclusivos de pessoa física */}
            {tipoPessoa === 'fisica' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data de nascimento</Label>
                    <Input
                      type="date"
                      value={dataNascimento}
                      onChange={e => setDataNascimento(e.target.value)}
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado civil</Label>
                    <Select value={estadoCivil} onValueChange={v => setEstadoCivil(v ?? '')}>
                      <SelectTrigger className="h-11 px-4 focus:ring-1 focus:ring-[#1A73E8] focus:border-[#1A73E8] rounded-lg transition-all"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="uniao_estavel">União estável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RG</Label>
                    <Input
                      value={rg}
                      onChange={e => setRg(e.target.value)}
                      placeholder="RG"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Órgão emissor</Label>
                    <Input
                      value={orgaoEmissor}
                      onChange={e => setOrgaoEmissor(e.target.value)}
                      placeholder="SSP/SP"
                      className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profissão / Segmento</Label>
                <Input
                  value={profissao}
                  onChange={e => setProfissao(e.target.value)}
                  placeholder={tipoPessoa === 'fisica' ? 'Profissão' : 'Segmento de atuação'}
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Renda / Faturamento mensal (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm font-semibold">R$</span>
                  <Input
                    type="number"
                    min={0}
                    value={rendaMensal}
                    onChange={e => setRendaMensal(e.target.value)}
                    className="h-11 pl-9 pr-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contato */}
        {step === 2 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Informações de Contato</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 2 de 7</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone principal *</Label>
              <Input
                value={telefone}
                onChange={e => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(00) 90000-0000"
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone secundário</Label>
              <Input
                value={telefone2}
                onChange={e => setTelefone2(formatarTelefone(e.target.value))}
                placeholder="(00) 90000-0000"
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>
          </div>
        )}

        {/* Step 3: Endereço */}
        {step === 3 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Endereço Residencial / Comercial</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 3 de 7</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CEP</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={cep}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g,'').slice(0,8)
                      setCep(v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v)
                    }}
                    onKeyDown={e => e.key === 'Enter' && buscarCep()}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`h-11 px-4 pr-10 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all ${buscandoCep ? 'border-[#1A73E8]/50' : endereco ? 'border-[#34A853]' : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {buscandoCep
                      ? <Loader2 size={16} className="animate-spin text-[#1A73E8]" />
                      : endereco
                        ? <CheckCircle size={16} className="text-[#34A853]" />
                        : null
                    }
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => buscarCep()}
                  disabled={buscandoCep || cep.replace(/\D/g,'').length < 8}
                  className="shrink-0 gap-1.5 h-11 rounded-lg border-border hover:bg-muted/50 font-semibold"
                >
                  {buscandoCep ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Buscar CEP
                </Button>
              </div>
              {buscandoCep && (
                <p className="text-xs text-[#1A73E8] flex items-center gap-1 font-medium">
                  <Loader2 size={11} className="animate-spin" /> Buscando endereço nos bancos postais...
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logradouro</Label>
                <Input
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  placeholder="Rua, Av..."
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número</Label>
                <Input
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="Nº"
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Complemento</Label>
                <Input
                  value={complemento}
                  onChange={e => setComplemento(e.target.value)}
                  placeholder="Apto, Bloco..."
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bairro</Label>
                <Input
                  value={bairro}
                  onChange={e => setBairro(e.target.value)}
                  placeholder="Bairro"
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cidade</Label>
                <Input
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  placeholder="Cidade"
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</Label>
                <Input
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  placeholder="UF"
                  maxLength={2}
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Bancário */}
        {step === 4 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Informações Bancárias</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 4 de 7</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Banco</Label>
              <Input
                value={banco}
                onChange={e => setBanco(e.target.value)}
                placeholder="Nome ou código do banco"
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agência</Label>
                <Input
                  value={agencia}
                  onChange={e => setAgencia(e.target.value)}
                  placeholder="0000"
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conta</Label>
                <Input
                  value={conta}
                  onChange={e => setConta(e.target.value)}
                  placeholder="00000-0"
                  className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de conta</Label>
              <Select value={tipoConta} onValueChange={v => setTipoConta(v ?? '')}>
                <SelectTrigger className="h-11 px-4 focus:ring-1 focus:ring-[#1A73E8] focus:border-[#1A73E8] rounded-lg transition-all">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="pagamento">Conta de pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
              <Input
                value={pix}
                onChange={e => setPix(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-lg transition-all"
              />
            </div>
          </div>
        )}

        {/* Step 5: Referências */}
        {step === 5 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Referências Contatos / Pessoais</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 5 de 7</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Informe até 3 contatos de referência para segurança em análise de risco.</p>

            <div className="space-y-5">
              {referencias.map((ref, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#1A73E8]" />
                  <p className="text-xs font-bold text-[#1A73E8] uppercase tracking-wider">Referência {idx + 1}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
                      <Input
                        value={ref.nome}
                        onChange={e => setRef(idx, 'nome', e.target.value)}
                        placeholder="Nome completo"
                        className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Parentesco / Relação</Label>
                      <Input
                        value={ref.parentesco}
                        onChange={e => setRef(idx, 'parentesco', e.target.value)}
                        placeholder="Ex: Cônjuge, filho, amigo..."
                        className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Telefone</Label>
                    <Input
                      value={ref.telefone}
                      onChange={e => setRef(idx, 'telefone', formatarTelefone(e.target.value))}
                      placeholder="(00) 90000-0000"
                      className="h-10 px-3 focus-visible:ring-1 focus-visible:ring-[#1A73E8] rounded-lg"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Documentos */}
        {step === 6 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Documentos Comprobatórios</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">Etapa 6 de 7</span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Arquivos Comprobatórios (Opcional)</span>
              <span className="text-[#1A73E8] bg-[#E8F0FE] px-2.5 py-1 rounded-full">
                {arquivosPendentes.size} de {CATEGORIAS_DOCUMENTO.length} enviados
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {CATEGORIAS_DOCUMENTO.map(cat => {
                const arquivo = arquivosPendentes.get(cat.id)
                const preview = previews.get(cat.id)
                const Icone = ICONES_CATEGORIA[cat.id] ?? FileText
                const inputId = `doc-upload-${cat.id}`

                return (
                  <div key={cat.id} className="relative group">
                    {arquivo ? (
                      /* Card preenchido */
                      <div className="rounded-xl border border-[#1A73E8]/30 bg-[#E8F0FE]/40 p-4 flex flex-col items-center gap-2 min-h-[140px] relative transition-all duration-300 shadow-sm">
                        <button
                          type="button"
                          onClick={() => removerArquivo(cat.id)}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#EA4335]/10 hover:bg-[#EA4335]/20 flex items-center justify-center transition-colors"
                        >
                          <X size={11} className="text-[#EA4335]" />
                        </button>

                        {preview ? (
                          <img src={preview} alt={cat.label} className="w-16 h-16 object-cover rounded-lg shadow-sm border border-white" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-[#E8F0FE] flex items-center justify-center border border-[#1A73E8]/20">
                            <Icone size={26} className="text-[#1A73E8]" />
                          </div>
                        )}
                        <p className="text-[11px] font-bold text-[#1557B0] text-center leading-tight truncate w-full mt-1">{cat.label}</p>
                        <p className="text-[9px] text-muted-foreground/80 font-medium truncate w-full text-center">{formatarTamanho(arquivo.size)}</p>
                      </div>
                    ) : (
                      /* Card vazio — área de drop/click */
                      <label
                        htmlFor={inputId}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-[#1A73E8]/50 hover:bg-[#E8F0FE]/20 p-4 flex flex-col items-center gap-2 min-h-[140px] transition-all duration-300 group"
                      >
                        <div className="w-16 h-16 rounded-lg bg-muted/60 flex items-center justify-center mt-1 border border-transparent group-hover:border-[#1A73E8]/20 group-hover:bg-card transition-all">
                          <Icone size={26} className="text-muted-foreground/40 group-hover:text-[#1A73E8]/60 transition-colors" />
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground text-center leading-tight mt-1">{cat.label}</p>
                        <p className="text-[9px] text-[#1A73E8] font-bold">Enviar arquivo</p>
                      </label>
                    )}
                    <input
                      id={inputId}
                      type="file"
                      accept={cat.accept}
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) adicionarArquivo(cat.id, f)
                        e.target.value = ''
                      }}
                    />
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground/60 text-center font-medium">
              A ausência de documentos não impede o cadastro, podendo ser anexados posteriormente no perfil do cliente.
            </p>
          </div>
        )}

        {/* Step 7: Revisão */}
        {step === 7 && (
          <div className="bg-card rounded-2xl border border-border/80 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="font-bold text-lg text-foreground">Revisão e Confirmação</h2>
              <span className="text-xs text-[#34A853] bg-[#E6F4EA] px-2.5 py-1 rounded-full font-bold">Pronto para salvar</span>
            </div>

            {[
              { titulo: 'Dados Pessoais / Identificação', items: [
                ['Tipo', tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'],
                ['Nome / Razão', nome],
                tipoPessoa === 'fisica'
                  ? ['CPF', cpf ? formatarCPF(cpf) : '—']
                  : ['CNPJ', cnpj || '—'],
                ...( tipoPessoa === 'fisica' ? [
                  ['Nascimento', dataNascimento || '—'] as [string,string],
                  ['Estado civil', estadoCivil || '—'] as [string,string],
                ] : []),
                ['Profissão / Segmento', profissao || '—'],
                ['Renda / Faturamento', rendaMensal ? `R$ ${Number(rendaMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'],
              ]},
              { titulo: 'Contato e Comunicação', items: [
                ['Telefone principal', formatarTelefone(telefone)],
                ['Telefone secundário', telefone2 ? formatarTelefone(telefone2) : '—'],
                ['E-mail', email || '—'],
              ]},
              { titulo: 'Localização e Endereço', items: [
                ['Logradouro', [endereco, numero].filter(Boolean).join(', ') || '—'],
                ['Bairro/Cidade', [bairro, cidade, estado].filter(Boolean).join(', ') || '—'],
                ['CEP', cep || '—'],
              ]},
              { titulo: 'Identificação Bancária', items: [
                ['Banco', banco || '—'],
                ['Agência/Conta', [agencia, conta].filter(Boolean).join(' / ') || '—'],
                ['Chave PIX', pix || '—'],
              ]},
            ].map(section => (
              <div key={section.titulo} className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">{section.titulo}</p>
                <div className="rounded-xl border border-border bg-muted/10 divide-y divide-border/40 overflow-hidden shadow-sm">
                  {section.items.map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center px-4 py-3 text-sm">
                      <span className="text-muted-foreground font-medium">{label}</span>
                      <span className="font-semibold text-foreground text-right max-w-[60%] truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {referencias.some(r => r.nome) && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Contatos de Referência</p>
                <div className="rounded-xl border border-border bg-muted/10 divide-y divide-border/40 overflow-hidden shadow-sm">
                  {referencias.filter(r => r.nome).map((r, i) => (
                    <div key={i} className="px-4 py-3 text-sm flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{r.nome}</span>
                        {r.parentesco && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">({r.parentesco})</span>}
                      </div>
                      {r.telefone && <span className="font-semibold text-[#1A73E8]">{formatarTelefone(r.telefone)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={voltar}
            disabled={step === 1}
            className="gap-2 h-11 rounded-full px-6 font-semibold border-border hover:bg-muted/50"
          >
            <ChevronLeft size={18} />
            Voltar
          </Button>

          {step < 7 ? (
            <Button
              className="gap-2 text-white h-11 rounded-full px-6 bg-[#1A73E8] hover:bg-[#1557B0] font-semibold transition-all shadow-sm"
              onClick={avancar}
            >
              Próxima etapa
              <ChevronRight size={18} />
            </Button>
          ) : (
            <Button
              className="gap-2 text-white px-8 h-11 rounded-full bg-[#34A853] hover:bg-[#2d9449] font-semibold shadow-sm transition-all"
              onClick={cadastrar}
              disabled={salvando}
            >
              {salvando
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle2 size={18} />
              }
              {salvando ? 'Cadastrando...' : 'Cadastrar Cliente'}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
