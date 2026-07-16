import { describe, it, expect } from 'vitest'
import {
  formatarDataParaIso,
  parseLocalizePf,
  parseLocalizePj,
  parseMixPf,
  parseMixPj,
  parseScoreCredito,
  parseAnalise360PF,
  parseAnalise360PJ,
  parseConexoes,
  parsePessoasDeReferencia,
  mesclarVinculos,
  parseHistoricoVeiculos,
  mesclarVeiculos,
  enriquecerVinculos,
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

  it('parseia possivelHistoricoProfissional completo (não só o primeiro item)', () => {
    const raw = {
      resposta: {
        dadosCadastrais: { nome: 'TESTE' },
        enderecos: [],
        telefones: { moveis: [], fixos: [] },
        emails: [],
        participacoesEmpresas: [],
        possivelHistoricoProfissional: [
          {
            rendaEstimada: '1317.87',
            setor: 'Atividades de apoio à educação',
            dataRegistro: '01/06/2023',
            cboDescricao: 'Secretário - executivo',
            cnpj: '49.268.772/0001-06',
            razaoSocial: 'DYNAMIS EDUCACAO LTDA',
            faixaSalarial: 'Até 1 Salário Mínimo',
          },
          {
            rendaEstimada: '2500',
            setor: 'Comércio varejista',
            dataRegistro: '01/01/2020',
            cboDescricao: 'Vendedor',
            cnpj: '11.222.333/0001-44',
            razaoSocial: 'LOJA EXEMPLO LTDA',
            faixaSalarial: '1 a 3 Salários Mínimos',
          },
        ],
      },
    }
    const result = parseLocalizePf(raw)
    expect(result.historico_profissional).toHaveLength(2)
    expect(result.historico_profissional![0]).toMatchObject({
      empresa: 'DYNAMIS EDUCACAO LTDA',
      cnpj: '49.268.772/0001-06',
      cargo: 'Secretário - executivo',
      setor: 'Atividades de apoio à educação',
      data_registro: '2023-06-01',
      renda_estimada: 1317.87,
      faixa_salarial: 'Até 1 Salário Mínimo',
    })
    expect(result.historico_profissional![1].empresa).toBe('LOJA EXEMPLO LTDA')
    // ocupação/renda estimada seguem vindo do item mais recente (índice 0), sem regressão
    expect(result.ocupacao).toBe('Secretário - executivo')
    expect(result.renda_estimada).toBe(1317.87)
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

// ─── parseScoreCredito ────────────────────────────────────────────────────────
// Este é o produto REALMENTE contratado para score/dívidas (confirmado por
// contrato + teste ao vivo em 2026-07-14) — o Mix não está no plano (403).
// GET /score/v3/pf/credito/{cpf}?acoes=true&positivo=true  |  /pj/credito/{cnpj}?acoes=true

describe('parseScoreCredito', () => {
  it('parseia score, cadastro positivo e negativações (registrosDebitos) — formato real PF', () => {
    const raw = {
      resposta: {
        score: {
          pontos: 0,
          classe: 'F',
          faixa: { titulo: 'Altíssimo risco', descricao: 'Baixa chance de honrar compromissos' },
          cadastroPositivo: {
            suspenso: false,
            atrasoConsumo: { descricao: 'Atraso alto', valor: 78, risco: 'ALTO' },
          },
        },
        registrosDebitos: {
          list: [{ credor: 'BANCO X', valor: 100, dataInclusao: '15/06/2026', contrato: '123', tipoDebito: 'REGISTRADO', tipoDevedor: { titulo: 'COMPRADOR' }, cidade: 'SAO PAULO', uf: 'SP' }],
          qtdDebitos: 1,
          valorTotal: 100,
        },
        protestosPublicos: { list: [], qtdProtestos: 0, valorTotal: '' },
        rendaPresumida: { valor: 1500 },
        cheques: {},
        ultimasConsultas: { list: [{ consultante: 'BANCO Y', dataOcorrencia: '01/07/2026' }], qtdUltConsultas: 1 },
      },
      // `acoes` vem como irmão de `resposta`, não dentro dela
      acoes: { list: [{ tipo: { titulo: 'Execução' }, data: '10/01/2026', valor: 5000, uf: 'SP' }], qtdAcoes: 1, valorTotal: 5000 },
    }

    const result = parseScoreCredito(raw, 'pf')

    expect(result.score).toBe(0)
    expect(result.faixa_risco).toBe('F — Altíssimo risco')
    expect(result.score_detalhado?.cadastro_positivo?.atrasoConsumo?.risco).toBe('ALTO')
    expect(result.renda_presumida).toBe(1500)

    expect(result.negativacoes).toHaveLength(1)
    expect(result.negativacoes?.[0].credor).toBe('BANCO X')
    expect(result.total_negativacoes).toBe(1)
    expect(result.valor_total_negativacoes).toBe(100)

    expect(result.acoes_judiciais).toHaveLength(1)
    expect(result.acoes_judiciais?.[0].tipo).toBe('Execução')
    expect(result.total_acoes_judiciais).toBe(1)
    expect(result.valor_total_acoes).toBe(5000)

    expect(result.total_consultas_anteriores).toBe(1)
  })

  it('parseia faturamento presumido e protestos — formato real PJ', () => {
    const raw = {
      resposta: {
        score: { pontos: 0, classe: 'F', faixa: { titulo: 'Altíssimo risco' } },
        protestosPublicos: { list: [{ uf: 'GO', cidade: 'GOIANIA', valor: 6881.85, cartorio: '02' }], qtdProtestos: 1, valorTotal: 6881.85 },
        registrosDebitos: {},
        faturamentoEstimado: { valor: 425687780 },
        cheques: {},
      },
      acoes: {},
    }
    const result = parseScoreCredito(raw, 'pj')
    expect(result.faturamento_presumido).toBe(425687780)
    expect(result.protestos).toHaveLength(1)
    expect(result.total_protestos).toBe(1)
    expect(result.valor_total_protestos).toBe(6881.85)
    expect(result.total_acoes_judiciais).toBe(0)
  })

  it('retorna objeto vazio para entrada nula', () => {
    expect(parseScoreCredito(null, 'pf')).toEqual({})
  })

  it('não quebra quando registrosDebitos/cheques vêm como objeto vazio {}', () => {
    const raw = { resposta: { score: {}, registrosDebitos: {}, protestosPublicos: {}, cheques: {} } }
    const result = parseScoreCredito(raw, 'pf')
    expect(result.negativacoes).toEqual([])
    expect(result.total_negativacoes).toBe(0)
  })
})

// ─── parseConexoes ────────────────────────────────────────────────────────────
// Validado em 2026-07-14 contra a API real (CPF e CNPJ reais): `resposta` é uma
// lista PLANA de conexões — não agrupada por categoria como o swagger sugere.

describe('parseConexoes', () => {
  it('lê o formato real: resposta como lista plana', () => {
    const raw = {
      resposta: [
        { nomeOuRazaoSocial: 'MARIA DA SILVA', documento: '11122233344', tipoDocumento: 'PF', tipoRelacao: 'Parentes', relacao: 'Mãe', telefone: '(62) 99999-0001', whatsapp: true },
        { nomeOuRazaoSocial: 'EMPRESA PARCEIRA LTDA', documento: '11222333000144', tipoDocumento: 'PJ', tipoRelacao: 'Sócios', relacao: 'Sócio(a)' },
      ],
    }
    const vinculos = parseConexoes(raw)
    expect(vinculos).toHaveLength(2)
    expect(vinculos[0].nome).toBe('MARIA DA SILVA')
    expect(vinculos[0].parentesco).toBe('Mãe')
    expect(vinculos[0].telefone).toBe('(62) 99999-0001')
    expect(vinculos[0].whatsapp).toBe(true)
    expect(vinculos[1].documento_tipo).toBe('PJ')
  })

  it('aceita o formato agrupado por categoria como fallback', () => {
    const raw = { resposta: { parentes: { conexoes: [{ nomeOuRazaoSocial: 'JOAO PAI', documento: '99988877766', tipoDocumento: 'PF', relacao: 'Pai' }] } } }
    const vinculos = parseConexoes(raw)
    expect(vinculos).toHaveLength(1)
    expect(vinculos[0].parentesco).toBe('Pai')
  })

  it('deduplica pela mesma pessoa aparecendo em mais de uma categoria', () => {
    const raw = {
      resposta: [
        { nomeOuRazaoSocial: 'FULANO SOCIO', documento: '12312312312', tipoDocumento: 'PF', relacao: 'Sócio(a)' },
        { nomeOuRazaoSocial: 'FULANO SOCIO', documento: '12312312312', tipoDocumento: 'PF', relacao: 'Decisor' },
      ],
    }
    const vinculos = parseConexoes(raw)
    expect(vinculos).toHaveLength(1)
  })

  it('retorna array vazio para entrada nula', () => {
    expect(parseConexoes(null)).toEqual([])
  })
})

// ─── parsePessoasDeReferencia / mesclarVinculos ──────────────────────────────
// Fonte extra (só PF) validada ao vivo em 2026-07-14 — achou um empregador que
// /conexoes não tinha achado pro mesmo CPF.

describe('parsePessoasDeReferencia', () => {
  it('parseia pessoas de referência incluindo empregador PJ', () => {
    const raw = {
      resposta: {
        pessoasDeReferencia: [
          { relacao: 'Mãe', nomeOuRazaoSocial: 'MARIA DA SILVA', documento: '11122233344', dataNascimentoOuAbertura: '31/12/1982' },
          { relacao: 'Empregador', nomeOuRazaoSocial: 'EMPRESA X LTDA', documento: '49268772000106', dataNascimentoOuAbertura: '20/01/2023' },
        ],
      },
    }
    const vinculos = parsePessoasDeReferencia(raw)
    expect(vinculos).toHaveLength(2)
    expect(vinculos[0].parentesco).toBe('Mãe')
    expect(vinculos[0].documento_tipo).toBe('PF')
    expect(vinculos[1].parentesco).toBe('Empregador')
    expect(vinculos[1].documento_tipo).toBe('PJ')
    expect(vinculos[1].nome).toBe('EMPRESA X LTDA')
  })

  it('retorna array vazio para entrada nula', () => {
    expect(parsePessoasDeReferencia(null)).toEqual([])
  })
})

describe('mesclarVinculos', () => {
  it('soma pessoas da fonte extra sem duplicar quem já veio da fonte principal', () => {
    const principal = [{ nome: 'MARIA DA SILVA', documento: '11122233344', parentesco: 'Mãe', telefone: '(62) 99999-0000' }]
    const extra = [
      { nome: 'MARIA DA SILVA', documento: '11122233344', parentesco: 'Mãe' }, // duplicado, sem telefone
      { nome: 'EMPRESA X LTDA', documento: '49268772000106', parentesco: 'Empregador' }, // novo
    ]
    const result = mesclarVinculos(principal, extra)
    expect(result).toHaveLength(2)
    expect(result[0].telefone).toBe('(62) 99999-0000') // mantém a versão mais rica (principal)
    expect(result[1].nome).toBe('EMPRESA X LTDA')
  })
})

// ─── enriquecerVinculos ───────────────────────────────────────────────────────

describe('enriquecerVinculos', () => {
  it('mescla endereço, email e telefone de um perfil consultado à parte', () => {
    const vinculos = [{ nome: 'MARIA DA SILVA', documento: '11122233344', parentesco: 'Mãe' }]
    const perfis = new Map([
      ['11122233344', {
        nome: 'MARIA DA SILVA',
        enderecos: [{ logradouro: 'Rua X', municipio: 'Goiânia', uf: 'GO' }],
        emails: [{ email: 'maria@example.com' }],
        telefones: [{ ddd: '62', numero: '999990001' }],
      }],
    ])
    const result = enriquecerVinculos(vinculos, perfis)
    expect(result[0].endereco?.logradouro).toBe('Rua X')
    expect(result[0].email).toBe('maria@example.com')
    expect(result[0]._enriquecido).toBe(true)
  })

  it('não mexe em vínculos sem documento próprio', () => {
    const vinculos = [{ nome: 'SEM DOC' }]
    const result = enriquecerVinculos(vinculos, new Map())
    expect(result[0]._enriquecido).toBeUndefined()
  })
})

// ─── parseHistoricoVeiculos / mesclarVeiculos ────────────────────────────────
// Validado em 2026-07-14 contra a API real (produto Veículos, não Localize).

describe('parseHistoricoVeiculos', () => {
  it('parseia o formato real de resposta.historicoVeiculos', () => {
    const raw = {
      resposta: {
        historicoVeiculos: [
          { placa: 'ABC1234', cidade: 'GOIANIA', uf: 'GO', renavam: '00475847520', anoFabricacao: '2012', anoModelo: '2013', procedencia: 'NACIONAL', especie: 'PASSAGEIRO', combustivel: 'ALCOOL/GASOLINA', cor: 'BRANCA', marcaModelo: 'VW/GOL 1.0' },
        ],
      },
    }
    const veiculos = parseHistoricoVeiculos(raw)
    expect(veiculos).toHaveLength(1)
    expect(veiculos[0].marca).toBe('VW')
    expect(veiculos[0].modelo).toBe('GOL 1.0')
    expect(veiculos[0].ano_fabricacao).toBe(2012)
    expect(typeof veiculos[0].ano_fabricacao).toBe('number')
  })

  it('retorna array vazio para entrada nula', () => {
    expect(parseHistoricoVeiculos(null)).toEqual([])
  })
})

describe('mesclarVeiculos', () => {
  it('histórico dedicado tem prioridade sobre o incidental do Localize na mesma placa', () => {
    const localize = [{ placa: 'ABC1234', marca: 'DESCONHECIDA' }]
    const historico = [{ placa: 'ABC1234', marca: 'VW', modelo: 'GOL' }]
    const result = mesclarVeiculos(localize, historico)
    expect(result).toHaveLength(1)
    expect(result[0].marca).toBe('VW')
  })

  it('mantém veículos de ambas as fontes quando placas são diferentes', () => {
    const result = mesclarVeiculos([{ placa: 'AAA1111' }], [{ placa: 'BBB2222' }])
    expect(result).toHaveLength(2)
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

// ─── parseAnalise360PJ / parseAnalise360PF ────────────────────────────────────
// Payload do callback assíncrono de /credito/v1/pj e /credito/v1/pf. Estrutura
// baseada no schema oficial (ResultPJ/ResultPF) — não testado ao vivo (exige
// webhook público, indisponível em dev local), mas segue exatamente os módulos
// documentados no swagger da Assertiva.

describe('parseAnalise360PJ', () => {
  it('parseia imóveis, score e quadro societário — único produto com imóveis', () => {
    const raw = {
      resposta: {
        modulos: {
          imoveis: {
            quantidadeTotal: 1,
            registros: [{ inscricao: '123', endereco: 'Rua X, 100', valorTerreno: 500000, valorImposto: 1200, usoTerreno: 'Comercial', anoConstrucao: 2010, area: 300, situacao: 'Regular' }],
          },
          score: { score: 650, idRange: 25 },
          limiteCredito: { valor: 50000 },
          quadroSocietario: { quantidadeTotal: 2 },
        },
      },
    }
    const result = parseAnalise360PJ(raw)
    expect(result.tipo).toBe('pj')
    expect(result.imoveis).toHaveLength(1)
    expect(result.imoveis?.[0].endereco).toBe('Rua X, 100')
    expect(result.quantidade_imoveis).toBe(1)
    expect(result.score).toBe(650)
    expect(result.faixa_risco).toBe('C — Médio risco')
    expect(result.limite_credito_sugerido).toBe(50000)
    expect(result.quadro_societario_qtd).toBe(2)
  })

  it('retorna imóveis vazio quando módulo não vem na resposta', () => {
    const result = parseAnalise360PJ({ resposta: { modulos: {} } })
    expect(result.imoveis).toEqual([])
    expect(result.quantidade_imoveis).toBe(0)
  })

  it('parseia antifraude, reputação online, movimentações cadastrais e concorrência de segmento', () => {
    const raw = {
      resposta: {
        modulos: {
          antifraude: { score: 850 },
          reputacoes: {
            dados: [{
              tipo: 'google-meu-negocio', nome: 'SRS M Factoring', nota: { valor: 4.5, maximo: 5 },
              reputacao: 'Boa', telefone: '(62) 3245-6677', endereco: 'Rua X, 100', segmento: 'Serviços Financeiros',
              site: 'https://srsm.com.br', linkFonte: 'https://google.com/maps/...',
            }],
          },
          movimentacoes: {
            total: 1, status: 'Ativa',
            detalhamentos: [{
              data: '10/01/2026', titulo: 'Alteração de endereço',
              mudancas: [{ titulo: 'Endereço', descricao: 'Rua Antiga, 1 --> Rua Nova, 200' }],
            }],
          },
          concorrencias: {
            analiseHomonimia: 'Nenhuma homonímia relevante encontrada',
            segmentoAtuacao: 'Factoring e fomento mercantil',
            perfilSegmento: 'Empresas de pequeno porte',
            tendenciaSegmento: [{ data: 'Jan/26', valor: 12.5, descricao: 'Crescimento do segmento' }],
          },
        },
      },
    }
    const result = parseAnalise360PJ(raw)
    expect(result.antifraude_score).toBe(850)

    expect(result.reputacoes).toHaveLength(1)
    expect(result.reputacoes?.[0].nome).toBe('SRS M Factoring')
    expect(result.reputacoes?.[0].nota).toBe(4.5)
    expect(result.reputacoes?.[0].nota_maxima).toBe(5)
    expect(result.reputacoes?.[0].plataforma).toBe('google-meu-negocio')

    expect(result.movimentacoes).toHaveLength(1)
    expect(result.movimentacoes?.[0].titulo).toBe('Alteração de endereço')
    expect(result.movimentacoes?.[0].mudancas?.[0].descricao).toBe('Rua Antiga, 1 --> Rua Nova, 200')

    expect(result.concorrencia?.segmento_atuacao).toBe('Factoring e fomento mercantil')
    expect(result.concorrencia?.tendencia_segmento).toHaveLength(1)
    expect(result.concorrencia?.tendencia_segmento?.[0].valor).toBe(12.5)
  })

  it('deixa reputações, movimentações e concorrência undefined quando os módulos não vêm na resposta', () => {
    const result = parseAnalise360PJ({ resposta: { modulos: {} } })
    expect(result.reputacoes).toBeUndefined()
    expect(result.movimentacoes).toBeUndefined()
    expect(result.concorrencia).toBeUndefined()
    expect(result.antifraude_score).toBeUndefined()
  })
})

describe('parseAnalise360PF', () => {
  it('parseia perfil socioeconômico, dívida ativa da União, IRPF, benefícios e composição domiciliar', () => {
    const raw = {
      resposta: {
        modulos: {
          perfilSocioeconomico: {
            classeSocial: 'B', profissao: 'Engenheiro', profissaoFuncionarioPublico: true,
            profissaoFuncionarioPublicoInfo: { cargo: 'Analista', situacao: 'Ativo' },
            enderecoCidadeTipoImovel: 'Apartamento', enderecoCidadeTipoImportancia: 'Capital',
            profissaoQtdeEmpresasTrabalhadas: 3, empresarioQtdeEmpresasAbertas: 1,
            empresarioTipo: 'MEI', empresarioCNAEDescAtuacao: 'Comércio varejista',
            enderecoMelhoriaMoradia: 'Melhoria identificada nos últimos 12 meses',
            enderecoClasseSocialCep: 'B2',
          },
          antifraude: { score: 720 },
          dividasAtivasUniao: {
            quantidadeTotal: 1, valorTotal: 3200,
            registros: [{ tipo: 'IPTU', numeroInscricao: 999, situacao: 'Em cobrança', uf: 'SP', entidadeResponsavel: 'PGFN', data: '10/01/2025', valor: 3200 }],
          },
          restituicaoIRPF: { ano: 2025, idStatus: 1 },
          beneficios: { quantidadeTotal: 1, valorTotal: 600, registros: [{ nome: 'Bolsa Família', data: '05/06/2026', valor: 600 }] },
          composicaoDomiciliar: { idPurchasingPower: 3, idHouseholdingSize: 5, rendaPresumida: 4000, isFamilyLeader: true },
          limiteCredito: { valor: 8000 },
          score: { score: 720, idRange: 2 },
        },
      },
    }

    const result = parseAnalise360PF(raw)
    expect(result.tipo).toBe('pf')

    expect(result.perfil_socioeconomico?.classe_social).toBe('B')
    expect(result.perfil_socioeconomico?.funcionario_publico).toBe(true)
    expect(result.perfil_socioeconomico?.cargo_publico).toBe('Analista')
    expect(result.perfil_socioeconomico?.qtd_empresas_trabalhadas).toBe(3)
    expect(result.perfil_socioeconomico?.empresario_qtd_empresas_abertas).toBe(1)
    expect(result.perfil_socioeconomico?.empresario_tipo).toBe('MEI')
    expect(result.perfil_socioeconomico?.empresario_cnae_atuacao).toBe('Comércio varejista')
    expect(result.perfil_socioeconomico?.melhoria_moradia).toBe('Melhoria identificada nos últimos 12 meses')
    expect(result.perfil_socioeconomico?.classe_social_cep).toBe('B2')
    expect(result.antifraude_score).toBe(720)

    expect(result.dividas_uniao).toHaveLength(1)
    expect(result.dividas_uniao?.[0].tipo).toBe('IPTU')
    expect(result.valor_total_dividas_uniao).toBe(3200)

    expect(result.restituicao_irpf_ano).toBe(2025)
    expect(result.restituicao_irpf_status).toBe('Imposto a receber por depósito em conta corrente')

    expect(result.beneficios).toHaveLength(1)
    expect(result.beneficios?.[0].nome).toBe('Bolsa Família')
    expect(result.valor_total_beneficios).toBe(600)

    expect(result.composicao_domiciliar?.poder_compra).toBe('Médio')
    expect(result.composicao_domiciliar?.lider_familia).toBe(true)

    expect(result.limite_credito_sugerido).toBe(8000)
    expect(result.score).toBe(720)
    expect(result.faixa_risco).toBe('B — Médio-baixo risco')
  })

  it('não quebra quando nenhum módulo vem na resposta', () => {
    const result = parseAnalise360PF({ resposta: { modulos: {} } })
    expect(result.tipo).toBe('pf')
    expect(result.dividas_uniao).toEqual([])
    expect(result.beneficios).toEqual([])
    expect(result.perfil_socioeconomico).toBeUndefined()
  })
})
