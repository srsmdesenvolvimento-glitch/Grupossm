import { describe, it, expect } from 'vitest'
import {
  detectarTipo,
  scoreLabel,
  scoreColor,
  maskDoc,
  formatCpf,
  formatCnpj,
  formatTel,
} from '../client'

// ─── detectarTipo ─────────────────────────────────────────────────────────────

describe('detectarTipo', () => {
  it('retorna "pf" para CPF com 11 dígitos', () => {
    expect(detectarTipo('12345678909')).toBe('pf')
    expect(detectarTipo('000.000.000-00')).toBe('pf') // com máscara
  })

  it('retorna "pj" para CNPJ com 14 dígitos', () => {
    expect(detectarTipo('12345678000195')).toBe('pj')
    expect(detectarTipo('12.345.678/0001-95')).toBe('pj') // com máscara
  })

  it('retorna null para documentos com comprimento inválido', () => {
    expect(detectarTipo('123')).toBeNull()
    expect(detectarTipo('')).toBeNull()
    expect(detectarTipo('1234567890')).toBeNull()  // 10 dígitos
    expect(detectarTipo('123456789012345')).toBeNull() // 15 dígitos
  })
})

// ─── scoreLabel ───────────────────────────────────────────────────────────────

describe('scoreLabel', () => {
  it('retorna "Sem Score" para undefined/null', () => {
    expect(scoreLabel(undefined)).toBe('Sem Score')
    expect(scoreLabel()).toBe('Sem Score')
  })

  it('classifica scores corretamente', () => {
    expect(scoreLabel(850)).toBe('Excelente') // >= 800
    expect(scoreLabel(800)).toBe('Excelente')
    expect(scoreLabel(700)).toBe('Bom')       // 650–799
    expect(scoreLabel(650)).toBe('Bom')
    expect(scoreLabel(550)).toBe('Regular')   // 500–649
    expect(scoreLabel(500)).toBe('Regular')
    expect(scoreLabel(400)).toBe('Baixo')     // 300–499
    expect(scoreLabel(300)).toBe('Baixo')
    expect(scoreLabel(200)).toBe('Muito Baixo') // < 300
    expect(scoreLabel(0)).toBe('Muito Baixo')
  })
})

// ─── scoreColor ───────────────────────────────────────────────────────────────

describe('scoreColor', () => {
  it('retorna cinza para score indefinido', () => {
    expect(scoreColor(undefined)).toBe('#6B7280')
  })

  it('retorna cores corretas por faixa', () => {
    expect(scoreColor(900)).toBe('#10b981') // excelente
    expect(scoreColor(700)).toBe('#22c55e') // bom
    expect(scoreColor(550)).toBe('#f59e0b') // regular
    expect(scoreColor(350)).toBe('#ef4444') // baixo
    expect(scoreColor(100)).toBe('#dc2626') // muito baixo
  })

  it('os limites de faixa retornam a cor correta', () => {
    expect(scoreColor(800)).toBe('#10b981') // exato 800 → excelente
    expect(scoreColor(650)).toBe('#22c55e') // exato 650 → bom
    expect(scoreColor(500)).toBe('#f59e0b') // exato 500 → regular
    expect(scoreColor(300)).toBe('#ef4444') // exato 300 → baixo
    expect(scoreColor(299)).toBe('#dc2626') // 299 → muito baixo
  })
})

// ─── maskDoc ─────────────────────────────────────────────────────────────────

describe('maskDoc', () => {
  it('aplica máscara de CPF para 11 dígitos', () => {
    expect(maskDoc('12345678909')).toBe('123.456.789-09')
  })

  it('aplica separadores de CPF somente a partir de 9 dígitos', () => {
    // Regex requer 3 grupos de 3 → precisa de ≥9 dígitos para separar
    expect(maskDoc('123')).toBe('123')          // sem separador
    expect(maskDoc('123456')).toBe('123456')    // sem separador (6 < 9)
    expect(maskDoc('123456789')).toBe('123.456.789')     // 9 dígitos → formata
    expect(maskDoc('1234567890')).toBe('123.456.789-0')  // 10 dígitos
  })

  it('aplica máscara de CNPJ para 14 dígitos', () => {
    expect(maskDoc('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('aplica separadores de CNPJ somente a partir de 12 dígitos', () => {
    // CNPJ path (>11 dígitos): regex requer 2+3+3+4 = 12 dígitos para separar
    expect(maskDoc('12345678')).toBe('12345678')   // 8 ≤ 11 → vai para CPF path, sem separador
    expect(maskDoc('123456780001')).toBe('12.345.678/0001')  // 12 dígitos → formata
    expect(maskDoc('12345678000195')).toBe('12.345.678/0001-95') // 14 dígitos → completo
  })

  it('limita a 14 dígitos mesmo com input maior', () => {
    const result = maskDoc('123456789012345678') // 18 dígitos
    const digits = result.replace(/\D/g, '')
    expect(digits.length).toBeLessThanOrEqual(14)
  })

  it('ignora caracteres não numéricos na entrada', () => {
    expect(maskDoc('123.456.789-09')).toBe('123.456.789-09')
  })
})

// ─── formatCpf ───────────────────────────────────────────────────────────────

describe('formatCpf', () => {
  it('formata CPF com 11 dígitos', () => {
    expect(formatCpf('12345678909')).toBe('123.456.789-09')
  })

  it('retorna "—" para undefined/null', () => {
    expect(formatCpf(undefined)).toBe('—')
    expect(formatCpf('')).toBe('—')
  })

  it('retorna string bruta se não tiver 11 dígitos', () => {
    expect(formatCpf('1234567')).toBe('1234567')
  })
})

// ─── formatCnpj ──────────────────────────────────────────────────────────────

describe('formatCnpj', () => {
  it('formata CNPJ com 14 dígitos', () => {
    expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('retorna "—" para undefined/null', () => {
    expect(formatCnpj(undefined)).toBe('—')
    expect(formatCnpj('')).toBe('—')
  })

  it('retorna string bruta se não tiver 14 dígitos', () => {
    expect(formatCnpj('1234567800')).toBe('1234567800')
  })
})

// ─── formatTel ───────────────────────────────────────────────────────────────

describe('formatTel', () => {
  it('formata celular com 11 dígitos (com 9)', () => {
    expect(formatTel('11999887766')).toBe('(11) 99988-7766')
  })

  it('formata fixo com 10 dígitos', () => {
    expect(formatTel('1132441234')).toBe('(11) 3244-1234')
  })

  it('retorna "—" para undefined/null', () => {
    expect(formatTel(undefined)).toBe('—')
    expect(formatTel('')).toBe('—')
  })

  it('retorna string bruta para formatos não reconhecidos', () => {
    expect(formatTel('123')).toBe('123')
  })
})

// ─── Lógica de filtro de busca (extraída dos pages) ──────────────────────────

describe('filtro de busca de clientes (lógica pura)', () => {
  // Replica a lógica dos pages para teste independente de React
  function filtrarClientes(clientes: Array<{ nome: string; cpf: string | null; telefone: string | null }>, busca: string) {
    if (!busca) return clientes
    const q = busca.toLowerCase()
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      (c.cpf ?? '').includes(q) ||
      (c.telefone ?? '').includes(q)
    )
  }

  const clientes = [
    { nome: 'João da Silva', cpf: '12345678909', telefone: '11999887766' },
    { nome: 'Maria Oliveira', cpf: '98765432100', telefone: '21988776655' },
    { nome: 'Carlos Santos', cpf: null, telefone: null },
    { nome: 'Ana Lima', cpf: '11122233344', telefone: '31977665544' },
  ]

  it('retorna todos quando busca está vazia', () => {
    expect(filtrarClientes(clientes, '')).toHaveLength(4)
  })

  it('filtra por nome (case-insensitive)', () => {
    expect(filtrarClientes(clientes, 'joão')).toHaveLength(1)
    expect(filtrarClientes(clientes, 'SILVA')).toHaveLength(1)
  })

  it('filtra por CPF parcial', () => {
    expect(filtrarClientes(clientes, '98765432')).toHaveLength(1)
    expect(filtrarClientes(clientes, '123456')).toHaveLength(1)
  })

  it('filtra por telefone parcial', () => {
    expect(filtrarClientes(clientes, '11999')).toHaveLength(1)
    expect(filtrarClientes(clientes, '21988')).toHaveLength(1)
  })

  it('não crasha quando cpf ou telefone são null', () => {
    expect(() => filtrarClientes(clientes, 'carlos')).not.toThrow()
    expect(filtrarClientes(clientes, 'carlos')).toHaveLength(1)
  })

  it('retorna vazio quando não há correspondência', () => {
    expect(filtrarClientes(clientes, 'zzzzz')).toHaveLength(0)
  })

  it('busca em múltiplos campos simultaneamente', () => {
    // "Lima" existe no nome de Ana Lima
    expect(filtrarClientes(clientes, 'lima')).toHaveLength(1)
  })
})

// ─── Filtro de parcelas factoring (factoring/parcelas/page) ──────────────────

describe('filtro de parcelas factoring (lógica pura)', () => {
  const HOJE = '2026-06-22'
  const EM7 = '2026-06-29'

  type Parcela = {
    numero_contrato: string
    cliente_nome: string
    cliente_cpf: string | null
    status: 'pendente' | 'atrasado' | 'pago' | 'cancelado'
    data_vencimento: string
  }

  function filtrarParcelas(parcelas: Parcela[], busca: string, tab: string) {
    return parcelas.filter(p => {
      if (busca) {
        const q = busca.toLowerCase()
        if (
          !p.numero_contrato.toLowerCase().includes(q) &&
          !p.cliente_nome.toLowerCase().includes(q) &&
          !(p.cliente_cpf ?? '').includes(q)
        ) return false
      }
      if (tab === 'hoje') return p.status === 'pendente' && p.data_vencimento === HOJE
      if (tab === 'proximos7') return p.status === 'pendente' && p.data_vencimento > HOJE && p.data_vencimento <= EM7
      if (tab !== 'todos' && p.status !== tab) return false
      return true
    })
  }

  const parcelas: Parcela[] = [
    { numero_contrato: 'EMP-001', cliente_nome: 'João Silva', cliente_cpf: '12345678909', status: 'pendente', data_vencimento: HOJE },
    { numero_contrato: 'EMP-002', cliente_nome: 'Maria Souza', cliente_cpf: '98765432100', status: 'pendente', data_vencimento: '2026-06-25' },
    { numero_contrato: 'EMP-003', cliente_nome: 'Carlos Lima', cliente_cpf: null, status: 'atrasado', data_vencimento: '2026-06-10' },
    { numero_contrato: 'EMP-004', cliente_nome: 'Ana Costa', cliente_cpf: '11122233344', status: 'pago', data_vencimento: '2026-06-01' },
    { numero_contrato: 'EMP-005', cliente_nome: 'Pedro Nunes', cliente_cpf: '55566677788', status: 'pendente', data_vencimento: '2026-07-10' },
  ]

  it('tab todos sem busca retorna tudo', () => {
    expect(filtrarParcelas(parcelas, '', 'todos')).toHaveLength(5)
  })

  it('tab pendente filtra por status', () => {
    const result = filtrarParcelas(parcelas, '', 'pendente')
    expect(result.every(p => p.status === 'pendente')).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('tab atrasado filtra por status', () => {
    const result = filtrarParcelas(parcelas, '', 'atrasado')
    expect(result).toHaveLength(1)
    expect(result[0].numero_contrato).toBe('EMP-003')
  })

  it('tab pago filtra por status', () => {
    const result = filtrarParcelas(parcelas, '', 'pago')
    expect(result).toHaveLength(1)
    expect(result[0].numero_contrato).toBe('EMP-004')
  })

  it('tab hoje retorna apenas pendentes do dia', () => {
    const result = filtrarParcelas(parcelas, '', 'hoje')
    expect(result).toHaveLength(1)
    expect(result[0].numero_contrato).toBe('EMP-001')
  })

  it('tab proximos7 retorna pendentes nos próximos 7 dias (excluindo hoje)', () => {
    const result = filtrarParcelas(parcelas, '', 'proximos7')
    expect(result).toHaveLength(1)
    expect(result[0].numero_contrato).toBe('EMP-002')
  })

  it('busca por nome filtra em todos os tabs', () => {
    expect(filtrarParcelas(parcelas, 'joão', 'todos')).toHaveLength(1)
    expect(filtrarParcelas(parcelas, 'SILVA', 'todos')).toHaveLength(1)
  })

  it('busca por CPF parcial', () => {
    expect(filtrarParcelas(parcelas, '98765432', 'todos')).toHaveLength(1)
  })

  it('busca por número de contrato', () => {
    expect(filtrarParcelas(parcelas, 'EMP-003', 'todos')).toHaveLength(1)
  })

  it('busca aplicada dentro do tab hoje', () => {
    // "hoje" com busca que bate → retorna
    expect(filtrarParcelas(parcelas, 'joão', 'hoje')).toHaveLength(1)
    // "hoje" com busca que não bate → retorna vazio
    expect(filtrarParcelas(parcelas, 'maria', 'hoje')).toHaveLength(0)
  })

  it('busca aplicada dentro do tab proximos7', () => {
    expect(filtrarParcelas(parcelas, 'maria', 'proximos7')).toHaveLength(1)
    expect(filtrarParcelas(parcelas, 'joão', 'proximos7')).toHaveLength(0)
  })

  it('não crasha quando cliente_cpf é null', () => {
    expect(() => filtrarParcelas(parcelas, 'carlos', 'todos')).not.toThrow()
    expect(filtrarParcelas(parcelas, 'carlos', 'todos')).toHaveLength(1)
  })

  it('retorna vazio quando busca não bate', () => {
    expect(filtrarParcelas(parcelas, 'zzzzz', 'todos')).toHaveLength(0)
  })
})

// ─── Filtro de contas a receber empório (emporio/financeiro/contas-receber) ──

describe('filtro de contas a receber empório (lógica pura)', () => {
  type Parcela = {
    status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
    data_vencimento: string
    clientes_emporio: { nome: string; telefone: string | null } | null
    vendas: { numero_venda: string | number } | null
  }

  const HOJE = '2026-06-22'

  function filtrarContasReceber(parcelas: Parcela[], tabAtiva: string, search: string) {
    let lista = [...parcelas]
    switch (tabAtiva) {
      case 'pendentes': lista = lista.filter(p => p.status === 'pendente'); break
      case 'vencendo':  lista = lista.filter(p => p.status === 'pendente' && p.data_vencimento === HOJE); break
      case 'atrasadas': lista = lista.filter(p => p.status === 'atrasado'); break
      case 'pagas':     lista = lista.filter(p => p.status === 'pago'); break
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      lista = lista.filter(p =>
        (p.clientes_emporio?.nome ?? '').toLowerCase().includes(q) ||
        (p.clientes_emporio?.telefone ?? '').includes(q) ||
        String(p.vendas?.numero_venda ?? '').toLowerCase().includes(q) ||
        p.data_vencimento.includes(q),
      )
    }
    return lista
  }

  const parcelas: Parcela[] = [
    { status: 'pendente', data_vencimento: HOJE,         clientes_emporio: { nome: 'Loja Alpha', telefone: '11999887766' }, vendas: { numero_venda: 42 } },
    { status: 'pendente', data_vencimento: '2026-06-28', clientes_emporio: { nome: 'Beta Comércio', telefone: null },         vendas: { numero_venda: '100' } },
    { status: 'atrasado', data_vencimento: '2026-06-10', clientes_emporio: { nome: 'Gama Ltda', telefone: '31977665544' },    vendas: null },
    { status: 'pago',     data_vencimento: '2026-06-01', clientes_emporio: null,                                              vendas: { numero_venda: 7 } },
    { status: 'cancelado',data_vencimento: '2026-05-15', clientes_emporio: { nome: 'Delta S.A.', telefone: '21988776655' },   vendas: null },
  ]

  it('tab todas retorna tudo sem busca', () => {
    expect(filtrarContasReceber(parcelas, 'todas', '')).toHaveLength(5)
  })

  it('tab pendentes filtra por status', () => {
    expect(filtrarContasReceber(parcelas, 'pendentes', '')).toHaveLength(2)
  })

  it('tab vencendo retorna só pendentes do dia', () => {
    const result = filtrarContasReceber(parcelas, 'vencendo', '')
    expect(result).toHaveLength(1)
    expect(result[0].vendas?.numero_venda).toBe(42)
  })

  it('tab atrasadas filtra por status', () => {
    expect(filtrarContasReceber(parcelas, 'atrasadas', '')).toHaveLength(1)
  })

  it('tab pagas filtra por status', () => {
    expect(filtrarContasReceber(parcelas, 'pagas', '')).toHaveLength(1)
  })

  it('busca por nome do cliente', () => {
    expect(filtrarContasReceber(parcelas, 'todas', 'alpha')).toHaveLength(1)
    expect(filtrarContasReceber(parcelas, 'todas', 'BETA')).toHaveLength(1)
  })

  it('busca por telefone', () => {
    expect(filtrarContasReceber(parcelas, 'todas', '11999887766')).toHaveLength(1)
    expect(filtrarContasReceber(parcelas, 'todas', '31977')).toHaveLength(1)
  })

  it('busca por número da venda', () => {
    expect(filtrarContasReceber(parcelas, 'todas', '42')).toHaveLength(1)
    expect(filtrarContasReceber(parcelas, 'todas', '100')).toHaveLength(1)
  })

  it('busca por data de vencimento', () => {
    expect(filtrarContasReceber(parcelas, 'todas', '2026-06-01')).toHaveLength(1)
    expect(filtrarContasReceber(parcelas, 'todas', '2026-06')).toHaveLength(4)
  })

  it('não crasha quando clientes_emporio é null', () => {
    expect(() => filtrarContasReceber(parcelas, 'todas', 'test')).not.toThrow()
  })

  it('não crasha quando telefone é null', () => {
    expect(() => filtrarContasReceber(parcelas, 'todas', 'beta')).not.toThrow()
    expect(filtrarContasReceber(parcelas, 'todas', 'beta')).toHaveLength(1)
  })

  it('busca combinada com tab', () => {
    expect(filtrarContasReceber(parcelas, 'pendentes', 'alpha')).toHaveLength(1)
    expect(filtrarContasReceber(parcelas, 'pendentes', 'gama')).toHaveLength(0)
  })

  it('retorna vazio quando busca não bate', () => {
    expect(filtrarContasReceber(parcelas, 'todas', 'zzzzz')).toHaveLength(0)
  })
})
