import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizarTelefone } from '../whatsapp'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers that mirror the production logic (kept pure for testability)
// ─────────────────────────────────────────────────────────────────────────────

type TriggerConfig = { ativo: boolean; template: string; dias_antes?: number }

function avaliarTrigger(trigger: TriggerConfig | undefined, fallback: string): string | null {
  const t = trigger ?? { ativo: true, template: fallback }
  if (!t.ativo) return null
  return t.template
}

function renderizarTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v),
    template,
  )
}

function buildLogPayload(params: {
  empresa_id: string; destinatario: string; assunto: string; mensagem: string
  referencia_tipo?: string; referencia_id?: string
  ok: boolean; messageId?: string; erro?: string
}) {
  return {
    empresa_id: params.empresa_id,
    canal: 'whatsapp',
    destinatario: params.destinatario,
    assunto: params.assunto,
    mensagem: params.mensagem,
    referencia_tipo: params.referencia_tipo ?? null,
    referencia_id: params.referencia_id ?? null,
    status: params.ok ? 'enviado' : 'erro',
    erro: params.ok ? null : (params.erro ?? 'Falha no envio'),
    whatsapp_message_id: params.ok ? (params.messageId ?? null) : null,
    enviado_em: params.ok ? expect.any(String) : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Avaliação de triggers (ativo/desativado)
// ─────────────────────────────────────────────────────────────────────────────
describe('avaliarTrigger — contrato_criado', () => {
  it('retorna template quando trigger está ativo', () => {
    const trigger: TriggerConfig = { ativo: true, template: 'Olá {{nome}}!' }
    expect(avaliarTrigger(trigger, '')).toBe('Olá {{nome}}!')
  })

  it('retorna null quando trigger está desativado', () => {
    const trigger: TriggerConfig = { ativo: false, template: 'Olá {{nome}}!' }
    expect(avaliarTrigger(trigger, '')).toBeNull()
  })

  it('usa fallback quando trigger não configurado (whatsapp_settings vazio)', () => {
    const fallback = 'Fallback: olá {{nome}}'
    const result = avaliarTrigger(undefined, fallback)
    expect(result).toBe(fallback)
  })

  it('trigger contrato_assinado desativado não envia mensagem', () => {
    const settings = { contrato_assinado: { ativo: false, template: 'Assinado {{nome}}' } }
    expect(avaliarTrigger(settings.contrato_assinado, '')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Renderização de templates (substituição de variáveis)
// ─────────────────────────────────────────────────────────────────────────────
describe('renderizarTemplate — contrato_criado', () => {
  const template = `Olá, *{{nome}}*! Seu contrato {{numero_contrato}} no valor de {{valor_principal}} foi gerado.\n\n✍️ Assine: {{link_assinatura}}`

  it('substitui todas as variáveis corretamente', () => {
    const result = renderizarTemplate(template, {
      nome: 'GUSTAVO FRANCO',
      numero_contrato: 'FAC-2026-0001',
      valor_principal: 'R$ 5.000,00',
      link_assinatura: 'https://srsm.vercel.app/assinar/abc123',
    })
    expect(result).toContain('GUSTAVO FRANCO')
    expect(result).toContain('FAC-2026-0001')
    expect(result).toContain('R$ 5.000,00')
    expect(result).toContain('https://srsm.vercel.app/assinar/abc123')
    expect(result).not.toContain('{{')
  })

  it('mantém placeholder quando variável não fornecida', () => {
    const result = renderizarTemplate(template, {
      nome: 'GUSTAVO',
      numero_contrato: 'FAC-001',
    })
    expect(result).toContain('{{valor_principal}}')
    expect(result).toContain('{{link_assinatura}}')
  })

  it('aceita espaços dentro de {{ }}', () => {
    const t = 'Olá, {{ nome }}!'
    expect(renderizarTemplate(t, { nome: 'MARIA' })).toBe('Olá, MARIA!')
  })
})

describe('renderizarTemplate — contrato_assinado', () => {
  const template = `✅ Contrato *{{numero_contrato}}* assinado!\n\n📄 Acesse: {{link_contrato}}`

  it('substitui link_contrato com URL do PDF', () => {
    const result = renderizarTemplate(template, {
      nome: 'JOAO SILVA',
      numero_contrato: 'FAC-2026-0042',
      link_contrato: 'https://storage.example.com/contrato_assinado_FAC-0042.pdf',
    })
    expect(result).toContain('FAC-2026-0042')
    expect(result).toContain('.pdf')
  })
})

describe('renderizarTemplate — cobranca_pos_vencimento', () => {
  const template = `⚠️ Parcela {{numero_parcela}}/{{total_parcelas}} em atraso há *{{dias_atraso}} dias*.\n💰 Total: {{valor_total}}\n💳 PIX: {{whatsapp_padrao}}`

  it('renderiza template de cobrança com todos os campos', () => {
    const result = renderizarTemplate(template, {
      numero_parcela: '2', total_parcelas: '6', dias_atraso: '15',
      valor_total: 'R$ 605,00', whatsapp_padrao: 'srsm@pix.com.br',
    })
    expect(result).toContain('2/6')
    expect(result).toContain('15 dias')
    expect(result).toContain('R$ 605,00')
    expect(result).toContain('srsm@pix.com.br')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Payload de log (notificacoes_log) — estrutura correta
// ─────────────────────────────────────────────────────────────────────────────
describe('buildLogPayload — estrutura do notificacoes_log', () => {
  const base = {
    empresa_id: 'emp-uuid-001',
    destinatario: '5562999990000',
    assunto: 'Link de Assinatura — FAC-2026-0001',
    mensagem: 'Olá, GUSTAVO! Assine: https://srsm.vercel.app/assinar/abc',
    referencia_tipo: 'emprestimo',
    referencia_id: 'emp-uuid-999',
  }

  it('status=enviado quando ok=true', () => {
    const payload = buildLogPayload({ ...base, ok: true, messageId: 'wamid.abc123' })
    expect(payload.status).toBe('enviado')
    expect(payload.erro).toBeNull()
    expect(payload.whatsapp_message_id).toBe('wamid.abc123')
    expect(payload.canal).toBe('whatsapp')
    expect(payload.referencia_tipo).toBe('emprestimo')
    expect(payload.referencia_id).toBe('emp-uuid-999')
  })

  it('status=erro quando ok=false', () => {
    const payload = buildLogPayload({ ...base, ok: false, erro: 'Token inválido' })
    expect(payload.status).toBe('erro')
    expect(payload.erro).toBe('Token inválido')
    expect(payload.whatsapp_message_id).toBeNull()
    expect(payload.enviado_em).toBeNull()
  })

  it('usa erro padrão quando mensagem de erro não fornecida', () => {
    const payload = buildLogPayload({ ...base, ok: false })
    expect(payload.erro).toBe('Falha no envio')
  })

  it('aceita referencia_tipo e referencia_id opcionais como null', () => {
    const payload = buildLogPayload({ ...base, ok: true, referencia_tipo: undefined, referencia_id: undefined })
    expect(payload.referencia_tipo).toBeNull()
    expect(payload.referencia_id).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Normalização de telefone no contexto do envio automático
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizarTelefone — fluxo de disparo automático', () => {
  it('telefone do cliente sem DDD 55 é normalizado corretamente', () => {
    expect(normalizarTelefone('62999990000')).toBe('5562999990000')
  })

  it('telefone com +55 é normalizado para 55 sem +', () => {
    expect(normalizarTelefone('+55 62 99999-0000')).toBe('5562999990000')
  })

  it('telefone inválido retorna null — evita envio para destino errado', () => {
    expect(normalizarTelefone('123')).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone('00000000000000000')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Lógica de gatilho por tipo de evento
// ─────────────────────────────────────────────────────────────────────────────
describe('fluxo completo de triggers', () => {
  const whatsappSettings = {
    contrato_criado: { ativo: true, template: 'Olá {{nome}}, assine: {{link_assinatura}}' },
    contrato_assinado: { ativo: true, template: 'Parabéns {{nome}}, contrato assinado! PDF: {{link_contrato}}' },
    lembrete_pre_vencimento: { ativo: true, dias_antes: 3, template: 'Lembrete: vence em {{dias_antes}} dias.' },
    lembrete_vencimento: { ativo: true, template: 'Sua parcela vence HOJE!' },
    cobranca_pos_vencimento: { ativo: true, template: 'Parcela em atraso há {{dias_atraso}} dias.' },
  }

  it('contrato_criado: dispara e renderiza com link de assinatura', () => {
    const template = avaliarTrigger(whatsappSettings.contrato_criado, '')
    expect(template).not.toBeNull()
    const msg = renderizarTemplate(template!, {
      nome: 'CARLOS', link_assinatura: 'https://srsm.vercel.app/assinar/xyz'
    })
    expect(msg).toContain('CARLOS')
    expect(msg).toContain('https://srsm.vercel.app/assinar/xyz')
  })

  it('contrato_assinado: dispara e renderiza com link do PDF', () => {
    const template = avaliarTrigger(whatsappSettings.contrato_assinado, '')
    const msg = renderizarTemplate(template!, {
      nome: 'ANA', link_contrato: 'https://storage.srsm.com/contrato.pdf'
    })
    expect(msg).toContain('ANA')
    expect(msg).toContain('contrato.pdf')
  })

  it('lembrete_pre_vencimento: usa dias_antes corretamente', () => {
    const cfg = whatsappSettings.lembrete_pre_vencimento
    expect(cfg.dias_antes).toBe(3)
    const msg = renderizarTemplate(cfg.template, { dias_antes: String(cfg.dias_antes) })
    expect(msg).toContain('3 dias')
  })

  it('cobranca_pos_vencimento desativada não retorna template', () => {
    const settings = { ...whatsappSettings, cobranca_pos_vencimento: { ativo: false, template: 'X' } }
    expect(avaliarTrigger(settings.cobranca_pos_vencimento, '')).toBeNull()
  })
})
