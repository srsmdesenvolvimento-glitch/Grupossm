import { createAdminClient } from '@/lib/supabase/admin'

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION ?? 'v20.0'
const FETCH_TIMEOUT_MS = 30_000

// In-process config cache (TTL: 60s) — evita N queries DB por execucao de cron
const _configCache = new Map<string, { data: any; expiresAt: number }>()

function getCachedConfig(empresaId: string) {
  const entry = _configCache.get(empresaId)
  if (entry && entry.expiresAt > Date.now()) return entry.data
  return null
}

function setCachedConfig(empresaId: string, data: any) {
  _configCache.set(empresaId, { data, expiresAt: Date.now() + 60_000 })
}

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/**
 * Envia uma mensagem via WhatsApp.
 * Prioriza credenciais dinamicas da empresa no banco (Evolution API),
 * com fallback para API Oficial Meta (env) ou Evolution global.
 * Cache in-process de 60s por empresa evita queries repetidas no cron.
 */
/**
 * Normaliza telefone para formato E.164 sem '+' (ex: 5511999990000).
 * Retorna null se o número for inválido (muito curto após limpeza).
 */
export function normalizarTelefone(telefone: string): string | null {
  const numero = telefone.replace(/\D/g, '')
  if (numero.length < 10) return null // mínimo DDD + 8 dígitos
  const com55 = numero.startsWith('55') ? numero : `55${numero}`
  // Máximo: 55 + DDD (2) + 9 dígitos = 13 chars
  if (com55.length > 13) return null
  return com55
}

export async function enviarMensagem(
  telefone: string,
  mensagem: string,
  empresaId?: string,
  imediato?: boolean,
): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  const numeroFormatado = normalizarTelefone(telefone)
  if (!numeroFormatado) {
    return { ok: false, erro: `Telefone inválido: "${telefone}". Use formato com DDD (ex: 11999990000).` }
  }

  // 1. Extracao de PDF inline na mensagem
  const pdfRegex = /(https?:\/\/[^\s]+\.pdf[^\s]*)/i
  const match = mensagem.match(pdfRegex)
  let linkPdf: string | null = null
  let textoFinal = mensagem

  if (match) {
    linkPdf = match[0]
    textoFinal = mensagem.replace(pdfRegex, '').trim()
  }

  // 2. Resolucao de credenciais (cache -> banco -> env)
  let apiUrl = process.env.EVOLUTION_API_URL
  let apiKey = process.env.EVOLUTION_API_KEY
  let instanceName = process.env.EVOLUTION_API_INSTANCE ?? 'default'
  let useMeta = !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID)
  let delayMs = 1200

  if (empresaId) {
    try {
      let config = getCachedConfig(empresaId)

      if (!config) {
        const supabase = createAdminClient()
        const { data } = await supabase
          .from('config_whatsapp')
          .select('api_url, api_key, instance_name, delay_ms')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .maybeSingle()
        config = data ?? null
        setCachedConfig(empresaId, config)
      }

      if (config) {
        apiUrl = config.api_url
        apiKey = config.api_key
        instanceName = config.instance_name
        useMeta = false
        delayMs = config.delay_ms ?? 1200
      }
    } catch (dbErr) {
      console.error('[WhatsApp] Erro ao buscar config da empresa:', dbErr)
    }
  }

  // MODO A: API Oficial Meta
  if (useMeta && WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
    let body: Record<string, any>

    if (linkPdf) {
      let filename = 'documento.pdf'
      if (linkPdf.includes('contrato')) filename = 'contrato.pdf'
      else if (linkPdf.includes('recibo')) filename = 'recibo.pdf'

      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numeroFormatado,
        type: 'document',
        document: { link: linkPdf, filename, caption: textoFinal || undefined },
      }
    } else {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numeroFormatado,
        type: 'text',
        text: { body: textoFinal },
      }
    }

    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return { ok: false, erro: `Meta API HTTP ${res.status}: ${errorText}` }
      }

      const resData = await res.json()
      return { ok: true, messageId: resData?.messages?.[0]?.id }
    } catch (err) {
      return { ok: false, erro: `Erro Meta API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // MODO B: Evolution API
  if (apiUrl && apiKey) {
    const delay = imediato ? 0 : delayMs

    try {
      let endpoint: string
      let body: Record<string, any>

      if (linkPdf) {
        endpoint = `${apiUrl}/message/sendMedia/${instanceName}`
        body = {
          number: numeroFormatado,
          mediatype: 'document',
          mimetype: 'application/pdf',
          fileName: linkPdf.includes('contrato') ? 'contrato.pdf' : 'recibo.pdf',
          caption: textoFinal,
          media: linkPdf,
          options: { delay },
        }
      } else {
        endpoint = `${apiUrl}/message/sendText/${instanceName}`
        body = {
          number: numeroFormatado,
          text: textoFinal,
          options: { delay },
        }
      }

      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let errorText = await res.text()
        // Detecta o caso específico de número sem WhatsApp (exists: false)
        try {
          const errJson = JSON.parse(errorText)
          const msgs = errJson?.response?.message
          if (Array.isArray(msgs) && msgs[0]?.exists === false) {
            return { ok: false, erro: `Número ${numeroFormatado} não possui WhatsApp cadastrado.` }
          }
          if (errJson?.response?.message?.includes?.('not-authorized') || res.status === 401) {
            return { ok: false, erro: 'WhatsApp desconectado. Reconecte em Mensagens → Conexão WhatsApp.' }
          }
        } catch {}
        return { ok: false, erro: `Evolution API HTTP ${res.status}: ${errorText}` }
      }

      const resData = await res.json()
      const messageId =
        resData?.key?.id || resData?.message?.key?.id || resData?.instance?.message?.key?.id
      return { ok: true, messageId }
    } catch (err) {
      return { ok: false, erro: `Erro Evolution API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // MODO C: Sem credenciais configuradas — falha explícita (nunca simular sucesso)
  console.error('[WhatsApp] Nenhuma credencial configurada.', { empresaId, apiUrl: !!apiUrl, apiKey: !!apiKey, useMeta })
  return {
    ok: false,
    erro: empresaId
      ? 'WhatsApp não configurado para esta empresa. Acesse Mensagens → Conexão & Automação e salve as credenciais com o switch "Ativar envio" ligado.'
      : 'WhatsApp não configurado. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY nas variáveis de ambiente.',
  }
}

