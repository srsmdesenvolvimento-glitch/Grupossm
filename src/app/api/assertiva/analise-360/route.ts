import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAssertivaToken, postAssertivaApi, CREDITO_BASE } from '@/lib/assertiva/server'

// Análise Comportamental / Análise 360 — PF e PJ. Para PJ é a única fonte de
// imóveis da Assertiva (não existe fonte de imóveis para CPF). Para PF traz
// perfil socioeconômico, dívidas ativas da União, restituição de IRPF,
// benefícios (INSS etc.), composição domiciliar e limite de crédito sugerido —
// dados que o Score/Crédito síncrono não tem. É assíncrono: esta rota apenas
// registra o job e dispara a consulta; o resultado chega depois via POST em
// /api/assertiva/webhook/analise-360.
const ID_FINALIDADE_COMPORTAMENTAL = 2

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { clienteId } = await request.json() as { clienteId?: string }
    if (!clienteId) return NextResponse.json({ erro: 'clienteId é obrigatório' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: cliente } = await supabase
      .from('clientes_factoring')
      .select('id, empresa_id, cpf, cnpj, tipo_pessoa')
      .eq('id', clienteId)
      .maybeSingle()

    if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })

    const ehPj = cliente.tipo_pessoa === 'juridica'
    const documento = ehPj ? cliente.cnpj : cliente.cpf
    if (!documento) {
      return NextResponse.json(
        { erro: `Cliente não possui ${ehPj ? 'CNPJ' : 'CPF'} cadastrado` },
        { status: 400 }
      )
    }

    const { data: acesso } = await supabaseAuth
      .from('usuario_empresa')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', cliente.empresa_id)
      .eq('ativo', true)
      .maybeSingle()
    if (!acesso) return NextResponse.json({ erro: 'Sem acesso a este cliente' }, { status: 403 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl || appUrl.includes('localhost')) {
      return NextResponse.json(
        { erro: 'Análise 360 exige uma URL pública de produção (NEXT_PUBLIC_APP_URL) para receber o retorno da Assertiva — não funciona em ambiente local' },
        { status: 503 }
      )
    }

    const webhookToken = randomBytes(24).toString('hex')

    const { data: job, error: jobError } = await supabase
      .from('assertiva_analise360_jobs')
      .insert({
        empresa_id:     cliente.empresa_id,
        cliente_id:     cliente.id,
        documento,
        webhook_token:  webhookToken,
        solicitado_por: user.id,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('[Assertiva Análise 360] Erro ao criar job:', jobError)
      return NextResponse.json({ erro: 'Erro ao registrar solicitação' }, { status: 500 })
    }

    let token: string | null = null
    try {
      token = await getAssertivaToken()
    } catch (e: any) {
      const msg = e?.message ?? 'falha de autenticação'
      await supabase.from('assertiva_analise360_jobs')
        .update({ status: 'erro', erro: msg, respondido_em: new Date().toISOString() })
        .eq('id', job.id)
      return NextResponse.json({ erro: `Falha de autenticação Assertiva: ${msg}` }, { status: 502 })
    }

    if (!token) {
      await supabase.from('assertiva_analise360_jobs')
        .update({ status: 'erro', erro: 'token nulo', respondido_em: new Date().toISOString() })
        .eq('id', job.id)
      return NextResponse.json({ erro: 'Falha de autenticação Assertiva' }, { status: 502 })
    }

    const webhookUrl = `${appUrl}/api/assertiva/webhook/analise-360?token=${webhookToken}`

    const res = await postAssertivaApi(`${CREDITO_BASE}/${ehPj ? 'pj' : 'pf'}`, token, [
      {
        doc:                 documento,
        idFinalidade:        ID_FINALIDADE_COMPORTAMENTAL,
        urlEntregaResultado: webhookUrl,
        identificador:       job.id,
      },
    ])

    if (!res.ok) {
      const msg = res.data?.message ?? res.data?.error_description ?? `HTTP ${res.status}`
      await supabase.from('assertiva_analise360_jobs')
        .update({ status: 'erro', erro: msg, respondido_em: new Date().toISOString() })
        .eq('id', job.id)
      return NextResponse.json({ erro: `Falha ao solicitar Análise 360: ${msg}` }, { status: 502 })
    }

    return NextResponse.json({ jobId: job.id, status: 'pendente' })
  } catch (err: any) {
    console.error('[Assertiva Análise 360] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}

// Consulta o status/resultado mais recente de um job (polling da UI)
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const clienteId = request.nextUrl.searchParams.get('clienteId')
    if (!clienteId) return NextResponse.json({ erro: 'clienteId é obrigatório' }, { status: 400 })

    // RLS de assertiva_analise360_jobs já restringe por empresa do usuário logado
    const { data: job } = await supabaseAuth
      .from('assertiva_analise360_jobs')
      .select('id, status, resultado, erro, solicitado_em, respondido_em')
      .eq('cliente_id', clienteId)
      .order('solicitado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ job: job ?? null })
  } catch (err: any) {
    console.error('[Assertiva Análise 360] Erro ao consultar status:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}
