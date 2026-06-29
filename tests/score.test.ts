import test from 'node:test';
import assert from 'node:assert';
import { calcularScore, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO } from '../src/lib/utils/calculos';

const dadosBase = {
  total_parcelas: 0,
  pagas_pontualmente: 0,
  pagas_antecipado: 0,
  emprestimos_quitados: 0,
  parcelas_atrasadas_atuais: 0,
  max_dias_atraso: 0,
  pagas_com_atraso_leve: 0,
  pagas_com_atraso_moderado: 0,
  pagas_com_atraso_severo: 0,
  tempo_relacionamento_meses: 0,
  cliente_bloqueado: false,
  cadastro_completo: false,
  volume_total_pago: 0,
  assertiva_score: null as number | null,
}

test('Score Engine — motor de score ponderado base 50', async (t) => {

  await t.test('Sem dados e sem Assertiva: base 50 menos cadastro incompleto = 45', () => {
    const result = calcularScore(dadosBase, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO)
    // base(50) - cadastro_incompleto(-5) = 45
    assert.strictEqual(result.score, 45, 'Deveria ser 45: base 50 menos -5 cadastro incompleto')
    assert.strictEqual(result.nivel, 'alto', 'Score 45 está em Alto Risco (30–49)')
    assert.strictEqual(result.recomendacao, 'analisar')
  })

  await t.test('Histórico perfeito com Assertiva alta → score máximo (100)', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 10,
      pagas_pontualmente: 10,
      emprestimos_quitados: 2,
      cadastro_completo: true,
      volume_total_pago: 12000,
      assertiva_score: 800,
    }
    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO)
    // base(50)+pagamentos_em_dia(20)+sem_atraso_historico(10)+emprestimos_quitados(8)
    // +volume_pago(4)+score_externo(12)+cadastro_completo(5)+sem_restricoes_bureau(10) = 119 → 100
    assert.strictEqual(result.score, 100, 'Score deve ser limitado a 100')
    assert.strictEqual(result.nivel, 'baixo')
    assert.strictEqual(result.recomendacao, 'aprovar')
  })

  await t.test('Parcelas atrasadas + cliente bloqueado → score crítico (≤ 30)', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 10,
      pagas_pontualmente: 5,
      parcelas_atrasadas_atuais: 3,
      max_dias_atraso: 95,
      pagas_com_atraso_severo: 2,
      cliente_bloqueado: true,
      cadastro_completo: true,
      volume_total_pago: 1000,
      assertiva_score: 500,
    }
    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO)
    // base(50)+pagamentos_em_dia(10)+volume_pago(2)+score_externo(8)+cadastro_completo(5)
    // +sem_restricoes_bureau(10) - atraso_atual(-20) - atraso_severo(-15) - atraso_critico(-20) - cliente_bloqueado(-30) = 0
    assert.ok(result.score <= 30, `Score deve ser crítico, obtido: ${result.score}`)
    assert.strictEqual(result.nivel, 'critico')
    assert.strictEqual(result.recomendacao, 'negar')
  })

  await t.test('Peso customizado de cadastro_completo = 30 → score máximo', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 10,
      pagas_pontualmente: 10,
      cadastro_completo: true,
      assertiva_score: 700,
    }
    const customRules = REGRAS_SCORE_PADRAO.map(r =>
      r.id === 'cadastro_completo' ? { ...r, peso: 30 } : r
    )
    const result = calcularScore(dados, customRules, FAIXAS_RISCO_PADRAO)
    assert.strictEqual(result.score, 100, 'Peso customizado deve levar ao cap de 100')
  })

  await t.test('Regras desativadas não contribuem para o score', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 10,
      pagas_pontualmente: 10,
      cadastro_completo: true,
      assertiva_score: 700,
    }
    const customRules = REGRAS_SCORE_PADRAO.map(r =>
      (r.id === 'sem_restricoes_bureau' || r.id === 'cadastro_completo') ? { ...r, ativo: false } : r
    )
    const result = calcularScore(dados, customRules, FAIXAS_RISCO_PADRAO)
    // base(50)+pagamentos_em_dia(20)+sem_atraso_historico(10)+score_externo(round(700/1000*15)=11) = 91
    assert.strictEqual(result.score, 91, 'Regras inativas não devem pontuar')
  })

  await t.test('Limite sugerido e taxa calculados corretamente pela faixa de risco', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 10,
      pagas_pontualmente: 8,
      emprestimos_quitados: 1,
      cadastro_completo: true,
      volume_total_pago: 2000,
      assertiva_score: 650,
    }
    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO, 15000)
    assert.ok(result.faixa, 'Deve retornar faixa de risco')
    assert.ok(result.limiteSugerido !== undefined, 'Deve calcular limite sugerido')
    assert.ok(result.taxaSugerida !== undefined, 'Deve calcular taxa sugerida')
    const expectedLimit = Math.round(15000 * (result.faixa.limiteSugeridoPercentual / 100))
    assert.strictEqual(result.limiteSugerido, expectedLimit, 'Limite sugerido deve bater com o percentual da faixa')
  })

  await t.test('Assertiva score 0 não trava o score em zero (motor independente)', () => {
    const dados = {
      ...dadosBase,
      total_parcelas: 5,
      pagas_pontualmente: 5,
      cadastro_completo: true,
      assertiva_score: 0,
    }
    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO)
    // Assertiva=0 contribui 0 para score_externo, mas base é 50 e demais fatores positivos somam
    // Nunca deve travar em 0 só por causa da Assertiva
    assert.ok(result.score > 0, `Assertiva=0 não deve zerar o score, obtido: ${result.score}`)
    assert.ok(result.score >= 50, `Base neutra de 50 deve ser mantida sem penalidades, obtido: ${result.score}`)
  })
})
