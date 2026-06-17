import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarMensagem } from '@/lib/utils/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { destinatario, mensagem, empresa_id } = body as { destinatario: string; mensagem: string; empresa_id: string }

    if (!destinatario || !mensagem || !empresa_id) {
      return NextResponse.json({ erro: 'Destinatário, mensagem e Empresa ID são obrigatórios.' }, { status: 400 })
    }

    // Valida que o usuário tem acesso à empresa
    const { data: access } = await supabase
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresa_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!access) {
      return NextResponse.json({ erro: 'Acesso negado para esta empresa.' }, { status: 403 })
    }

    // Envia a mensagem imediatamente (bypass delayMs = 0)
    const result = await enviarMensagem(destinatario, mensagem, empresa_id, true)

    if (!result.ok) {
      // Registra a falha de envio imediato no log de notificações
      await supabase.from('notificacoes_log').insert({
        empresa_id,
        canal: 'whatsapp',
        destinatario,
        assunto: 'Notificação Imediata WhatsApp (Falhou)',
        mensagem,
        status: 'erro',
        erro: result.erro || 'Falha ao enviar mensagem imediatamente.',
      })

      return NextResponse.json({ erro: result.erro || 'Falha ao enviar mensagem imediata.' }, { status: 400 })
    }

    // Registra o envio imediato no log de notificações com o ID da mensagem externa
    const { data: logRecord, error: logError } = await supabase
      .from('notificacoes_log')
      .insert({
        empresa_id,
        canal: 'whatsapp',
        destinatario,
        assunto: 'Notificação Imediata WhatsApp',
        mensagem,
        status: 'enviado',
        enviado_em: new Date().toISOString(),
        whatsapp_message_id: result.messageId || null,
      })
      .select('id')
      .single()

    if (logError) {
      console.error('[WhatsApp API Enviar] Erro ao gravar log de envio:', logError.message)
    }

    return NextResponse.json({ sucesso: true, messageId: result.messageId, logId: logRecord?.id })
  } catch (err: any) {
    console.error('[WhatsApp API Enviar] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
