'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, ArrowRight, TrendingUp, DollarSign, Percent, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'
import {
  calcularJurosCompostos,
  calcularSAC,
  taxaMensalParaAnual,
  type ParcelaTabela,
} from '@/lib/utils/calculos'

const defaultVenc = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
})()

const TIPOS_AMORT = [
  {
    v: 'price' as const,
    l: 'Tabela Price',
    desc: 'Parcelas iguais durante todo o contrato. Amortização cresce e juros caem a cada mês.',
  },
  {
    v: 'sac' as const,
    l: 'SAC',
    desc: 'Amortização constante. Parcelas começam maiores e diminuem gradualmente.',
  },
]

export default function SimuladorPage() {
  const router = useRouter()

  const [valor, setValor] = useState(5000)
  const [parcelas, setParcelas] = useState(12)
  const [taxa, setTaxa] = useState(5)
  const [tipoAmort, setTipoAmort] = useState<'price' | 'sac'>('price')
  const [dataVenc, setDataVenc] = useState(defaultVenc)

  const resultado = useMemo(() => {
    if (!valor || !parcelas || !taxa) return null
    const dataBase = new Date(dataVenc || new Date().toISOString().split('T')[0])
    return tipoAmort === 'price'
      ? calcularJurosCompostos(valor, taxa, parcelas, dataBase)
      : calcularSAC(valor, taxa, parcelas, dataBase)
  }, [valor, parcelas, taxa, tipoAmort, dataVenc])

  const taxaAnual = useMemo(() => taxaMensalParaAnual(taxa), [taxa])

  const columns: Column<ParcelaTabela>[] = [
    { key: 'numero_parcela', header: 'Nº', render: r => <span className="tabular-nums text-muted-foreground">{r.numero_parcela}</span> },
    { key: 'data_vencimento', header: 'Vencimento', render: r => <span className="tabular-nums">{formatarData(r.data_vencimento)}</span> },
    { key: 'valor_principal', header: 'Amortização', render: r => <span className="tabular-nums text-blue-700">{formatarMoeda(r.valor_principal)}</span> },
    { key: 'valor_juros', header: 'Juros', render: r => <span className="tabular-nums text-orange-600">{formatarMoeda(r.valor_juros)}</span> },
    { key: 'valor_parcela', header: 'Parcela', render: r => <span className="tabular-nums font-semibold">{formatarMoeda(r.valor_parcela)}</span> },
    { key: 'saldo_devedor', header: 'Saldo Devedor', render: r => <span className="tabular-nums text-muted-foreground">{formatarMoeda(r.saldo_devedor)}</span> },
  ]

  return (
    <AppShell empresa="factoring" titulo="Simulador de Empréstimo">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT — Form */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EDF4FE' }}>
              <Calculator size={20} style={{ color: '#1E5AA8' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">Parâmetros</h2>
              <p className="text-xs text-muted-foreground">Todos os cálculos usam juros compostos</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Valor do Empréstimo</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
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
              <Label>Taxa Mensal</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={taxa}
                  min={0.1}
                  step={0.1}
                  onChange={e => setTaxa(Number(e.target.value))}
                  className="pr-8"
                />
                <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">≡ {taxaAnual}% a.a. (juros compostos)</p>
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

          <div className="space-y-2">
            <Label>Sistema de Amortização</Label>
            <div className="flex gap-2">
              {TIPOS_AMORT.map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setTipoAmort(o.v)}
                  className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors text-left"
                  style={tipoAmort === o.v
                    ? { backgroundColor: '#1E5AA8', color: '#fff', borderColor: '#1E5AA8' }
                    : { backgroundColor: 'transparent', color: '#475569', borderColor: '#e2e8f0' }}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex gap-1">
              <Info size={12} className="shrink-0 mt-0.5" />
              {TIPOS_AMORT.find(t => t.v === tipoAmort)?.desc}
            </p>
          </div>

          {resultado && (
            <Button
              className="w-full gap-2 text-white"
              style={{ backgroundColor: '#1E5AA8' }}
              onClick={() => router.push(
                `/factoring/emprestimos/novo?valor=${valor}&parcelas=${parcelas}&taxa=${taxa}&tipo=${tipoAmort}&venc=${dataVenc}`
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
            <div className="bg-card rounded-xl border border-border p-12">
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
                  { label: tipoAmort === 'price' ? 'Valor da Parcela' : '1ª Parcela (maior)', value: resultado.valor_parcela, color: '#1E5AA8', icon: DollarSign, isValue: true },
                  { label: 'Total de Juros', value: resultado.total_juros, color: '#f97316', icon: TrendingUp, isValue: true },
                  { label: 'Total a Pagar', value: resultado.total_pagar, color: '#1E5AA8', icon: DollarSign, isValue: true },
                  { label: 'Taxa Anual Equiv.', value: taxaAnual, suffix: '% a.a.', color: '#64748b', icon: Percent, isValue: false },
                ].map(card => (
                  <div key={card.label} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <card.icon size={13} style={{ color: card.color }} />
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                    <p className="text-xl font-bold" style={{ color: card.color }}>
                      {card.isValue ? formatarMoeda(card.value as number) : `${card.value}${card.suffix}`}
                    </p>
                  </div>
                ))}
              </div>

              {/* Juros vs Principal breakdown bar */}
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Composição do contrato</p>
                <div className="flex rounded-full overflow-hidden h-3">
                  <div
                    className="h-3 bg-[#1E5AA8] transition-all"
                    style={{ width: `${Math.round((valor / resultado.total_pagar) * 100)}%` }}
                  />
                  <div className="h-3 bg-orange-400 flex-1" />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1E5AA8] inline-block" />
                    Principal: {formatarMoeda(valor)} ({Math.round((valor / resultado.total_pagar) * 100)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    Juros: {formatarMoeda(resultado.total_juros)} ({Math.round((resultado.total_juros / resultado.total_pagar) * 100)}%)
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-card-foreground text-sm">Tabela de Amortização</h3>
                  <span className="text-xs text-muted-foreground">{resultado.tabela.length} parcelas</span>
                </div>
                <DataTable
                  columns={columns}
                  data={resultado.tabela}
                  keyExtractor={r => String(r.numero_parcela)}
                  perPage={12}
                />
              </div>

              <Button
                size="lg"
                className="w-full gap-2 text-white font-semibold"
                style={{ backgroundColor: '#1E5AA8' }}
                onClick={() => router.push(
                  `/factoring/emprestimos/novo?valor=${valor}&parcelas=${parcelas}&taxa=${taxa}&tipo=${tipoAmort}&venc=${dataVenc}`
                )}
              >
                Contratar Agora
                <ArrowRight size={18} />
              </Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
