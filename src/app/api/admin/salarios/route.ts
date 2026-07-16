import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/supabase/superAdmin'
import { z } from 'zod'

const salarioSchema = z.object({
  usuario_id: z.string().uuid(),
  empresa_id: z.string().uuid(),
  cargo: z.string().max(100).optional(),
  valor_base: z.number().min(0),
  beneficios: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  data_inicio: z.string().optional(),
  data_fim: z.string().nullable().optional(),
  ativo: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const empresa_id = searchParams.get('empresa_id')

    const admin = createAdminClient()
    let query = admin
      .from('salarios')
      .select(`
        *,
        usuarios(id, nome, email),
        empresas(id, nome, tipo)
      `)
      .order('created_at', { ascending: false })

    if (empresa_id) query = query.eq('empresa_id', empresa_id)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = salarioSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('salarios')
      .insert(parsed.data)
      .select(`*, usuarios(id, nome, email)`)
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
    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ erro: 'ID obrigatório' }, { status: 400 })

    const parsed = salarioSchema.partial().safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('salarios')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`*, usuarios(id, nome, email), empresas(id, nome)`)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
