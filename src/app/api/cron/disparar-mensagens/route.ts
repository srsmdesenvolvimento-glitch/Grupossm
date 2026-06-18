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

  // Envia todas em paralelo com imediato=true (sem delay de digitacao)
  const resultados = await Promise.all(
    pendentes.map(async msg => {
      const resultado = await enviarMensagem(msg.destinatario, msg.mensagem, msg.empresa_id, true)
      return { id: msg.id, ...resultado }
    }),
  )

  const sucessos = resultados.filter(r => r.ok).map(r => r.id)
  const erros = resultados.filter(r => !r.ok)

  // Batch update dos sucessos em uma unica query
  if (sucessos.length > 0) {
    await supabase
      .from('notificacoes_log')
      .update({ status: 'enviado', enviado_em: new Date().toISOString() })
      .in('id', sucessos)
  }

  // Updates individuais apenas para erros (normalmente poucos)
  if (erros.length > 0) {
    await Promise.all(
      erros.map(r =>
        supabase
          .from('notificacoes_log')
          .update({ status: 'erro', erro: r.erro ?? 'Erro desconhecido' })
          .eq('id', r.id),
      ),
    )
  }

  return NextResponse.json({ ok: true, enviadas: sucessos.length, erros: erros.length })
}
