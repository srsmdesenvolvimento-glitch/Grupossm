import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const assinaturaSchema = z.object({
  empresa_id: z.string().uuid(),
  plano_id: z.string().uuid(),
  status: z.enum(['trial', 'ativa', 'inadimplente', 'cancelada', 'suspensa', 'expirada']).default('trial'),
  periodicidade: z.enum(['mensal', 'anual']).default('mensal'),
  data_inicio: z.string().optional(),
  data_fim: z.string().nullable().optional(),
  data_renovacao: z.string().nullable().optional(),
  valor_cobrado: z.number().min(0).nullable().optional(),
  desconto_pct: z.number().min(0).max(100).default(0),
  observacoes: z.string().nullable().optional(),
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await assertAdmin(supabase)
    if (!user) return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const empresa_id = searchParams.get('empresa_id')

    const admin = createAdminClient()
    let query = admin
      .from('assinaturas')
      .select(`
        *,
        empresas(id, nome, tipo, cnpj),
        planos_assinatura(id, nome, preco_mensal, preco_anual)
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
    const user = await assertAdmin(supabase)
    if (!user) return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const parsed = assinaturaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminClient()

    // Busca o plano para calcular valor
    const { data: plano } = await admin
      .from('planos_assinatura')
      .select('preco_mensal, preco_anual')
      .eq('id', parsed.data.plano_id)
      .single()

    const valorBase = parsed.data.periodicidade === 'anual'
      ? (plano?.preco_anual ?? (plano?.preco_mensal ?? 0) * 12)
      : (plano?.preco_mensal ?? 0)

    const desconto = parsed.data.desconto_pct ?? 0
    const valorCobrado = parsed.data.valor_cobrado ?? (valorBase * (1 - desconto / 100))

    // Calcula data de renovação
    const inicio = parsed.data.data_inicio ? new Date(parsed.data.data_inicio) : new Date()
    const renovacao = new Date(inicio)
    if (parsed.data.periodicidade === 'anual') {
      renovacao.setFullYear(renovacao.getFullYear() + 1)
    } else {
      renovacao.setMonth(renovacao.getMonth() + 1)
    }

    const { data, error } = await admin
      .from('assinaturas')
      .upsert({
        ...parsed.data,
        valor_cobrado: valorCobrado,
        data_renovacao: parsed.data.data_renovacao ?? renovacao.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })
      .select(`
        *,
        empresas(id, nome, tipo),
        planos_assinatura(id, nome, preco_mensal)
      `)
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

    const parsed = assinaturaSchema.partial().safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('assinaturas')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        empresas(id, nome, tipo),
        planos_assinatura(id, nome, preco_mensal)
      `)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
