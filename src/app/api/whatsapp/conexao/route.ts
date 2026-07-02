import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const META_TOKEN = process.env.WHATSAPP_TOKEN
const META_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const META_VERSION = process.env.WHATSAPP_VERSION ?? 'v21.0'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const empresaId = request.nextUrl.searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ erro: 'empresa_id obrigatório' }, { status: 400 })

  const { data: access } = await supabase
    .from('usuario_empresa')
    .select('papel')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresaId)
    .eq('ativo', true)
    .maybeSingle()

  if (!access) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  if (!META_TOKEN || !META_PHONE_ID) {
    return NextResponse.json({
      configurado: false,
      status: 'nao_configurado',
      mensagem: 'WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID não estão definidos no servidor.',
    })
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    const res = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${META_PHONE_ID}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${META_TOKEN}` }, signal: ctrl.signal },
    ).finally(() => clearTimeout(timer))

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({
        configurado: true,
        status: 'erro',
        mensagem: err?.error?.message ?? `Meta API HTTP ${res.status}`,
      })
    }

    const data = await res.json()
    return NextResponse.json({
      configurado: true,
      status: 'ativo',
      phone_number_id: META_PHONE_ID,
      display_phone_number: data.display_phone_number,
      verified_name: data.verified_name,
      quality_rating: data.quality_rating,
    })
  } catch (err: any) {
    return NextResponse.json({
      configurado: true,
      status: 'erro',
      mensagem: err?.name === 'AbortError' ? 'Meta API não respondeu em 10s' : (err.message ?? 'Erro desconhecido'),
    })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
