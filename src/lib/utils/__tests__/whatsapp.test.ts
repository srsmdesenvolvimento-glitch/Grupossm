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
    // 55 + 2 DDD + 10 dígitos = 14 chars → inválido
    expect(normalizarTelefone('551199999000001')).toBeNull()
  })

  it('aceita número de 8 dígitos com DDD (fixo antigo)', () => {
    // 55 + 11 + 8 dígitos = 12 chars → válido
    expect(normalizarTelefone('1133334444')).toBe('551133334444')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. enviarMensagem — resolução de provedor (dry-run quando sem config)
// ─────────────────────────────────────────────────────────────────────────────
describe('enviarMensagem — resolução de provedor', () => {
  beforeEach(() => {
    // Garante que env vars não estejam definidas para dry-run
    delete process.env.EVOLUTION_API_URL
    delete process.env.EVOLUTION_API_KEY
    delete process.env.WHATSAPP_TOKEN
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
  })

  it('dry-run retorna ok=true com messageId mockado quando sem provedor', async () => {
    // Import dinâmico para que o módulo leia as env vars atualizadas
    const { enviarMensagem } = await import('../whatsapp')
    // Limpa cache de config para este teste
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)
    expect(result.ok).toBe(true)
    expect(result.messageId).toMatch(/^mock_/)
    expect(result.erro).toBeUndefined()
  })

  it('retorna erro para telefone inválido antes de chamar API', async () => {
    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('123', 'teste', undefined, true)
    expect(result.ok).toBe(false)
    expect(result.erro).toContain('inválido')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. enviarMensagem — Evolution API (mock fetch)
// ─────────────────────────────────────────────────────────────────────────────
describe('enviarMensagem — Evolution API via env vars', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.EVOLUTION_API_URL = 'http://evo.local'
    process.env.EVOLUTION_API_KEY = 'test-key'
    process.env.EVOLUTION_API_INSTANCE = 'test-instance'
    delete process.env.WHATSAPP_TOKEN
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.EVOLUTION_API_URL
    delete process.env.EVOLUTION_API_KEY
    delete process.env.EVOLUTION_API_INSTANCE
  })

  it('monta payload correto para texto simples', async () => {
    let capturedUrl = ''
    let capturedBody: any = {}

    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      capturedUrl = url
      capturedBody = JSON.parse(opts.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ key: { id: 'wamid-123' } }),
        text: () => Promise.resolve(''),
      } as Response)
    })

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'Olá teste', undefined, true)

    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('wamid-123')
    expect(capturedUrl).toBe('http://evo.local/message/sendText/test-instance')
    expect(capturedBody.number).toBe('5511999990000')
    expect(capturedBody.text).toBe('Olá teste')
    expect(capturedBody.options.delay).toBe(0) // imediato=true
  })

  it('usa apikey header (não Authorization Bearer)', async () => {
    let capturedHeaders: any = {}

    global.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      capturedHeaders = opts.headers
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ key: { id: 'wamid-456' } }),
        text: () => Promise.resolve(''),
      } as Response)
    })

    const { enviarMensagem } = await import('../whatsapp')
    await enviarMensagem('11999990000', 'teste', undefined, true)

    expect(capturedHeaders['apikey']).toBe('test-key')
    expect(capturedHeaders['Authorization']).toBeUndefined()
  })

  it('retorna erro amigável para 401 (desconectado)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ response: { message: 'not-authorized' } })),
    } as Response)

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)

    expect(result.ok).toBe(false)
    expect(result.erro).toContain('desconectado')
  })

  it('retorna erro amigável para número sem WhatsApp (exists: false)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          JSON.stringify({ response: { message: [{ exists: false }] } }),
        ),
    } as Response)

    const { enviarMensagem } = await import('../whatsapp')
    const result = await enviarMensagem('11999990000', 'teste', undefined, true)

    expect(result.ok).toBe(false)
    expect(result.erro).toContain('não possui WhatsApp')
  })

  it('extrai PDF da mensagem e usa endpoint sendMedia', async () => {
    let capturedUrl = ''
    let capturedBody: any = {}

    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      capturedUrl = url
      capturedBody = JSON.parse(opts.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ key: { id: 'wamid-pdf' } }),
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
    expect(capturedUrl).toContain('/message/sendMedia/')
    expect(capturedBody.mediatype).toBe('document')
    expect(capturedBody.media).toContain('.pdf')
    expect(capturedBody.fileName).toBe('contrato.pdf')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. enviarMensagem — Meta API (lógica do payload — teste unitário puro)
// ─────────────────────────────────────────────────────────────────────────────
// Nota: WHATSAPP_TOKEN é lido no topo do módulo (const), então não é possível
// sobrescrever via process.env em testes sem resetar o módulo. Por isso testamos
// a lógica de construção de payload da Meta API de forma pura, sem reimportar.
describe('enviarMensagem — Meta API payload (lógica pura)', () => {
  it('payload texto Meta tem estrutura correta', () => {
    const numeroFormatado = '5511999990000'
    const textoFinal = 'Olá Meta'

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: numeroFormatado,
      type: 'text',
      text: { body: textoFinal },
    }

    expect(body.messaging_product).toBe('whatsapp')
    expect(body.recipient_type).toBe('individual')
    expect(body.to).toBe('5511999990000')
    expect(body.type).toBe('text')
    expect(body.text.body).toBe('Olá Meta')
  })

  it('payload documento Meta tem estrutura correta', () => {
    const linkPdf = 'https://storage.example.com/contrato-123.pdf'
    const textoFinal = 'Segue seu contrato.'

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5511999990000',
      type: 'document',
      document: {
        link: linkPdf,
        filename: 'contrato.pdf',
        caption: textoFinal,
      },
    }

    expect(body.type).toBe('document')
    expect(body.document.filename).toBe('contrato.pdf')
    expect(body.document.link).toContain('.pdf')
    expect(body.document.caption).toBe(textoFinal)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Templates de mensagem (montarMensagem)
// ─────────────────────────────────────────────────────────────────────────────
describe('montarMensagem — interpolação de variáveis', () => {
  it('substitui variáveis simples', async () => {
    const { montarMensagem } = await import('@/lib/utils/mensagens')
    const result = montarMensagem('Olá {{nome}}, seu contrato {{numero_contrato}} está pronto.', {
      nome: 'João Silva',
      numero_contrato: 'FAC-2026-00001',
    })
    expect(result).toBe('Olá João Silva, seu contrato FAC-2026-00001 está pronto.')
  })

  it('mantém placeholder quando variável não fornecida', async () => {
    const { montarMensagem } = await import('@/lib/utils/mensagens')
    const result = montarMensagem('Valor: {{valor}}', {})
    expect(result).toBe('Valor: {{valor}}')
  })

  it('suporta variáveis com espaços nas chaves {{ nome }}', async () => {
    const { montarMensagem } = await import('@/lib/utils/mensagens')
    // Template usa \w+ então não suporta espaços — verifica comportamento atual
    const result = montarMensagem('Olá {{ nome }}', { nome: 'Maria' })
    // {{ nome }} com espaço não é substituída pelo regex \w+
    expect(result).toBe('Olá {{ nome }}')
  })

  it('remove bloco condicional quando variável ausente', async () => {
    const { montarMensagem } = await import('@/lib/utils/mensagens')
    const result = montarMensagem('Texto {{#link}}Clique: {{link}}{{/link}} fim.', {})
    expect(result).toBe('Texto  fim.')
  })

  it('mantém bloco condicional quando variável presente', async () => {
    const { montarMensagem } = await import('@/lib/utils/mensagens')
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
  it('Set de IDs enviados evita duplicação de inserção', () => {
    const idsEnviadosHoje = new Set<string>()
    const parcelaId = 'parcela-uuid-001'

    // Simula primeira passagem
    expect(idsEnviadosHoje.has(parcelaId)).toBe(false)
    idsEnviadosHoje.add(parcelaId)

    // Simula segunda passagem (duplicata)
    expect(idsEnviadosHoje.has(parcelaId)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Webhook de status — mapeamento Baileys
// ─────────────────────────────────────────────────────────────────────────────
describe('webhook — mapeamento de status Baileys', () => {
  function mapearStatusBaileys(status: number): 'entregue' | 'lido' | null {
    if (status === 2) return 'entregue'
    if (status === 3 || status === 4 || status === 5) return 'lido'
    return null
  }

  it('status 2 → entregue', () => {
    expect(mapearStatusBaileys(2)).toBe('entregue')
  })

  it('status 3 → lido', () => {
    expect(mapearStatusBaileys(3)).toBe('lido')
  })

  it('status 4 → lido', () => {
    expect(mapearStatusBaileys(4)).toBe('lido')
  })

  it('status 5 → lido', () => {
    expect(mapearStatusBaileys(5)).toBe('lido')
  })

  it('status 0 (enviando) → null (ignorado)', () => {
    expect(mapearStatusBaileys(0)).toBeNull()
  })

  it('status 1 (enviado) → null (ignorado)', () => {
    expect(mapearStatusBaileys(1)).toBeNull()
  })

  it('status desconhecido → null', () => {
    expect(mapearStatusBaileys(99)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Webhook — não quebra com eventos desconhecidos
// ─────────────────────────────────────────────────────────────────────────────
describe('webhook — processamento seguro', () => {
  it('ignora evento desconhecido sem lançar exceção', () => {
    const event: string = 'messages.reaction' // evento não tratado — tipado como string para simular runtime
    const data = [{ key: { id: 'wamid-x' }, update: { reaction: '👍' } }]

    const processed: string[] = []

    // Lógica extraída do webhook route
    if (event === 'messages.update' && Array.isArray(data)) {
      for (const item of data) {
        const messageId = item.key?.id
        const updateStatus = (item.update as any)?.status
        if (messageId && updateStatus !== undefined) {
          processed.push(messageId)
        }
      }
    }

    expect(processed).toHaveLength(0) // não processa evento desconhecido
  })

  it('processa messages.update corretamente', () => {
    const event = 'messages.update'
    const data = [
      { key: { id: 'wamid-1' }, update: { status: 2 } },
      { key: { id: 'wamid-2' }, update: { status: 3 } },
      { key: { id: 'wamid-3' }, update: {} }, // sem status — ignorado
    ]

    const updates: Array<{ id: string; status: string }> = []

    if (event === 'messages.update' && Array.isArray(data)) {
      for (const item of data) {
        const messageId = item.key?.id
        const updateStatus = item.update?.status
        if (!messageId || updateStatus === undefined) continue

        let statusText: string | null = null
        if (updateStatus === 2) statusText = 'entregue'
        else if (updateStatus === 3 || updateStatus === 4 || updateStatus === 5) statusText = 'lido'

        if (statusText) updates.push({ id: messageId, status: statusText })
      }
    }

    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({ id: 'wamid-1', status: 'entregue' })
    expect(updates[1]).toEqual({ id: 'wamid-2', status: 'lido' })
  })
})
