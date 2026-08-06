import { describe, it, expect } from 'vitest'
import { calcularCamposOrigemManual, extrairValoresParaOrigem } from '../origemDados'
import type { RelatorioCompleto } from '@/lib/assertiva/types'

describe('calcularCamposOrigemManual', () => {
  it('não marca nada quando os valores atuais batem com os da Assertiva', () => {
    const atuais = { nome: 'JOÃO SILVA', telefone: '(11) 99999-0000' }
    const daApi = { nome: 'JOÃO SILVA', telefone: '(11) 99999-0000' }
    expect(calcularCamposOrigemManual(atuais, daApi)).toEqual([])
  })

  it('marca como manual quando o valor difere do que a Assertiva mandou', () => {
    const atuais = { nome: 'JOÃO SILVA', telefone: '(11) 98888-1111' }
    const daApi = { nome: 'JOÃO SILVA', telefone: '(11) 99999-0000' }
    expect(calcularCamposOrigemManual(atuais, daApi)).toEqual(['telefone'])
  })

  it('marca como manual um campo preenchido que a Assertiva deixou vazio', () => {
    const atuais = { nome: 'JOÃO SILVA', profissao: 'Pedreiro' }
    const daApi = { nome: 'JOÃO SILVA' }
    expect(calcularCamposOrigemManual(atuais, daApi)).toEqual(['profissao'])
  })

  it('não marca campo vazio mesmo sem valor da Assertiva', () => {
    const atuais = { nome: 'JOÃO SILVA', profissao: '' }
    const daApi = { nome: 'JOÃO SILVA' }
    expect(calcularCamposOrigemManual(atuais, daApi)).toEqual([])
  })

  it('ignora espaços em branco na comparação', () => {
    const atuais = { nome: '  JOÃO SILVA  ' }
    const daApi = { nome: 'JOÃO SILVA' }
    expect(calcularCamposOrigemManual(atuais, daApi)).toEqual([])
  })
})

describe('extrairValoresParaOrigem', () => {
  it('retorna objeto vazio para entrada nula', () => {
    expect(extrairValoresParaOrigem(null)).toEqual({})
    expect(extrairValoresParaOrigem(undefined)).toEqual({})
  })

  it('extrai nome, telefone (celular com whatsapp priorizado) e endereço', () => {
    const raw: Partial<RelatorioCompleto> = {
      nome: 'MARIA OLIVEIRA',
      telefones: [
        { ddd: '11', numero: '32441234', tipo: 'Fixo' } as any,
        { ddd: '11', numero: '999990000', tipo: 'Celular', whatsapp: true } as any,
      ],
      enderecos: [{ logradouro: 'Rua das Flores', numero: '100', bairro: 'Centro', municipio: 'SP', uf: 'SP', cep: '01001000' }],
    }
    const v = extrairValoresParaOrigem(raw as RelatorioCompleto)
    expect(v.nome).toBe('MARIA OLIVEIRA')
    expect(v.telefone).toBe('(11) 99999-0000')
    expect(v.cep).toBe('01001-000')
    expect(v.endereco).toBe('Rua das Flores')
    expect(v.bairro).toBe('Centro')
    expect(v.cidade).toBe('SP')
    expect(v.estado).toBe('SP')
  })

  it('normaliza estado civil da API pro valor usado no select do formulário', () => {
    expect(extrairValoresParaOrigem({ estado_civil_api: 'Casado(a)' } as RelatorioCompleto).estado_civil).toBe('casado')
    expect(extrairValoresParaOrigem({ estado_civil_api: 'Solteiro' } as RelatorioCompleto).estado_civil).toBe('solteiro')
    expect(extrairValoresParaOrigem({ estado_civil_api: 'União Estável' } as RelatorioCompleto).estado_civil).toBe('uniao_estavel')
  })

  it('usa faturamento_presumido como fallback de renda quando renda_estimada não existe (PJ)', () => {
    const v = extrairValoresParaOrigem({ faturamento_presumido: 5000 } as RelatorioCompleto)
    expect(v.renda_mensal).toBeTruthy()
  })
})
