'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, User, Settings, Calculator, CheckCircle2, ChevronRight, ChevronLeft,
  X, Percent, UserPlus, ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QuickNovoClienteSheet } from '@/components/factoring/QuickNovoClienteSheet'
import { formatarMoeda, formatarData, formatarCPF, formatarTelefone, iniciais } from '@/lib/utils/formatters'
import { parseSupabaseError, logError } from '@/lib/utils/errors'
import { toast } from 'sonner'
import type { ClienteFactoring } from '@/lib/types/database'

type ClienteSumario = Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'limite_credito' | 'credito_disponivel' | 'score_interno'>

type TabelaLinha = {
  numero: number
  vencimento: string
  principal: number
  juros: number
  parcela: number
  saldo_antes: number
  saldo_apos: number
}

function calcularPrice(valor: number, taxa: number, n: number, dataInicio: string) {
  if (!valor || !taxa || !n) return { parcela: 0, total: 0, totalJuros: 0, tabela: [] as TabelaLinha[] }
  const i = taxa / 100
  const parcela = valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
  let saldo = valor
  const base = new Date(dataInicio || new Date().toISOString().split('T')[0])
  const tabela: TabelaLinha[] = []
  for (let k = 1; k <= n; k++) {
    const saldo_antes = saldo
    const juros = saldo * i
    const principal = parcela - juros
    saldo = Math.max(0, saldo - principal)
    const venc = new Date(base)
    venc.setMonth(venc.getMonth() + (k - 1))
    tabela.push({ numero: k, vencimento: venc.toISOString().split('T')[0], principal, juros, parcela, saldo_antes, saldo_apos: saldo })
  }
  return { parcela, total: parcela * n, totalJuros: parcela * n - valor, tabela }
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
  const [quickSheetOpen, setQuickSheetOpen] = useState(false)

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

  const [salvando, setSalvando] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const buscarClientes = useCallback(async (q: string) => {
    if (!empresaAtual || q.trim().length < 2) { setResultados([]); setShowDropdown(false); return }
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('clientes_factoring')
        .select('id, nome, cpf, telefone, limite_credito, credito_disponivel, score_interno')
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
      .select('taxa_juros_padrao')
      .eq('empresa_id', empresaAtual.id)
      .single()
      .then(({ data }) => {
        if (data?.taxa_juros_padrao) setTaxa(String(data.taxa_juros_padrao))
      })
  }, [empresaAtual, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from simulator URL params
  useEffect(() => {
    const valorParam = searchParams.get('valor')
    const parcelasParam = searchParams.get('parcelas')
    const taxaParam = searchParams.get('taxa')
    const vencParam = searchParams.get('venc')
    if (valorParam) setValor(valorParam)
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
      .select('id, nome, cpf, telefone, limite_credito, credito_disponivel, score_interno')
      .eq('id', clienteId)
      .single()
      .then(({ data }) => {
        if (data) {
          setCliente(data as ClienteSumario)
          setBusca(data.nome)
        }
      })
  }, [searchParams, empresaAtual]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClienteCriado = (c: ClienteSumario) => {
    setCliente(c)
    setBusca(c.nome)
  }

  const valorNum = Number(valor) || 0
  const taxaNum = Number(taxa) || 0
  const parcelasNum = Number(numParcelas) || 0

  const resultado = useMemo(() => {
    if (!valorNum || !taxaNum || !parcelasNum) return null
    return calcularPrice(valorNum, taxaNum, parcelasNum, dataVenc)
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

      const { count } = await supabase
        .from('emprestimos')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaAtual.id)
      const seq = String((count ?? 0) + 1).padStart(4, '0')
      const year = new Date().getFullYear()
      const numero_contrato = `EMP-${year}-${seq}`
      const hojeStr = new Date().toISOString().split('T')[0]

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
          observacoes: observacoes || null,
          garantias: garantias || null,
          documentos: [],
          status: 'ativo',
        })
        .select('id')
        .single()

      if (empError || !empData) throw empError

      const empId = empData.id

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

      await supabase.from('movimentacoes_caixa').insert({
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

      const creditoDisponivel = cliente.credito_disponivel ?? cliente.limite_credito
      await supabase.from('clientes_factoring').update({
        credito_utilizado: (cliente.limite_credito - creditoDisponivel) + valorNum,
        ultima_operacao: hojeStr,
        total_emprestimos: undefined,
      }).eq('id', cliente.id).eq('empresa_id', empresaAtual.id)

      toast.success(`Contrato ${numero_contrato} criado com sucesso!`)
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
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
        
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
                  onClick={() => setQuickSheetOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full border border-[#1A73E8] text-[#1A73E8] bg-transparent hover:bg-[#E8F0FE] transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  <UserPlus size={14} />
                  Cadastro Rápido
                </button>
              )}
            </div>

            <div ref={wrapperRef} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={18} />
              <input
                value={busca}
                onChange={e => { setBusca(e.target.value); if (!e.target.value) setCliente(null) }}
                placeholder="Pesquisar por nome, CPF/CNPJ ou telefone..."
                className="w-full pl-11 pr-10 py-3 border border-border/60 focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]/20 rounded-xl text-sm focus:outline-none transition-all"
              />
              {buscando && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-[#1A73E8]" />
              )}
              {cliente && !buscando && (
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground" onClick={() => { setCliente(null); setBusca('') }}>
                  <X size={16} />
                </button>
              )}
              {showDropdown && resultados.length > 0 && (
                <div className="absolute z-50 top-full mt-2 w-full bg-card border border-border/50 rounded-2xl shadow-m3-3 overflow-hidden">
                  {resultados.map(c => (
                    <button
                      key={c.id}
                      className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/65 text-left border-b border-border/30 last:border-0 transition-colors"
                      onClick={() => { setCliente(c); setBusca(c.nome); setShowDropdown(false) }}
                    >
                      {renderAvatar(c.nome)}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate leading-none">{c.nome}</p>
                        <p className="text-xs text-muted-foreground/80 mt-1 font-semibold">{c.cpf ? formatarCPF(c.cpf) : ''} · {formatarTelefone(c.telefone)}</p>
                      </div>
                      <span className="text-xs font-bold shrink-0 bg-[#E8F0FE] text-[#1A73E8] px-2.5 py-0.5 rounded-full border border-[#1A73E8]/10 shadow-sm">Score {c.score_interno}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Hint "não achou?" */}
              {busca.length >= 2 && resultados.length === 0 && !buscando && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground bg-muted/10">
                  <span className="font-semibold text-xs text-muted-foreground/75">Nenhum tomador ativo localizado para &quot;{busca}&quot;</span>
                  <button
                    onClick={() => setQuickSheetOpen(true)}
                    className="ml-3 flex items-center gap-1 font-bold text-xs shrink-0 text-[#1A73E8] hover:underline"
                  >
                    <UserPlus size={14} /> Cadastrar Rápido
                  </button>
                </div>
              )}
            </div>

            {/* Selected tomador card */}
            {cliente && (
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
                <Input type="number" min={100} value={valor} onChange={e => setValor(e.target.value)} className="h-11 pl-10 pr-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-mono font-bold text-sm bg-card border-border/60" placeholder="0,00" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parcelas (Price)</Label>
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

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Primeiro Vencimento</Label>
              <Input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} className="h-11 px-4 focus-visible:ring-1 focus-visible:ring-[#1A73E8] focus-visible:border-[#1A73E8] rounded-xl font-bold text-sm bg-card border-border/60" />
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

            {/* Table wrapper */}
            <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-m3-1 transition-all hover:shadow-m3-2">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/15 flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm tracking-tight">Fluxo de Caixa / Price</h3>
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

      <QuickNovoClienteSheet
        open={quickSheetOpen}
        onClose={() => setQuickSheetOpen(false)}
        onClienteCriado={handleClienteCriado}
      />
    </AppShell>
  )
}
