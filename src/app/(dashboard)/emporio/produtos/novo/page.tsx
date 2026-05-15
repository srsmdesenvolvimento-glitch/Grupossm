'use client'

import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  Save,
  Loader2,
  Package,
  Image as ImageIcon,
  Plus,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ─── Schema ───────────────────────────────────────────────────────────────────

const produtoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  sku: z.string().optional(),
  categoria_id: z.string().optional(),
  descricao_curta: z
    .string()
    .max(500, 'Máximo de 500 caracteres')
    .optional(),
  descricao: z.string().optional(),
  preco_custo: z.coerce.number().min(0).optional().or(z.literal('')),
  preco: z.coerce.number().min(0.01, 'Preço deve ser maior que zero'),
  estoque: z.coerce.number().int().min(0, 'Estoque não pode ser negativo'),
  estoque_minimo: z.coerce.number().int().min(0).optional(),
  unidade: z.string().optional(),
  peso: z.coerce.number().min(0).optional().or(z.literal('')),
  largura: z.coerce.number().min(0).optional().or(z.literal('')),
  altura: z.coerce.number().min(0).optional().or(z.literal('')),
  profundidade: z.coerce.number().min(0).optional().or(z.literal('')),
  disponivel_catalogo: z.boolean().optional(),
  destaque: z.boolean().optional(),
})

type ProdutoFormValues = z.infer<typeof produtoSchema>

type Categoria = {
  id: string
  nome: string
}

// ─── Margin Badge ─────────────────────────────────────────────────────────────

function MargemBadge({ custo, preco }: { custo: number | string; preco: number | string }) {
  const c = Number(custo)
  const p = Number(preco)
  if (!c || !p || c <= 0) return null
  const margem = ((p - c) / c) * 100

  let label = `${margem.toFixed(1)}%`
  let cls = ''
  if (margem >= 20) cls = 'bg-green-50 text-green-700 ring-green-600/20'
  else if (margem >= 10) cls = 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
  else cls = 'bg-red-50 text-red-700 ring-red-600/20'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        cls
      )}
    >
      Margem: {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NovoProdutoPage() {
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()
  const router = useRouter()

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [salvando, setSalvando] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema) as Resolver<ProdutoFormValues>,
    defaultValues: {
      nome: '',
      sku: '',
      descricao_curta: '',
      descricao: '',
      preco: 0,
      estoque: 0,
      estoque_minimo: 0,
      unidade: 'un',
      disponivel_catalogo: true,
      destaque: false,
    },
  })

  const watchedDescricaoCurta = watch('descricao_curta') ?? ''
  const watchedCusto = watch('preco_custo')
  const watchedPreco = watch('preco')

  useEffect(() => {
    async function loadCategorias() {
      if (!empresaAtual) return
      const { data } = await supabase
        .from('categorias_produto')
        .select('id, nome')
        .eq('empresa_id', empresaAtual.id)
        .eq('ativo', true)
        .order('nome')
      setCategorias(data ?? [])
    }
    loadCategorias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtual])

  function gerarSku() {
    const sku = `PROD-${Date.now().toString(36).toUpperCase()}`
    setValue('sku', sku)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews((prev) => [...prev, ...urls])
  }

  function removerPreview(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values: ProdutoFormValues) {
    if (!empresaAtual) return
    setSalvando(true)
    try {
      const temDimensoes =
        values.largura || values.altura || values.profundidade
      const dimensoes = temDimensoes
        ? {
            largura: Number(values.largura) || 0,
            altura: Number(values.altura) || 0,
            profundidade: Number(values.profundidade) || 0,
          }
        : null

      const { error } = await supabase.from('produtos').insert({
        empresa_id: empresaAtual.id,
        nome: values.nome,
        sku: values.sku || null,
        categoria_id: values.categoria_id || null,
        descricao: values.descricao || null,
        descricao_curta: values.descricao_curta || null,
        preco: values.preco,
        preco_custo: values.preco_custo !== '' ? Number(values.preco_custo) : null,
        estoque: values.estoque,
        estoque_minimo: values.estoque_minimo ?? 0,
        unidade: values.unidade || 'un',
        peso: values.peso !== '' ? Number(values.peso) : null,
        dimensoes,
        imagens: [],
        destaque: values.destaque ?? false,
        disponivel_catalogo: values.disponivel_catalogo ?? true,
        status: 'ativo',
      })

      if (error) throw error
      toast.success('Produto criado com sucesso!')
      router.push('/emporio/produtos')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao criar produto')
    } finally {
      setSalvando(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell empresa="emporio" titulo="Novo Produto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <button
          onClick={() => router.push('/emporio/produtos')}
          className="hover:text-slate-700 transition-colors"
        >
          Produtos
        </button>
        <span>/</span>
        <span className="text-slate-900 font-medium">Novo Produto</span>
      </div>

      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar
      </button>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="basicos" className="w-full">
          <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="basicos" className="rounded-lg">
              Dados Básicos
            </TabsTrigger>
            <TabsTrigger value="precos" className="rounded-lg">
              Preços
            </TabsTrigger>
            <TabsTrigger value="estoque" className="rounded-lg">
              Estoque
            </TabsTrigger>
            <TabsTrigger value="caracteristicas" className="rounded-lg">
              Características
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="rounded-lg">
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="fotos" className="rounded-lg">
              Fotos
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Dados Básicos ──────────────────────────────────────── */}
          <TabsContent value="basicos">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="nome">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome"
                  {...register('nome')}
                  placeholder="Ex: Sofá Retrátil 3 Lugares"
                  className={cn(errors.nome && 'border-red-400')}
                />
                {errors.nome && (
                  <p className="text-xs text-red-500">{errors.nome.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    {...register('sku')}
                    placeholder="Ex: SOF-RET-3L"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={gerarSku}
                    className="shrink-0 text-xs px-3"
                  >
                    Gerar automaticamente
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="categoria_id">Categoria</Label>
                <Controller
                  name="categoria_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <SelectTrigger id="categoria_id">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="descricao_curta">Descrição Curta</Label>
                  <span className="text-xs text-slate-400">
                    {watchedDescricaoCurta.length}/500 caracteres
                  </span>
                </div>
                <Textarea
                  id="descricao_curta"
                  {...register('descricao_curta')}
                  placeholder="Resumo do produto para listagens..."
                  rows={2}
                  maxLength={500}
                  className={cn(
                    'resize-none',
                    errors.descricao_curta && 'border-red-400'
                  )}
                />
                {errors.descricao_curta && (
                  <p className="text-xs text-red-500">
                    {errors.descricao_curta.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descricao">
                  Descrição Completa
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    Usado no catálogo público
                  </span>
                </Label>
                <Textarea
                  id="descricao"
                  {...register('descricao')}
                  placeholder="Descreva o produto em detalhes: material, dimensões, diferenciais..."
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 2: Preços ────────────────────────────────────────────── */}
          <TabsContent value="precos">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="preco_custo">Preço de Custo (R$)</Label>
                  <Input
                    id="preco_custo"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('preco_custo')}
                    placeholder="0,00"
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="preco">
                    Preço de Venda (R$) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('preco')}
                    placeholder="0,00"
                    className={cn('font-mono', errors.preco && 'border-red-400')}
                  />
                  {errors.preco && (
                    <p className="text-xs text-red-500">{errors.preco.message}</p>
                  )}
                </div>
              </div>

              {/* Margem calculada */}
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">Margem de lucro:</span>
                <MargemBadge custo={watchedCusto ?? ''} preco={watchedPreco ?? 0} />
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 3: Estoque ───────────────────────────────────────────── */}
          <TabsContent value="estoque">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="estoque">
                    Estoque Atual <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="estoque"
                    type="number"
                    min="0"
                    step="1"
                    {...register('estoque')}
                    placeholder="0"
                    className={cn('font-mono', errors.estoque && 'border-red-400')}
                  />
                  {errors.estoque && (
                    <p className="text-xs text-red-500">{errors.estoque.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    min="0"
                    step="1"
                    {...register('estoque_minimo')}
                    placeholder="0"
                    className="font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    Alerta quando o estoque cair abaixo deste valor
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="unidade">Unidade</Label>
                  <Input
                    id="unidade"
                    {...register('unidade')}
                    placeholder="un, cx, m²..."
                  />
                  <p className="text-xs text-slate-400">
                    Ex: un, cx, par, m², kg
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 4: Características ───────────────────────────────────── */}
          <TabsContent value="caracteristicas">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('peso')}
                  placeholder="0,000"
                  className="font-mono w-48"
                />
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">Dimensões (cm)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="largura"
                      className="text-xs text-slate-500 font-normal"
                    >
                      Largura
                    </Label>
                    <Input
                      id="largura"
                      type="number"
                      step="0.1"
                      min="0"
                      {...register('largura')}
                      placeholder="0"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="altura"
                      className="text-xs text-slate-500 font-normal"
                    >
                      Altura
                    </Label>
                    <Input
                      id="altura"
                      type="number"
                      step="0.1"
                      min="0"
                      {...register('altura')}
                      placeholder="0"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="profundidade"
                      className="text-xs text-slate-500 font-normal"
                    >
                      Profundidade
                    </Label>
                    <Input
                      id="profundidade"
                      type="number"
                      step="0.1"
                      min="0"
                      {...register('profundidade')}
                      placeholder="0"
                      className="font-mono"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Largura × Altura × Profundidade em centímetros
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Informações adicionais como material, cor, marca e modelo podem
                ser incluídas na descrição completa do produto.
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 5: Catálogo ──────────────────────────────────────────── */}
          <TabsContent value="catalogo">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <Controller
                name="disponivel_catalogo"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        Visível no catálogo
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Clientes poderão ver este produto no catálogo público
                      </p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />

              <Controller
                name="destaque"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        Produto em destaque ⭐
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Aparece na seção de destaques do catálogo
                      </p>
                    </div>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />

              <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
                Configure mais opções do catálogo em{' '}
                <strong>Catálogo &rsaquo; Configurações</strong>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab 6: Fotos ─────────────────────────────────────────────── */}
          <TabsContent value="fotos">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              {/* Upload area */}
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 cursor-pointer hover:border-slate-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="font-medium text-slate-700 text-sm">
                  Clique para selecionar fotos
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PNG, JPG ou WEBP — múltiplas fotos permitidas
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Previews */}
              {previews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {previews.map((url, i) => (
                    <div
                      key={i}
                      className="relative rounded-lg overflow-hidden aspect-square bg-slate-100 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Preview ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removerPreview(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium"
                      >
                        Remover
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 aspect-square bg-slate-50 hover:border-slate-300 transition-colors text-slate-400 text-xs gap-1"
                  >
                    <Plus className="h-5 w-5" />
                    Adicionar
                  </button>
                </div>
              )}

              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
                <strong>Nota:</strong> Upload para armazenamento será ativado em
                breve. As fotos serão salvas quando a configuração do Supabase
                Storage estiver completa.
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Fixed bottom save bar ───────────────────────────────────── */}
        <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 -mx-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={salvando}
            className="text-white hover:opacity-90 min-w-[120px]"
            style={{ backgroundColor: '#D4A528' }}
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Produto
              </>
            )}
          </Button>
        </div>
      </form>
    </AppShell>
  )
}
