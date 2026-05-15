'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Package,
  ArrowUpDown,
  X,
} from 'lucide-react'

interface Produto {
  id: string
  nome: string
  sku: string | null
  estoque: number
  estoque_minimo: number
  unidade: string | null
}

// ---------- Combobox produto selector ----------
function ProdutoSelector({
  produtos,
  selected,
  onSelect,
}: {
  produtos: Produto[]
  selected: Produto | null
  onSelect: (p: Produto | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.trim()
    ? produtos.filter(
        (p) =>
          p.nome.toLowerCase().includes(query.toLowerCase()) ||
          (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : produtos

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          placeholder="Buscar produto..."
          value={selected ? selected.nome : query}
          onChange={(e) => {
            setQuery(e.target.value)
            onSelect(null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="flex-1"
        />
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onSelect(null)
              setQuery('')
            }}
          >
            <X size={14} />
          </Button>
        )}
      </div>
      {open && !selected && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-[#FEF9E7] transition-colors flex items-center justify-between"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p)
                setOpen(false)
                setQuery('')
              }}
            >
              <span className="font-medium text-slate-800">{p.nome}</span>
              {p.sku && <span className="text-xs text-slate-400">SKU: {p.sku}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Stock status helper ----------
function estoqueStatus(p: Produto): 'critico' | 'baixo' | 'ok' {
  if (p.estoque === 0) return 'critico'
  if (p.estoque < p.estoque_minimo) return 'baixo'
  return 'ok'
}

const statusLabel: Record<string, string> = {
  critico: 'Crítico',
  baixo: 'Baixo',
  ok: 'OK',
}

// ---------- Main page ----------
export default function MovimentacoesEstoquePage() {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // dialog states
  const [entradaOpen, setEntradaOpen] = useState(false)
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [perdaOpen, setPerdaOpen] = useState(false)

  // Entrada form
  const [entradaProduto, setEntradaProduto] = useState<Produto | null>(null)
  const [entradaQtd, setEntradaQtd] = useState('')
  const [entradaCusto, setEntradaCusto] = useState('')
  const [entradaFornecedor, setEntradaFornecedor] = useState('')
  const [entradaNF, setEntradaNF] = useState('')
  const [entradaMotivo, setEntradaMotivo] = useState('')

  // Ajuste form
  const [ajusteProduto, setAjusteProduto] = useState<Produto | null>(null)
  const [ajusteQtdReal, setAjusteQtdReal] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')

  // Perda form
  const [perdaProduto, setPerdaProduto] = useState<Produto | null>(null)
  const [perdaQtd, setPerdaQtd] = useState('')
  const [perdaMotivo, setPerdaMotivo] = useState('')

  const carregarProdutos = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, sku, estoque, estoque_minimo, unidade')
      .eq('empresa_id', empresaAtual.id)
      .eq('status', 'ativo')
      .order('nome')

    if (error) {
      toast.error('Erro ao carregar produtos')
    } else {
      setProdutos(data ?? [])
    }
    setLoading(false)
  }, [empresaAtual?.id, supabase])

  useEffect(() => {
    carregarProdutos()
  }, [carregarProdutos])

  // ---- Handlers ----
  const handleEntrada = async () => {
    if (!entradaProduto) return toast.error('Selecione um produto')
    const qtd = parseInt(entradaQtd)
    if (!qtd || qtd < 1) return toast.error('Quantidade deve ser ≥ 1')

    setSaving(true)
    const novoEstoque = entradaProduto.estoque + qtd
    const { error } = await supabase
      .from('produtos')
      .update({ estoque: novoEstoque })
      .eq('id', entradaProduto.id)

    if (error) {
      toast.error('Erro ao registrar entrada')
    } else {
      toast.success(
        `Entrada registrada! Estoque de ${entradaProduto.nome}: ${entradaProduto.estoque} → ${novoEstoque} ${entradaProduto.unidade ?? ''}`
      )
      setEntradaOpen(false)
      resetEntrada()
      carregarProdutos()
    }
    setSaving(false)
  }

  const handleAjuste = async () => {
    if (!ajusteProduto) return toast.error('Selecione um produto')
    const qtdReal = parseInt(ajusteQtdReal)
    if (isNaN(qtdReal) || qtdReal < 0) return toast.error('Informe a quantidade real')
    if (!ajusteMotivo.trim()) return toast.error('Motivo é obrigatório')

    setSaving(true)
    const { error } = await supabase
      .from('produtos')
      .update({ estoque: qtdReal })
      .eq('id', ajusteProduto.id)

    if (error) {
      toast.error('Erro ao ajustar estoque')
    } else {
      toast.success(`Estoque ajustado: ${ajusteProduto.estoque} → ${qtdReal}`)
      setAjusteOpen(false)
      resetAjuste()
      carregarProdutos()
    }
    setSaving(false)
  }

  const handlePerda = async () => {
    if (!perdaProduto) return toast.error('Selecione um produto')
    const qtd = parseInt(perdaQtd)
    if (!qtd || qtd < 1) return toast.error('Quantidade deve ser ≥ 1')
    if (qtd > perdaProduto.estoque) return toast.error('Quantidade maior que o estoque atual')
    if (!perdaMotivo.trim()) return toast.error('Motivo é obrigatório')

    setSaving(true)
    const novoEstoque = Math.max(0, perdaProduto.estoque - qtd)
    const { error } = await supabase
      .from('produtos')
      .update({ estoque: novoEstoque })
      .eq('id', perdaProduto.id)

    if (error) {
      toast.error('Erro ao registrar perda')
    } else {
      toast.success(`Perda registrada. Estoque: ${perdaProduto.estoque} → ${novoEstoque}`)
      setPerdaOpen(false)
      resetPerda()
      carregarProdutos()
    }
    setSaving(false)
  }

  // ---- Reset helpers ----
  const resetEntrada = () => {
    setEntradaProduto(null)
    setEntradaQtd('')
    setEntradaCusto('')
    setEntradaFornecedor('')
    setEntradaNF('')
    setEntradaMotivo('')
  }
  const resetAjuste = () => {
    setAjusteProduto(null)
    setAjusteQtdReal('')
    setAjusteMotivo('')
  }
  const resetPerda = () => {
    setPerdaProduto(null)
    setPerdaQtd('')
    setPerdaMotivo('')
  }

  // ---- Derived data ----
  const produtosBaixos = produtos.filter((p) => p.estoque < p.estoque_minimo)

  const ajusteDiff = ajusteProduto && ajusteQtdReal !== ''
    ? parseInt(ajusteQtdReal) - ajusteProduto.estoque
    : null

  const colunas: Column<Produto>[] = [
    {
      key: 'nome',
      header: 'Produto',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-800">{p.nome}</p>
          {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
        </div>
      ),
    },
    {
      key: 'estoque',
      header: 'Estoque Atual',
      render: (p) => (
        <span className={cn('font-semibold', p.estoque === 0 ? 'text-red-600' : 'text-slate-800')}>
          {p.estoque} {p.unidade ?? ''}
        </span>
      ),
    },
    {
      key: 'estoque_minimo',
      header: 'Estoque Mínimo',
      render: (p) => (
        <span className="text-slate-600">
          {p.estoque_minimo} {p.unidade ?? ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const s = estoqueStatus(p)
        return (
          <StatusBadge
            status={s}
            label={statusLabel[s]}
          />
        )
      },
    },
  ]

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="emporio" titulo="Movimentações de Estoque">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          onClick={() => setEntradaOpen(true)}
          className="bg-[#D4A528] hover:bg-[#B8901E] text-white gap-2"
        >
          <TrendingUp size={16} />
          Entrada de Estoque
        </Button>
        <Button
          variant="outline"
          onClick={() => setAjusteOpen(true)}
          className="border-[#D4A528] text-[#D4A528] hover:bg-[#FEF9E7] gap-2"
        >
          <ArrowUpDown size={16} />
          Ajuste de Estoque
        </Button>
        <Button
          variant="outline"
          onClick={() => setPerdaOpen(true)}
          className="border-red-400 text-red-600 hover:bg-red-50 gap-2"
        >
          <TrendingDown size={16} />
          Registrar Perda
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={carregarProdutos}
          className="ml-auto text-slate-500"
        >
          <RefreshCw size={16} />
        </Button>
      </div>

      {/* Info card */}
      <div className="mb-6 rounded-xl border border-[#F5E6B8] bg-[#FEF9E7] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="flex gap-3">
          <TrendingUp size={20} className="text-[#D4A528] mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-800">Entrada de Estoque</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Registre recebimento de mercadorias de fornecedores com nota fiscal.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <ArrowUpDown size={20} className="text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-800">Ajuste de Estoque</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Corrija a quantidade real após contagem física do inventário.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <TrendingDown size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-800">Registrar Perda</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Registre avarias, furtos ou vencimentos com justificativa obrigatória.
            </p>
          </div>
        </div>
      </div>

      {/* Low stock section */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-500" />
          <h2 className="text-base font-semibold text-slate-800">
            Produtos com Estoque Baixo
            {produtosBaixos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {produtosBaixos.length} produto{produtosBaixos.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
        </div>

        {produtosBaixos.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 py-10 text-center">
            <Package size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Todos os produtos estão com estoque adequado.</p>
          </div>
        ) : (
          <DataTable
            data={produtosBaixos}
            columns={colunas}
            keyExtractor={(p) => p.id}
          />
        )}
      </div>

      {/* ==================== Dialog: Entrada ==================== */}
      <Dialog open={entradaOpen} onOpenChange={(v) => { setEntradaOpen(v); if (!v) resetEntrada() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#D4A528]" />
              Entrada de Estoque
            </DialogTitle>
            <DialogDescription>
              Registre o recebimento de produtos. O estoque será incrementado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <ProdutoSelector
                produtos={produtos}
                selected={entradaProduto}
                onSelect={setEntradaProduto}
              />
              {entradaProduto && (
                <p className="text-xs text-slate-500">
                  Estoque atual: <span className="font-semibold">{entradaProduto.estoque} {entradaProduto.unidade ?? ''}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min={1}
                  value={entradaQtd}
                  onChange={(e) => setEntradaQtd(e.target.value)}
                  placeholder="0"
                />
                {entradaProduto && entradaQtd && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Novo estoque: {entradaProduto.estoque + (parseInt(entradaQtd) || 0)} {entradaProduto.unidade ?? ''}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Custo unitário (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={entradaCusto}
                  onChange={(e) => setEntradaCusto(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Input
                  value={entradaFornecedor}
                  onChange={(e) => setEntradaFornecedor(e.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Número da NF</Label>
                <Input
                  value={entradaNF}
                  onChange={(e) => setEntradaNF(e.target.value)}
                  placeholder="NF-e 000000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={entradaMotivo}
                onChange={(e) => setEntradaMotivo(e.target.value)}
                placeholder="Observações sobre esta entrada..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEntradaOpen(false); resetEntrada() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleEntrada}
              disabled={saving}
              className="bg-[#D4A528] hover:bg-[#B8901E] text-white"
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <TrendingUp size={16} className="mr-2" />}
              Confirmar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Dialog: Ajuste ==================== */}
      <Dialog open={ajusteOpen} onOpenChange={(v) => { setAjusteOpen(v); if (!v) resetAjuste() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown size={18} className="text-slate-600" />
              Ajuste de Estoque
            </DialogTitle>
            <DialogDescription>
              Corrija o estoque com base na contagem física. Informe a quantidade real encontrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <ProdutoSelector
                produtos={produtos}
                selected={ajusteProduto}
                onSelect={(p) => {
                  setAjusteProduto(p)
                  setAjusteQtdReal('')
                }}
              />
            </div>

            {ajusteProduto && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">Estoque atual no sistema</span>
                <span className="font-bold text-slate-800">
                  {ajusteProduto.estoque} {ajusteProduto.unidade ?? ''}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Quantidade real (contagem física) *</Label>
              <Input
                type="number"
                min={0}
                value={ajusteQtdReal}
                onChange={(e) => setAjusteQtdReal(e.target.value)}
                placeholder="Informe o total contado"
              />
              {ajusteDiff !== null && !isNaN(ajusteDiff) && (
                <p
                  className={cn(
                    'text-sm font-semibold mt-1',
                    ajusteDiff > 0 ? 'text-emerald-600' : ajusteDiff < 0 ? 'text-red-600' : 'text-slate-500'
                  )}
                >
                  Diferença:{' '}
                  {ajusteDiff > 0 ? '+' : ''}
                  {ajusteDiff} {ajusteProduto?.unidade ?? ''}
                  {ajusteDiff === 0 && ' (sem alteração)'}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Motivo do ajuste *</Label>
              <Textarea
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                placeholder="Ex: Contagem física do inventário mensal..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAjusteOpen(false); resetAjuste() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleAjuste}
              disabled={saving}
              className="bg-[#1A1A2E] hover:bg-[#2a2a4e] text-white"
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowUpDown size={16} className="mr-2" />}
              Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Dialog: Perda ==================== */}
      <Dialog open={perdaOpen} onOpenChange={(v) => { setPerdaOpen(v); if (!v) resetPerda() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <TrendingDown size={18} />
              Registrar Perda
            </DialogTitle>
            <DialogDescription>
              Registre avarias, furtos ou vencimentos. O estoque será decrementado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <ProdutoSelector
                produtos={produtos}
                selected={perdaProduto}
                onSelect={(p) => {
                  setPerdaProduto(p)
                  setPerdaQtd('')
                }}
              />
              {perdaProduto && (
                <p className="text-xs text-slate-500">
                  Estoque atual: <span className="font-semibold">{perdaProduto.estoque} {perdaProduto.unidade ?? ''}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Quantidade perdida *</Label>
              <Input
                type="number"
                min={1}
                max={perdaProduto?.estoque ?? undefined}
                value={perdaQtd}
                onChange={(e) => setPerdaQtd(e.target.value)}
                placeholder="0"
              />
              {perdaProduto && perdaQtd && (
                <p
                  className={cn(
                    'text-xs font-medium',
                    parseInt(perdaQtd) > perdaProduto.estoque ? 'text-red-600' : 'text-slate-500'
                  )}
                >
                  {parseInt(perdaQtd) > perdaProduto.estoque
                    ? 'Quantidade maior que o estoque disponível!'
                    : `Estoque após perda: ${Math.max(0, perdaProduto.estoque - (parseInt(perdaQtd) || 0))} ${perdaProduto.unidade ?? ''}`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Motivo da perda *</Label>
              <Textarea
                value={perdaMotivo}
                onChange={(e) => setPerdaMotivo(e.target.value)}
                placeholder="Descreva detalhadamente o motivo da perda (avaria, furto, vencimento, etc.)..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPerdaOpen(false); resetPerda() }}>
              Cancelar
            </Button>
            <Button
              onClick={handlePerda}
              disabled={saving}
              variant="destructive"
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <TrendingDown size={16} className="mr-2" />}
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
