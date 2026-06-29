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
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pendentes?.length) {
    return NextResponse.json({ ok: true, enviadas: 0 })
  }

  // Envia em série com intervalo entre cada envio para evitar 429 na Evolution API
  const resultados: Array<{ id: string; ok: boolean; messageId?: string; erro?: string }> = []
  for (let i = 0; i < pendentes.length; i++) {
    const msg = pendentes[i]
    const resultado = await enviarMensagem(msg.destinatario, msg.mensagem, msg.empresa_id, true)
    resultados.push({ id: msg.id, ...resultado })
    if (i < pendentes.length - 1) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  const sucessos = resultados.filter(r => r.ok)
  const erros = resultados.filter(r => !r.ok)
  const agora = new Date().toISOString()

  // Updates para sucessos — tenta com whatsapp_message_id, fallback sem ele
  if (sucessos.length > 0) {
    await Promise.all(
      sucessos.map(async r => {
        const payload: Record<string, any> = { status: 'enviado', enviado_em: agora }
        if (r.messageId) payload.whatsapp_message_id = r.messageId
        try {
          await supabase.from('notificacoes_log').update(payload).eq('id', r.id)
        } catch {
          // Fallback: salva sem whatsapp_message_id caso coluna não exista ainda
          await supabase.from('notificacoes_log')
            .update({ status: 'enviado', enviado_em: agora })
            .eq('id', r.id)
        }
      }),
    )
  }

  // Updates para erros
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
