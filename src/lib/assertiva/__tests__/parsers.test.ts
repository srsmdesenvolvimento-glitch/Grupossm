import { describe, it, expect } from 'vitest'
import {
  formatarDataParaIso,
  parseLocalizePf,
  parseLocalizePj,
  parseMixPf,
  parseMixPj,
  mergeData,
  calcularTotais,
  generateSandboxReport,
  injectSandboxFallback,
} from '../parsers'

// ─── formatarDataParaIso ──────────────────────────────────────────────────────

describe('formatarDataParaIso', () => {
  it('retorna undefined para entrada vazia', () => {
    expect(formatarDataParaIso(undefined)).toBeUndefined()
    expect(formatarDataParaIso('')).toBeUndefined()
  })

  it('mantém formato ISO yyyy-mm-dd sem alteração', () => {
    expect(formatarDataParaIso('1988-07-24')).toBe('1988-07-24')
  })

  it('converte dd/mm/yyyy para yyyy-mm-dd', () => {
    expect(formatarDataParaIso('24/07/1988')).toBe('1988-07-24')
  })

  it('extrai apenas a data de um datetime ISO', () => {
    expect(formatarDataParaIso('1988-07-24T00:00:00.000Z')).toBe('1988-07-24')
  })

  it('retorna string crua quando formato é desconhecido', () => {
    expect(formatarDataParaIso('julho 1988')).toBe('julho 1988')
  })
})

// ─── parseLocalizePf ─────────────────────────────────────────────────────────

describe('parseLocalizePf', () => {
  it('retorna {} para entrada null/undefined', () => {
    expect(parseLocalizePf(null)).toEqual({})
    expect(parseLocalizePf(undefined)).toEqual({})
  })

  it('parseia dados cadastrais básicos', () => {
    const raw = {
      resposta: {
        dadosCadastrais: {
          nome: 'JOÃO DA SILVA',
          dataNascimento: '1985-03-12',
          sexo: 'M',
          situacaoCadastral: 'REGULAR',
          obitoProvavel: false,
          idade: 39,
        },
        enderecos: [],
        telefones: { moveis: [], fixos: [] },
        emails: [],
        participacoesEmpresas: [],
      },
    }
    const result = parseLocalizePf(raw)
    expect(result.nome).toBe('JOÃO DA SILVA')
    expect(result.data_nascimento).toBe('1985-03-12')
    expect(result.sexo).toBe('M')
    expect(result.situacao_cpf).toBe('REGULAR')
    expect(result.indicador_obito).toBe(false)
    expect(result.idade).toBe(39)
  })

  it('parseia telefones móveis e fixos corretamente', () => {
    const raw = {
      resposta: {
        dadosCadastrais: { nome: 'TESTE' },
        telefones: {
          moveis: [{ numero: '999887766', aplicativos: { whatsApp: true }, operadora: 'VIVO' }],
          fixos:  [{ numero: '32441234', aplicativos: { whatsAppBusiness: false } }],
        },
        enderecos: [],
        emails: [],
        participacoesEmpresas: [],
      },
    }
    const result = parseLocalizePf(raw)
    expect(result.telefones).toHaveLength(2)
    expect(result.telefones![0].tipo).toBe('Celular')
    expect(result.telefones![0].whatsapp).toBe(true)
    expect(result.telefones![0].operadora).toBe('VIVO')
    expect(result.telefones![1].tipo).toBe('Fixo')
    expect(result.telefones![1].whatsapp).toBe(false)
  })

  it('parseia endereços concatenando tipoLogradouro + logradouro', () => {
    const raw = {
      resposta: {
        dadosCadastrais: { nome: 'TESTE' },
        enderecos: [{ tipoLogradouro: 'Rua', logradouro: 'das Flores', numero: 100, bairro: 'Centro', cidade: 'SP', uf: 'SP', cep: '01001000' }],
        telefones: { moveis: [], fixos: [] },
        emails: [],
        participacoesEmpresas: [],
      },
    }
    const result = parseLocalizePf(raw)
    expect(result.enderecos).toHaveLength(1)
    expect(result.enderecos![0].logradouro).toBe('Rua das Flores')
    expect(result.enderecos![0].numero).toBe('100')
    expect(result.enderecos![0].municipio).toBe('SP')
  })

  it('converte data de nascimento dd/mm/yyyy no cadastro', () => {
    const raw = {
      resposta: {
        dadosCadastrais: { nome: 'TESTE', dataNascimento: '12/03/1985' },
        enderecos: [],
        telefones: { moveis: [], fixos: [] },
        emails: [],
        participacoesEmpresas: [],
      },
    }
    const result = parseLocalizePf(raw)
    expect(result.data_nascimento).toBe('1985-03-12')
  })

  it('aceita resposta sem wrapper `resposta`', () => {
    const raw = {
      dadosCadastrais: { nome: 'DIRETO', situacaoCadastral: 'REGULAR' },
      enderecos: [],
      telefones: { moveis: [], fixos: [] },
      emails: [],
    }
    const result = parseLocalizePf(raw)
    expect(result.nome).toBe('DIRETO')
  })
})

// ─── parseLocalizePj ─────────────────────────────────────────────────────────

describe('parseLocalizePj', () => {
  it('retorna {} para entrada null', () => {
    expect(parseLocalizePj(null)).toEqual({})
  })

  it('parseia dados cadastrais de CNPJ', () => {
    const raw = {
      resposta: {
        dadosCadastrais: {
          razaoSocial: 'EMPRESA LTDA',
          nomeFantasia: 'FANTASIA',
          situacaoCadastral: 'ATIVA',
          cnae: 6201,
          dataAbertura: '2010-05-15',
          porteEmpresa: 'Médio',
        },
        enderecos: [],
        telefones: { moveis: [], fixos: [] },
        emails: [],
        socios: [],
      },
    }
    const result = parseLocalizePj(raw)
    expect(result.razao_social).toBe('EMPRESA LTDA')
    expect(result.nome_fantasia).toBe('FANTASIA')
    expect(result.situacao_cnpj).toBe('ATIVA')
    expect(result.cnae_principal).toBe('6201')
    expect(result.data_abertura).toBe('2010-05-15')
  })

  it('parseia sócios corretamente', () => {
    const raw = {
      resposta: {
        dadosCadastrais: { razaoSocial: 'EMPRESA LTDA' },
        socios: [{ nome: 'Fulano', cpf: '12345678909', participacao: 100, cargo: 'Sócio-Administrador', dataEntrada: '2010-01-01' }],
        enderecos: [],
        telefones: { moveis: [], fixos: [] },
        emails: [],
      },
    }
    const result = parseLocalizePj(raw)
    expect(result.socios).toHaveLength(1)
    expect(result.socios![0].nome).toBe('Fulano')
    expect(result.socios![0].documento).toBe('12345678909')
    expect(result.socios![0].participacao).toBe(100)
  })
})

// ─── parseMixPf ──────────────────────────────────────────────────────────────

describe('parseMixPf', () => {
  it('retorna {} para entrada null', () => {
    expect(parseMixPf(null)).toEqual({})
  })

  it('parseia score e faixa de risco', () => {
    const raw = {
      ocorrencias: {
        score: {
          score: {
            pontos: 750,
            classe: 'B',
            faixa: { titulo: 'Bom', descricao: 'Baixo risco' },
            probabilidade: '95%',
          },
        },
      },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.score).toBe(750)
    expect(result.faixa_risco).toBe('B — Bom')
    expect(result.score_detalhado?.pontos).toBe(750)
    expect(result.score_detalhado?.classe).toBe('B')
  })

  it('parseia negativações (débitos) corretamente', () => {
    const raw = {
      ocorrencias: {
        debitos: [
          { credor: 'BANCO X', valor: 500, dataOcorrencia: '2025-01-10', contratoFatura: 123, tipo: 'B', tipoDevedor: 'PF', cidade: 'SP', uf: 'SP' },
        ],
      },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.negativacoes).toHaveLength(1)
    expect(result.negativacoes![0].credor).toBe('BANCO X')
    expect(result.negativacoes![0].valor).toBe(500)
    expect(result.negativacoes![0].tipo).toBe('Débito') // tipo 'B' → 'Débito'
    expect(result.negativacoes![0].contrato).toBe('123')
  })

  it('usa sumQuantidade dos resumos quando disponível', () => {
    const raw = {
      ocorrencias: { debitos: [{ credor: 'X', valor: 100 }] },
      resumos: { debitos: { sumQuantidade: 5, sumValorTotal: 1000 } },
    }
    const result = parseMixPf(raw)
    expect(result.total_negativacoes).toBe(5)
    expect(result.valor_total_negativacoes).toBe(1000)
  })

  it('usa length do array quando resumos não tem sumQuantidade', () => {
    const raw = {
      ocorrencias: { debitos: [{ credor: 'X' }, { credor: 'Y' }] },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.total_negativacoes).toBe(2)
  })

  it('parseia protestos corretamente', () => {
    const raw = {
      ocorrencias: {
        protestos: [{ cartorio: 1, valor: 2000, data: '2025-06-01', cidade: 'RJ', uf: 'RJ' }],
      },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.protestos).toHaveLength(1)
    expect(result.protestos![0].cartorio).toBe('1')
    expect(result.protestos![0].municipio).toBe('RJ')
  })

  it('parseia ações judiciais com forum aninhado', () => {
    const raw = {
      ocorrencias: {
        acoes: [{ forum: { tipo: 'Execução', valor: 10000, data: '2024-01-01', vara: 1, uf: 'SP' } }],
      },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.acoes_judiciais).toHaveLength(1)
    expect(result.acoes_judiciais![0].tipo).toBe('Execução')
    expect(result.acoes_judiciais![0].vara).toBe('1')
  })

  it('parseia CCF corretamente', () => {
    const raw = {
      ocorrencias: {
        cheques: [{ banco: '001', nomeBanco: 'BB', agencia: '1234', numeroCheque: '99', motivoDescricao: 'Sem fundo', valor: 300, data: '2026-01-01' }],
      },
      resumos: {},
    }
    const result = parseMixPf(raw)
    expect(result.ccf).toHaveLength(1)
    expect(result.ccf![0].nome_banco).toBe('BB')
    expect(result.ccf![0].motivo).toBe('Sem fundo')
  })
})

// ─── parseMixPj ──────────────────────────────────────────────────────────────

describe('parseMixPj', () => {
  it('retorna {} para entrada null', () => {
    expect(parseMixPj(null)).toEqual({})
  })

  it('parseia score de PJ', () => {
    const raw = {
      ocorrencias: {
        score: { score: { pontos: 600, classe: 'C', faixa: { titulo: 'Regular' }, probabilidade: '80%' } },
      },
      resumos: {},
    }
    const result = parseMixPj(raw)
    expect(result.score).toBe(600)
    expect(result.faixa_risco).toBe('C — Regular')
  })

  it('ignora faturamento_presumido "Não consta"', () => {
    const raw = {
      ocorrencias: {},
      resumos: { faturamentoPresumido: 'Não consta' },
    }
    const result = parseMixPj(raw)
    expect(result.faturamento_presumido).toBeUndefined()
  })

  it('mantém faturamento_presumido numérico', () => {
    const raw = {
      ocorrencias: {},
      resumos: { faturamentoPresumido: 250000 },
    }
    const result = parseMixPj(raw)
    expect(result.faturamento_presumido).toBe(250000)
    expect(result.renda_estimada).toBe(250000)
  })

  it('parseia sócios do Mix PJ', () => {
    const raw = {
      ocorrencias: {
        participacoesEmpresas: [{ razaoSocial: 'EMPRESA PAI', cnpj: '11222333000144', dataEntrada: '2015-01-01' }],
      },
      resumos: {},
    }
    const result = parseMixPj(raw)
    expect(result.socios).toHaveLength(1)
    expect(result.socios![0].nome).toBe('EMPRESA PAI')
    expect(result.socios![0].documento).toBe('11222333000144')
  })

  it('retorna socios undefined quando array está vazio', () => {
    const raw = { ocorrencias: { participacoesEmpresas: [] }, resumos: {} }
    const result = parseMixPj(raw)
    expect(result.socios).toBeUndefined()
  })
})

// ─── mergeData ───────────────────────────────────────────────────────────────

describe('mergeData', () => {
  it('Mix tem prioridade sobre Localize para campos escalares', () => {
    const localize = { nome: 'Localize Nome', idade: 30 }
    const mix      = { nome: 'Mix Nome', score: 700 }
    const result   = mergeData(localize, mix)
    expect(result.nome).toBe('Mix Nome')
    expect(result.idade).toBe(30)
    expect(result.score).toBe(700)
  })

  it('usa Localize quando Mix retorna valor vazio/null', () => {
    const localize = { enderecos: [{ logradouro: 'Rua A' }] }
    const mix      = { enderecos: [], nome: 'Mix' }
    const result   = mergeData(localize, mix)
    // Mix tem array vazio + Localize tem array com dados → usa Localize
    expect(result.enderecos).toHaveLength(1)
    expect(result.enderecos[0].logradouro).toBe('Rua A')
  })

  it('usa Mix quando ambos têm arrays com dados', () => {
    const localize = { telefones: [{ numero: '111' }] }
    const mix      = { telefones: [{ numero: '222' }, { numero: '333' }] }
    const result   = mergeData(localize, mix)
    expect(result.telefones).toHaveLength(2)
  })

  it('ignora valores null, undefined e string vazia', () => {
    const localize = { nome: 'Localize', cpf: null }
    const mix      = { nome: '', cpf: undefined }
    const result   = mergeData(localize, mix)
    expect(result.nome).toBe('Localize') // mix tem '' → usa localize
    expect(result.cpf).toBeUndefined()   // ambos vazios → não inclui
  })
})

// ─── calcularTotais ──────────────────────────────────────────────────────────

describe('calcularTotais', () => {
  it('soma corretamente todas as dívidas', () => {
    const r = {
      total_negativacoes: 2,
      total_protestos: 1,
      total_acoes_judiciais: 1,
      total_ccf: 3,
      valor_total_negativacoes: 1000,
      valor_total_protestos: 500,
      valor_total_acoes: 2000,
    }
    const result = calcularTotais(r)
    expect(result.total_dividas).toBe(7)         // 2+1+1+3
    expect(result.valor_total_dividas).toBe(3500) // 1000+500+2000
  })

  it('trata undefined como zero', () => {
    const result = calcularTotais({})
    expect(result.total_dividas).toBe(0)
    expect(result.valor_total_dividas).toBe(0)
  })

  it('calcula corretamente sem ações judiciais', () => {
    const r = { total_negativacoes: 1, valor_total_negativacoes: 800 }
    const result = calcularTotais(r)
    expect(result.total_dividas).toBe(1)
    expect(result.valor_total_dividas).toBe(800)
  })
})

// ─── generateSandboxReport ───────────────────────────────────────────────────

describe('generateSandboxReport', () => {
  it('gera relatório PF com todos os campos obrigatórios', () => {
    const report = generateSandboxReport('12345678909', 'pf')
    expect(report.documento).toBe('12345678909')
    expect(report.tipo).toBe('pf')
    expect(report.nome).toBeTruthy()
    expect(report.score).toBeGreaterThan(0)
    expect(report.negativacoes?.length).toBeGreaterThan(0)
    expect(report.protestos?.length).toBeGreaterThan(0)
    expect(report.acoes_judiciais?.length).toBeGreaterThan(0)
    expect(report.ccf?.length).toBeGreaterThan(0)
    expect(report.enderecos?.length).toBeGreaterThan(0)
    expect(report.telefones?.length).toBeGreaterThan(0)
    expect(report._gerado_em).toBeTruthy()
    expect(report._cache).toBe(false)
  })

  it('gera relatório PJ com todos os campos obrigatórios', () => {
    const report = generateSandboxReport('12345678000195', 'pj')
    expect(report.documento).toBe('12345678000195')
    expect(report.tipo).toBe('pj')
    expect(report.razao_social).toBeTruthy()
    expect(report.socios?.length).toBeGreaterThan(0)
    expect(report.score).toBeGreaterThan(0)
    expect(report.negativacoes?.length).toBeGreaterThan(0)
  })

  it('total_dividas bate com a soma dos sub-totais (PF)', () => {
    const r = generateSandboxReport('12345678909', 'pf')
    const esperado = (r.total_negativacoes ?? 0) + (r.total_protestos ?? 0) +
                     (r.total_acoes_judiciais ?? 0) + (r.total_ccf ?? 0)
    expect(r.total_dividas).toBe(esperado)
  })

  it('total_dividas bate com a soma dos sub-totais (PJ)', () => {
    const r = generateSandboxReport('12345678000195', 'pj')
    const esperado = (r.total_negativacoes ?? 0) + (r.total_protestos ?? 0) +
                     (r.total_acoes_judiciais ?? 0) + (r.total_ccf ?? 0)
    expect(r.total_dividas).toBe(esperado)
  })

  it('cada chamada retorna _gerado_em único (não em cache)', () => {
    const r1 = generateSandboxReport('11111111111', 'pf')
    const r2 = generateSandboxReport('22222222222', 'pf')
    expect(r1._cache).toBe(false)
    expect(r2._cache).toBe(false)
  })
})

// ─── injectSandboxFallback ───────────────────────────────────────────────────

describe('injectSandboxFallback', () => {
  it('não modifica dados reais quando sandbox=false e Mix ok', () => {
    const parsed = {
      nome: 'Real User',
      score: 800,
      negativacoes: [{ credor: 'REAL BANK', valor: 100 }],
      total_negativacoes: 1,
      valor_total_negativacoes: 100,
      veiculos: [{ placa: 'ABC1234' }],
      vinculos: [{ nome: 'Parente Real' }],
    }
    const result = injectSandboxFallback('pf', parsed, false, false)
    expect(result.score).toBe(800)
    expect(result.negativacoes[0].credor).toBe('REAL BANK')
    expect(result.veiculos[0].placa).toBe('ABC1234')
  })

  it('injeta score quando está zerado e isMixFailed=true (PF)', () => {
    const parsed = { nome: 'Fulano', score: 0 }
    const result = injectSandboxFallback('pf', parsed, false, true)
    expect(result.score).toBe(720)
    expect(result.score_detalhado?.pontos).toBe(720)
    expect(result.faixa_risco).toContain('Médio-Baixo')
  })

  it('injeta negativações quando array está vazio e isSandbox=true (PF)', () => {
    const parsed = { nome: 'Fulano', score: 700, negativacoes: [], veiculos: [{ placa: 'XYZ' }], vinculos: [{ nome: 'A' }] }
    const result = injectSandboxFallback('pf', parsed, true, false)
    expect(result.negativacoes.length).toBeGreaterThan(0)
  })

  it('injeta veículos quando array vazio mesmo sem sandbox (shouldMockAssets)', () => {
    const parsed = { nome: 'Fulano', score: 700, veiculos: [] }
    const result = injectSandboxFallback('pf', parsed, false, false)
    // veículos vazios → injeta mock independente de sandbox
    expect(result.veiculos.length).toBeGreaterThan(0)
  })

  it('injeta score PJ quando zerado e Mix falhou', () => {
    const parsed = { razao_social: 'EMPRESA X', score: 0, faturamento_presumido: 0 }
    const result = injectSandboxFallback('pj', parsed, false, true)
    expect(result.score).toBe(680)
    expect(result.faturamento_presumido).toBe(120000)
  })

  it('não sobrescreve score existente mesmo com isSandbox=true', () => {
    const parsed = {
      score: 900,
      negativacoes: [{ credor: 'X' }],
      total_negativacoes: 1,
      protestos: [{ cartorio: 'Y' }],
      total_protestos: 1,
      acoes_judiciais: [{ tipo: 'Z' }],
      total_acoes_judiciais: 1,
      ccf: [{ banco: '001' }],
      total_ccf: 1,
      veiculos: [{ placa: 'AAA' }],
      vinculos: [{ nome: 'B' }],
    }
    const result = injectSandboxFallback('pf', parsed, true, false)
    // score já tem valor → não substitui
    expect(result.score).toBe(900)
  })

  it('injeta vínculos PJ quando sandbox ativo', () => {
    const parsed = { razao_social: 'X', score: 600, vinculos: [] }
    const result = injectSandboxFallback('pj', parsed, true, false)
    expect(result.vinculos.length).toBeGreaterThan(0)
    expect(result.vinculos[0].tipo).toBe('Coligada')
  })
})
