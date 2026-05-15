const EVOLUTION_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY
const EVOLUTION_INSTANCE = process.env.EVOLUTION_API_INSTANCE ?? 'default'

export async function enviarMensagem(
  telefone: string,
  mensagem: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    return { ok: true }
  }

  const numero = telefone.replace(/\D/g, '')
  const numeroFormatado = numero.startsWith('55') ? numero : `55${numero}`

  try {
    const res = await fetch(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_KEY,
        },
        body: JSON.stringify({
          number: numeroFormatado,
          options: { delay: 1200 },
          textMessage: { text: mensagem },
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, erro: `HTTP ${res.status}: ${body}` }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) }
  }
}
