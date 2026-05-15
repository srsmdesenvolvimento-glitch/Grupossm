'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Phone, MapPin, CreditCard, Users, FileText, CheckCircle2,
  ChevronLeft, ChevronRight, Search,
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
import { toast } from 'sonner'

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

export default function NovoClienteFactoringPage() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)

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

  const buscarCep = async () => {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) { toast.error('CEP inválido'); return }
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const data = await res.json()
      if (data.erro) { toast.error('CEP não encontrado'); return }
      setEndereco(data.logradouro ?? '')
      setBairro(data.bairro ?? '')
      setCidade(data.localidade ?? '')
      setEstado(data.uf ?? '')
    } catch {
      toast.error('Erro ao buscar CEP')
    } finally {
      setBuscandoCep(false)
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
          cpf: cpf || null,
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

      if (error || !clienteData) throw error

      const refs = referencias.filter(r => r.nome.trim())
      if (refs.length > 0) {
        await supabase.from('referencias_clientes_factoring').insert(
          refs.map(r => ({
            cliente_id: clienteData.id,
            nome: r.nome.trim(),
            parentesco: r.parentesco || null,
            telefone: r.telefone.trim(),
          }))
        )
      }

      toast.success('Cliente cadastrado com sucesso!')
      router.push(`/factoring/clientes/${clienteData.id}`)
    } catch {
      toast.error('Erro ao cadastrar cliente')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppShell empresa="factoring" titulo="Novo Cliente">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Dados Pessoais</h2>
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" maxLength={14} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Estado civil</Label>
                <Select value={estadoCivil} onValueChange={v => setEstadoCivil(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Profissão</Label>
                <Input value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Profissão" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Renda mensal (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <Input
                  type="number"
                  min={0}
                  value={rendaMensal}
                  onChange={e => setRendaMensal(e.target.value)}
                  className="pl-9"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contato */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Endereço</h2>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={cep}
                  onChange={e => setCep(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="flex-1"
                />
                <Button variant="outline" onClick={buscarCep} disabled={buscandoCep} className="gap-1.5 shrink-0">
                  {buscandoCep
                    ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    : <Search size={14} />
                  }
                  Buscar
                </Button>
              </div>
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Documentos</h2>
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
              <FileText size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-medium">Documentos do cliente</p>
              <p className="text-sm text-slate-400 mt-1">
                Os documentos podem ser adicionados após o cadastro no perfil do cliente.
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                <strong>Documentos necessários:</strong> RG/CNH, Comprovante de renda,
                Comprovante de residência, CPF.
              </p>
            </div>
          </div>
        )}

        {/* Step 7: Revisão */}
        {step === 7 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Revisão do Cadastro</h2>

            {[
              { titulo: 'Dados Pessoais', items: [
                ['Nome', nome],
                ['CPF', cpf ? formatarCPF(cpf) : '—'],
                ['Nascimento', dataNascimento || '—'],
                ['Estado civil', estadoCivil || '—'],
                ['Profissão', profissao || '—'],
                ['Renda mensal', rendaMensal ? `R$ ${Number(rendaMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'],
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
