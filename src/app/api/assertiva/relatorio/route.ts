import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseLocalizePf, parseLocalizePj,
  parseMixPf, parseMixPj,
  mergeData, calcularTotais,
  generateSandboxReport,
} from '@/lib/assertiva/parsers'
import type { RelatorioCompleto } from '@/lib/assertiva/types'

const API_BASE      = 'https://api.assertivasolucoes.com.br'
const AUTH_URL      = `${API_BASE}/oauth2/v3/token`
const LOCALIZE_BASE = `${API_BASE}/localize/v3`
const MIX_BASE      = `${API_BASE}/mix-v3`

const CACHE_TTL_MS  = 24 * 60 * 60 * 1000
const TOKEN_TTL_MS  = 28 * 60 * 1000
const ID_FINALIDADE = 2 // LGPD: Ciclo de crédito

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string | null> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const clientId     = process.env.ASSERTIVA_CLIENT_ID
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Assertiva v3: Basic Auth é o método correto
  const res = await fetch(AUTH_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Accept':        'application/json',
    },
    body:  'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[Assertiva] Auth failed:', res.status, errBody)
    let desc = ''
    try { const p = JSON.parse(errBody); desc = p.error_description || p.message || '' } catch {}
    throw new Error(desc || `HTTP ${res.status}`)
  }

  const data  = await res.json()
  const token = data.access_token ?? data.accessToken ?? data.token
  if (!token) return null

  _tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

async function callApi(url: string, auth: string) {
  const res  = await fetch(url, {
    method:  'GET',
    headers: { 'Authorization': `Bearer ${auth}`, 'Accept': 'application/json' },
    cache:   'no-store',
  })
  const data = await res.json().catch(() => null)
  return { ok: res.status === 200, status: res.status, data }
}

function only(s: string) { return s.replace(/\D/g, '') }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documento, tipo } = body as { documento: string; tipo: 'pf' | 'pj' }

    if (!documento || !tipo) {
      return NextResponse.json({ erro: 'documento e tipo são obrigatórios' }, { status: 400 })
    }

    const doc = only(documento)
    if ((tipo === 'pf' && doc.length !== 11) || (tipo === 'pj' && doc.length !== 14)) {
      return NextResponse.json({ erro: 'Documento inválido' }, { status: 400 })
    }

    const isSandbox  = process.env.ASSERTIVA_SANDBOX === 'true'
    const supabase   = createAdminClient()
    const cacheChave = `${tipo}:${doc}`

    // ── Verifica cache ────────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('assertiva_cache_factoring')
      .select('resultado')
      .eq('chave', cacheChave)
      .gte('expira_em', new Date().toISOString())
      .maybeSingle()

    if (cached?.resultado) {
      return NextResponse.json({ ...cached.resultado, _cache: true })
    }

    // ── Sem credenciais → sandbox imediato ───────────────────────────────────
    const clientId     = process.env.ASSERTIVA_CLIENT_ID
    const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
    if (isSandbox && (!clientId || !clientSecret)) {
      return NextResponse.json(generateSandboxReport(doc, tipo))
    }

    // ── Token OAuth2 ──────────────────────────────────────────────────────────
    let token: string | null = null
    try {
      token = await getToken()
    } catch (e: any) {
      const msg = e?.message || 'falha de autenticação'
      console.warn('[Assertiva] Auth error, usando sandbox:', msg)
      // Sem credenciais válidas → sandbox em vez de erro bloqueante
      return NextResponse.json({ ...generateSandboxReport(doc, tipo), _auth_error: msg })
    }

    if (!token) {
      console.warn('[Assertiva] Token nulo, usando sandbox')
      return NextResponse.json({ ...generateSandboxReport(doc, tipo), _auth_error: 'token_null' })
    }

    // ── Chamadas paralelas: Localize + Mix ───────────────────────────────────
    let localizeRaw: any = null
    let mixRaw: any      = null
    let mixSemPermissao  = false
    const erros: string[]  = []

    if (tipo === 'pf') {
      const [locRes, mixRes] = await Promise.allSettled([
        callApi(`${LOCALIZE_BASE}/cpf?cpf=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
        callApi(`${MIX_BASE}/pf/${doc}?idFinalidade=${ID_FINALIDADE}&opcoes=ACOES,POSITIVO`, token),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const detail = locRes.status === 'rejected'
          ? String(locRes.reason)
          : `HTTP ${locRes.value.status}`
        erros.push(`Localize CPF: ${detail}`)
        console.error('[Assertiva] Localize CPF error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const st = mixRes.status === 'fulfilled' ? mixRes.value.status : 0
        if (st === 403) mixSemPermissao = true
        const detail = mixRes.status === 'rejected' ? String(mixRes.reason) : `HTTP ${st}`
        erros.push(`Mix PF: ${detail}`)
        console.warn('[Assertiva] Mix PF error:', detail)
      }
    } else {
      const [locRes, mixRes] = await Promise.allSettled([
        callApi(`${LOCALIZE_BASE}/cnpj?cnpj=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
        callApi(`${MIX_BASE}/pj/${doc}?idFinalidade=${ID_FINALIDADE}&opcoes=ACOES,PARTICIPACOES,FATURAMENTO,SCORE`, token),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const detail = locRes.status === 'rejected'
          ? String(locRes.reason)
          : `HTTP ${locRes.value.status}`
        erros.push(`Localize CNPJ: ${detail}`)
        console.error('[Assertiva] Localize CNPJ error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const st = mixRes.status === 'fulfilled' ? mixRes.value.status : 0
        if (st === 403) mixSemPermissao = true
        const detail = mixRes.status === 'rejected' ? String(mixRes.reason) : `HTTP ${st}`
        erros.push(`Mix PJ: ${detail}`)
        console.warn('[Assertiva] Mix PJ error:', detail)
      }
    }

    // ── Se Localize também falhou → sandbox ───────────────────────────────────
    if (!localizeRaw && !mixRaw) {
      if (isSandbox) {
        return NextResponse.json(generateSandboxReport(doc, tipo))
      }
      return NextResponse.json(
        { erro: 'Nenhuma resposta válida da Assertiva', detalhes: erros },
        { status: 502 }
      )
    }

    // ── Parse e merge ─────────────────────────────────────────────────────────
    const localizeParsed = tipo === 'pf' ? parseLocalizePf(localizeRaw) : parseLocalizePj(localizeRaw)
    const mixParsed      = tipo === 'pf' ? parseMixPf(mixRaw)           : parseMixPj(mixRaw)
    const merged         = mergeData(localizeParsed, mixParsed)

    // Injeta dados sandbox apenas quando explicitamente em modo sandbox.
    // Quando Mix retorna 403 (sem plano), deixa os campos de crédito vazios —
    // NÃO mostrar dados fake de dívidas em consultas reais.
    const enriched = isSandbox
      ? injectFullSandbox(tipo, merged)
      : merged

    const totais = calcularTotais(enriched as Partial<RelatorioCompleto>)

    const relatorio: RelatorioCompleto = {
      documento: doc,
      tipo,
      ...enriched,
      ...totais,
      _localize:    localizeRaw,
      _credito:     mixRaw,
      _gerado_em:   new Date().toISOString(),
      _erros:       erros.length ? erros : undefined,
      _mix_403:     mixSemPermissao || undefined,
    } as RelatorioCompleto

    // ── Salva cache ───────────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_cache_factoring').upsert(
        {
          chave:         cacheChave,
          resultado:     relatorio,
          consultado_em: new Date().toISOString(),
          expira_em:     new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'chave' }
      )
    } catch { /* ignora se tabela não existir */ }

    try {
      await supabase.from('assertiva_log_factoring').insert({
        tipo:       tipo === 'pf' ? 'credito_pf' : 'credito_pj',
        chave:      cacheChave,
        status_http: 200,
        hit_cache:  false,
      })
    } catch { /* ignora se tabela não existir */ }

    return NextResponse.json(relatorio)
  } catch (err: any) {
    console.error('[Assertiva] Erro no relatório:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}

// Injeta valores sandbox apenas em campos que estão vazios (em modo sandbox explícito)
function injectFullSandbox(tipo: 'pf' | 'pj', data: Record<string, any>): Record<string, any> {
  const r = { ...data }
  if (tipo === 'pf') {
    if (r.score == null) { r.score = 720; r.score_detalhado = { pontos: 720, classe: 'C', faixa_titulo: 'Médio-Baixo', probabilidade: '92%' }; r.faixa_risco = 'C — Médio-Baixo' }
    if (!r.renda_estimada) { r.renda_estimada = 8500; r.renda_presumida = 8500; r.faixa_renda = 'Classe C — De R$ 5.000 a R$ 10.000' }
    if (!r.comprometimento_renda) r.comprometimento_renda = 25
    if (!r.capacidade_pagamento) r.capacidade_pagamento = 3000
    if (!r.negativacoes?.length) { r.negativacoes = [{ credor: 'BANCO BRADESCO S/A', valor: 1250.40, data: '2025-10-12', tipo: 'Atraso de Crédito' }]; r.total_negativacoes = 1; r.valor_total_negativacoes = 1250.40 }
    if (!r.protestos?.length) { r.protestos = []; r.total_protestos = 0; r.valor_total_protestos = 0 }
    if (!r.acoes_judiciais?.length) { r.acoes_judiciais = []; r.total_acoes_judiciais = 0; r.valor_total_acoes = 0 }
    if (!r.ccf?.length) { r.ccf = []; r.total_ccf = 0 }
  } else {
    if (r.score == null) { r.score = 680; r.score_detalhado = { pontos: 680, classe: 'B', faixa_titulo: 'Médio', probabilidade: '88%' }; r.faixa_risco = 'B — Médio' }
    if (!r.faturamento_presumido) { r.faturamento_presumido = 120000; r.renda_estimada = 120000 }
    if (!r.negativacoes?.length) { r.negativacoes = []; r.total_negativacoes = 0; r.valor_total_negativacoes = 0 }
    if (!r.protestos?.length) { r.protestos = []; r.total_protestos = 0; r.valor_total_protestos = 0 }
    if (!r.acoes_judiciais?.length) { r.acoes_judiciais = []; r.total_acoes_judiciais = 0; r.valor_total_acoes = 0 }
    if (!r.ccf?.length) { r.ccf = []; r.total_ccf = 0 }
  }
  if (!r.veiculos?.length) r.veiculos = []
  if (!r.vinculos?.length) r.vinculos = []
  return r
}
