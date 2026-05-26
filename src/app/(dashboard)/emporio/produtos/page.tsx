'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { exportarCSV } from '@/lib/utils/export'
import { usePermissao } from '@/hooks/usePermissao'
import { Download } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { SearchInput } from '@/components/shared/SearchInput'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Package,
  List,
  LayoutGrid,
  Edit2,
  Copy,
  BarChart3,
  TrendingDown,
  AlertTriangle,
  Loader2,
  Boxes,
} from 'lucide-react'
import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Produto = {
  id: string
  empresa_id: string
  categoria_id: string | null
  fornecedor_id: string | null
  nome: string
  descricao: string | null
  descricao_curta: string | null
  sku: string | null
  preco: number
  preco_custo: number | null
  estoque: number
  estoque_minimo: number
  unidade: string
  peso: number | null
  dimensoes: Record<string, number> | null
  imagens: string[]
  tags: string[] | null
  destaque: boolean
  disponivel_catalogo: boolean
  status: 'ativo' | 'inativo' | 'sem_estoque'
  created_at: string
  updated_at: string
  categorias_produto: { nome: string } | null
}

type Categoria = {
  id: string
  nome: string
  slug: string
  icone: string
  ordem: number
  ativo: boolean
}

type EstoqueFilter = 'todos' | 'normal' | 'baixo' | 'zerado'

// ─── Stock Badge ──────────────────────────────────────────────────────────────

function EstoqueBadge({
  estoque,
  estoqueMinimo,
  unidade,
}: {
  estoque: number
  estoqueMinimo: number
  unidade: string
}) {
  if (estoque === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
        Zerado
      </span>
    )
  }
  if (estoque < estoqueMinimo) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
        {estoque} {unidade} ↓
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
      {estoque} {unidade}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProdutosPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()
  const { temPermissao } = usePermissao()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [view, setView] = useState<'grade' | 'lista'>('lista')
  const [search, setSearch] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas')
  const [filterEstoque, setFilterEstoque] = useState<EstoqueFilter>('todos')

  const [ajusteDialog, setAjusteDialog] = useState<{
    produto: Produto | null
    open: boolean
  }>({ produto: null, open: false })
  const [novaQtd, setNovaQtd] = useState<string>('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [duplicando, setDuplicando] = useState<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  async function carregarDados() {
    if (!empresaAtual) return
    setLoading(true)
    try {
      const [{ data: prods, error: errProds }, { data: cats, error: errCats }] =
        await Promise.all([
          supabase
            .from('produtos')
            .select('*, categorias_produto(nome)')
            .eq('empresa_id', empresaAtual.id)
            .order('nome'),
          supabase
            .from('categorias_produto')
            .select('*')
            .eq('empresa_id', empresaAtual.id)
            .eq('ativo', true)
            .order('nome'),
        ])
      if (errProds) throw errProds
      if (errCats) throw errCats
      setProdutos((prods as Produto[]) ?? [])
      setCategorias((cats as Categoria[]) ?? [])
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const total = produtos.length
  const emEstoque = produtos.filter((p) => p.estoque > 0).length
  const estoqueBaixo = produtos.filter(
    (p) => p.estoque > 0 && p.estoque < p.estoque_minimo
  ).length
  const zerados = produtos.filter((p) => p.estoque === 0).length
  const noCatalogo = produtos.filter((p) => p.disponivel_catalogo).length

  // ── Filter ─────────────────────────────────────────────────────────────────

  const produtosFiltrados = produtos.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === '' ||
      p.nome.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q)

    const matchCategoria =
      selectedCategoria === 'todas' || p.categoria_id === selectedCategoria

    const matchEstoque =
      filterEstoque === 'todos' ||
      (filterEstoque === 'normal' && p.estoque >= p.estoque_minimo) ||
      (filterEstoque === 'baixo' && p.estoque > 0 && p.estoque < p.estoque_minimo) ||
      (filterEstoque === 'zerado' && p.estoque === 0)

    return matchSearch && matchCategoria && matchEstoque
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  async function toggleCatalogo(produto: Produto) {
    setToggleLoading(produto.id)
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ disponivel_catalogo: !produto.disponivel_catalogo })
        .eq('id', produto.id)
        .eq('empresa_id', empresaAtual!.id)
      if (error) throw error
      setProdutos((prev) =>
        prev.map((p) =>
          p.id === produto.id
            ? { ...p, disponivel_catalogo: !p.disponivel_catalogo }
            : p
        )
      )
      toast.success(
        `"${produto.nome}" ${
          produto.disponivel_catalogo ? 'removido do' : 'adicionado ao'
        } catálogo`
      )
    } catch {
      toast.error('Erro ao atualizar catálogo')
    } finally {
      setToggleLoading(null)
    }
  }

  async function duplicarProduto(produto: Produto) {
    setDuplicando(produto.id)
    try {
      const { error } = await supabase.from('produtos').insert({
        empresa_id: produto.empresa_id,
        categoria_id: produto.categoria_id,
        fornecedor_id: produto.fornecedor_id,
        nome: `${produto.nome} (Cópia)`,
        descricao: produto.descricao,
        descricao_curta: produto.descricao_curta,
        sku: null,
        preco: produto.preco,
        preco_custo: produto.preco_custo,
        estoque: 0,
        estoque_minimo: produto.estoque_minimo,
        unidade: produto.unidade,
        peso: produto.peso,
        dimensoes: produto.dimensoes,
        imagens: [],
        tags: produto.tags,
        destaque: false,
        disponivel_catalogo: false,
        status: 'ativo',
      })
      if (error) throw error
      toast.success('Produto duplicado com sucesso')
      await carregarDados()
    } catch {
      toast.error('Erro ao duplicar produto')
    } finally {
      setDuplicando(null)
    }
  }

  async function salvarAjuste() {
    if (!ajusteDialog.produto) return
    const qtd = parseInt(novaQtd, 10)
    if (isNaN(qtd) || qtd < 0) {
      toast.error('Quantidade inválida')
      return
    }
    setSalvandoAjuste(true)
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ estoque: qtd })
        .eq('id', ajusteDialog.produto.id)
        .eq('empresa_id', empresaAtual!.id)
      if (error) throw error
      toast.success(
        `Estoque de "${ajusteDialog.produto.nome}" atualizado para ${qtd} ${ajusteDialog.produto.unidade}`
      )
      setAjusteDialog({ produto: null, open: false })
      setNovaQtd('')
      await carregarDados()
    } catch {
      toast.error('Erro ao ajustar estoque')
    } finally {
      setSalvandoAjuste(false)
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: Column<Produto>[] = [
    {
      key: 'produto',
      header: 'Produto',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
            {row.imagens?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.imagens[0]}
                alt={row.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <Package className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{row.nome}</p>
            {row.sku && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{row.sku}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoria',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.categorias_produto?.nome ?? '—'}
        </span>
      ),
    },
    {
      key: 'preco_custo',
      header: 'Custo',
      render: (row) =>
        row.preco_custo != null ? (
          <MoneyDisplay valor={row.preco_custo} tamanho="sm" />
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'preco',
      header: 'Preço',
      render: (row) => (
        <span className="font-semibold" style={{ color: '#D4A528' }}>
          <MoneyDisplay valor={row.preco} tamanho="sm" />
        </span>
      ),
    },
    {
      key: 'estoque',
      header: 'Estoque',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <EstoqueBadge
            estoque={row.estoque}
            estoqueMinimo={row.estoque_minimo}
            unidade={row.unidade}
          />
          <span className="text-xs text-slate-400">
            mín. {row.estoque_minimo} {row.unidade}
          </span>
        </div>
      ),
    },
    {
      key: 'catalogo',
      header: 'Catálogo',
      render: (row) => (
        <Switch
          checked={row.disponivel_catalogo}
          disabled={toggleLoading === row.id}
          onCheckedChange={() => toggleCatalogo(row)}
          aria-label="Visível no catálogo"
        />
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-[#1A1A2E]"
            onClick={() => router.push(`/emporio/produtos/${row.id}`)}
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-[#1A1A2E]"
            onClick={() => duplicarProduto(row)}
            disabled={duplicando === row.id}
            title="Duplicar"
          >
            {duplicando === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-[#1A1A2E]"
            onClick={() => {
              setAjusteDialog({ produto: row, open: true })
              setNovaQtd(String(row.estoque))
            }}
            title="Ajustar estoque"
          >
            <Boxes className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingPage />

  return (
    <AppShell empresa="emporio" titulo="Produtos">

      {/* Stat Cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard
          titulo="Total de Produtos"
          valor={String(total)}
          icone={Package}
          corIcone="#3B82F6"
          corFundo="#EFF6FF"
        />
        <StatCard
          titulo="Em Estoque"
          valor={String(emEstoque)}
          icone={BarChart3}
          corIcone="#10B981"
          corFundo="#F0FDF4"
        />
        <StatCard
          titulo="Estoque Baixo"
          valor={String(estoqueBaixo)}
          icone={AlertTriangle}
          corIcone="#F59E0B"
          corFundo="#FFFBEB"
        />
        <StatCard
          titulo="Zerados"
          valor={String(zerados)}
          icone={TrendingDown}
          corIcone="#EF4444"
          corFundo="#FEF2F2"
        />
        <StatCard
          titulo="No Catálogo"
          valor={String(noCatalogo)}
          icone={LayoutGrid}
          corIcone="#D4A528"
          corFundo="#FEFCE8"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou SKU..."
          className="w-64"
        />

        <Select value={selectedCategoria} onValueChange={(v) => setSelectedCategoria(v ?? 'todas')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterEstoque}
          onValueChange={(v) => setFilterEstoque(v as EstoqueFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estoque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
            <SelectItem value="zerado">Zerado</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 p-0.5 gap-0.5 ml-auto">
          <button
            onClick={() => setView('lista')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              view === 'lista'
                ? 'bg-[#1A1A2E] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            onClick={() => setView('grade')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              view === 'grade'
                ? 'bg-[#1A1A2E] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Grade
          </button>
        </div>

        <div className="flex items-center gap-2">
          {temPermissao('financeiro') && produtosFiltrados.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportarCSV('produtos-emporio', produtosFiltrados.map((p: Produto) => ({
                nome: p.nome,
                sku: p.sku ?? '',
                categoria: p.categorias_produto?.nome ?? '',
                preco_venda: p.preco,
                estoque: p.estoque,
              })), [
                { key: 'nome', label: 'Nome' },
                { key: 'sku', label: 'SKU' },
                { key: 'categoria', label: 'Categoria' },
                { key: 'preco_venda', label: 'Preço Venda' },
                { key: 'estoque', label: 'Estoque' },
              ])}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          )}
          <Button
            onClick={() => router.push('/emporio/produtos/novo')}
            className="text-white font-semibold shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#D4A528' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Content */}
      {produtosFiltrados.length === 0 ? (
        <EmptyState
          icone={Package}
          titulo="Nenhum produto encontrado"
          descricao={
            search || selectedCategoria !== 'todas' || filterEstoque !== 'todos'
              ? 'Tente ajustar os filtros de busca'
              : 'Comece adicionando seu primeiro produto ao estoque'
          }
          acao={
            !search && selectedCategoria === 'todas' && filterEstoque === 'todos'
              ? {
                  label: 'Novo Produto',
                  onClick: () => router.push('/emporio/produtos/novo'),
                }
              : undefined
          }
        />
      ) : view === 'lista' ? (
        <DataTable
          columns={columns}
          data={produtosFiltrados}
          keyExtractor={(row) => row.id}
          perPage={20}
        />
      ) : (
        /* Grade View */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {produtosFiltrados.map((produto) => (
            <div
              key={produto.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                {produto.imagens?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={produto.imagens[0]}
                    alt={produto.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-10 w-10 text-slate-300" />
                )}
              </div>

              {/* Content */}
              <div className="p-3 flex flex-col gap-1.5">
                {produto.sku && (
                  <span className="text-xs text-slate-400 font-mono">
                    {produto.sku}
                  </span>
                )}
                <p className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">
                  {produto.nome}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold" style={{ color: '#D4A528' }}>
                    <MoneyDisplay valor={produto.preco} tamanho="md" />
                  </span>
                  <EstoqueBadge
                    estoque={produto.estoque}
                    estoqueMinimo={produto.estoque_minimo}
                    unidade={produto.unidade}
                  />
                </div>

                {/* Badges */}
                {(produto.destaque || produto.disponivel_catalogo) && (
                  <div className="flex flex-wrap gap-1">
                    {produto.destaque && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        ⭐ Destaque
                      </span>
                    )}
                    {produto.disponivel_catalogo && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        No Catálogo
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 mt-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs text-slate-600 hover:text-[#1A1A2E] hover:bg-slate-50"
                    onClick={() => router.push(`/emporio/produtos/${produto.id}`)}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-[#1A1A2E] hover:bg-slate-50"
                    onClick={() => {
                      setAjusteDialog({ produto, open: true })
                      setNovaQtd(String(produto.estoque))
                    }}
                    title="Ajustar estoque"
                  >
                    <Boxes className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ajuste de estoque Dialog */}
      <Dialog
        open={ajusteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAjusteDialog({ produto: null, open: false })
            setNovaQtd('')
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>{ajusteDialog.produto?.nome}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">Estoque atual</span>
              <span className="font-semibold text-slate-900">
                {ajusteDialog.produto?.estoque ?? 0}{' '}
                {ajusteDialog.produto?.unidade ?? 'un'}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nova-qtd">Nova quantidade</Label>
              <Input
                id="nova-qtd"
                type="number"
                min={0}
                value={novaQtd}
                onChange={(e) => setNovaQtd(e.target.value)}
                placeholder="0"
                className="text-right font-mono"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAjusteDialog({ produto: null, open: false })
                setNovaQtd('')
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarAjuste}
              disabled={salvandoAjuste}
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#D4A528' }}
            >
              {salvandoAjuste ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
