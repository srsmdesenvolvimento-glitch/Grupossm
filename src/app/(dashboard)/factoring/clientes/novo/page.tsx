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
          await supabase
            .from('clientes_factoring')
            .update({ documentos: uploads })
            .eq('id', clienteData.id)
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
          <div className="bg-card rounded-xl border border-border p-10 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
              <CheckCircle2 size={40} style={{ color: '#22c55e' }} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Cliente cadastrado!</h2>
              <p className="text-slate-500">
                <span className="font-semibold text-slate-700">{nome}</span> foi cadastrado com sucesso no sistema.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => router.push(`/factoring/clientes/${clienteCriadoId}`)}
              >
                <User size={16} />
                Ver Perfil
              </Button>
              <Button
                className="flex-1 gap-2 text-white"
                style={{ backgroundColor: '#1E5AA8' }}
                onClick={() => router.push(`/factoring/emprestimos/novo?cliente_id=${clienteCriadoId}`)}
              >
                <Banknote size={16} />
                Iniciar Empréstimo
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
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#EDF4FE', color: '#1E5AA8' }}>
            <CheckCircle2 size={16} />
            Após cadastrar, você será redirecionado automaticamente de volta ao empréstimo.
          </div>
        )}
        {/* Step indicator */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const num = i + 1
              const done = step > num
              const active = step === num
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center gap-1 min-w-[60px]">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                      style={done
                        ? { backgroundColor: '#22c55e', color: '#fff' }
                        : active
                          ? { backgroundColor: '#1E5AA8', color: '#fff' }
                          : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                    >
                      {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                    </div>
                    <span
                      className="text-xs font-medium text-center leading-tight"
                      style={{ color: active ? '#1E5AA8' : done ? '#22c55e' : '#94a3b8' }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="h-0.5 w-4 mx-1 rounded shrink-0" style={{ backgroundColor: step > num ? '#22c55e' : '#e2e8f0' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 1: Dados Pessoais */}
        {step === 1 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Dados Pessoais</h2>

            {/* Toggle tipo pessoa */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                onClick={() => { setTipoPessoa('fisica'); setCnpj(''); setCnpjConsultado(null) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tipoPessoa === 'fisica' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <User size={15} />
                Pessoa Física
              </button>
              <button
                onClick={() => { setTipoPessoa('juridica'); setCpf(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tipoPessoa === 'juridica' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Building2 size={15} />
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
                  <Label>CPF</Label>
                  <div className="relative">
                    <Input
                      value={cpf}
                      onChange={e => setCpf(mascaraCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={`pr-10 ${cpfCompleto ? (cpfOk ? 'border-green-400 focus-visible:ring-green-300' : 'border-red-400 focus-visible:ring-red-300') : ''}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cpfCompleto && (cpfOk
                        ? <CheckCircle size={16} className="text-green-500" />
                        : <XCircle size={16} className="text-red-500" />
                      )}
                    </div>
                  </div>
                  {cpfCompleto && !cpfOk && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={12} /> CPF inválido — verifique os dígitos
                    </p>
                  )}
                  {cpfCompleto && cpfOk && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={12} /> CPF válido
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
                    <Label>CNPJ</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={cnpj}
                          onChange={e => { setCnpj(mascaraCNPJ(e.target.value)); setCnpjConsultado(null) }}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          className={`pr-10 ${cnpjCompleto ? (cnpjOk ? 'border-green-400' : 'border-red-400') : ''}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {cnpjCompleto && (cnpjOk
                            ? <CheckCircle size={16} className="text-green-500" />
                            : <XCircle size={16} className="text-red-500" />
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={buscarCNPJ}
                        disabled={!cnpjOk || buscandoCnpj}
                        className="shrink-0 gap-1.5"
                      >
                        {buscandoCnpj
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Search size={14} />
                        }
                        Consultar Receita
                      </Button>
                    </div>
                    {cnpjCompleto && !cnpjOk && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} /> CNPJ inválido — verifique os dígitos
                      </p>
                    )}
                  </div>

                  {/* Card com resultado da consulta */}
                  {cnpjConsultado && (() => {
                    const d = cnpjConsultado as Record<string, string | null>
                    return (
                      <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-600 shrink-0" />
                          <p className="font-semibold text-green-800 text-sm">{d.razao_social ?? ''}</p>
                        </div>
                        {d.nome_fantasia && (
                          <p className="text-xs text-green-700">Nome fantasia: {d.nome_fantasia}</p>
                        )}
                        <p className="text-xs text-green-600">
                          Situação: <strong>{d.descricao_situacao_cadastral ?? ''}</strong>
                          {d.data_situacao_cadastral && ` desde ${d.data_situacao_cadastral.split('T')[0]}`}
                        </p>
                        {d.cnae_fiscal_descricao && (
                          <p className="text-xs text-green-600">Atividade: {d.cnae_fiscal_descricao}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">Endereço, telefone e sócios preenchidos automaticamente.</p>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            {/* Nome */}
            <div className="space-y-1.5">
              <Label>{tipoPessoa === 'fisica' ? 'Nome completo *' : 'Razão social *'}</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder={tipoPessoa === 'fisica' ? 'Nome completo' : 'Razão social'} />
            </div>

            {/* Campos exclusivos de pessoa física */}
            {tipoPessoa === 'fisica' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data de nascimento</Label>
                    <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado civil</Label>
                    <Select value={estadoCivil} onValueChange={v => setEstadoCivil(v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>RG</Label>
                    <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="RG" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Órgão emissor</Label>
                    <Input value={orgaoEmissor} onChange={e => setOrgaoEmissor(e.target.value)} placeholder="SSP/SP" />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Profissão / Segmento</Label>
                <Input value={profissao} onChange={e => setProfissao(e.target.value)} placeholder={tipoPessoa === 'fisica' ? 'Profissão' : 'Segmento de atuação'} />
              </div>
              <div className="space-y-1.5">
                <Label>Renda / Faturamento mensal (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <Input type="number" min={0} value={rendaMensal} onChange={e => setRendaMensal(e.target.value)} className="pl-9" placeholder="0,00" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contato */}
        {step === 2 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Dados de Contato</h2>
            <div className="space-y-1.5">
              <Label>Telefone principal *</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone 2</Label>
              <Input value={telefone2} onChange={e => setTelefone2(e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>
        )}

        {/* Step 3: Endereço */}
        {step === 3 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Endereço</h2>
            <div className="space-y-1.5">
              <Label>CEP</Label>
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
                    className={`pr-10 ${buscandoCep ? 'border-blue-300' : endereco ? 'border-green-400' : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {buscandoCep
                      ? <Loader2 size={16} className="animate-spin text-blue-500" />
                      : endereco
                        ? <CheckCircle size={16} className="text-green-500" />
                        : null
                    }
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => buscarCep()}
                  disabled={buscandoCep || cep.replace(/\D/g,'').length < 8}
                  className="shrink-0 gap-1.5 text-sm"
                >
                  {buscandoCep ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar
                </Button>
              </div>
              {buscandoCep && (
                <p className="text-xs text-blue-500 flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Buscando endereço via BrasilAPI...
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Logradouro</Label>
                <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Av..." />
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Bloco..." />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Cidade</Label>
                <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input value={estado} onChange={e => setEstado(e.target.value)} placeholder="UF" maxLength={2} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Bancário */}
        {step === 4 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Dados Bancários</h2>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={banco} onChange={e => setBanco(e.target.value)} placeholder="Nome ou código do banco" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={conta} onChange={e => setConta(e.target.value)} placeholder="00000-0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de conta</Label>
              <Select value={tipoConta} onValueChange={v => setTipoConta(v ?? '')}>
                <SelectTrigger>
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
              <Label>Chave PIX</Label>
              <Input value={pix} onChange={e => setPix(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" />
            </div>
          </div>
        )}

        {/* Step 5: Referências */}
        {step === 5 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Referências Pessoais</h2>
            <p className="text-sm text-slate-400">Informe até 3 referências pessoais do cliente.</p>
            {referencias.map((ref, idx) => (
              <div key={idx} className="rounded-xl border border-slate-100 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Referência {idx + 1}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input value={ref.nome} onChange={e => setRef(idx, 'nome', e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Parentesco</Label>
                    <Input value={ref.parentesco} onChange={e => setRef(idx, 'parentesco', e.target.value)} placeholder="Cônjuge, filho, amigo..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={ref.telefone} onChange={e => setRef(idx, 'telefone', e.target.value)} placeholder="(00) 90000-0000" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 6: Documentos */}
        {step === 6 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Documentos</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {arquivosPendentes.size} de {CATEGORIAS_DOCUMENTO.length} enviados · opcional
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIAS_DOCUMENTO.map(cat => {
                const arquivo = arquivosPendentes.get(cat.id)
                const preview = previews.get(cat.id)
                const Icone = ICONES_CATEGORIA[cat.id] ?? FileText
                const inputId = `doc-upload-${cat.id}`

                return (
                  <div key={cat.id} className="relative">
                    {arquivo ? (
                      /* Card preenchido */
                      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 flex flex-col items-center gap-2 min-h-[120px] relative">
                        <button
                          type="button"
                          onClick={() => removerArquivo(cat.id)}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                        >
                          <X size={11} className="text-red-500" />
                        </button>

                        {preview ? (
                          <img src={preview} alt={cat.label} className="w-16 h-16 object-cover rounded-lg" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Icone size={28} className="text-blue-400" />
                          </div>
                        )}
                        <p className="text-xs font-medium text-blue-700 text-center leading-tight">{cat.label}</p>
                        <p className="text-[10px] text-slate-400 truncate w-full text-center">{formatarTamanho(arquivo.size)}</p>
                      </div>
                    ) : (
                      /* Card vazio — área de drop/click */
                      <label
                        htmlFor={inputId}
                        className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 p-3 flex flex-col items-center gap-2 min-h-[120px] transition-colors"
                      >
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center mt-1">
                          <Icone size={28} className="text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-500 text-center leading-tight">{cat.label}</p>
                        <p className="text-[10px] text-blue-400 font-medium">Clique para enviar</p>
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

            <p className="text-xs text-slate-400 text-center">
              Todos os campos são opcionais. Documentos também podem ser adicionados depois, no perfil do cliente.
            </p>
          </div>
        )}

        {/* Step 7: Revisão */}
        {step === 7 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Revisão do Cadastro</h2>

            {[
              { titulo: 'Dados Pessoais', items: [
                ['Tipo', tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'],
                ['Nome', nome],
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
              { titulo: 'Contato', items: [
                ['Telefone', formatarTelefone(telefone)],
                ['Telefone 2', telefone2 ? formatarTelefone(telefone2) : '—'],
                ['E-mail', email || '—'],
              ]},
              { titulo: 'Endereço', items: [
                ['Logradouro', [endereco, numero].filter(Boolean).join(', ') || '—'],
                ['Bairro/Cidade', [bairro, cidade, estado].filter(Boolean).join(', ') || '—'],
                ['CEP', cep || '—'],
              ]},
              { titulo: 'Bancário', items: [
                ['Banco', banco || '—'],
                ['Agência/Conta', [agencia, conta].filter(Boolean).join(' / ') || '—'],
                ['PIX', pix || '—'],
              ]},
            ].map(section => (
              <div key={section.titulo}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{section.titulo}</p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
                  {section.items.map(([label, value]) => (
                    <div key={label} className="flex justify-between px-4 py-2.5">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="text-sm font-medium text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {referencias.some(r => r.nome) && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Referências</p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
                  {referencias.filter(r => r.nome).map((r, i) => (
                    <div key={i} className="px-4 py-2.5">
                      <span className="text-sm font-medium text-slate-800">{r.nome}</span>
                      {r.parentesco && <span className="text-sm text-slate-400 ml-2">({r.parentesco})</span>}
                      {r.telefone && <span className="text-sm text-slate-400 ml-2">· {formatarTelefone(r.telefone)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={voltar} disabled={step === 1} className="gap-2">
            <ChevronLeft size={16} />
            Voltar
          </Button>

          {step < 7 ? (
            <Button className="gap-2 text-white" style={{ backgroundColor: '#1E5AA8' }} onClick={avancar}>
              Próxima etapa
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              className="gap-2 text-white px-8"
              style={{ backgroundColor: '#22c55e' }}
              onClick={cadastrar}
              disabled={salvando}
            >
              {salvando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle2 size={16} />
              }
              {salvando ? 'Cadastrando...' : 'Cadastrar Cliente'}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  )
}
