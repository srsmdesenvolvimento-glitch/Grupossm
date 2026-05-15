'use client'

import { useState } from 'react'
import { Package, Search, MessageCircle, X, Star } from 'lucide-react'

interface Cores {
  primary: string
  secondary: string
}

interface Config {
  titulo: string
  descricao: string | null
  whatsapp: string | null
  instagram: string | null
  facebook: string | null
  banner_url: string | null
  cores: Cores
  mostrar_preco: boolean
  mostrar_estoque: boolean
  slug: string
}

interface Categoria {
  id: string
  nome: string
  slug: string
  icone: string | null
  ordem: number
}

interface Produto {
  id: string
  nome: string
  sku: string | null
  preco: number | null
  estoque: number
  unidade: string | null
  imagens: string[] | null
  disponivel_catalogo: boolean
  destaque: boolean
  status: string
  categoria_id: string | null
  descricao?: string | null
  descricao_curta?: string | null
}

interface Props {
  config: Config
  categorias: Categoria[]
  produtos: Produto[]
}

function formatPreco(valor: number | null): string {
  if (valor == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function CatalogoContent({ config, categorias, produtos }: Props) {
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas')
  const [searchBusca, setSearchBusca] = useState('')
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null)

  const primary = config.cores?.primary ?? '#D4A528'
  const secondary = config.cores?.secondary ?? '#1A1A2E'

  const whatsappUrl = config.whatsapp
    ? `https://wa.me/55${config.whatsapp.replace(/\D/g, '')}`
    : null

  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca = p.nome.toLowerCase().includes(searchBusca.toLowerCase())
    const matchCategoria =
      selectedCategoria === 'todas' || p.categoria_id === selectedCategoria
    return matchBusca && matchCategoria
  })

  const abrirWhatsApp = (produto?: Produto) => {
    if (!whatsappUrl) return
    const texto = produto
      ? `Olá! Vi o produto "${produto.nome}" no catálogo e tenho interesse!`
      : `Olá! Gostaria de saber mais sobre os produtos do catálogo.`
    window.open(`${whatsappUrl}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#FBF6E9]">
      {/* ===== Header ===== */}
      <header style={{ backgroundColor: secondary }} className="text-white py-5 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: primary }}>
              {config.titulo}
            </h1>
            {config.descricao && (
              <p className="text-slate-300 text-sm mt-1 hidden sm:block">{config.descricao}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchBusca}
                onChange={(e) => setSearchBusca(e.target.value)}
                placeholder="Buscar produtos..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/30 w-52"
              />
            </div>

            {/* WhatsApp button */}
            {whatsappUrl && (
              <button
                onClick={() => abrirWhatsApp()}
                className="w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-full sm:rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center gap-2 text-white text-sm font-medium shrink-0"
              >
                <MessageCircle size={18} />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile search */}
        <div className="max-w-6xl mx-auto mt-3 sm:hidden">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchBusca}
              onChange={(e) => setSearchBusca(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </header>

      {/* ===== Banner ===== */}
      {config.banner_url ? (
        <div className="w-full h-40 sm:h-56 overflow-hidden">
          <img
            src={config.banner_url}
            alt={config.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full h-16 sm:h-24"
          style={{
            background: `linear-gradient(135deg, ${primary}33 0%, ${primary}11 100%)`,
            borderBottom: `2px solid ${primary}22`,
          }}
        />
      )}

      {/* ===== Category chips ===== */}
      {categorias.length > 0 && (
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide no-scrollbar">
              <button
                onClick={() => setSelectedCategoria('todas')}
                className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors"
                style={
                  selectedCategoria === 'todas'
                    ? { backgroundColor: primary, color: '#fff', borderColor: primary }
                    : { backgroundColor: 'white', color: '#475569', borderColor: '#e2e8f0' }
                }
              >
                Todos
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoria(cat.id)}
                  className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5"
                  style={
                    selectedCategoria === cat.id
                      ? { backgroundColor: primary, color: '#fff', borderColor: primary }
                      : { backgroundColor: 'white', color: '#475569', borderColor: '#e2e8f0' }
                  }
                >
                  {cat.icone && <span>{cat.icone}</span>}
                  {cat.nome}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Products grid ===== */}
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhum produto encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Tente buscar por outro termo</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {produtosFiltrados.map((produto) => (
              <div
                key={produto.id}
                className="bg-white rounded-xl border border-[#F5E6B8] hover:border-[#D4A528] hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer group"
                onClick={() => setSelectedProduto(produto)}
              >
                {/* Image */}
                <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                  {produto.imagens?.[0] ? (
                    <img
                      src={produto.imagens[0]}
                      alt={produto.nome}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Package size={32} className="text-slate-300" />
                  )}
                  {produto.destaque && (
                    <span
                      className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-1"
                      style={{ backgroundColor: primary }}
                    >
                      <Star size={10} fill="white" />
                      Destaque
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2 mb-2 flex-1">
                    {produto.nome}
                  </h3>

                  {config.mostrar_preco && produto.preco != null && (
                    <p className="font-bold text-base mb-1" style={{ color: primary }}>
                      {formatPreco(produto.preco)}
                    </p>
                  )}
                  {config.mostrar_preco && produto.preco == null && (
                    <p className="text-slate-400 text-xs italic mb-1">Consulte o preço</p>
                  )}

                  {config.mostrar_estoque && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full self-start mb-2 ${
                        produto.estoque > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {produto.estoque > 0 ? 'Disponível' : 'Indisponível'}
                    </span>
                  )}

                  <button
                    className="mt-auto w-full py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{
                      borderColor: primary,
                      color: primary,
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = primary
                      ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = primary
                    }}
                  >
                    Ver Produto
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ===== Product Modal ===== */}
      {selectedProduto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedProduto(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative aspect-video bg-slate-100 flex items-center justify-center">
              {selectedProduto.imagens?.[0] ? (
                <img
                  src={selectedProduto.imagens[0]}
                  alt={selectedProduto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package size={56} className="text-slate-300" />
              )}
              <button
                onClick={() => setSelectedProduto(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
              {selectedProduto.destaque && (
                <span
                  className="absolute top-3 left-3 text-xs font-bold px-2 py-0.5 rounded-full text-white flex items-center gap-1"
                  style={{ backgroundColor: primary }}
                >
                  <Star size={10} fill="white" />
                  Destaque
                </span>
              )}
            </div>

            <div className="p-5">
              <h2 className="text-xl font-bold text-slate-800 mb-1">
                {selectedProduto.nome}
              </h2>
              {selectedProduto.sku && (
                <p className="text-xs text-slate-400 mb-3">SKU: {selectedProduto.sku}</p>
              )}

              {config.mostrar_preco && selectedProduto.preco != null && (
                <p className="text-2xl font-bold mb-3" style={{ color: primary }}>
                  {formatPreco(selectedProduto.preco)}
                </p>
              )}
              {config.mostrar_preco && selectedProduto.preco == null && (
                <p className="text-slate-400 italic mb-3 text-sm">Consulte o preço</p>
              )}

              {config.mostrar_estoque && (
                <span
                  className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${
                    selectedProduto.estoque > 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {selectedProduto.estoque > 0
                    ? `Disponível (${selectedProduto.estoque} ${selectedProduto.unidade ?? ''})`
                    : 'Indisponível'}
                </span>
              )}

              {(selectedProduto.descricao_curta || selectedProduto.descricao) && (
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  {selectedProduto.descricao_curta ?? selectedProduto.descricao}
                </p>
              )}

              <div className="flex flex-col gap-2 mt-4">
                {whatsappUrl && (
                  <button
                    onClick={() => abrirWhatsApp(selectedProduto)}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={18} />
                    Quero este produto
                  </button>
                )}
                <button
                  onClick={() => setSelectedProduto(null)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Floating WhatsApp button ===== */}
      {whatsappUrl && (
        <button
          onClick={() => abrirWhatsApp()}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Fale conosco no WhatsApp"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* ===== Footer ===== */}
      <footer
        className="py-8 px-4 text-center text-sm"
        style={{ backgroundColor: secondary, color: '#94a3b8' }}
      >
        <p className="font-semibold text-white mb-2">{config.titulo}</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {config.whatsapp && (
            <a
              href={whatsappUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              WhatsApp: {config.whatsapp}
            </a>
          )}
          {config.instagram && (
            <a
              href={`https://instagram.com/${config.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              @{config.instagram}
            </a>
          )}
          {config.facebook && (
            <a
              href={
                config.facebook.startsWith('http')
                  ? config.facebook
                  : `https://facebook.com/${config.facebook}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Facebook
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-600">
          Catálogo digital · Grupo SRSM
        </p>
      </footer>
    </div>
  )
}
