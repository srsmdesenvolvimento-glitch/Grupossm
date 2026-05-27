import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  empresa_id: z.string().uuid(),
  papel: z.enum(['admin', 'gerente', 'operador', 'visualizador']),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const { nome, email, senha, empresa_id, papel } = parsed.data

    // Verify caller is admin of the company
    const { data: ue } = await supabase
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresa_id)
      .eq('ativo', true)
      .single()

    if (!ue || ue.papel !== 'admin') {
      return NextResponse.json({ erro: 'Sem permissão para criar usuários nesta empresa' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Create auth user
    const { data: newUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (authError || !newUser.user) {
      return NextResponse.json({ erro: authError?.message ?? 'Erro ao criar usuário' }, { status: 400 })
    }

    // Create usuarios profile
    const { error: perfilError } = await admin.from('usuarios').insert({
      id: newUser.user.id,
      nome,
      email,
    })
    if (perfilError) {
      return NextResponse.json({ erro: 'Erro ao criar perfil do usuário', detalhes: perfilError.message }, { status: 500 })
    }

    // Link to company
    const { error: vinculoError } = await admin.from('usuario_empresa').insert({
      usuario_id: newUser.user.id,
      empresa_id,
      papel,
    })
    if (vinculoError) {
      return NextResponse.json({ erro: 'Erro ao vincular usuário à empresa', detalhes: vinculoError.message }, { status: 500 })
    }

    return NextResponse.json({ sucesso: true, id: newUser.user.id })
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
