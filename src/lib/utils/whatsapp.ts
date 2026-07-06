const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_VERSION = process.env.WHATSAPP_VERSION ?? 'v21.0'
const FETCH_TIMEOUT_MS = 30_000

// Mapeamento: trigger key → template Meta + ordem das variáveis
// Templates Meta: srsm2_* (IDs criados 2026-07-06, aguardando aprovação)
export const TEMPLATE_MAP = {
  contrato_criado: {
    name: 'srsm2_contrato_criado',
    vars: (v: Record<string, string>) => [v.nome, v.numero_contrato, v.valor_principal, v.link_assinatura],
  },
  contrato_assinado: {
    name: 'srsm2_contrato_assinado',
    vars: (v: Record<string, string>) => [v.nome, v.numero_contrato, v.link_contrato],
  },
  lembrete_pre_vencimento: {
    name: 'srsm2_lembrete_vencimento',
    vars: (v: Record<string, string>) => [v.nome, v.numero_parcela, v.total_parcelas, v.numero_contrato, v.dias_antes, v.data_vencimento, v.valor, v.whatsapp_padrao],
  },
  lembrete_vencimento: {
    name: 'srsm2_vencimento_hoje',
    vars: (v: Record<string, string>) => [v.nome, v.numero_parcela, v.total_parcelas, v.numero_contrato, v.valor, v.whatsapp_padrao],
  },
  cobranca_pos_vencimento: {
    name: 'srsm2_cobranca_atraso',
    vars: (v: Record<string, string>) => [v.nome, v.numero_contrato, v.numero_parcela, v.total_parcelas, v.data_vencimento, v.dias_atraso, v.valor_total, v.whatsapp_padrao],
  },
} as const

export type TriggerKey = keyof typeof TEMPLATE_MAP

// Fallback text usado quando o template ainda está "Em análise" na Meta.
// Só funciona se houver janela de 24h aberta com o destinatário.
// Remove-se automaticamente assim que os templates forem aprovados (template terá prioridade).
const TEMPLATE_FALLBACK: Record<TriggerKey, (v: Record<string, string>) => string> = {
  contrato_criado: (v) =>
    `Olá ${v.nome}! Seu contrato *${v.numero_contrato}* no valor de *${v.valor_principal}* foi gerado e aguarda assinatura digital.\n\nAcesse o link seguro para assinar:\n${v.link_assinatura}\n\nVocê precisará de foto do documento e selfie para biometria.`,
  contrato_assinado: (v) =>
    `Olá ${v.nome}! ✅ Seu contrato *${v.numero_contrato}* foi assinado com sucesso!\n\nAcesse seu contrato assinado:\n${v.link_contrato}`,
  lembrete_pre_vencimento: (v) =>
    `Olá ${v.nome}! Lembrete: a parcela *${v.numero_parcela}/${v.total_parcelas}* do contrato *${v.numero_contrato}* vence em *${v.dias_antes} dia(s)* (${v.data_vencimento}).\n\nValor: *${v.valor}*\nPIX: ${v.whatsapp_padrao}`,
  lembrete_vencimento: (v) =>
    `Olá ${v.nome}! ⚠️ A parcela *${v.numero_parcela}/${v.total_parcelas}* do contrato *${v.numero_contrato}* vence *HOJE*.\n\nValor: *${v.valor}*\nPague via PIX: ${v.whatsapp_padrao}`,
  cobranca_pos_vencimento: (v) =>
    `Olá ${v.nome}! A parcela *${v.numero_parcela}/${v.total_parcelas}* do contrato *${v.numero_contrato}* venceu em ${v.data_vencimento} (${v.dias_atraso} dia(s) de atraso).\n\nValor total: *${v.valor_total}*\nRegularize via PIX: ${v.whatsapp_padrao}`,
}

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

// Envia usando template aprovado — funciona sem o cliente ter iniciado conversa
export async function enviarTemplate(
  telefone: string,
  triggerKey: TriggerKey,
  variaveis: Record<string, string>,
  _empresaId?: string,
): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  const numeroFormatado = normalizarTelefone(telefone)
  if (!numeroFormatado) {
    return { ok: false, erro: `Telefone inválido: "${telefone}"` }
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, erro: 'WhatsApp não configurado.' }
  }

  const tpl = TEMPLATE_MAP[triggerKey]
  if (!tpl) {
    return { ok: false, erro: `Trigger desconhecido: ${triggerKey}` }
  }

  const parametros = tpl.vars(variaveis).map((text) => ({ type: 'text', text: text ?? '' }))

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: numeroFormatado,
    type: 'template',
    template: {
      name: tpl.name,
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: parametros }],
    },
  }

  const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      let errCode: number | undefined
      let errMsg = err
      try {
        const errJson = JSON.parse(err)
        errCode = errJson?.error?.code
        errMsg = errJson?.error?.message ?? err
      } catch { /* não é JSON */ }

      // Códigos Meta para template não aprovado / em análise → tenta mensagem livre
      const templatePendente = errCode === 132000 || errCode === 132001 || errCode === 132015 ||
        errMsg.toLowerCase().includes('template') && (
          errMsg.toLowerCase().includes('not approved') ||
          errMsg.toLowerCase().includes('does not exist') ||
          errMsg.toLowerCase().includes('pending') ||
          errMsg.toLowerCase().includes('in review')
        )

      if (templatePendente) {
        const fallbackFn = TEMPLATE_FALLBACK[triggerKey]
        if (fallbackFn) {
          return enviarMensagem(telefone, fallbackFn(variaveis))
        }
      }

      return { ok: false, erro: `Meta API (template): ${errMsg}` }
    }

    const data = await res.json()
    return { ok: true, messageId: data?.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, erro: `Timeout/rede: ${err instanceof Error ? err.message : String(err)}` }
  }
}
