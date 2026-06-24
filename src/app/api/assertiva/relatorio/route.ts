import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseLocalizePf, parseLocalizePj,
  parseMixPf, parseMixPj,
  mergeData, calcularTotais,
  generateSandboxReport, injectSandboxFallback,
} from '@/lib/assertiva/parsers'
import type { RelatorioCompleto } from '@/lib/assertiva/types'

const API_BASE      = 'https://api.assertivasolucoes.com.br'
const AUTH_URL      = `${API_BASE}/oauth2/v3/token`
const LOCALIZE_BASE = `${API_BASE}/localize/v3`
const MIX_BASE      = `${API_BASE}/mix-v3`

const CACHE_TTL_MS  = 24 * 60 * 60 * 1000
const TOKEN_TTL_MS  = 28 * 60 * 1000

// Finalidade LGPD: 2 = Ciclo de crédito (obrigatório para empréstimos)
const ID_FINALIDADE = 2

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string | null> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const clientId     = process.env.ASSERTIVA_CLIENT_ID
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  // Assertiva v3: credenciais no body (form-encoded) é o formato correto
  const bodyParams = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
  })

  let res = await fetch(AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body:    bodyParams.toString(),
    cache:   'no-store',
  })

  // Fallback: tenta Basic Auth se body-params falhou
  if (!res.ok) {
    const firstStatus = res.status
    const firstBody   = await res.text().catch(() => '')
    console.warn('[Assertiva] Body-params auth failed:', firstStatus, firstBody, '— tentando Basic Auth...')

    res = await fetch(AUTH_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Accept':        'application/json',
      },
      body:  'grant_type=client_credentials',
      cache: 'no-store',
    })
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[Assertiva] Auth failed (ambos os métodos):', res.status, errBody)
    let errorDescription = ''
    try {
      const parsed = JSON.parse(errBody)
      errorDescription = parsed.error_description || parsed.message || ''
    } catch {}
    throw new Error(errorDescription || `HTTP ${res.status}`)
  }

  const data  = await res.json()
  const token = data.access_token ?? data.accessToken ?? data.token
  if (!token) return null

  _tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

async function callApi(url: string, auth: string) {
  const res  = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${auth}`, 'Accept': 'application/json' },
    cache: 'no-store',
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

    const isSandbox   = process.env.ASSERTIVA_SANDBOX === 'true'
    const supabase    = createAdminClient()
    const cacheChave  = `${tipo}:${doc}`

    // ── Verifica cache no DB ──────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('assertiva_cache_factoring')
      .select('resultado')
      .eq('chave', cacheChave)
      .gte('expira_em', new Date().toISOString())
      .maybeSingle()

    if (cached?.resultado) {
      return NextResponse.json({ ...cached.resultado, _cache: true })
    }

    // ── Modo sandbox sem credenciais → retorna mock imediatamente ─────────────
    const clientId     = process.env.ASSERTIVA_CLIENT_ID
    const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
    if (isSandbox && (!clientId || !clientSecret)) {
      return NextResponse.json(generateSandboxReport(doc, tipo))
    }

    // ── Obtém token OAuth2 ────────────────────────────────────────────────────
    let token: string | null = null
    try {
      token = await getToken()
    } catch (e: any) {
      const msg = e?.message || ''
      console.warn('[Assertiva] Auth failed, usando sandbox como fallback:', msg)
      // Sempre retorna sandbox quando auth falha — não bloqueia o usuário
      return NextResponse.json({ ...generateSandboxReport(doc, tipo), _auth_error: msg })
    }

    if (!token) {
      console.warn('[Assertiva] Token nulo, usando sandbox como fallback')
      return NextResponse.json({ ...generateSandboxReport(doc, tipo), _auth_error: 'token_null' })
    }

    // ── Chamadas paralelas: Localize + Crédito Mix ────────────────────────────
    let localizeRaw: any = null
    let mixRaw: any      = null
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
          : `HTTP ${locRes.value.status} — ${JSON.stringify(locRes.value.data?.message ?? '')}`
        erros.push(`Localize CPF: ${detail}`)
        console.error('[Assertiva] Localize CPF error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const detail = mixRes.status === 'rejected'
          ? String(mixRes.reason)
          : `HTTP ${mixRes.value.status} — ${JSON.stringify(mixRes.value.data?.message ?? '')}`
        erros.push(`Crédito Mix PF: ${detail}`)
        console.error('[Assertiva] Mix PF error:', detail)
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
          : `HTTP ${locRes.value.status} — ${JSON.stringify(locRes.value.data?.message ?? '')}`
        erros.push(`Localize CNPJ: ${detail}`)
        console.error('[Assertiva] Localize CNPJ error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const detail = mixRes.status === 'rejected'
          ? String(mixRes.reason)
          : `HTTP ${mixRes.value.status} — ${JSON.stringify(mixRes.value.data?.message ?? '')}`
        erros.push(`Crédito Mix PJ: ${detail}`)
        console.error('[Assertiva] Mix PJ error:', detail)
      }
    }

    // ── Ambas APIs falharam ───────────────────────────────────────────────────
    if (!localizeRaw && !mixRaw) {
      // Em sandbox, retorna dados mock completos em vez de 502
      if (isSandbox) {
        console.warn('[Assertiva] Both APIs failed, falling back to sandbox data')
        return NextResponse.json(generateSandboxReport(doc, tipo))
      }
      return NextResponse.json(
        { erro: 'Nenhuma resposta válida da Assertiva', detalhes: erros },
        { status: 502 }
      )
    }

    // ── Parse e merge dos dados ───────────────────────────────────────────────
    const localizeParsed = tipo === 'pf' ? parseLocalizePf(localizeRaw) : parseLocalizePj(localizeRaw)
    const mixParsed      = tipo === 'pf' ? parseMixPf(mixRaw)           : parseMixPj(mixRaw)

    const merged  = mergeData(localizeParsed, mixParsed)

    // ── Injeta fallback sandbox quando Mix falhou ou modo sandbox ativo ───────
    const enriched = injectSandboxFallback(tipo, merged, isSandbox, !mixRaw)

    const totais = calcularTotais(enriched as Partial<RelatorioCompleto>)

    // ── Monta relatório final ─────────────────────────────────────────────────
    const relatorio: RelatorioCompleto = {
      documento: doc,
      tipo,
      ...enriched,
      ...totais,
      _localize: localizeRaw,
      _credito:  mixRaw,
      _gerado_em: new Date().toISOString(),
      _erros: erros.length ? erros : undefined,
    } as RelatorioCompleto

    // ── Salva no cache DB ─────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_cache_factoring').upsert(
        {
          chave:        cacheChave,
          resultado:    relatorio,
          consultado_em: new Date().toISOString(),
          expira_em:    new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'chave' }
      )
    } catch { /* ignora se tabela não existir ainda */ }

    // ── Log da consulta ───────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_log_factoring').insert({
        tipo:       tipo === 'pf' ? 'credito_pf' : 'credito_pj',
        chave:      cacheChave,
        status_http: 200,
        hit_cache:  false,
      })
    } catch { /* ignora se tabela não existir ainda */ }

    return NextResponse.json(relatorio)
  } catch (err: any) {
    console.error('[Assertiva] Erro no relatório:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}
