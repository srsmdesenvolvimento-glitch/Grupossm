import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Package, ArrowLeft, MessageCircle, Tag, Box } from 'lucide-react'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: produto } = await supabase
    .from('produtos')
    .select('nome, descricao_curta, imagens')
    .eq('id', id)
    .single()

  const imageUrl = produto?.imagens?.[0] ?? null

  return {
    title: produto?.nome ?? 'Produto',
    description: produto?.descricao_curta ?? undefined,
    openGraph: {
      title: produto?.nome,
      description: produto?.descricao_curta ?? undefined,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

function formatPreco(valor: number | null): string {
  if (valor == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export default async function ProdutoCatalogoPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const [{ data: config }, { data: produto }] = await Promise.all([
    supabase.from('config_catalogo').select('*').eq('slug', slug).single(),
    supabase
      .from('produtos')
      .select('*, categorias_produto(nome)')
      .eq('id', id)
      .single(),
  ])

  if (!config || !config.ativo || !produto) notFound()

  const primary: string = config.cores?.primary ?? '#D4A528'
  const secondary: string = config.cores?.secondary ?? '#1A1A2E'

  const whatsappBase = config.whatsapp
    ? `https://wa.me/55${String(config.whatsapp).replace(/\D/g, '')}`
    : null

  const whatsappProduto = whatsappBase
    ? `${whatsappBase}?text=${encodeURIComponent(`Olá! Vi o produto "${produto.nome}" no catálogo e tenho interesse!`)}`
    : null

  const categoriaNome =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (produto.categorias_produto as any)?.nome ?? null

  const imagens: string[] = produto.imagens ?? []

  return (
    <div className="min-h-screen bg-[#FBF6E9]">
      {/* ===== Header ===== */}
      <header style={{ backgroundColor: secondary }} className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a
            href={`/catalogo/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: primary }}
          >
            <ArrowLeft size={16} />
            Voltar ao catálogo
          </a>
          <span className="font-bold text-sm" style={{ color: primary }}>
            {config.titulo}
          </span>
        </div>
      </header>

      {/* ===== Main content ===== */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-[#F5E6B8] shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Image */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
              {imagens[0] ? (
                <img
                  src={imagens[0]}
                  alt={produto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package size={72} className="text-slate-300" />
              )}
              {produto.destaque && (
                <span
                  className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ backgroundColor: primary }}
                >
                  Destaque
                </span>
              )}
            </div>

            {/* Details */}
            <div className="p-6 sm:p-8 flex flex-col">
              {/* Category */}
              {categoriaNome && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag size={12} style={{ color: primary }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>
                    {categoriaNome}
                  </span>
                </div>
              )}

              {/* Nome */}
              <h1 className="text-2xl font-bold mb-1" style={{ color: secondary }}>
                {produto.nome}
              </h1>

              {/* SKU */}
              {produto.sku && (
                <p className="text-xs text-slate-400 mb-4">SKU: {produto.sku}</p>
              )}

              {/* Price */}
              {config.mostrar_preco && produto.preco != null && (
                <p className="text-3xl font-bold mb-4" style={{ color: primary }}>
                  {formatPreco(produto.preco)}
                </p>
              )}
              {config.mostrar_preco && produto.preco == null && (
                <p className="text-slate-400 italic mb-4">Consulte o preço</p>
              )}

              {/* Stock */}
              {config.mostrar_estoque && (
                <span
                  className={`inline-block self-start text-xs font-semibold px-3 py-1 rounded-full mb-4 ${
                    produto.estoque > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {produto.estoque > 0
                    ? `${produto.estoque} ${produto.unidade ?? 'un'} disponíveis`
                    : 'Produto indisponível'}
                </span>
              )}

              {/* Short description */}
              {produto.descricao_curta && (
                <p className="text-slate-700 font-medium text-sm mb-3 leading-relaxed">
                  {produto.descricao_curta}
                </p>
              )}

              {/* Full description */}
              {produto.descricao && (
                <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1">
                  {produto.descricao}
                </p>
              )}

              <div className="mt-auto space-y-3">
                {/* WhatsApp CTA */}
                {whatsappProduto ? (
                  <a
                    href={whatsappProduto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors text-base"
                  >
                    <MessageCircle size={20} />
                    Quero este produto
                  </a>
                ) : (
                  <div className="w-full py-3.5 rounded-xl bg-slate-100 text-slate-400 text-center text-sm">
                    WhatsApp não configurado
                  </div>
                )}

                {/* Back to catalog */}
                <a
                  href={`/catalogo/${slug}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border text-sm font-medium transition-colors"
                  style={{ borderColor: primary, color: primary }}
                >
                  <ArrowLeft size={16} />
                  Ver todos os produtos
                </a>
              </div>
            </div>
          </div>

          {/* ===== Extra images ===== */}
          {imagens.length > 1 && (
            <div className="border-t border-[#F5E6B8] p-6">
              <p className="text-sm font-semibold text-slate-600 mb-3">Mais imagens</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {imagens.slice(1).map((img, i) => (
                  <div
                    key={i}
                    className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-[#F5E6B8] bg-slate-100"
                  >
                    <img
                      src={img}
                      alt={`${produto.nome} ${i + 2}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Product details ===== */}
          <div className="border-t border-[#F5E6B8] p-6">
            <p className="text-sm font-semibold text-slate-600 mb-4">Detalhes do Produto</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {produto.unidade && (
                <div className="flex items-start gap-2">
                  <Box size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Unidade</p>
                    <p className="text-sm font-medium text-slate-700">{produto.unidade}</p>
                  </div>
                </div>
              )}
              {produto.sku && (
                <div className="flex items-start gap-2">
                  <Tag size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">SKU</p>
                    <p className="text-sm font-medium text-slate-700 font-mono">{produto.sku}</p>
                  </div>
                </div>
              )}
              {categoriaNome && (
                <div className="flex items-start gap-2">
                  <Tag size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Categoria</p>
                    <p className="text-sm font-medium text-slate-700">{categoriaNome}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ===== Floating WhatsApp ===== */}
      {whatsappBase && (
        <a
          href={`${whatsappBase}?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre os produtos do catálogo.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Fale conosco no WhatsApp"
        >
          <MessageCircle size={24} />
        </a>
      )}

      {/* ===== Footer ===== */}
      <footer
        className="py-6 px-4 text-center text-sm mt-8"
        style={{ backgroundColor: secondary, color: '#94a3b8' }}
      >
        <p className="font-semibold text-white mb-1">{config.titulo}</p>
        {config.whatsapp && (
          <p className="text-slate-400 text-xs">WhatsApp: {config.whatsapp}</p>
        )}
        <p className="mt-3 text-xs text-slate-600">Catálogo digital · Grupo SRSM</p>
      </footer>
    </div>
  )
}
