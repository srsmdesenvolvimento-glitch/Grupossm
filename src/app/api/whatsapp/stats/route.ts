import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  const [r_enviado, r_entregue, r_lido, r_erro, r_pendente, r_hoje, r_fila] = await Promise.all([
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'enviado').gte('created_at', thirtyDaysAgo),
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'entregue').gte('created_at', thirtyDaysAgo),
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'lido').gte('created_at', thirtyDaysAgo),
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'erro').gte('created_at', thirtyDaysAgo),
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'pendente'),
    admin.from('notificacoes_log').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').gte('created_at', todayStart.toISOString()).neq('status', 'pendente'),
    admin.from('notificacoes_log').select('id, destinatario, assunto, created_at', { count: 'exact' }).eq('empresa_id', empresaId).eq('canal', 'whatsapp').eq('status', 'pendente').order('created_at', { ascending: true }).limit(5),
  ])

  const enviado = r_enviado.count ?? 0
  const entregue = r_entregue.count ?? 0
  const lido = r_lido.count ?? 0
  const erro = r_erro.count ?? 0
  const pendente = r_pendente.count ?? 0
  const totalProcessados = enviado + entregue + lido + erro
  const totalEntregues = entregue + lido

  return NextResponse.json({
    periodo: '30 dias',
    total: totalProcessados + pendente,
    enviado,
    entregue,
    lido,
    erro,
    pendente,
    hoje: r_hoje.count ?? 0,
    fila: r_fila.data ?? [],
    taxa_entrega: totalProcessados > 0 ? Math.round((totalEntregues / totalProcessados) * 100) : 0,
    taxa_leitura: totalEntregues > 0 ? Math.round((lido / totalEntregues) * 100) : 0,
  })
}
