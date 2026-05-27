const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION ?? 'v20.0'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_API_INSTANCE ?? 'default'

/**
 * Envia uma mensagem via WhatsApp.
 * Suporta a API Oficial da Meta (WhatsApp Cloud API) com prioridade,
 * e possui fallback automático para Evolution API ou simulação em desenvolvimento.
 */
export async function enviarMensagem(
  telefone: string,
  mensagem: string,
): Promise<{ ok: boolean; erro?: string }> {
  const numero = telefone.replace(/\D/g, '')
  // Garante o DDI 55 se o número for brasileiro e sem DDI
  const numeroFormatado = numero.startsWith('55') ? numero : `55${numero}`

  // 1. Extração dinâmica de anexos PDF no corpo da mensagem
  // Busca por links públicos terminados em .pdf
  const pdfRegex = /(https?:\/\/[^\s]+\.pdf[^\s]*)/i
  const match = mensagem.match(pdfRegex)
  
  let linkPdf: string | null = null
  let textoFinal = mensagem

  if (match) {
    linkPdf = match[0]
    // Remove o link da mensagem para não ficar duplicado na legenda
    textoFinal = mensagem.replace(pdfRegex, '').trim()
  }

  // ── MODO 1: API Oficial do WhatsApp Cloud (Meta) ──────────────────────────
  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
    
    let body: Record<string, any>

    if (linkPdf) {
      // Determina o nome do arquivo amigável baseado no tipo de anexo
      let filename = 'documento.pdf'
      if (linkPdf.includes('contrato')) filename = 'contrato.pdf'
      else if (linkPdf.includes('recibo')) filename = 'recibo.pdf'

      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numeroFormatado,
        type: 'document',
        document: {
          link: linkPdf,
          filename: filename,
          caption: textoFinal || undefined,
        },
      }
    } else {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numeroFormatado,
        type: 'text',
        text: {
          body: textoFinal,
        },
      }
    }

    try {
      const res = await fetch(url, {
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

      return { ok: true }
    } catch (err) {
      return { ok: false, erro: `Erro ao conectar na Meta API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // ── MODO 2: Fallback para Evolution API (Antigo) ──────────────────────────
  if (EVOLUTION_URL && EVOLUTION_KEY) {
    try {
      let endpoint = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`
      let body: Record<string, any> = {
        number: numeroFormatado,
        options: { delay: 1200 },
      }

      if (linkPdf) {
        endpoint = `${EVOLUTION_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`
        body = {
          ...body,
          mediaMessage: {
            mediatype: 'document',
            fileName: linkPdf.includes('contrato') ? 'contrato.pdf' : 'recibo.pdf',
            caption: textoFinal,
            media: linkPdf,
          }
        }
      } else {
        body = {
          ...body,
          textMessage: { text: textoFinal },
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_KEY,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return { ok: false, erro: `Evolution API HTTP ${res.status}: ${errorText}` }
      }

      return { ok: true }
    } catch (err) {
      return { ok: false, erro: `Erro ao conectar na Evolution API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // ── MODO 3: Simulação de Desenvolvimento (Dry-run) ──────────────────────
  console.log('--- WhatsApp Dry-run Log ---')
  console.log(`Para: ${numeroFormatado}`)
  if (linkPdf) {
    console.log(`Documento Anexo: ${linkPdf}`)
    console.log(`Legenda: ${textoFinal}`)
  } else {
    console.log(`Mensagem: ${textoFinal}`)
  }
  console.log('-----------------------------')
  
  return { ok: true }
}
