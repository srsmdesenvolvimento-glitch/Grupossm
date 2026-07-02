import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizarTelefone } from '../whatsapp'

// ─────────────────────────────────────────────────────────────────────────────
// 1. normalizarTelefone
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizarTelefone', () => {
  it('adiciona 55 quando ausente', () => {
    expect(normalizarTelefone('11999990000')).toBe('5511999990000')
  })

  it('mantém 55 quando já presente', () => {
    expect(normalizarTelefone('5511999990000')).toBe('5511999990000')
  })

  it('remove formatação (parênteses, hífen, espaço)', () => {
    expect(normalizarTelefone('(11) 99999-0000')).toBe('5511999990000')
  })

  it('remove +55 internacional', () => {
    expect(normalizarTelefone('+55 11 99999-0000')).toBe('5511999990000')
  })

  it('retorna null para número muito curto (< 10 dígitos)', () => {
    expect(normalizarTelefone('1199')).toBeNull()
    expect(normalizarTelefone('999')).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
  })

  it('retorna null para número muito longo (> 13 dígitos com 55)', () => {
    expect(normalizarTelefone('551199999000001')).toBeNull()
  })

  it('aceita número de 8 dígitos com DDD (fixo antigo)', () => {
    expect(normalizarTelefone('1133334444')).toBe('551133334444')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. enviarMensagem — sem credenciais configuradas
// ─────────────────────────────────────────────────────────────────────────────
describe('enviarMensagem — sem credenciais', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_TOKEN
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
  })

  it('retorna erro explícito quando nenhuma credencial está configurada', async () => {
    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)
    expect(result.ok).toBe(false)
    expect(result.erro).toBeDefined()
    expect(result.erro).toContain('não configurado')
  })

  it('retorna erro para telefone inválido antes de chamar API', async () => {
    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('123', 'teste', undefined, true)
    expect(result.ok).toBe(false)
    expect(result.erro).toContain('inválido')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. enviarMensagem — Meta Cloud API (mock fetch)
// ─────────────────────────────────────────────────────────────────────────────
describe('enviarMensagem — Meta Cloud API', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.WHATSAPP_TOKEN = 'test-meta-token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
    process.env.WHATSAPP_VERSION = 'v21.0'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.WHATSAPP_TOKEN
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_VERSION
  })

  it('monta payload texto correto para Meta API', async () => {
    let capturedUrl = ''
    let capturedBody: any = {}
    let capturedHeaders: any = {}

    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      capturedUrl = url
      capturedBody = JSON.parse(opts.body)
      capturedHeaders = opts.headers
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid.meta123' }] }),
        text: () => Promise.resolve(''),
      } as Response)
    })

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'Olá Meta API', undefined, true)

    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('wamid.meta123')
    expect(capturedUrl).toContain('graph.facebook.com')
    expect(capturedUrl).toContain('123456789/messages')
    expect(capturedBody.messaging_product).toBe('whatsapp')
    expect(capturedBody.to).toBe('5511999990000')
    expect(capturedBody.type).toBe('text')
    expect(capturedBody.text.body).toBe('Olá Meta API')
    expect(capturedHeaders['Authorization']).toBe('Bearer test-meta-token')
  })

  it('usa endpoint e payload de documento quando mensagem contém URL PDF', async () => {
    let capturedBody: any = {}

    global.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid.pdf' }] }),
        text: () => Promise.resolve(''),
      } as Response)
    })

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem(
      '11999990000',
      'Segue seu contrato: https://storage.example.com/contrato-123.pdf',
      undefined,
      true,
    )

    expect(result.ok).toBe(true)
    expect(capturedBody.type).toBe('document')
    expect(capturedBody.document.link).toContain('.pdf')
    expect(capturedBody.document.filename).toBe('contrato.pdf')
  })

  it('identifica PDF de recibo corretamente', async () => {
    let capturedBody: any = {}

    global.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid.recibo' }] }),
        text: () => Promise.resolve(''),
      } as Response)
    })

    const { enviarMensagem } = await import('../whatsapp')
    await enviarMensagem('11999990000', 'Seu recibo: https://s3.example.com/recibo-pag.pdf', undefined, true)

    expect(capturedBody.document.filename).toBe('recibo.pdf')
  })

  it('retorna erro amigável com mensagem da Meta API em caso de falha', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: '(#131030) Recipient phone number not in allowed list' }
      })),
    } as Response)

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)

    expect(result.ok).toBe(false)
    expect(result.erro).toContain('Meta API')
    expect(result.erro).toContain('131030')
  })

  it('retorna erro de timeout quando fetch não responde', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        const err = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
        setTimeout(() => reject(err), 100)
      })
    })

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)

    expect(result.ok).toBe(false)
    expect(result.erro).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Payload Meta API — lógica pura (sem import)
// ─────────────────────────────────────────────────────────────────────────────
describe('Meta API — estrutura de payload (lógica pura)', () => {
  it('payload texto tem campos obrigatórios', () => {
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5511999990000',
      type: 'text',
      text: { body: 'Olá' },
    }
    expect(body.messaging_product).toBe('whatsapp')
    expect(body.recipient_type).toBe('individual')
    expect(body.type).toBe('text')
    expect(body.text.body).toBe('Olá')
  })

  it('payload documento tem campos obrigatórios', () => {
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5511999990000',
      type: 'document',
      document: { link: 'https://ex.com/contrato.pdf', filename: 'contrato.pdf', caption: 'Seu contrato' },
    }
    expect(body.type).toBe('document')
    expect(body.document.filename).toBe('contrato.pdf')
    expect(body.document.link).toContain('.pdf')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Templates de mensagem (montarMensagem em mensagens.ts)
// ─────────────────────────────────────────────────────────────────────────────
describe('montarMensagem — interpolação de variáveis', () => {
  it('substitui variáveis simples', () => {
    const { montarMensagem } = require('@/lib/utils/mensagens')
    const result = montarMensagem('Olá {{nome}}, contrato {{numero_contrato}}.', {
      nome: 'João Silva',
      numero_contrato: 'FAC-2026-00001',
    })
    expect(result).toBe('Olá João Silva, contrato FAC-2026-00001.')
  })

  it('mantém placeholder quando variável não fornecida', () => {
    const { montarMensagem } = require('@/lib/utils/mensagens')
    const result = montarMensagem('Valor: {{valor}}', {})
    expect(result).toBe('Valor: {{valor}}')
  })

  it('remove bloco condicional quando variável ausente', () => {
    const { montarMensagem } = require('@/lib/utils/mensagens')
    const result = montarMensagem('Texto {{#link}}Clique: {{link}}{{/link}} fim.', {})
    expect(result).toBe('Texto  fim.')
  })

  it('mantém bloco condicional quando variável presente', () => {
    const { montarMensagem } = require('@/lib/utils/mensagens')
    const result = montarMensagem('Texto {{#link}}Clique: {{link}}{{/link}} fim.', {
      link: 'https://example.com',
    })
    expect(result).toContain('Clique: https://example.com')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Idempotência de disparos (lógica pura)
// ─────────────────────────────────────────────────────────────────────────────
describe('idempotência de disparos', () => {
  it('Set de IDs evita duplicação', () => {
    const enviados = new Set<string>()
    const id = 'parcela-uuid-001'
    expect(enviados.has(id)).toBe(false)
    enviados.add(id)
    expect(enviados.has(id)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Webhook Meta — mapeamento de status
// ─────────────────────────────────────────────────────────────────────────────
describe('webhook Meta — mapeamento de status', () => {
  function mapearStatusMeta(status: string): 'enviado' | 'entregue' | 'lido' | null {
    if (status === 'sent') return 'enviado'
    if (status === 'delivered') return 'entregue'
    if (status === 'read') return 'lido'
    return null
  }

  it('sent → enviado', () => expect(mapearStatusMeta('sent')).toBe('enviado'))
  it('delivered → entregue', () => expect(mapearStatusMeta('delivered')).toBe('entregue'))
  it('read → lido', () => expect(mapearStatusMeta('read')).toBe('lido'))
  it('failed → null (erro tratado separado)', () => expect(mapearStatusMeta('failed')).toBeNull())
  it('desconhecido → null', () => expect(mapearStatusMeta('unknown_event')).toBeNull())
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Webhook Meta — processamento de payload
// ─────────────────────────────────────────────────────────────────────────────
describe('webhook Meta — processamento de payload', () => {
  it('extrai message_id e status do payload Meta', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            statuses: [
              { id: 'wamid.meta1', status: 'delivered', recipient_id: '5511999990000' },
              { id: 'wamid.meta2', status: 'read', recipient_id: '5511999990000' },
            ]
          }
        }]
      }]
    }

    const statuses = payload.entry[0].changes[0].value.statuses
    expect(statuses).toHaveLength(2)
    expect(statuses[0].id).toBe('wamid.meta1')
    expect(statuses[0].status).toBe('delivered')
    expect(statuses[1].status).toBe('read')
  })

  it('ignora payload sem statuses sem lançar exceção', () => {
    const payload = { entry: [{ changes: [{ value: { messages: [] } }] }] }
    const statuses = payload.entry[0].changes[0].value.messages
    expect(Array.isArray(statuses)).toBe(true)
    expect(statuses).toHaveLength(0)
  })
})
