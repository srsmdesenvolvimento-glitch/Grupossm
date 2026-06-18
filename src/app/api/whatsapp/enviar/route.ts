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

    // Fire-and-forget: envia imediatamente sem salvar no banco
    const result = await enviarMensagem(destinatario, mensagem, empresa_id, true)

    if (!result.ok) {
      return NextResponse.json({ erro: result.erro || 'Falha ao enviar mensagem.' }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('[WhatsApp Enviar] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
