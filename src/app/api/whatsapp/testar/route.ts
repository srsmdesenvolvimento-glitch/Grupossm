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

    const result = await enviarMensagem(destinatario, mensagem, empresa_id, true)

    if (!result.ok) {
      return NextResponse.json({ erro: result.erro || 'Falha ao enviar mensagem.' }, { status: 400 })
    }

    // Registra o teste — falha silenciosa para não esconder sucesso de envio
    try {
      const logPayload: Record<string, any> = {
        empresa_id,
        canal: 'whatsapp',
        destinatario,
        assunto: 'Mensagem de Teste WhatsApp',
        mensagem,
        status: 'enviado',
        enviado_em: new Date().toISOString(),
      }
      if (result.messageId) logPayload.whatsapp_message_id = result.messageId
      await supabase.from('notificacoes_log').insert(logPayload)
    } catch (logErr) {
      console.error('[WhatsApp Testar] Falha ao registrar log (não crítico):', logErr)
    }

    return NextResponse.json({ sucesso: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('[WhatsApp API Testar] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
