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

  // Envia em série com intervalo mínimo para não sobrecarregar a Evolution API
  // (50 mensagens em paralelo gera picos de 429 em instâncias compartilhadas)
  const resultados: Array<{ id: string; ok: boolean; messageId?: string; erro?: string }> = []
  for (const msg of pendentes) {
    const resultado = await enviarMensagem(msg.destinatario, msg.mensagem, msg.empresa_id, true)
    resultados.push({ id: msg.id, ...resultado })
  }

  const sucessos = resultados.filter(r => r.ok)
  const erros = resultados.filter(r => !r.ok)
  const agora = new Date().toISOString()

  // Updates individuais para sucessos — persiste messageId para rastreio de status via webhook
  if (sucessos.length > 0) {
    await Promise.all(
      sucessos.map(r =>
        supabase
          .from('notificacoes_log')
          .update({
            status: 'enviado',
            enviado_em: agora,
            ...(r.messageId ? { whatsapp_message_id: r.messageId } : {}),
          })
          .eq('id', r.id),
      ),
    )
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
