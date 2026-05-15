import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogoContent } from './CatalogoContent'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: config } = await supabase
    .from('config_catalogo')
    .select('titulo, descricao, banner_url')
    .eq('slug', slug)
    .single()

  if (!config) return { title: 'Catálogo não encontrado' }

  return {
    title: config.titulo,
    description: config.descricao ?? undefined,
    openGraph: {
      title: config.titulo,
      description: config.descricao ?? undefined,
      images: config.banner_url ? [config.banner_url] : [],
    },
  }
}

export default async function CatalogoPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('config_catalogo')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!config || !config.ativo) notFound()

  const [{ data: categorias }, { data: produtos }] = await Promise.all([
    supabase
      .from('categorias_produto')
      .select('*')
      .eq('empresa_id', config.empresa_id)
      .eq('ativo', true)
      .order('ordem'),
    supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', config.empresa_id)
      .eq('disponivel_catalogo', true)
      .eq('status', 'ativo')
      .order('destaque', { ascending: false })
      .order('nome'),
  ])

  return (
    <CatalogoContent
      config={config}
      categorias={categorias ?? []}
      produtos={produtos ?? []}
    />
  )
}
