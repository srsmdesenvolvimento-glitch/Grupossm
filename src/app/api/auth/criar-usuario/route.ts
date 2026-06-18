import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const papelEnum = z.enum(['admin', 'gerente', 'operador', 'visualizador'])

const vinculoSchema = z.object({
  empresa_id: z.string().uuid(),
  papel: papelEnum,
})

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  // Multi-empresa: aceita array de vínculos
  empresas: z.array(vinculoSchema).min(1).max(10),
  // Retrocompat: aceita campo legado empresa_id + papel (convertido internamente)
  empresa_id: z.string().uuid().optional(),
  papel: papelEnum.optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const body = await request.json()

    // Normaliza retrocompat: empresa_id + papel → empresas[]
    if (!body.empresas && body.empresa_id && body.papel) {
      body.empresas = [{ empresa_id: body.empresa_id, papel: body.papel }]
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const { nome, email, senha, empresas } = parsed.data

    // Verificação de permissão: o caller precisa ser admin em TODAS as empresas solicitadas
    const { data: callerUes } = await supabase
      .from('usuario_empresa')
      .select('empresa_id, papel')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .in('empresa_id', empresas.map(e => e.empresa_id))

    const callerMap = new Map((callerUes ?? []).map(ue => [ue.empresa_id, ue.papel]))

    for (const { empresa_id } of empresas) {
      const callerPapel = callerMap.get(empresa_id)
      if (callerPapel !== 'admin') {
        return NextResponse.json(
          { erro: `Sem permissão para criar usuários na empresa ${empresa_id}` },
          { status: 403 }
        )
      }
    }

    const admin = createAdminClient()

    // Cria o usuário no Auth
    const { data: newUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (authError || !newUser.user) {
      return NextResponse.json({ erro: authError?.message ?? 'Erro ao criar usuário' }, { status: 400 })
    }

    const userId = newUser.user.id

    // Cria o perfil em usuarios
    const { error: perfilError } = await admin.from('usuarios').insert({ id: userId, nome, email })
    if (perfilError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ erro: 'Erro ao criar perfil', detalhes: perfilError.message }, { status: 500 })
    }

    // Vincula a TODAS as empresas solicitadas
    const vinculos = empresas.map(e => ({
      usuario_id: userId,
      empresa_id: e.empresa_id,
      papel: e.papel,
    }))

    const { error: vinculoError } = await admin.from('usuario_empresa').insert(vinculos)
    if (vinculoError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ erro: 'Erro ao vincular empresas', detalhes: vinculoError.message }, { status: 500 })
    }

    return NextResponse.json({ sucesso: true, id: userId, empresas_vinculadas: empresas.length })
  } catch (err: any) {
    console.error('[Criar Usuário] Erro:', err)
    return NextResponse.json({ erro: err?.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
