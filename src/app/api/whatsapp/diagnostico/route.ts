import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CheckResult = { ok: boolean; msg: string; detail?: string }

async function checkTable(admin: ReturnType<typeof createAdminClient>, table: string): Promise<CheckResult> {
  const { error } = await admin.from(table as any).select('id').limit(1)
  if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
    return { ok: false, msg: `Tabela "${table}" não existe`, detail: 'Execute whatsapp_master_migration.sql no Supabase SQL Editor' }
  }
  return { ok: true, msg: `Tabela "${table}" OK` }
}

async function checkColumn(admin: ReturnType<typeof createAdminClient>, table: string, column: string): Promise<CheckResult> {
  const { error } = await admin.from(table as any).select(column).limit(0)
  if (error) {
    return { ok: false, msg: `Coluna "${column}" não existe em "${table}"`, detail: 'Execute whatsapp_master_migration.sql' }
  }
  return { ok: true, msg: `Coluna "${column}" em "${table}" OK` }
}

async function checkMetaApi(): Promise<CheckResult[]> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const version = process.env.WHATSAPP_VERSION ?? 'v21.0'
  const results: CheckResult[] = []

  if (!token) {
    results.push({ ok: false, msg: 'WHATSAPP_TOKEN não configurado', detail: 'Adicione WHATSAPP_TOKEN nas variáveis de ambiente do servidor (Vercel/Railway)' })
    return results
  }
  results.push({ ok: true, msg: 'WHATSAPP_TOKEN configurado' })

  if (!phoneId) {
    results.push({ ok: false, msg: 'WHATSAPP_PHONE_NUMBER_ID não configurado', detail: 'Adicione WHATSAPP_PHONE_NUMBER_ID nas variáveis de ambiente' })
    return results
  }
  results.push({ ok: true, msg: `WHATSAPP_PHONE_NUMBER_ID configurado: ${phoneId}` })

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal },
    ).finally(() => clearTimeout(timer))

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message ?? `HTTP ${res.status}`
      results.push({ ok: false, msg: `Meta API erro: ${msg}`, detail: 'Verifique se o token não expirou no Meta Developer Console' })
    } else {
      const data = await res.json()
      results.push({ ok: true, msg: `Meta API ativa — número: ${data.display_phone_number ?? phoneId} (${data.verified_name ?? 'sem nome verificado'})` })
    }
  } catch (err: any) {
    clearTimeout(timer)
    const msg = err?.name === 'AbortError' ? 'Meta API não respondeu em 10s' : err.message
    results.push({ ok: false, msg: `Meta API inacessível: ${msg}` })
  }

  return results
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const empresaId = request.nextUrl.searchParams.get('empresa_id')
    if (!empresaId) return NextResponse.json({ erro: 'empresa_id obrigatório' }, { status: 400 })

    const { data: access } = await supabase
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .maybeSingle()

    if (!access) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

    const admin = createAdminClient()
    const checks: CheckResult[] = []

    // 1. Tabelas obrigatórias
    const tableChecks = await Promise.all([
      checkTable(admin, 'config_whatsapp'),
      checkTable(admin, 'notificacoes_log'),
      checkTable(admin, 'webhook_logs'),
    ])
    checks.push(...tableChecks)

    // 2. Colunas extras
    const colChecks = await Promise.all([
      checkColumn(admin, 'notificacoes_log', 'whatsapp_message_id'),
      checkColumn(admin, 'config_whatsapp', 'delay_ms'),
      checkColumn(admin, 'config_factoring', 'whatsapp_settings'),
    ])
    checks.push(...colChecks)

    // 3. Meta Cloud API
    const metaChecks = await checkMetaApi()
    checks.push(...metaChecks)

    // 4. Config de envio da empresa
    const { data: config } = await admin
      .from('config_whatsapp')
      .select('ativo, delay_ms')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!config) {
      checks.push({ ok: false, msg: 'Nenhuma configuração salva para esta empresa', detail: 'Salve as configurações na aba WhatsApp para habilitar o envio' })
    } else {
      checks.push({ ok: true, msg: `Configuração da empresa: envio ${config.ativo ? 'ativado' : 'desativado'}, delay ${config.delay_ms ?? 1200}ms` })
      if (!config.ativo) {
        checks.push({ ok: false, msg: 'Envio desativado para esta empresa', detail: 'Ative o switch "Ativar envio" nas configurações e salve' })
      }
    }

    // 5. Fila de mensagens pendentes
    const { count: pendentes } = await admin
      .from('notificacoes_log')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')

    checks.push({
      ok: true,
      msg: `Mensagens na fila (pendente): ${pendentes ?? 0}`,
      detail: pendentes ? 'Serão processadas pelo cron disparar-mensagens às 09:30 (Brasília)' : undefined,
    })

    // 6. Logs recentes
    const { data: recentLogs } = await admin
      .from('notificacoes_log')
      .select('status, enviado_em, erro, destinatario')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(5)

    const allOk = checks.every(c => c.ok)

    return NextResponse.json({ ok: allOk, checks, recentLogs: recentLogs ?? [] })
  } catch (err: any) {
    console.error('[WhatsApp Diagnóstico] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno: ' + err.message }, { status: 500 })
  }
}
