import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function verificarAutenticidadeWebhook(request: Request): boolean {
  // Opção 1: token na query string (ex: URL = /api/webhooks/whatsapp?token=SEU_SECRET)
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')
  const webhookSecret = process.env.WEBHOOK_SECRET

  // Se WEBHOOK_SECRET está configurado, exige validação
  if (webhookSecret) {
    if (queryToken === webhookSecret) return true

    // Opção 2: header apikey (Evolution API envia o apikey da instância)
    const headerApiKey = request.headers.get('apikey')
    if (headerApiKey && headerApiKey === webhookSecret) return true

    return false
  }

  // Sem WEBHOOK_SECRET configurado: permite mas loga aviso
  console.warn('[Webhook WhatsApp] WEBHOOK_SECRET não configurado — endpoint público. Configure para segurança.')
  return true
}

export async function POST(request: Request) {
  try {
    if (!verificarAutenticidadeWebhook(request)) {
      console.warn('[Webhook WhatsApp] Requisição rejeitada: token inválido')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createAdminClient()

    // 1. Grava o log bruto na webhook_logs para fins de auditoria/segurança
    const { error: logError } = await supabase.from('webhook_logs').insert({
      tipo: 'whatsapp',
      payload: body,
      created_at: new Date().toISOString(),
    })
    if (logError) console.error('Falha ao gravar webhook log:', logError.message)

    // 2. Processa atualização de status de envio da Evolution API
    // Formato da Evolution API para atualização de mensagens: messages.update
    const event = body.event || body.type
    const data = body.data

    if (event === 'messages.update' && Array.isArray(data)) {
      for (const item of data) {
        const messageId = item.key?.id
        const updateStatus = item.update?.status

        if (messageId && updateStatus !== undefined) {
          // Mapeamento de Status Baileys/Evolution:
          // 2 = DELIVERY_ACK (Entregue - dois checks cinzas) -> 'entregue'
          // 3, 4, 5 = READ/PLAYED (Lido - checks azuis) -> 'lido'
          let statusText: 'entregue' | 'lido' | null = null

          if (updateStatus === 2) {
            statusText = 'entregue'
          } else if (updateStatus === 3 || updateStatus === 4 || updateStatus === 5) {
            statusText = 'lido'
          }

          if (statusText) {
            // Atualiza o registro correspondente no banco
            const { error: updateErr } = await supabase
              .from('notificacoes_log')
              .update({ 
                status: statusText, 
                enviado_em: new Date().toISOString() 
              })
              .eq('whatsapp_message_id', messageId)

            if (updateErr) {
              console.error(`[Webhook WhatsApp] Falha ao atualizar notificacao_log para id ${messageId}:`, updateErr.message)
            } else {
              console.log(`[Webhook WhatsApp] Mensagem ${messageId} atualizada com sucesso para status: ${statusText}`)
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Webhook WhatsApp Route] Erro:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook' })
}
