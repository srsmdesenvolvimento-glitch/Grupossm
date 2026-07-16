import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/supabase/superAdmin'
import { z } from 'zod'

// GET /api/admin/usuarios — lista todos os usuários de todas as empresas
// (bypassa RLS via admin client) — painel do operador da plataforma, por
// isso exige super_admin, não só "admin" de uma empresa.
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const admin = createAdminClient()

    const [usersRes, uesRes, empsRes] = await Promise.all([
      admin.from('usuarios').select('id, nome, email, status, created_at').order('nome'),
      admin.from('usuario_empresa').select('usuario_id, papel, empresa_id, empresas(id, nome, tipo)').eq('ativo', true),
      admin.from('empresas').select('id, nome, tipo').eq('ativo', true).order('nome'),
    ])

    if (usersRes.error) return NextResponse.json({ erro: usersRes.error.message }, { status: 500 })

    const ues  = uesRes.data ?? []
    const emps = empsRes.data ?? []

    const usuarios = (usersRes.data ?? []).map(u => ({
      ...u,
      empresas_vinculadas: ues
        .filter(ue => ue.usuario_id === u.id)
        .map(ue => ({
          empresa_id: ue.empresa_id,
          papel:      ue.papel,
          nome:       (ue.empresas as any)?.nome ?? '',
          tipo:       (ue.empresas as any)?.tipo ?? '',
        })),
    }))

    return NextResponse.json({ usuarios, empresas: emps })
  } catch (err: any) {
    console.error('[Admin/Usuarios GET]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/admin/usuarios — edita nome, email e/ou senha de um usuário
const editSchema = z.object({
  id:    z.string().uuid(),
  nome:  z.string().min(2).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const body   = await request.json()
    const parsed = editSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.issues }, { status: 400 })
    }

    const { id, nome, email, senha } = parsed.data
    if (!nome && !email && !senha) {
      return NextResponse.json({ erro: 'Informe ao menos um campo para atualizar' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Atualiza na tabela usuarios
    if (nome || email) {
      const update: Record<string, string> = {}
      if (nome)  update.nome  = nome
      if (email) update.email = email

      const { error } = await admin.from('usuarios').update(update).eq('id', id)
      if (error) return NextResponse.json({ erro: `Erro ao atualizar perfil: ${error.message}` }, { status: 500 })
    }

    // Atualiza no Supabase Auth
    const authUpdate: Record<string, string> = {}
    if (email) authUpdate.email    = email
    if (senha) authUpdate.password = senha

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(id, authUpdate)
      if (error) return NextResponse.json({ erro: `Erro ao atualizar credenciais: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    console.error('[Admin/Usuarios PATCH]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/admin/usuarios?id=UUID — remove usuário do sistema
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await requireSuperAdmin(supabase)
    if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ erro: 'ID inválido' }, { status: 400 })
    }

    // Não permite excluir a si mesmo
    if (id === auth.userId) {
      return NextResponse.json({ erro: 'Você não pode excluir sua própria conta' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Remove vínculos com empresas
    await admin.from('usuario_empresa').delete().eq('usuario_id', id)

    // Remove perfil
    await admin.from('usuarios').delete().eq('id', id)

    // Remove do Auth (último passo — irreversível)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ erro: `Erro ao remover usuário: ${error.message}` }, { status: 500 })

    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    console.error('[Admin/Usuarios DELETE]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
