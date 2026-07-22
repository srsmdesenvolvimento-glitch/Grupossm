'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, User, Settings, Calculator, CheckCircle2, ChevronRight, ChevronLeft,
  X, Percent, UserPlus, ArrowRight, AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { gerarContratoPDF } from '@/lib/utils/documentos'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { handleCurrencyChange, parseBRL, formatBRL, valorPorExtenso } from '@/lib/utils/currency'
import { parseSupabaseError, logError } from '@/lib/utils/errors'
import { toast } from 'sonner'
import type { ClienteFactoring } from '@/lib/types/database'
import { salvarRascunho, lerRascunho, limparRascunho } from '@/lib/utils/formDraft'

type ClienteSumario = {
  id: string
  nome: string
  cpf: string | null
  telefone: string
  limite_credito: number
  credito_disponivel: number
  score_interno: number
  total_dividas_assertiva?: number | null
  valor_total_dividas_assertiva?: number | null
  score_assertiva?: number | null
  faixa_risco_assertiva?: string | null
  pep_assertiva?: boolean | null
  indicador_obito_assertiva?: boolean | null
}

type TabelaLinha = {
  numero: number
  vencimento: string
  principal: number
  juros: number
  parcela: number
  saldo_antes: number
  saldo_apos: number
}

// Rascunho em memória — sair pra outra tela no meio da criação do contrato e
// voltar não deve perder o que já foi preenchido (só refresh/fechar reseta).
const RASCUNHO_NOVO_EMPRESTIMO = 'novo-emprestimo-factoring'

type RascunhoNovoEmprestimo = {
  step: number
  cliente: ClienteSumario | null
  valor: string
  taxa: string
  numParcelas: string
  dataVenc: string
  garantias: string
  observacoes: string
  jurosMoraDiarioInput: string
}

function calcularJurosSimples(valor: number, taxa: number, n: number, dataInicio: string) {
  if (!valor || !taxa || !n) return { parcela: 0, total: 0, totalJuros: 0, tabela: [] as TabelaLinha[] }
  const i = taxa / 100
  const totalJuros = Number((valor * i * n).toFixed(2))
  const totalGeral = Number((valor + totalJuros).toFixed(2))
  
  const parcelaBase = Number((totalGeral / n).toFixed(2))
  const amortizacaoBase = Number((valor / n).toFixed(2))
  const jurosBase = Number((totalJuros / n).toFixed(2))
  
  const base = new Date(dataInicio || new Date().toISOString().split('T')[0])
  const tabela: TabelaLinha[] = []
  
  let somaAmortizacao = 0
  let somaJuros = 0
  let somaParcelas = 0

  for (let k = 1; k <= n; k++) {
    let amort = amortizacaoBase
    let jur = jurosBase
    let parc = parcelaBase

    if (k === n) {
      amort = Number((valor - somaAmortizacao).toFixed(2))
      jur = Number((totalJuros - somaJuros).toFixed(2))
      parc = Number((totalGeral - somaParcelas).toFixed(2))
    }

    somaAmortizacao += amort
    somaJuros += jur
    somaParcelas += parc

    const saldo_antes = Number((valor - (somaAmortizacao - amort)).toFixed(2))
    const saldo_apos = Math.max(0, Number((valor - somaAmortizacao).toFixed(2)))
    
    const venc = new Date(base)
    venc.setMonth(venc.getMonth() + k)
    tabela.push({
      numero: k,
      vencimento: venc.toISOString().split('T')[0],
      principal: amort,
      juros: jur,
      parcela: parc,
      saldo_antes,
      saldo_apos,
    })
  }

  return { parcela: parcelaBase, total: totalGeral, totalJuros, tabela }
}

const defaultVenc = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
})()

const STEPS = [
  { label: 'Cliente', icon: User },
  { label: 'Condições', icon: Settings },
  { label: 'Simulação', icon: Calculator },
  { label: 'Confirmar', icon: CheckCircle2 },
]

// Generates a beautiful Google-style initials avatar
function renderAvatar(nome: string, size: 'sm' | 'md' = 'sm') {
  const init = iniciais(nome)
  const bgCores = ['#E8F0FE', '#E6F4EA', '#FCE8E6', '#FEF7E0', '#F3E8FD', '#FEF0E1']
  const textCores = ['#1A73E8', '#34A853', '#EA4335', '#FBBC04', '#A142F4', '#FA903E']
  
  const charSum = nome.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const idx = charSum % bgCores.length

  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-11 h-11 text-sm'

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold uppercase tracking-wider shrink-0 transition-transform duration-200 group-hover:scale-105`}
      style={{ backgroundColor: bgCores[idx], color: textCores[idx] }}
    >
      {init}
    </div>
  )
}

export default function NovoEmprestimoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [step, setStep] = useState(1)


  // Step 1
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ClienteSumario[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [cliente, setCliente] = useState<ClienteSumario | null>(null)

  // Step 2
  const [valor, setValor] = useState('')
  const [taxa, setTaxa] = useState('3')
  const [numParcelas, setNumParcelas] = useState('1')
  const [dataVenc, setDataVenc] = useState(defaultVenc)
  const [garantias, setGarantias] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [jurosMoraDiarioInput, setJurosMoraDiarioInput] = useState('')

  const [salvando, setSalvando] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Restaura o rascunho, se existir — sair pra outra tela no meio da criação
  // do contrato e voltar não perde nada (só refresh/fechar aba reseta).
  useEffect(() => {
    const r = lerRascunho<RascunhoNovoEmprestimo>(RASCUNHO_NOVO_EMPRESTIMO)
    if (!r) return
    setStep(r.step)
    setCliente(r.cliente)
    setValor(r.valor)
    setTaxa(r.taxa)
    setNumParcelas(r.numParcelas)
    setDataVenc(r.dataVenc)
    setGarantias(r.garantias)
    setObservacoes(r.observacoes)
    setJurosMoraDiarioInput(r.jurosMoraDiarioInput)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva o rascunho a cada mudança relevante.
  useEffect(() => {
    salvarRascunho<RascunhoNovoEmprestimo>(RASCUNHO_NOVO_EMPRESTIMO, {
      step, cliente, valor, taxa, numParcelas, dataVenc, garantias, observacoes, jurosMoraDiarioInput,
    })
  }, [step, cliente, valor, taxa, numParcelas, dataVenc, garantias, observacoes, jurosMoraDiarioInput])

  const buscarClientes = useCallback(async (q: string) => {
    if (!empresaAtual || q.trim().length < 2) { setResultados([]); setShowDropdown(false); return }
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('clientes_factoring')
        .select('id, nome, cpf, telefone, limite_credito, credito_disponivel, score_interno, total_dividas_assertiva, valor_total_dividas_assertiva, score_assertiva, faixa_risco_assertiva, pep_assertiva, indicador_obito_assertiva')
        .eq('empresa_id', empresaAtual.id)
        .eq('status', 'ativo')
        .or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(8)
      setResultados((data ?? []) as ClienteSumario[])
      setShowDropdown(true)
    } catch (error) {
      logError('buscarClientes', error)
    } finally {
      setBuscando(false)
    }
  }, [empresaAtual, supabase])

  useEffect(() => {
    if (cliente) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarClientes(busca), 300)
  }, [busca, buscarClientes, cliente])

  useEffect(() => {
    if (!empresaAtual) return
    const taxaParam = searchParams.get('taxa')
    if (taxaParam) return
    supabase
      .from('config_factoring')
      .select('taxa_juros_padrao, juros_mora_diario')
      .eq('empresa_id', empresaAtual.id)
      .single()
      .then(({ data }) => {
        if (data?.taxa_juros_padrao) setTaxa(String(data.taxa_juros_padrao))
        if (data?.juros_mora_diario) setJurosMoraDiarioInput(String(data.juros_mora_diario))
      })
  }, [empresaAtual, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from simulator URL params
  useEffect(() => {
    const valorParam = searchParams.get('valor')
    const parcelasParam = searchParams.get('parcelas')
    const taxaParam = searchParams.get('taxa')
    const vencParam = searchParams.get('venc')
    if (valorParam) setValor(formatBRL(parseFloat(valorParam) || 0))
    if (parcelasParam) setNumParcelas(parcelasParam)
    if (taxaParam) setTaxa(taxaParam)
    if (vencParam) setDataVenc(vencParam)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Pré-seleciona cliente quando vindo de clientes/novo via ?cliente_id=
  useEffect(() => {
    const clienteId = searchParams.get('cliente_id')
    if (!clienteId || !empresaAtual || cliente) return
    supabase
      .from('clientes_factoring')
      .select('id, nome, cpf, telefone, limite_credito, credito_disponivel, score_interno, total_dividas_assertiva, valor_total_dividas_assertiva, score_assertiva, faixa_risco_assertiva, pep_assertiva, indicador_obito_assertiva')
      .eq('id', clienteId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCliente(data as ClienteSumario)
          setBusca(data.nome)
        }
      })
  }, [searchParams, empresaAtual]) // eslint-disable-line react-hooks/exhaustive-deps



  const valorNum = parseBRL(valor)
  const taxaNum = Number(taxa) || 0
  const parcelasNum = Number(numParcelas) || 0

  const resultado = useMemo(() => {
    if (!valorNum || !taxaNum || !parcelasNum) return null
    return calcularJurosSimples(valorNum, taxaNum, parcelasNum, dataVenc)
  }, [valorNum, taxaNum, parcelasNum, dataVenc])

  const tabelaColumns: Column<TabelaLinha>[] = [
    { key: 'numero', header: 'Nº', render: r => <span className="text-muted-foreground/60 font-semibold tabular-nums text-xs">{r.numero}</span> },
    { key: 'vencimento', header: 'Vencimento', render: r => <span className="tabular-nums font-semibold text-xs">{formatarData(r.vencimento)}</span> },
    { key: 'principal', header: 'Amortização', render: r => <span className="tabular-nums font-semibold text-xs text-foreground">{formatarMoeda(r.principal)}</span> },
    { key: 'juros', header: 'Juros', render: r => <span className="tabular-nums font-semibold text-xs text-[#FA903E]">{formatarMoeda(r.juros)}</span> },
    { key: 'parcela', header: 'Parcela', render: r => <span className="tabular-nums font-bold text-xs text-foreground">{formatarMoeda(r.parcela)}</span> },
    { key: 'saldo', header: 'Saldo Devedor', render: r => <span className="tabular-nums font-semibold text-xs text-muted-foreground/80">{formatarMoeda(r.saldo_apos)}</span> },
  ]

  const avancar = () => {
    if (step === 1 && !cliente) { toast.error('Selecione um cliente'); return }
    if (step === 2) {
      if (!valorNum || valorNum < 100) { toast.error('Valor mínimo R$ 100'); return }
      if (!taxaNum) { toast.error('Informe a taxa de juros'); return }
      if (!parcelasNum || parcelasNum < 1) { toast.error('Informe o número de parcelas'); return }
    }
    setStep(s => Math.min(s + 1, 4))
  }

  const voltar = () => setStep(s => Math.max(s - 1, 1))

  const liberarEmprestimo = async () => {
    if (!cliente || !resultado || !empresaAtual) return
    setSalvando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user.id ?? null
      const hojeStr = new Date().toISOString().split('T')[0]
      const token = typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)

      let empId: string
      let numero_contrato: string
      let finalToken: string = token

      // Originação atômica via RPC PostgreSQL (evita corrupção de dados se alguma inserção falhar)
      const { data: rpcRes, error: rpcError } = await supabase.rpc('originar_emprestimo_factoring', {
        p_empresa_id: empresaAtual.id,
        p_cliente_id: cliente.id,
        p_usuario_id: userId,
        p_valor_principal: valorNum,
        p_taxa_juros: taxaNum,
        p_prazo_meses: parcelasNum,
        p_valor_parcela: resultado.parcela,
        p_total_pagar: resultado.total,
        p_total_juros: resultado.totalJuros,
        p_data_liberacao: hojeStr,
        p_data_primeiro_vencimento: resultado.tabela[0]?.vencimento ?? dataVenc,
        p_tabela_parcelas: resultado.tabela.map(row => ({
          numero_parcela: row.numero,
          data_vencimento: row.vencimento,
          valor: row.parcela,
          valor_principal: row.principal,
          valor_juros: row.juros,
          saldo_devedor: row.saldo_apos,
        })),
        p_garantias: garantias || null,
        p_observacoes: `[Mora: ${jurosMoraDiarioInput || '0.0333'}% ao dia]${observacoes ? ` ${observacoes}` : ''}`.trim() || null,
        p_sistema_amortizacao: 'PRICE',
        p_assinatura_token: token,
      })

      if (!rpcError && rpcRes && rpcRes.length > 0) {
        empId = rpcRes[0].emprestimo_id
        numero_contrato = rpcRes[0].numero_contrato
      } else {
        // Fallback para inserção cliente se a RPC ainda não tiver sido criada no Supabase pelo usuário
        const { count } = await supabase
          .from('emprestimos')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresaAtual.id)
        const seq = String((count ?? 0) + 1).padStart(4, '0')
        const year = new Date().getFullYear()
        numero_contrato = `EMP-${year}-${seq}`

        const { data: empData, error: empError } = await supabase
          .from('emprestimos')
          .insert({
            empresa_id: empresaAtual.id,
            numero_contrato,
            cliente_id: cliente.id,
            usuario_id: userId,
            valor_principal: valorNum,
            taxa_juros: taxaNum,
            tipo_taxa: 'mensal',
            prazo_meses: parcelasNum,
            valor_parcela: resultado.parcela,
            total_pagar: resultado.total,
            total_juros: resultado.totalJuros,
            valor_entrada: 0,
            saldo_devedor: valorNum,
            data_primeiro_vencimento: resultado.tabela[0]?.vencimento ?? dataVenc,
            data_liberacao: hojeStr,
            data_quitacao: null,
            observacoes: `[Mora: ${jurosMoraDiarioInput || '0.0333'}% ao dia]${observacoes ? ` ${observacoes}` : ''}`.trim() || null,
            garantias: garantias || null,
            documentos: [],
            status: 'ativo',
          })
          .select('id, assinatura_token')
          .single()

        if (empError || !empData) throw empError

        empId = empData.id
        finalToken = empData.assinatura_token ?? token

        const parcelasInsert = resultado.tabela.map(row => ({
          empresa_id: empresaAtual.id,
          emprestimo_id: empId,
          cliente_id: cliente.id,
          numero_parcela: row.numero,
          total_parcelas: parcelasNum,
          valor: row.parcela,
          valor_principal: row.principal,
          valor_juros: row.juros,
          saldo_devedor_antes: row.saldo_antes,
          saldo_devedor_apos: row.saldo_apos,
          valor_pago: null,
          data_vencimento: row.vencimento,
          data_pagamento: null,
          tipo_pagamento: null,
          multa: 0,
          juros_mora: 0,
          status: 'pendente',
          observacoes: null,
        }))

        const { error: pError } = await supabase.from('parcelas_emprestimo').insert(parcelasInsert)
        if (pError) throw pError

        const { error: caixaError } = await supabase.from('movimentacoes_caixa').insert({
          empresa_id: empresaAtual.id,
          usuario_id: userId,
          tipo: 'saida',
          categoria: 'liberacao_emprestimo',
          descricao: `Empréstimo ${numero_contrato} — ${cliente.nome}`,
          valor: valorNum,
          referencia_tipo: 'emprestimo',
          referencia_id: empId,
          data_movimentacao: hojeStr,
        })
        if (caixaError) throw caixaError

        const creditoDisponivel = cliente.credito_disponivel ?? cliente.limite_credito
        const { error: limitError } = await supabase.from('clientes_factoring').update({
          credito_utilizado: (cliente.limite_credito - creditoDisponivel) + valorNum,
          ultima_operacao: hojeStr,
          total_emprestimos: undefined,
        }).eq('id', cliente.id).eq('empresa_id', empresaAtual.id)
        if (limitError) throw limitError
      }

      // ── Enviar Link de Assinatura via WhatsApp (independente do PDF) ──
      if (cliente.telefone) {
        const linkAssinatura = `${window.location.origin}/assinar/${empId}?token=${finalToken}`
        try {
          await fetch('/api/whatsapp/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              empresa_id: empresaAtual.id,
              destinatario: cliente.telefone,
              triggerKey: 'contrato_criado',
              variaveis: {
                nome: cliente.nome,
                numero_contrato,
                valor_principal: formatarMoeda(valorNum),
                link_assinatura: linkAssinatura,
              },
              assunto: `Link de Assinatura — ${numero_contrato}`,
              referencia_tipo: 'emprestimo',
              referencia_id: empId,
            }),
          })
        } catch {
          // falha silenciosa — usuário pode reenviar manualmente na tela do contrato
        }
      }

      // ── Gerar PDF do Contrato e salvar no Storage ──
      try {
        const { data: fullCliente } = await supabase
          .from('clientes_factoring')
          .select('*')
          .eq('id', cliente.id)
          .single()

        const { data: empData } = await supabase
          .from('empresas')
          .select('cnpj')
          .eq('id', empresaAtual.id)
          .single()

        const empresaCnpj = empData?.cnpj ?? null

        if (fullCliente) {
          const contratoParams = {
            contrato: {
              numero_contrato,
              valor_principal: valorNum,
              taxa_juros: taxaNum,
              prazo_meses: parcelasNum,
              valor_parcela: resultado.parcela,
              total_pagar: resultado.total,
              total_juros: resultado.totalJuros,
              data_liberacao: hojeStr,
              data_primeiro_vencimento: resultado.tabela[0]?.vencimento ?? dataVenc,
              garantias: garantias || null,
              observacoes: `[Mora: ${jurosMoraDiarioInput || '0.0333'}% ao dia]${observacoes ? ` ${observacoes}` : ''}`.trim() || null,
            },
            cliente: {
              nome: fullCliente.nome,
              cpf: fullCliente.cpf,
              rg: fullCliente.rg,
              orgao_emissor: fullCliente.orgao_emissor,
              telefone: fullCliente.telefone,
              email: fullCliente.email,
              endereco: fullCliente.endereco,
              numero: fullCliente.numero,
              bairro: fullCliente.bairro,
              cidade: fullCliente.cidade,
              estado: fullCliente.estado,
              cep: fullCliente.cep,
            },
            parcelas: resultado.tabela.map(row => ({
              numero_parcela: row.numero,
              data_vencimento: row.vencimento,
              valor: row.parcela,
              valor_principal: row.principal,
              valor_juros: row.juros,
            })),
            empresaNome: empresaAtual.nome,
            empresaCnpj: empresaCnpj,
          }

          const contratoBlob = await gerarContratoPDF(contratoParams, { output: 'blob' })

          if (contratoBlob instanceof Blob) {
            const filePath = `${empresaAtual.id}/${cliente.id}/contratos/contrato-${numero_contrato}-${Date.now()}.pdf`
            const { error: uploadError } = await supabase.storage
              .from('documentos-clientes')
              .upload(filePath, contratoBlob, {
                contentType: 'application/pdf',
                upsert: false,
              })

            if (uploadError) {
              console.error('Erro ao fazer upload do contrato PDF:', uploadError)
            }
          }
        }
      } catch (e) {
        console.error('Erro ao gerar PDF do contrato:', e)
      }

      limparRascunho(RASCUNHO_NOVO_EMPRESTIMO)
      toast.success(`Contrato ${numero_contrato} criado! Link de assinatura enviado via WhatsApp.`, { duration: 5000 })
      router.push(`/factoring/emprestimos/${empId}`)
    } catch (err) {
      logError('liberarEmprestimo', err)
      toast.error(parseSupabaseError(err, 'Erro ao criar empréstimo'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppShell empresa="factoring" titulo="Novo Empréstimo">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Step indicator */}
        <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 p-5 overflow-hidden">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const num = i + 1
              const done = step > num
              const active = step === num
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-[70px]">
                    <div
                      className="w-9.5 h-9.5 rounded-full flex items-center justify-center transition-all duration-300 border-2 shadow-sm"
                      style={done
                        ? { backgroundColor: '#34A853', borderColor: '#34A853', color: '#fff' }
                        : active
                          ? { backgroundColor: '#E8F0FE', borderColor: '#1A73E8', color: '#1A73E8', boxShadow: '0 0 10px rgba(26,115,232,0.15)' }
                          : { backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-center leading-tight transition-colors duration-300" style={{ color: active ? '#1A73E8' : done ? '#34A853' : 'var(--muted-foreground)' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 rounded transition-colors duration-500" style={{ backgroundColor: step > num ? '#34A853' : 'var(--border)' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 1: Cliente */}
        {step === 1 && (
          <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
              <div className="space-y-0.5">
                <h2 className="font-bold text-base text-foreground tracking-tight">Beneficiário</h2>
                <p className="text-xs text-muted-foreground font-medium">Pesquise o cliente tomador do crédito</p>
              </div>
              {!cliente && (
                <button
                  onClick={() => {
                    const docLimpo = busca.replace(/\D/g, '')
                    const doc = docLimpo.length === 11 || docLimpo.length === 14 ? `&documento=${docLimpo}` : ''
                    router.push(`/factoring/clientes/novo?redirect=/factoring/emprestimos/novo${doc}`)
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full border border-[#1A73E8] text-[#1A73E8] bg-transparent hover:bg-[#E8F0FE] transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  <UserPlus size={14} />
                  Cadastro de Cliente
                </button>
              )}
            </div>

            <div ref={wrapperRef} className="relative">
              {/* Input isolado num wrapper próprio — o dropdown/hint abaixo não
                  pode influenciar a altura desse bloco, senão os ícones (que se
                  centralizam com top-1/2 relativo ao pai) saem do lugar. */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={18} />
                <input
                  value={busca}
                  onChange={e => { setBusca(e.target.value); if (!e.target.value) setCliente(null) }}
                  placeholder="Pesquisar por nome, CPF/CNPJ ou telefone..."
                  className="w-full pl-11 pr-10 py-3 border border-border/60 focus:border-[var(--gt-blue)] focus:ring-1 focus:ring-[var(--gt-blue)]/20 rounded-xl text-sm focus:outline-none transition-all"
                />
                {buscando && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[var(--gt-blue)]" />
                )}
                {cliente && !buscando && (
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground" onClick={() => { setCliente(null); setBusca('') }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              {showDropdown && resultados.length > 0 && (
                <div className="absolute z-50 top-full mt-2 w-full bg-card border border-border/50 rounded-2xl shadow-m3-3 overflow-hidden">
                  {resultados.map(c => {
                    const temDividas = (c.total_dividas_assertiva ?? 0) > 0
                    const creditoDisp = c.credito_disponivel ?? 0
                    return (
                      <button
                        key={c.id}
                        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/65 text-left border-b border-border/30 last:border-0 transition-colors"
                        onClick={() => { setCliente(c); setBusca(c.nome); setShowDropdown(false) }}
                      >
                        {renderAvatar(c.nome)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-foreground text-sm truncate leading-none">{c.nome}</p>
                            {temDividas && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground/80 mt-1 font-semibold">{c.cpf ? formatarCPF(c.cpf) : ''} · Disponível: {formatarMoeda(creditoDisp)}</p>
                        </div>
                        <span className="text-xs font-bold shrink-0 bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/10 text-[var(--gt-blue)] px-2.5 py-0.5 rounded-full border border-[var(--gt-blue)]/10 shadow-sm">Score {c.score_interno}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Hint "não achou?" — overlay (absolute), não empurra o layout abaixo */}
              {busca.length >= 2 && resultados.length === 0 && !buscando && !cliente && (
                <div className="absolute z-50 top-full mt-2 w-full flex items-center justify-between rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground bg-card shadow-m3-2">
                  <span className="font-semibold text-xs text-muted-foreground/75">Nenhum tomador ativo localizado para &quot;{busca}&quot;</span>
                  <button
                    onClick={() => {
                    const docLimpo = busca.replace(/\D/g, '')
                    const doc = docLimpo.length === 11 || docLimpo.length === 14 ? `&documento=${docLimpo}` : ''
                    router.push(`/factoring/clientes/novo?redirect=/factoring/emprestimos/novo${doc}`)
                  }}
                    className="ml-3 flex items-center gap-1 font-bold text-xs shrink-0 text-[var(--gt-blue)] hover:underline"
                  >
                    <UserPlus size={14} /> Cadastro de Cliente
                  </button>
                </div>
              )}
            </div>

            {/* Selected tomador card */}
            {cliente && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/60 bg-card p-4.5 flex items-center gap-3.5 shadow-sm relative overflow-hidden transition-all duration-300">
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#1A73E8]" />
                  {renderAvatar(cliente.nome, 'md')}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate text-sm leading-none mb-1">{cliente.nome}</p>
                    <p className="text-xs text-muted-foreground font-semibold">{cliente.cpf ? formatarCPF(cliente.cpf) : ''} · {formatarTelefone(cliente.telefone)}</p>
                  </div>
                  <div className="ml-auto text-right shrink-0 bg-muted/30 border border-border/30 rounded-xl px-3 py-1 shadow-inner">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Score</p>
                    <p className="text-lg font-black text-[#1A73E8] tracking-tight">{cliente.score_interno}</p>
                  </div>
                </div>

                {/* Assertiva Credit and Debt Warning Banner */}
                {(() => {
                  const temDividas = (cliente.total_dividas_assertiva ?? 0) > 0 || (cliente.valor_total_dividas_assertiva ?? 0) > 0
                  const hasPep = !!cliente.pep_assertiva
                  const hasObito = !!cliente.indicador_obito_assertiva
                  
                  if (temDividas || hasPep || hasObito) {
                    return (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-2.5 animate-fade-in text-red-750">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="text-red-600 shrink-0" size={16} />
                          <span className="font-extrabold text-xs uppercase tracking-wider">Alertas de Crédito & Restrições</span>
                        </div>
                        <div className="text-[11px] font-semibold space-y-1 text-slate-700">
                          {temDividas && (
                            <p>
                              * O tomador possui <span className="font-bold text-red-650">{cliente.total_dividas_assertiva}</span> restrições registradas (negativações, protestos, ações ou CCF), totalizando <span className="font-bold text-red-650">{formatarMoeda(cliente.valor_total_dividas_assertiva ?? 0)}</span> no relatório Assertiva.
                            </p>
                          )}
                          {hasPep && (
                            <p className="text-orange-655 font-bold">
                              * ATENÇÃO: Tomador identificado como Pessoa Politicamente Exposta (PEP).
                            </p>
                          )}
                          {hasObito && (
                            <p className="text-red-655 font-extrabold bg-red-100 p-1 px-2 rounded-lg border border-red-200">
                              * ALERTA CRÍTICO: Indica óbito provável na base de dados da Receita Federal.
                            </p>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium pt-1 border-t border-border/30">
                          Verifique a Ficha de Crédito completa no perfil do cliente para maiores detalhes antes de prosseguir.
                        </p>
                      </div>
                    )
                  }
                  
                  // If no active debts and has consult data
                  if (cliente.score_assertiva != null) {
                    return (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3 text-xs leading-relaxed text-emerald-750 animate-fade-in">
                        <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-800">Crédito Validado (Ficha Limpa)</p>
                          <p className="text-[11px] text-slate-655 font-semibold mt-0.5">
                            Nenhuma restrição financeira (negativação, protesto ou ação) foi encontrada na base de dados da Assertiva.
                          </p>
                          <div className="flex gap-4 mt-2 text-[10px] text-emerald-600/80 font-bold">
                            <span>Score Assertiva: {cliente.score_assertiva}</span>
                            <span>Faixa: {cliente.faixa_risco_assertiva || 'Não informada'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // If no Assertiva profile query at all
                  return (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex gap-3 text-xs leading-relaxed text-muted-foreground">
                      <AlertTriangle className="text-muted-foreground/60 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-bold">Análise de Crédito Não Realizada</p>
                        <p className="text-[10px] text-muted-foreground/85 mt-0.5">
                          Este tomador ainda não possui consulta de crédito cadastrada no perfil.
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Condições */}
        {step === 2 && (
          <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
              <div className="space-y-0.5">
                <h2 className="font-bold text-base text-foreground tracking-tight">Condições</h2>
                <p className="text-xs text-muted-foreground font-medium">Defina as bases do empréstimo</p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full font-bold">Etapa 2 de 4</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor do Empréstimo</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm font-semibold">R$</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={valor}
                  onChange={e => setValor(handleCurrencyChange(e.target.value))}
                  className="h-11 pl-10 pr-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-mono font-bold text-sm bg-card border-border/60"
                  placeholder="0,00"
                />
              </div>
              {valorNum > 0 && (
                <p className="text-[11px] text-muted-foreground/65 italic font-medium px-1">
                  {valorPorExtenso(valorNum)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Número de Parcelas</Label>
                <Input type="number" min={1} max={60} value={numParcelas} onChange={e => setNumParcelas(e.target.value)} className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-bold text-sm bg-card border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taxa Mensal (%)</Label>
                <div className="relative">
                  <Input type="number" min={0.1} step={0.1} value={taxa} onChange={e => setTaxa(e.target.value)} className="h-11 pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-bold text-sm bg-card border-border/60" />
                  <Percent size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Primeiro Vencimento</Label>
                <Input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-bold text-sm bg-card border-border/60" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Juros por Atraso (% ao dia)</Label>
                  <button
                    type="button"
                    onClick={() => router.push('/factoring/configuracoes')}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#1A73E8] hover:underline"
                  >
                    <Settings size={10} /> Das configurações
                  </button>
                </div>
                <div className="relative">
                  <Input type="number" min={0} step={0.001} value={jurosMoraDiarioInput} onChange={e => setJurosMoraDiarioInput(e.target.value)} className="h-11 pl-4 pr-10 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-bold text-sm bg-card border-border/60" placeholder="0,0333" />
                  <Percent size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Garantias Vinculadas</Label>
              <Input value={garantias} onChange={e => setGarantias(e.target.value)} placeholder="Notas promissórias, avalistas, bens atrelados..." className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl text-sm bg-card border-border/60" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Observações Operacionais</Label>
              <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Finalidade, observações de liberação ou restrições..." className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl text-sm bg-card border-border/60" />
            </div>
          </div>
        )}

        {/* Step 3: Simulador */}
        {step === 3 && resultado && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Valor da Parcela', value: formatarMoeda(resultado.parcela), color: '#1A73E8', bg: '#E8F0FE' },
                { label: 'Total de Juros', value: formatarMoeda(resultado.totalJuros), color: '#FA903E', bg: '#FEF0E1' },
                { label: 'Total a Pagar', value: formatarMoeda(resultado.total), color: '#1A73E8', bg: '#E8F0FE' },
                { label: 'Taxa Pactuada', value: `${taxa}% a.m.`, color: 'var(--muted-foreground)', bg: 'bg-muted/10' },
              ].map(card => (
                <div key={card.label} className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-4.5 relative overflow-hidden transition-all hover:shadow-m3-2 hover:scale-[1.02] duration-300">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: card.color }} />
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">{card.label}</p>
                  <p className="text-lg font-black truncate" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Composição do Caixa */}
            <div className="bg-card rounded-2xl border border-border/50 shadow-m3-1 p-5 space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Composição do Fluxo de Caixa</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Capital Liberado', desc: 'Valor entregue ao tomador', value: valorNum, color: '#1A73E8', bg: '#E8F0FE' },
                  { label: 'Total de Juros', desc: `${taxa}% a.m. × ${numParcelas} meses sobre o principal`, value: resultado.totalJuros, color: '#FA903E', bg: '#FEF0E1' },
                ].map(row => {
                  const pct = Math.round((row.value / resultado.total) * 100)
                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-foreground">{row.label}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground/70">{row.desc}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: row.bg, color: row.color }}>{pct}%</span>
                          <span className="text-xs font-black tabular-nums" style={{ color: row.color }}>{formatarMoeda(row.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-xs font-bold text-foreground">Total a Receber</span>
                  <span className="text-sm font-black text-foreground tabular-nums">{formatarMoeda(resultado.total)}</span>
                </div>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-m3-1 transition-all hover:shadow-m3-2">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/15 flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm tracking-tight">Fluxo de Caixa / Parcelas</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-background border border-border/50 rounded-full">{resultado.tabela.length} parcelas</span>
              </div>
              <DataTable
                columns={tabelaColumns}
                data={resultado.tabela}
                keyExtractor={r => String(r.numero)}
                perPage={12}
              />
            </div>
          </div>
        )}

        {/* Step 4: Confirmar */}
        {step === 4 && resultado && cliente && (
          <div className="bg-card rounded-3xl border border-border/50 shadow-m3-1 p-6 space-y-6 relative overflow-hidden transition-all hover:shadow-m3-2 duration-300">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#34A853]" />
            <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
              <div className="space-y-0.5">
                <h2 className="font-bold text-base text-foreground tracking-tight">Revisão do Contrato</h2>
                <p className="text-xs text-muted-foreground font-medium">Confirme as bases antes de efetuar a transferência</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#34A853] bg-[#E6F4EA] px-3 py-1 rounded-full border border-[#34A853]/10 animate-status-pulse">Aprovação Final</span>
            </div>

            <div className="space-y-0.5">
              {[
                { label: 'Cliente tomador', value: cliente.nome },
                { label: 'Valor sacado (Saída)', value: formatarMoeda(valorNum) },
                { label: 'Taxa operacional', value: `${taxa}% ao mês` },
                { label: 'Distribuição parcelada', value: `${parcelasNum}x de ${formatarMoeda(resultado.parcela)}` },
                { label: 'Total contratual', value: formatarMoeda(resultado.total) },
                { label: 'Primeiro vencimento', value: formatarData(dataVenc) },
                ...(garantias ? [{ label: 'Garantias vinculadas', value: garantias }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between items-start py-3 border-b border-border/30 last:border-0 text-sm">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{row.label}</span>
                  <span className="font-extrabold text-foreground text-right max-w-[65%] leading-normal">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-4.5 bg-[#E8F0FE]/50 border border-[#1A73E8]/20 flex gap-3.5 relative overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#1A73E8]" />
              <CheckCircle2 className="text-[#1A73E8] shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-[#1557B0] leading-relaxed font-semibold">
                Ao prosseguir com a liberação, o contrato digital será lavrado no sistema, a amortização em <strong>{parcelasNum} parcelas</strong> será estabelecida para o sacado
                e uma transação financeira de <strong>{formatarMoeda(valorNum)}</strong> constará como débito no caixa interno da empresa.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={voltar}
            disabled={step === 1}
            className="gap-2 h-11 rounded-full px-6 font-bold border-border hover:bg-muted/50 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft size={18} />
            <span>Voltar</span>
          </Button>

          {step < 4 ? (
            <Button
              className="gap-2 text-white h-11 rounded-full px-6 bg-[#1A73E8] hover:bg-[#1557B0] font-bold shadow-m3-1 hover:shadow-m3-2 transition-all hover:scale-105 active:scale-95 border-0"
              onClick={avancar}
            >
              <span>Avançar</span>
              <ChevronRight size={18} />
            </Button>
          ) : (
            <Button
              className="gap-2 text-white px-8 h-11 rounded-full bg-[#34A853] hover:bg-[#2d9449] font-bold shadow-m3-1 hover:shadow-m3-2 transition-all hover:scale-105 active:scale-95 border-0"
              onClick={liberarEmprestimo}
              disabled={salvando}
            >
              {salvando
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle2 size={18} />
              }
              <span>{salvando ? 'Processando transações...' : 'Liberar Financiamento'}</span>
            </Button>
          )}
        </div>
      </div>


    </AppShell>
  )
}
