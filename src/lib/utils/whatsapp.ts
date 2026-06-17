import { createAdminClient } from '@/lib/supabase/admin'

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION ?? 'v20.0'

/**
 * Envia uma mensagem via WhatsApp.
 * Prioriza credenciais dinâmicas da empresa cadastradas no banco de dados (Evolution API),
 * com fallback para a API Oficial da Meta (se configurada em env) ou Evolution API global.
 */export async function enviarMensagem(
  telefone: string,
  mensagem: string,
  empresaId?: string,
  imediato?: boolean,
): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  const numero = telefone.replace(/\D/g, '')
  // Garante o DDI 55 se o número for brasileiro e sem DDI
  const numeroFormatado = numero.startsWith('55') ? numero : `55${numero}`

  // 1. Extração dinâmica de anexos PDF no corpo da mensagem
  const pdfRegex = /(https?:\/\/[^\s]+\.pdf[^\s]*)/i
  const match = mensagem.match(pdfRegex)
  
  let linkPdf: string | null = null
  let textoFinal = mensagem

  if (match) {
    linkPdf = match[0]
    // Remove o link da mensagem para não ficar duplicado na legenda
    textoFinal = mensagem.replace(pdfRegex, '').trim()
  }

  // ── 2. Resolução das Credenciais (Banco vs Env) ──────────────────────────
  let apiUrl = process.env.EVOLUTION_API_URL
  let apiKey = process.env.EVOLUTION_API_KEY
  let instanceName = process.env.EVOLUTION_API_INSTANCE ?? 'default'
  let useMeta = !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID)
  let delayMs = 1200

  if (empresaId) {
    try {
      const supabase = createAdminClient()
      const { data: config } = await supabase
        .from('config_whatsapp')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .maybeSingle()

      if (config) {
        apiUrl = config.api_url
        apiKey = config.api_key
        instanceName = config.instance_name
        useMeta = false // Prioriza a Evolution API da empresa cadastrada no banco
        delayMs = config.delay_ms ?? 1200
      }
    } catch (dbErr) {
      console.error('[WhatsApp] Erro ao buscar config da empresa no banco:', dbErr)
    }
  }

  // ── MODO A: API Oficial do WhatsApp Cloud (Meta) ──────────────────────────
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

      const resData = await res.json()
      const messageId = resData?.messages?.[0]?.id

      return { ok: true, messageId }
    } catch (err) {
      return { ok: false, erro: `Erro ao conectar na Meta API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // ── MODO B: Evolution API (Empresa ou Global) ─────────────────────────────
  if (apiUrl && apiKey) {
    try {
      let endpoint = `${apiUrl}/message/sendText/${instanceName}`
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
          options: {
            delay: imediato ? 0 : delayMs
          }
        }
      } else {
        body = {
          number: numeroFormatado,
          text: textoFinal,
          options: {
            delay: imediato ? 0 : delayMs
          }
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return { ok: false, erro: `Evolution API HTTP ${res.status}: ${errorText}` }
      }

      const resData = await res.json()
      // A Evolution API retorna a chave com ID em resData.key?.id ou resData.message?.key?.id
      const messageId = resData?.key?.id || resData?.message?.key?.id || resData?.instance?.message?.key?.id

      return { ok: true, messageId }
    } catch (err) {
      return { ok: false, erro: `Erro ao conectar na Evolution API: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // ── MODO C: Simulação de Desenvolvimento (Dry-run) ──────────────────────
  console.log('--- WhatsApp Dry-run Log ---')
  console.log(`Para: ${numeroFormatado}`)
  console.log(`Empresa ID: ${empresaId ?? 'global'}`)
  console.log(`Bypass Delay (Imediato): ${imediato ? 'Sim' : 'Não'}`)
  if (linkPdf) {
    console.log(`Documento Anexo: ${linkPdf}`)
    console.log(`Legenda: ${textoFinal}`)
  } else {
    console.log(`Mensagem: ${textoFinal}`)
  }
  console.log('-----------------------------')
  
  return { ok: true, messageId: `mock_${Math.random().toString(36).substr(2, 9)}` }
}
