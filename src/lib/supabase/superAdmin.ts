import type { createClient } from './server'

// As rotas /api/admin/** administram a plataforma inteira (todas as empresas
// clientes), não uma empresa específica — por isso a checagem de acesso é
// "é super admin da plataforma?", nunca "é admin de alguma empresa?" (esse
// segundo tipo de admin é o dono/gestor de UMA empresa cliente, e não deve
// enxergar dados de outras empresas).
export async function requireSuperAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string } | { erro: string; status: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado', status: 401 }

  const { data, error } = await supabase
    .from('usuarios')
    .select('super_admin')
    .eq('id', user.id)
    .maybeSingle()

  // Se a coluna/consulta falhar por qualquer motivo, nega acesso (fail closed)
  // em vez de deixar passar — mais seguro do que assumir que deu certo.
  if (error || !data?.super_admin) {
    return { erro: 'Acesso negado. Apenas administradores da plataforma.', status: 403 }
  }

  return { userId: user.id }
}
