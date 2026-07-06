import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagem, enviarTemplate, TriggerKey } from '@/lib/utils/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      destinatario, mensagem, empresa_id,
      assunto, referencia_tipo, referencia_id,
      triggerKey, variaveis,
    } = body as {
      destinatario: string; empresa_id: string
      mensagem?: string
      assunto?: string; referencia_tipo?: string; referencia_id?: string
      triggerKey?: TriggerKey; variaveis?: Record<string, string>
    }

    if (!destinatario || !empresa_id) {
      return NextResponse.json({ erro: 'Destinatário e Empresa ID são obrigatórios.' }, { status: 400 })
    }
    if (!triggerKey && !mensagem) {
      return NextResponse.json({ erro: 'Informe mensagem ou triggerKey.' }, { status: 400 })
    }

    // Valida acesso à empresa
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

    const result = triggerKey && variaveis
      ? await enviarTemplate(destinatario, triggerKey, variaveis, empresa_id)
      : await enviarMensagem(destinatario, mensagem!, empresa_id, true)

    const logMensagem = triggerKey
      ? `Template ${triggerKey} enviado via WhatsApp`
      : (mensagem ?? '')

    const admin = createAdminClient()
    await admin.from('notificacoes_log').insert({
      empresa_id,
      canal: 'whatsapp',
      destinatario,
      assunto: assunto ?? (triggerKey ? `Template ${triggerKey}` : 'Mensagem WhatsApp'),
      mensagem: logMensagem,
      referencia_tipo: referencia_tipo ?? null,
      referencia_id: referencia_id ?? null,
      status: result.ok ? 'enviado' : 'erro',
      erro: result.ok ? null : (result.erro ?? 'Falha no envio'),
      whatsapp_message_id: result.ok ? (result.messageId ?? null) : null,
      enviado_em: result.ok ? new Date().toISOString() : null,
    })

    if (!result.ok) {
      return NextResponse.json({ erro: result.erro || 'Falha ao enviar mensagem.' }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('[WhatsApp Enviar] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
