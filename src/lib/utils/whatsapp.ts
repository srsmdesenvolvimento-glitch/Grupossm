const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION ?? 'v21.0'
const FETCH_TIMEOUT_MS = 30_000

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export function normalizarTelefone(telefone: string): string | null {
  const numero = telefone.replace(/\D/g, '')
  if (numero.length < 10) return null
  const com55 = numero.startsWith('55') ? numero : `55${numero}`
  if (com55.length > 13) return null
  return com55
}

export async function enviarMensagem(
  telefone: string,
  mensagem: string,
  _empresaId?: string,
  _imediato?: boolean,
): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  const numeroFormatado = normalizarTelefone(telefone)
  if (!numeroFormatado) {
    return { ok: false, erro: `Telefone inválido: "${telefone}". Use formato com DDD (ex: 11999990000).` }
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, erro: 'WhatsApp não configurado. Defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.' }
  }

  const pdfRegex = /(https?:\/\/[^\s]+\.pdf[^\s]*)/i
  const match = mensagem.match(pdfRegex)
  const linkPdf = match?.[0] ?? null
  const textoFinal = linkPdf ? mensagem.replace(pdfRegex, '').trim() : mensagem

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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      try {
        const errJson = JSON.parse(err)
        const msg = errJson?.error?.message ?? err
        return { ok: false, erro: `Meta API: ${msg}` }
      } catch {
        return { ok: false, erro: `Meta API HTTP ${res.status}: ${err}` }
      }
    }

    const data = await res.json()
    return { ok: true, messageId: data?.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, erro: `Erro ao enviar: ${err instanceof Error ? err.message : String(err)}` }
  }
}
