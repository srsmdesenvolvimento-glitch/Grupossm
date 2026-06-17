import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagem } from '@/lib/utils/whatsapp'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: pendentes, error } = await supabase
    .from('notificacoes_log')
    .select('id, destinatario, mensagem, empresa_id')
    .eq('status', 'pendente')
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendentes?.length) {
    return NextResponse.json({ ok: true, enviadas: 0 })
  }

  let enviadas = 0
  let erros = 0

  await Promise.all(
    pendentes.map(async msg => {
      const resultado = await enviarMensagem(msg.destinatario, msg.mensagem, msg.empresa_id)

      if (resultado.ok) {
        enviadas++
        await supabase
          .from('notificacoes_log')
          .update({ status: 'enviado', enviado_em: new Date().toISOString() })
          .eq('id', msg.id)
      } else {
        erros++
        await supabase
          .from('notificacoes_log')
          .update({ status: 'erro', erro: resultado.erro ?? 'Erro desconhecido' })
          .eq('id', msg.id)
      }
    }),
  )

  return NextResponse.json({ ok: true, enviadas, erros })
}
