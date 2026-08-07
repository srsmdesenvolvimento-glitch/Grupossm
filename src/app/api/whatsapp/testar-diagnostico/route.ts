import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizarTelefone } from '@/lib/utils/whatsapp'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const rawNum = request.nextUrl.searchParams.get('numero') || '62993885258'
    const numFormatado = normalizarTelefone(rawNum)

    const token = process.env.WHATSAPP_TOKEN
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const version = process.env.WHATSAPP_VERSION ?? 'v21.0'

    const envCheck = {
      WHATSAPP_TOKEN_DEFINIDO: Boolean(token),
      WHATSAPP_PHONE_NUMBER_ID: phoneId ?? 'NÃO DEFINIDO',
      WHATSAPP_VERSION: version,
      TELEFONE_TESTADO: numFormatado,
    }

    if (!token || !phoneId) {
      return NextResponse.json({
        ok: false,
        diagnostico: 'VARIAVEIS_NAO_CONFIGURADAS',
        mensagem: 'WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não estão configurados nas variáveis de ambiente do servidor.',
        envCheck,
      }, { status: 400 })
    }

    // 1. Checa status da conta/número no Graph API
    let metaAccountInfo: any = null
    try {
      const accRes = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      metaAccountInfo = await accRes.json()
    } catch (accErr: any) {
      metaAccountInfo = { error: accErr.message }
    }

    // 2. Tenta disparo de teste de mensagem via Meta Graph API
    const messageUrl = `https://graph.facebook.com/${version}/${phoneId}/messages`
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: numFormatado,
      type: 'text',
      text: { body: '🔍 Teste de Diagnóstico Conexão Meta WhatsApp API — SRS M Factoring' },
    }

    const sendRes = await fetch(messageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })

    const sendStatus = sendRes.status
    const sendData = await sendRes.json().catch(() => ({}))

    const isPaymentError = 
      sendData?.error?.code === 131030 || 
      sendData?.error?.code === 131031 || 
      sendData?.error?.error_subcode === 131030 ||
      (sendData?.error?.message ?? '').toLowerCase().includes('payment')

    return NextResponse.json({
      ok: sendRes.ok,
      httpStatus: sendStatus,
      isPaymentError,
      envCheck,
      metaAccountInfo,
      metaApiResponse: sendData,
      analiseConclusao: sendRes.ok
        ? '✅ Mensagem enviada com SUCESSO! A Meta aceitou e processou o envio.'
        : isPaymentError
        ? '❌ CONFIRMADO: Erro de Pagamento / Cartão Ausente na Meta. A conta precisa de Cartão de Crédito cadastrado no WhatsApp Manager.'
        : `⚠️ Erro retornado pela Meta API: ${sendData?.error?.message ?? 'Erro na requisição'}`
    })
  } catch (err: any) {
    console.error('[WhatsApp Teste Diagnostico] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno ao testar: ' + err.message }, { status: 500 })
  }
}
