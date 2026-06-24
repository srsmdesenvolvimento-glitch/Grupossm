'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { toast } from 'sonner'
import { formatarMoeda } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Search,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  CheckSquare,
  Users,
  Package,
  ChevronLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

interface ClienteEmporio {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  total_compras: number
}

interface Produto {
  id: string
  nome: string
  sku: string | null
  preco: number
  estoque: number
  unidade: string | null
  imagens: string[] | null
}

type ItemCarrinho = {
  produto: Produto
  quantidade: number
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cartao_debito', label: 'Débito', icon: CreditCard },
  { value: 'cartao_credito', label: 'Crédito', icon: CreditCard },
  { value: 'boleto', label: 'Boleto', icon: FileText },
  { value: 'crediario', label: 'Crediário', icon: CheckSquare },
]

export default function NovaVendaPage() {
  const router = useRouter()
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [clientes, setClientes] = useState<ClienteEmporio[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEmporio | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null)
  const [parcelas, setParcelas] = useState(1)
  const [valorEntrada, setValorEntrada] = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState<'valor' | 'pct'>('valor')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean
    numero_venda?: number
    venda_id?: string
  }>({ open: false })

  const carregarDados = useCallback(async () => {
    if (!empresaAtual?.id) return

    const [{ data: clientesData }, { data: produtosData }] = await Promise.all([
      supabase
        .from('clientes_emporio')
        .select('id, nome, cpf, telefone, total_compras')
        .eq('empresa_id', empresaAtual.id)
        .eq('status', 'ativo')
        .order('nome'),
      supabase
        .from('produtos')
        .select('id, nome, sku, preco, estoque, unidade, imagens')
        .eq('empresa_id', empresaAtual.id)
        .in('status', ['ativo'])
        .gt('estoque', 0)
        .order('nome'),
    ])

    if (clientesData) setClientes(clientesData)
    if (produtosData) setProdutos(produtosData)
  }, [empresaAtual?.id])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Calculations
  const subtotal = carrinho.reduce((s, i) => s + i.produto.preco * i.quantidade, 0)
  const descontoValor = tipoDesconto === 'pct' ? (subtotal * desconto) / 100 : desconto
  const total = Math.max(0, subtotal - descontoValor)
  const isCrediario = formaPagamento === 'crediario'
  const valorParcelado = isCrediario && parcelas > 1 ? (total - valorEntrada) / parcelas : 0

  const primeiraParcelaData = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('pt-BR')
  })()

  const clientesFiltrados = buscaCliente.trim()
    ? clientes
        .filter(
          (c) =>
            c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
            (c.cpf && c.cpf.includes(buscaCliente)),
        )
        .slice(0, 5)
    : []

  const produtosFiltrados = buscaProduto.trim()
    ? produtos
        .filter(
          (p) =>
            p.nome.toLowerCase().includes(buscaProduto.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(buscaProduto.toLowerCase())),
        )
        .slice(0, 8)
    : []

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id)
      if (existente) {
        return prev.map((i) =>
          i.produto.id === produto.id
            ? { ...i, quantidade: Math.min(i.quantidade + 1, produto.estoque) }
            : i,
        )
      }
      return [...prev, { produto, quantidade: 1 }]
    })
    setBuscaProduto('')
  }

  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((i) =>
          i.produto.id === produtoId
            ? {
                ...i,
                quantidade: Math.max(1, Math.min(i.quantidade + delta, i.produto.estoque)),
              }
            : i,
        )
        .filter((i) => i.quantidade > 0),
    )
  }

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId))
  }

  const resetarFormulario = () => {
    setCarrinho([])
    setClienteSelecionado(null)
    setBuscaCliente('')
    setBuscaProduto('')
    setFormaPagamento(null)
    setDesconto(0)
    setTipoDesconto('valor')
    setParcelas(1)
    setValorEntrada(0)
    setObservacoes('')
  }

  const finalizarVenda = async () => {
    if (carrinho.length === 0 || !formaPagamento || total <= 0) return

    setSalvando(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: venda, error: vendaError } = await supabase
        .from('vendas')
        .insert({
          empresa_id: empresaAtual!.id,
          cliente_id: clienteSelecionado?.id ?? null,
          usuario_id: user?.id ?? null,
          subtotal,
          desconto: descontoValor,
          total,
          tipo_pagamento:
            formaPagamento === 'crediario'
              ? 'boleto'
              : (formaPagamento as
                  | 'dinheiro'
                  | 'pix'
                  | 'cartao_credito'
                  | 'cartao_debito'
                  | 'boleto'
                  | 'transferencia'
                  | 'cheque'),
          parcelas: isCrediario ? parcelas : 1,
          valor_entrada: isCrediario ? valorEntrada : 0,
          observacoes: observacoes || null,
          status: 'aprovada',
        })
        .select('id, numero_venda')
        .single()

      if (vendaError || !venda) throw vendaError

      const { error: itensError } = await supabase.from('itens_venda').insert(
        carrinho.map((item) => ({
          venda_id: venda.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          sku_produto: item.produto.sku ?? null,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco,
          desconto: 0,
          total: item.produto.preco * item.quantidade,
        })),
      )
      if (itensError) throw itensError

      for (const item of carrinho) {
        const { error: estoqueError } = await supabase
          .from('produtos')
          .update({ estoque: Math.max(0, item.produto.estoque - item.quantidade) })
          .eq('id', item.produto.id)
        if (estoqueError) throw estoqueError
      }

      if (isCrediario && parcelas > 1) {
        const valorParcela = (total - valorEntrada) / parcelas
        const hoje = new Date()
        const parcelasInsert = []
        for (let i = 1; i <= parcelas; i++) {
          const vencimento = new Date(hoje)
          vencimento.setMonth(vencimento.getMonth() + i)
          parcelasInsert.push({
            empresa_id: empresaAtual!.id,
            venda_id: venda.id,
            cliente_id: clienteSelecionado?.id ?? null,
            numero_parcela: i,
            total_parcelas: parcelas,
            valor: valorParcela,
            data_vencimento: vencimento.toISOString().split('T')[0],
            status: 'pendente',
          })
        }
        const { error: parcelasError } = await supabase.from('parcelas_receber').insert(parcelasInsert)
        if (parcelasError) throw parcelasError
      }

      const { error: caixaError } = await supabase.from('movimentacoes_caixa').insert({
        empresa_id: empresaAtual!.id,
        usuario_id: user?.id ?? null,
        tipo: 'entrada',
        categoria: 'venda',
        descricao: `Venda #${venda.numero_venda}`,
        valor: total,
        referencia_tipo: 'venda',
        referencia_id: venda.id,
        data_movimentacao: new Date().toISOString().split('T')[0],
      })
      if (caixaError) throw caixaError

      setSuccessDialog({ open: true, numero_venda: venda.numero_venda, venda_id: venda.id })
      resetarFormulario()
    } catch (e) {
      toast.error('Erro ao finalizar venda. Tente novamente.')
      console.error(e)
    } finally {
      setSalvando(false)
    }
  }

  const podeFinalizar = carrinho.length > 0 && !!formaPagamento && total > 0 && !salvando
  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0)

  return (
    <AppShell empresa="emporio" titulo="Nova Venda">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/emporio/vendas')}
          className="text-slate-500 hover:text-slate-800 -ml-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar para Vendas
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* LEFT COLUMN: Cart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 space-y-6">
          {/* Section 1: Cliente */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                Cliente (opcional)
              </Label>
              {clienteSelecionado && (
                <button
                  onClick={() => setClienteSelecionado(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Sem cliente (balcão)
                </button>
              )}
            </div>

            {clienteSelecionado ? (
              <div className="flex items-center justify-between bg-[#FEF9E7] border border-[#D4A528]/40 rounded-lg px-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{clienteSelecionado.nome}</p>
                  {clienteSelecionado.telefone && (
                    <p className="text-xs text-slate-500 mt-0.5">{clienteSelecionado.telefone}</p>
                  )}
                </div>
                <button
                  onClick={() => setClienteSelecionado(null)}
                  className="text-slate-400 hover:text-red-400 transition-colors ml-3 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {clientesFiltrados.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-sm">
                    {clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => {
                          setClienteSelecionado(cliente)
                          setBuscaCliente('')
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#FEF9E7] transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-800">{cliente.nome}</p>
                        {cliente.cpf && (
                          <p className="text-xs text-slate-500">CPF: {cliente.cpf}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {buscaCliente.trim() && clientesFiltrados.length === 0 && (
                  <p className="text-xs text-slate-400 px-1">Nenhum cliente encontrado</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Section 2: Add Products */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <Package className="h-4 w-4 text-slate-400" />
              Adicionar Produtos
            </Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="pl-9"
                />
              </div>

              {produtosFiltrados.length > 0 && (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {produtosFiltrados.map((produto) => (
                    <button
                      key={produto.id}
                      onClick={() => adicionarAoCarrinho(produto)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{produto.nome}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {produto.sku && <span className="mr-2">SKU: {produto.sku}</span>}
                          <span className="text-emerald-600">
                            Estoque: {produto.estoque} {produto.unidade ?? 'un.'}
                          </span>
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#D4A528] ml-3 flex-shrink-0">
                        {formatarMoeda(produto.preco)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {buscaProduto.trim() && produtosFiltrados.length === 0 && (
                <p className="text-xs text-slate-400 px-1">Nenhum produto encontrado</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Section 3: Cart Items */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
              Itens do Carrinho
              {carrinho.length > 0 && (
                <span className="ml-auto text-xs font-normal text-slate-500">
                  {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                </span>
              )}
            </Label>

            {carrinho.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhum produto adicionado</p>
                <p className="text-xs mt-1 opacity-70">Use a busca acima para adicionar produtos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {carrinho.map((item) => {
                  const excedendo = item.quantidade > item.produto.estoque
                  return (
                    <div
                      key={item.produto.id}
                      className={cn(
                        'rounded-lg border p-3',
                        excedendo ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {item.produto.nome}
                          </p>
                          <p className="text-xs text-slate-500">{formatarMoeda(item.produto.preco)} / un.</p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => alterarQuantidade(item.produto.id, -1)}
                            className="h-7 w-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums">
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => alterarQuantidade(item.produto.id, 1)}
                            disabled={item.quantidade >= item.produto.estoque}
                            className="h-7 w-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="w-20 text-right flex-shrink-0">
                          <MoneyDisplay valor={item.produto.preco * item.quantidade} tamanho="sm" />
                        </div>

                        <button
                          onClick={() => removerDoCarrinho(item.produto.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {excedendo && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          Quantidade excede o estoque disponível ({item.produto.estoque})
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Payment */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 sticky top-4">
            {/* Summary */}
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Resumo</h3>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-800">{formatarMoeda(subtotal)}</span>
              </div>

              {/* Discount row */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 flex-shrink-0">Desconto</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => { setTipoDesconto('valor'); setDesconto(0) }}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded border transition-colors font-medium',
                      tipoDesconto === 'valor'
                        ? 'border-[#D4A528] bg-[#FEF9E7] text-[#D4A528]'
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50',
                    )}
                  >
                    R$
                  </button>
                  <button
                    onClick={() => { setTipoDesconto('pct'); setDesconto(0) }}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded border transition-colors font-medium',
                      tipoDesconto === 'pct'
                        ? 'border-[#D4A528] bg-[#FEF9E7] text-[#D4A528]'
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50',
                    )}
                  >
                    %
                  </button>
                  <Input
                    type="number"
                    min={0}
                    max={tipoDesconto === 'pct' ? 100 : subtotal}
                    value={desconto || ''}
                    onChange={(e) => { const v = parseFloat(e.target.value); setDesconto(isNaN(v) ? 0 : v) }}
                    className="w-20 h-7 text-sm text-right"
                    placeholder="0"
                  />
                </div>
              </div>

              {descontoValor > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Desconto aplicado</span>
                  <span className="text-emerald-600 font-medium">- {formatarMoeda(descontoValor)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center pt-1">
                <span className="text-base font-bold text-slate-800">TOTAL</span>
                <span className="text-2xl font-bold text-[#D4A528]">{formatarMoeda(total)}</span>
              </div>
            </div>

            <Separator />

            {/* Payment method */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                Forma de Pagamento
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS_PAGAMENTO.map((forma) => {
                  const Icon = forma.icon
                  const selected = formaPagamento === forma.value
                  return (
                    <button
                      key={forma.value}
                      onClick={() => {
                        setFormaPagamento(forma.value)
                        if (forma.value !== 'crediario') {
                          setParcelas(1)
                          setValorEntrada(0)
                        }
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all',
                        selected
                          ? 'border-2 border-[#D4A528] bg-[#FEF9E7] text-[#D4A528]'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {forma.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Crediário options */}
            {isCrediario && (
              <div className="space-y-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Opções do Crediário</p>
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Entrada (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    value={valorEntrada || ''}
                    onChange={(e) => setValorEntrada(Number(e.target.value))}
                    placeholder="0,00"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1 block">Número de Parcelas</Label>
                  <Select
                    value={String(parcelas)}
                    onValueChange={(v) => setParcelas(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {parcelas > 1 && (
                  <div className="text-xs text-slate-600 bg-white rounded-md border border-slate-200 p-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Valor da parcela:</span>
                      <span className="font-semibold text-slate-800">{formatarMoeda(valorParcelado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1ª parcela em:</span>
                      <span className="font-medium">{primeiraParcelaData}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-1 block">
                Observações <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações sobre a venda, data de entrega, etc."
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Submit */}
            <Button
              onClick={finalizarVenda}
              disabled={!podeFinalizar}
              className="w-full h-12 text-base font-semibold bg-[#D4A528] hover:bg-[#C09020] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Finalizar Venda{total > 0 ? ` • ${formatarMoeda(total)}` : ''}
                </>
              )}
            </Button>

            {carrinho.length === 0 && (
              <p className="text-xs text-center text-slate-400 -mt-2">
                Adicione produtos ao carrinho para continuar
              </p>
            )}
            {!formaPagamento && carrinho.length > 0 && (
              <p className="text-xs text-center text-amber-500 -mt-2">
                Selecione a forma de pagamento
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={successDialog.open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-[#FEF9E7] flex items-center justify-center">
                <ShoppingCart className="h-7 w-7 text-[#D4A528]" />
              </div>
            </div>
            <DialogTitle className="text-xl text-center">
              Venda #{successDialog.numero_venda} realizada! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-slate-500">
              A venda foi registrada com sucesso e o estoque foi atualizado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setSuccessDialog({ open: false })}
              className="flex-1"
            >
              Nova Venda
            </Button>
            <Button
              onClick={() => router.push(`/emporio/vendas/${successDialog.venda_id}`)}
              className="flex-1 bg-[#D4A528] hover:bg-[#C09020] text-white"
            >
              Ver Detalhes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
