import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type CheckResult = { ok: boolean; msg: string; detail?: string }

async function checkTable(admin: ReturnType<typeof createAdminClient>, table: string): Promise<CheckResult> {
  const { error } = await admin.from(table as any).select('id').limit(1)
  if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
    return { ok: false, msg: `Tabela "${table}" não existe`, detail: 'Execute whatsapp_master_migration.sql no Supabase' }
  }
  return { ok: true, msg: `Tabela "${table}" existe` }
}

async function checkColumn(admin: ReturnType<typeof createAdminClient>, table: string, column: string): Promise<CheckResult> {
  const { data, error } = await admin.rpc('check_column_exists' as any, { p_table: table, p_column: column }).maybeSingle()
  // Fallback: tenta uma query que usa a coluna
  if (error) {
    // Tenta via information_schema
    const { data: colData } = await admin
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_name', table)
      .eq('column_name', column)
      .maybeSingle()
    if (!colData) {
      return { ok: false, msg: `Coluna "${column}" não existe em "${table}"`, detail: 'Execute whatsapp_master_migration.sql' }
    }
  }
  return { ok: true, msg: `Coluna "${column}" existe em "${table}"` }
}

async function checkEvolutionApi(apiUrl: string, apiKey: string, instanceName: string): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)

  try {
    // Testa conectividade básica
    const pingRes = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      signal: ctrl.signal,
    })
    clearTimeout(timer)

    if (!pingRes.ok) {
      results.push({ ok: false, msg: `Evolution API retornou HTTP ${pingRes.status}`, detail: 'Verifique se a URL e a API Key estão corretas' })
      return results
    }

    results.push({ ok: true, msg: 'Evolution API acessível' })

    // Verifica se a instância existe
    const stateRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    })

    if (stateRes.status === 404) {
      results.push({ ok: false, msg: `Instância "${instanceName}" não existe`, detail: 'Salve a configuração para criar a instância automaticamente' })
      return results
    }

    if (!stateRes.ok) {
      results.push({ ok: false, msg: `Erro ao verificar instância: HTTP ${stateRes.status}` })
      return results
    }

    const stateData = await stateRes.json()
    const state = stateData.instance?.state || stateData.state || 'unknown'

    if (state === 'open') {
      results.push({ ok: true, msg: `Instância "${instanceName}" conectada ao WhatsApp ✓` })
    } else if (state === 'connecting') {
      results.push({ ok: false, msg: `Instância "${instanceName}" está conectando (aguardando QR)`, detail: 'Escaneie o QR Code na aba Conectar WhatsApp' })
    } else {
      results.push({ ok: false, msg: `Instância "${instanceName}" desconectada (state: ${state})`, detail: 'Escaneie o QR Code na aba Conectar WhatsApp' })
    }
  } catch (err: any) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') {
      results.push({ ok: false, msg: 'Evolution API não respondeu em 10s', detail: 'Verifique se o servidor está online e a URL está correta' })
    } else {
      results.push({ ok: false, msg: `Erro ao conectar na Evolution API: ${err?.message}`, detail: 'Verifique a URL da API' })
    }
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
    checks.push(await checkTable(admin, 'config_whatsapp'))
    checks.push(await checkTable(admin, 'notificacoes_log'))
    checks.push(await checkTable(admin, 'webhook_logs'))

    // 2. Colunas extras
    const colChecks = await Promise.all([
      checkColumn(admin, 'notificacoes_log', 'whatsapp_message_id'),
      checkColumn(admin, 'config_whatsapp', 'delay_ms'),
      checkColumn(admin, 'config_factoring', 'whatsapp_settings'),
    ])
    checks.push(...colChecks)

    // 3. Config da empresa
    const { data: config, error: configErr } = await admin
      .from('config_whatsapp')
      .select('api_url, api_key, instance_name, ativo, status, delay_ms')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (configErr?.message?.includes('does not exist')) {
      checks.push({ ok: false, msg: 'config_whatsapp não existe — migration não executada', detail: 'Execute whatsapp_master_migration.sql' })
    } else if (!config) {
      checks.push({ ok: false, msg: 'Nenhuma configuração salva para esta empresa', detail: 'Preencha e salve as credenciais da Evolution API na aba Conectar WhatsApp' })
    } else {
      checks.push({ ok: true, msg: `Config encontrada — api_url: ${config.api_url || '(vazio)'}` })

      if (!config.api_url) checks.push({ ok: false, msg: 'api_url está vazia', detail: 'Preencha a URL da Evolution API' })
      if (!config.api_key) checks.push({ ok: false, msg: 'api_key está vazia', detail: 'Preencha a chave da API' })
      if (!config.instance_name) checks.push({ ok: false, msg: 'instance_name está vazia', detail: 'Preencha o nome da instância' })
      if (!config.ativo) checks.push({ ok: false, msg: 'Envio desativado (ativo = false)', detail: 'Ligue o switch "Ativar envio" e salve' })

      // 4. Testa Evolution API se config válida
      if (config.api_url && config.api_key && config.instance_name) {
        const evolutionChecks = await checkEvolutionApi(config.api_url, config.api_key, config.instance_name)
        checks.push(...evolutionChecks)
      }
    }

    // 5. Mensagens pendentes na fila
    const { count: pendentes } = await admin
      .from('notificacoes_log')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')

    checks.push({
      ok: true,
      msg: `Mensagens na fila (pendente): ${pendentes ?? 0}`,
      detail: pendentes ? 'O cron disparar-mensagens irá processá-las às 09:30 (Brasília)' : undefined,
    })

    // 6. Últimos logs
    const { data: recentLogs } = await admin
      .from('notificacoes_log')
      .select('status, enviado_em, erro')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(5)

    const allOk = checks.every(c => c.ok)

    return NextResponse.json({
      ok: allOk,
      checks,
      recentLogs: recentLogs ?? [],
    })
  } catch (err: any) {
    console.error('[WhatsApp Diagnóstico] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno: ' + err.message }, { status: 500 })
  }
}
