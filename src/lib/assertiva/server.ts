// Cliente HTTP + autenticação OAuth2 compartilhados entre as rotas server-side
// que falam com a API da Assertiva (relatório síncrono e Análise 360 assíncrona).
// Não importar este arquivo em código client-side — usa client secret.

export const API_BASE      = 'https://api.assertivasolucoes.com.br'
export const AUTH_URL      = `${API_BASE}/oauth2/v3/token`
export const LOCALIZE_BASE = `${API_BASE}/localize/v3`
export const MIX_BASE      = `${API_BASE}/mix-v3`
export const SCORE_BASE    = `${API_BASE}/score/v3`
export const CONEXOES_BASE = `${API_BASE}/localize-api/v1/base-cadastral`
export const VEICULOS_BASE = `${API_BASE}/veiculos/v3`
export const CREDITO_BASE  = `${API_BASE}/credito/v1`

export const ID_FINALIDADE = 2 // LGPD: Ciclo de crédito
const TOKEN_TTL_MS = 28 * 60 * 1000

// Incrementar sempre que um parser (parsers.ts) mudar o formato dos dados
// retornados — sem isso, uma correção não afeta documentos já cacheados
// (TTL de 30 dias em assertiva_cache_factoring), mascarando o fix por semanas.
export const ASSERTIVA_CACHE_VERSION = 2

export function chaveCacheAssertiva(tipo: 'pf' | 'pj', documento: string): string {
  return `${tipo}:v${ASSERTIVA_CACHE_VERSION}:${documento}`
}

let _tokenCache: { token: string; expiresAt: number } | null = null

export async function getAssertivaToken(): Promise<string | null> {
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

export async function callAssertivaApi(url: string, auth: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9_000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    const data = await res.json().catch(() => null)
    return { ok: res.status === 200, status: res.status, data }
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, status: 408, data: null }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function postAssertivaApi(url: string, auth: string, body: unknown) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })
    const data = await res.json().catch(() => null)
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data }
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, status: 408, data: null }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
