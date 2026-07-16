import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAnalise360PF, parseAnalise360PJ } from '@/lib/assertiva/parsers'

// Receptor público do callback assíncrono da Análise Comportamental / Análise 360
// (PF e PJ) da Assertiva — chamado pelos servidores da Assertiva, não pelo
// navegador do usuário. A Assertiva não assina o payload, então a autenticidade
// é garantida pelo token aleatório de uso único que geramos por job (embutido
// na URL enviada no momento da solicitação) — sem o token correto, o resultado
// é rejeitado.
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ erro: 'token ausente' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ erro: 'payload inválido' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: job } = await supabase
      .from('assertiva_analise360_jobs')
      .select('id, status, documento')
      .eq('webhook_token', token)
      .maybeSingle()

    if (!job) {
      console.warn('[Webhook Análise 360] Token não corresponde a nenhum job pendente')
      return NextResponse.json({ erro: 'token inválido' }, { status: 401 })
    }

    const idErrorGeral = body?.resposta?.idError
    if (idErrorGeral) {
      await supabase.from('assertiva_analise360_jobs')
        .update({ status: 'erro', erro: `Código de erro ${idErrorGeral}`, resultado: body, respondido_em: new Date().toISOString() })
        .eq('id', job.id)
      return NextResponse.json({ ok: true })
    }

    // CPF tem 11 dígitos, CNPJ tem 14 — o documento gravado no job diz qual parser usar
    const ehPj = job.documento.replace(/\D/g, '').length === 14
    const resultado = ehPj ? parseAnalise360PJ(body) : parseAnalise360PF(body)

    await supabase.from('assertiva_analise360_jobs')
      .update({ status: 'concluido', resultado, respondido_em: new Date().toISOString() })
      .eq('id', job.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Webhook Análise 360] Erro:', err)
    // Retorna 200 mesmo em erro interno para evitar retentativas agressivas da
    // Assertiva; o erro já foi logado para investigação manual.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
