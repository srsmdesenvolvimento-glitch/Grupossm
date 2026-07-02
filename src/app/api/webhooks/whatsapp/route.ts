import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VERIFY_TOKEN = process.env.WEBHOOK_SECRET ?? process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

// GET — verificação do webhook pela Meta (obrigatório para configurar no Developer Console)
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN && challenge) {
    console.log('[Webhook WhatsApp] Verificação Meta aceita')
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return NextResponse.json({ ok: true, service: 'whatsapp-webhook-meta' })
}

// POST — recebe eventos da Meta Cloud API
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // Grava log bruto para auditoria
    await supabase.from('webhook_logs').insert({
      tipo: 'whatsapp',
      payload: body,
      created_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('[Webhook WhatsApp] Falha ao gravar log:', error.message)
    })

    // Valida estrutura Meta
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true })
    }

    const entries: any[] = body.entry ?? []
    const updates: Array<{ id: string; status: string }> = []

    for (const entry of entries) {
      for (const change of (entry.changes ?? [])) {
        if (change.field !== 'messages') continue
        const value = change.value ?? {}

        // Atualiza status de mensagens enviadas
        for (const statusUpdate of (value.statuses ?? [])) {
          const messageId: string | undefined = statusUpdate.id
          const rawStatus: string | undefined = statusUpdate.status

          if (!messageId || !rawStatus) continue

          let statusText: 'enviado' | 'entregue' | 'lido' | 'erro' | null = null
          if (rawStatus === 'sent') statusText = 'enviado'
          else if (rawStatus === 'delivered') statusText = 'entregue'
          else if (rawStatus === 'read') statusText = 'lido'
          else if (rawStatus === 'failed') statusText = 'erro'

          if (!statusText) continue

          updates.push({ id: messageId, status: statusText })

          const updatePayload: Record<string, any> = {
            status: statusText,
            enviado_em: new Date().toISOString(),
          }

          if (statusText === 'erro' && statusUpdate.errors?.[0]) {
            updatePayload.erro = statusUpdate.errors[0].message ?? 'Falha de entrega Meta API'
          }

          const { error } = await supabase
            .from('notificacoes_log')
            .update(updatePayload)
            .eq('whatsapp_message_id', messageId)

          if (error) {
            console.error(`[Webhook WhatsApp] Falha ao atualizar ${messageId}:`, error.message)
          }
        }
      }
    }

    if (updates.length > 0) {
      console.log(`[Webhook WhatsApp] ${updates.length} status(es) atualizados:`, updates)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Webhook WhatsApp] Erro:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
