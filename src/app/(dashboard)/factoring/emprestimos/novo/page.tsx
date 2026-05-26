'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, User, Settings, Calculator, CheckCircle2, ChevronRight, ChevronLeft,
  X, Percent, UserPlus,
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

// ── Página principal ─────────────────────────────────────────────────────────
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
    if (taxaParam) return // URL param takes priority over config default
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
    { key: 'numero', header: 'Nº', render: r => <span className="text-slate-400 tabular-nums">{r.numero}</span> },
    { key: 'vencimento', header: 'Vencimento', render: r => <span className="tabular-nums">{formatarData(r.vencimento)}</span> },
    { key: 'principal', header: 'Principal', render: r => <span className="tabular-nums">{formatarMoeda(r.principal)}</span> },
    { key: 'juros', header: 'Juros', render: r => <span className="tabular-nums text-orange-600">{formatarMoeda(r.juros)}</span> },
    { key: 'parcela', header: 'Parcela', render: r => <span className="tabular-nums font-semibold">{formatarMoeda(r.parcela)}</span> },
    { key: 'saldo', header: 'Saldo Devedor', render: r => <span className="tabular-nums text-slate-400">{formatarMoeda(r.saldo_apos)}</span> },
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
      const hoje = new Date().toISOString().split('T')[0]

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
          data_liberacao: hoje,
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
        data_movimentacao: hoje,
      })

      const creditoDisponivel = cliente.credito_disponivel ?? cliente.limite_credito
      await supabase.from('clientes_factoring').update({
        credito_utilizado: (cliente.limite_credito - creditoDisponivel) + valorNum,
        ultima_operacao: hoje,
        total_emprestimos: undefined,
      }).eq('id', cliente.id)

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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const num = i + 1
              const done = step > num
              const active = step === num
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                      style={done
                        ? { backgroundColor: '#22c55e', color: '#fff' }
                        : active
                          ? { backgroundColor: '#1E5AA8', color: '#fff' }
                          : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                    >
                      {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                    </div>
                    <span className="text-xs font-medium" style={{ color: active ? '#1E5AA8' : done ? '#22c55e' : '#94a3b8' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 rounded" style={{ backgroundColor: step > num ? '#22c55e' : '#e2e8f0' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 1: Cliente */}
        {step === 1 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Selecionar Cliente</h2>
              {!cliente && (
                <button
                  onClick={() => setQuickSheetOpen(true)}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                  style={{ color: '#1E5AA8', borderColor: '#1E5AA8' }}
                >
                  <UserPlus size={14} />
                  Novo Cliente
                </button>
              )}
            </div>

            <div ref={wrapperRef} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={busca}
                onChange={e => { setBusca(e.target.value); if (!e.target.value) setCliente(null) }}
                placeholder="Buscar por nome, CPF ou telefone..."
                className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
              />
              {buscando && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1E5AA8', borderTopColor: 'transparent' }} />
              )}
              {cliente && !buscando && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => { setCliente(null); setBusca('') }}>
                  <X size={16} />
                </button>
              )}
              {showDropdown && resultados.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {resultados.map(c => (
                    <button
                      key={c.id}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                      onClick={() => { setCliente(c); setBusca(c.nome); setShowDropdown(false) }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#1E5AA8' }}>
                        {iniciais(c.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.nome}</p>
                        <p className="text-xs text-slate-400">{c.cpf ? formatarCPF(c.cpf) : ''} · {formatarTelefone(c.telefone)}</p>
                      </div>
                      <span className="text-sm font-bold shrink-0" style={{ color: '#1E5AA8' }}>Score {c.score_interno}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Hint "não achou?" */}
              {busca.length >= 2 && resultados.length === 0 && !buscando && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  <span>Nenhum cliente encontrado para &quot;{busca}&quot;</span>
                  <button
                    onClick={() => setQuickSheetOpen(true)}
                    className="ml-3 flex items-center gap-1 font-medium shrink-0"
                    style={{ color: '#1E5AA8' }}
                  >
                    <UserPlus size={14} /> Cadastrar agora
                  </button>
                </div>
              )}
            </div>

            {/* Card do cliente selecionado */}
            {cliente && (
              <div className="rounded-xl border border-blue-200 p-4 space-y-3" style={{ backgroundColor: '#EDF4FE' }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: '#1E5AA8' }}>
                    {iniciais(cliente.nome)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{cliente.nome}</p>
                    <p className="text-sm text-slate-500">{cliente.cpf ? formatarCPF(cliente.cpf) : ''} · {formatarTelefone(cliente.telefone)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-slate-500">Score interno</p>
                    <p className="text-xl font-bold" style={{ color: '#1E5AA8' }}>{cliente.score_interno}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Condições */}
        {step === 2 && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Condições do Empréstimo</h2>

            <div className="space-y-1.5">
              <Label>Valor do Empréstimo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <Input type="number" min={100} value={valor} onChange={e => setValor(e.target.value)} className="pl-9" placeholder="0,00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nº de Parcelas</Label>
                <Input type="number" min={1} max={60} value={numParcelas} onChange={e => setNumParcelas(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa Mensal (%)</Label>
                <div className="relative">
                  <Input type="number" min={0.1} step={0.1} value={taxa} onChange={e => setTaxa(e.target.value)} className="pr-8" />
                  <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>1º Vencimento</Label>
              <Input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Garantias</Label>
              <Input value={garantias} onChange={e => setGarantias(e.target.value)} placeholder="Descreva as garantias (opcional)" />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações internas (opcional)" />
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && resultado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Valor da Parcela', value: formatarMoeda(resultado.parcela), color: '#1E5AA8' },
                { label: 'Total de Juros', value: formatarMoeda(resultado.totalJuros), color: '#f97316' },
                { label: 'Total a Pagar', value: formatarMoeda(resultado.total), color: '#1E5AA8' },
                { label: 'Taxa Mensal', value: `${taxa}%`, color: '#64748b' },
              ].map(card => (
                <div key={card.label} className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-slate-400 mb-1">{card.label}</p>
                  <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Tabela de Amortização</h3>
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
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">Confirmar e Liberar</h2>

            <div className="space-y-3">
              {[
                { label: 'Cliente', value: cliente.nome },
                { label: 'Valor principal', value: formatarMoeda(valorNum) },
                { label: 'Taxa de juros', value: `${taxa}% a.m.` },
                { label: 'Parcelas', value: `${parcelasNum}x de ${formatarMoeda(resultado.parcela)}` },
                { label: 'Total a pagar', value: formatarMoeda(resultado.total) },
                { label: '1º vencimento', value: formatarData(dataVenc) },
                ...(garantias ? [{ label: 'Garantias', value: garantias }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between items-start py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className="text-sm font-medium text-slate-800 text-right max-w-[60%]">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4" style={{ backgroundColor: '#EDF4FE' }}>
              <p className="text-sm text-slate-600">
                Ao confirmar, o contrato será criado, as <strong>{parcelasNum} parcelas</strong> serão geradas
                e <strong>{formatarMoeda(valorNum)}</strong> será registrado como saída de caixa.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={voltar} disabled={step === 1} className="gap-2">
            <ChevronLeft size={16} />
            Voltar
          </Button>

          {step < 4 ? (
            <Button className="gap-2 text-white" style={{ backgroundColor: '#1E5AA8' }} onClick={avancar}>
              Próxima etapa
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              className="gap-2 text-white px-8"
              style={{ backgroundColor: '#22c55e' }}
              onClick={liberarEmprestimo}
              disabled={salvando}
            >
              {salvando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle2 size={16} />
              }
              {salvando ? 'Criando contrato...' : 'Liberar Empréstimo'}
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
