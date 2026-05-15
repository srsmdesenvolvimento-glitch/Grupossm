'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, ArrowRight, TrendingUp, DollarSign, Percent } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'

type TabelaLinha = {
  numero: number
  vencimento: string
  principal: number
  juros: number
  parcela: number
  saldo: number
}

function calcularPrice(
  valor: number,
  taxa: number, // mensal decimal
  n: number,
  dataInicio: string
): { parcela: number; total: number; totalJuros: number; tabela: TabelaLinha[] } {
  if (!valor || !taxa || !n) return { parcela: 0, total: 0, totalJuros: 0, tabela: [] }
  const i = taxa / 100
  const parcela = valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
  let saldo = valor
  const tabela: TabelaLinha[] = []
  const base = new Date(dataInicio || new Date().toISOString().split('T')[0])

  for (let k = 1; k <= n; k++) {
    const juros = saldo * i
    const principal = parcela - juros
    saldo = Math.max(0, saldo - principal)
    const venc = new Date(base)
    venc.setMonth(venc.getMonth() + k)
    tabela.push({
      numero: k,
      vencimento: venc.toISOString().split('T')[0],
      principal,
      juros,
      parcela,
      saldo,
    })
  }
  return {
    parcela,
    total: parcela * n,
    totalJuros: parcela * n - valor,
    tabela,
  }
}

function calcularSAC(
  valor: number,
  taxa: number,
  n: number,
  dataInicio: string
): { parcela: number; total: number; totalJuros: number; tabela: TabelaLinha[] } {
  if (!valor || !taxa || !n) return { parcela: 0, total: 0, totalJuros: 0, tabela: [] }
  const i = taxa / 100
  const amort = valor / n
  let saldo = valor
  let total = 0
  const tabela: TabelaLinha[] = []
  const base = new Date(dataInicio || new Date().toISOString().split('T')[0])

  for (let k = 1; k <= n; k++) {
    const juros = saldo * i
    const parcela = amort + juros
    saldo = Math.max(0, saldo - amort)
    total += parcela
    const venc = new Date(base)
    venc.setMonth(venc.getMonth() + k)
    tabela.push({
      numero: k,
      vencimento: venc.toISOString().split('T')[0],
      principal: amort,
      juros,
      parcela,
      saldo,
    })
  }
  return { parcela: tabela[0]?.parcela ?? 0, total, totalJuros: total - valor, tabela }
}

const defaultVenc = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
})()

export default function SimuladorPage() {
  const router = useRouter()

  const [valor, setValor] = useState(5000)
  const [parcelas, setParcelas] = useState(12)
  const [taxa, setTaxa] = useState(5)
  const [tipoJuros, setTipoJuros] = useState<'price' | 'sac'>('price')
  const [dataVenc, setDataVenc] = useState(defaultVenc)

  const resultado = useMemo(() => {
    if (!valor || !parcelas || !taxa) return null
    return tipoJuros === 'price'
      ? calcularPrice(valor, taxa, parcelas, dataVenc)
      : calcularSAC(valor, taxa, parcelas, dataVenc)
  }, [valor, parcelas, taxa, tipoJuros, dataVenc])

  const columns: Column<TabelaLinha>[] = [
    { key: 'numero', header: 'Nº', render: r => <span className="tabular-nums text-slate-500">{r.numero}</span> },
    { key: 'vencimento', header: 'Vencimento', render: r => <span className="tabular-nums">{formatarData(r.vencimento)}</span> },
    { key: 'principal', header: 'Principal', render: r => <span className="tabular-nums">{formatarMoeda(r.principal)}</span> },
    { key: 'juros', header: 'Juros', render: r => <span className="tabular-nums text-orange-600">{formatarMoeda(r.juros)}</span> },
    { key: 'parcela', header: 'Parcela', render: r => <span className="tabular-nums font-semibold text-slate-800">{formatarMoeda(r.parcela)}</span> },
    { key: 'saldo', header: 'Saldo Devedor', render: r => <span className="tabular-nums text-slate-500">{formatarMoeda(r.saldo)}</span> },
  ]

  return (
    <AppShell empresa="factoring" titulo="Simulador de Empréstimo">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT — Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FE' }}>
              <Calculator size={20} style={{ color: '#1E5AA8' }} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Parâmetros</h2>
          </div>

          <div className="space-y-1.5">
            <Label>Valor do Empréstimo</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
              <Input
                type="number"
                value={valor}
                min={100}
                onChange={e => setValor(Number(e.target.value))}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº de Parcelas</Label>
              <Input
                type="number"
                value={parcelas}
                min={1}
                max={60}
                onChange={e => setParcelas(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Taxa Mensal (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxa}
                  min={0.1}
                  step={0.1}
                  onChange={e => setTaxa(Number(e.target.value))}
                  className="pr-8"
                />
                <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>1º Vencimento</Label>
            <Input
              type="date"
              value={dataVenc}
              onChange={e => setDataVenc(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Juros</Label>
            <div className="flex gap-2">
              {[{ v: 'price', l: 'Price (Composto)' }, { v: 'sac', l: 'SAC (Decrescente)' }].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setTipoJuros(o.v as 'price' | 'sac')}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border transition-colors"
                  style={tipoJuros === o.v
                    ? { backgroundColor: '#1E5AA8', color: '#fff', borderColor: '#1E5AA8' }
                    : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {resultado && (
            <Button
              className="w-full gap-2 text-white"
              style={{ backgroundColor: '#1E5AA8' }}
              onClick={() => router.push(
                `/factoring/emprestimos/novo?valor=${valor}&parcelas=${parcelas}&taxa=${taxa}&tipo=${tipoJuros}&venc=${dataVenc}`
              )}
            >
              Criar empréstimo com estes dados
              <ArrowRight size={16} />
            </Button>
          )}
        </div>

        {/* RIGHT — Results */}
        <div className="space-y-4">
          {!resultado ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12">
              <EmptyState
                icone={Calculator}
                titulo="Preencha os parâmetros"
                descricao="Os resultados aparecerão automaticamente enquanto você digita."
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Valor da Parcela', value: resultado.parcela, color: '#1E5AA8', icon: DollarSign },
                  { label: 'Total de Juros', value: resultado.totalJuros, color: '#f97316', icon: TrendingUp },
                  { label: 'Total a Pagar', value: resultado.total, color: '#1E5AA8', icon: DollarSign },
                  { label: 'CET mensal', value: taxa, suffix: '%', color: '#64748b', icon: Percent },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                    <p className="text-xl font-bold" style={{ color: card.color }}>
                      {card.suffix ? `${card.value}%` : formatarMoeda(card.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Tabela de Amortização</h3>
                </div>
                <DataTable
                  columns={columns}
                  data={resultado.tabela}
                  keyExtractor={r => String(r.numero)}
                  perPage={12}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
