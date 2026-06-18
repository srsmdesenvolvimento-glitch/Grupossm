import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const planoSchema = z.object({
  nome: z.string().min(2).max(100),
  descricao: z.string().optional(),
  preco_mensal: z.number().min(0),
  preco_anual: z.number().min(0).optional(),
  max_usuarios: z.number().int().min(1).default(5),
  max_empresas: z.number().int().min(1).default(1),
  recursos: z.record(z.string(), z.unknown()).default({}),
  destaque: z.boolean().default(false),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
})

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ue } = await supabase
    .from('usuario_empresa')
    .select('papel')
    .eq('usuario_id', user.id)
    .eq('papel', 'admin')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()

  return ue ? user : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await assertAdmin(supabase)
    if (!user) return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('planos_assinatura')
      .select('*')
      .order('ordem', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await assertAdmin(supabase)
    if (!user) return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const parsed = planoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('planos_assinatura')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await assertAdmin(supabase)
    if (!user) return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ erro: 'ID obrigatório' }, { status: 400 })

    const parsed = planoSchema.partial().safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('planos_assinatura')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
