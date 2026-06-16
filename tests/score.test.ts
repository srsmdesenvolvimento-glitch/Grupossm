import test from 'node:test';
import assert from 'node:assert';
import { calcularScore, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO } from '../src/lib/utils/calculos';

test('Score Engine - calcularScore unit tests', async (t) => {

  await t.test('Initial base score when Assertiva is unavailable defaults to 50', () => {
    const dados = {
      total_parcelas: 0,
      pagas_pontualmente: 0,
      pagas_antecipado: 0,
      emprestimos_quitados: 0,
      parcelas_atrasadas_atuais: 0,
      max_dias_atraso: 0,
      cliente_bloqueado: false,
      cadastro_completo: false,
      volume_total_pago: 0,
      assertiva_score: null,
    };

    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO);
    // base (50) - incomplete (-5) + default volume partial bonus (3) = 48
    assert.strictEqual(result.score, 48, 'Should calculate initial score as 48 when Assertiva is null and cadastro is incomplete');
    assert.strictEqual(result.nivel, 'alto', 'Should fall under Alto Risco (48 points)');
    assert.strictEqual(result.recomendacao, 'analisar', 'Should suggest analyzing');
  });

  await t.test('Calculates positive points for perfect payments history and completed cadastro', () => {
    const dados = {
      total_parcelas: 10,
      pagas_pontualmente: 10,
      pagas_antecipado: 0,
      emprestimos_quitados: 2,
      parcelas_atrasadas_atuais: 0,
      max_dias_atraso: 0,
      cliente_bloqueado: false,
      cadastro_completo: true,
      volume_total_pago: 12000,
      assertiva_score: 800, // base score 80
    };

    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO);
    // base (80) 
    // + pagamentos_em_dia (20)
    // + volume_pago (5)
    // + cadastro_completo (5)
    // + sem_restricoes_assertiva (10)
    // = 100 maxed out
    assert.strictEqual(result.score, 100, 'Score should be 100 (capped)');
    assert.strictEqual(result.nivel, 'baixo', 'Should fall under Baixo Risco');
    assert.strictEqual(result.recomendacao, 'aprovar', 'Should suggest approving');
  });

  await t.test('Calculates negative points for late payments and blocked status', () => {
    const dados = {
      total_parcelas: 10,
      pagas_pontualmente: 5,
      pagas_antecipado: 0,
      emprestimos_quitados: 0,
      parcelas_atrasadas_atuais: 3,
      max_dias_atraso: 95,
      cliente_bloqueado: true,
      cadastro_completo: true,
      volume_total_pago: 1000,
      assertiva_score: 500, // base score 50
    };

    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO);
    // Should be low and critical due to multiple late payments and blocked status
    assert.ok(result.score <= 30, 'Score should be critical');
    assert.strictEqual(result.nivel, 'critico', 'Should fall under Crítico');
    assert.strictEqual(result.recomendacao, 'negar', 'Should recommend denying loan');
  });

  await t.test('Custom score rules override default weights and status', () => {
    const dados = {
      total_parcelas: 10,
      pagas_pontualmente: 10,
      pagas_antecipado: 0,
      emprestimos_quitados: 0,
      parcelas_atrasadas_atuais: 0,
      max_dias_atraso: 0,
      cliente_bloqueado: false,
      cadastro_completo: true,
      volume_total_pago: 0,
      assertiva_score: 700, // base 70
    };

    // Define custom rules where "cadastro_completo" has a weight of 30 instead of 5
    const customRules = REGRAS_SCORE_PADRAO.map(r => {
      if (r.id === 'cadastro_completo') {
        return { ...r, peso: 30 };
      }
      return r;
    });

    const result = calcularScore(dados, customRules, FAIXAS_RISCO_PADRAO);
    // Base 70 + cadastro_completo (30) + sem_restricoes_assertiva (10) = 100 (capped)
    assert.strictEqual(result.score, 100, 'Score should use custom weight and cap at 100');
  });

  await t.test('Inactive rules do not contribute to score calculations', () => {
    const dados = {
      total_parcelas: 10,
      pagas_pontualmente: 10,
      pagas_antecipado: 0,
      emprestimos_quitados: 0,
      parcelas_atrasadas_atuais: 0,
      max_dias_atraso: 0,
      cliente_bloqueado: false,
      cadastro_completo: true,
      volume_total_pago: 0,
      assertiva_score: 700, // base 70
    };

    // Deactivate "sem_restricoes_assertiva" and "cadastro_completo"
    const customRules = REGRAS_SCORE_PADRAO.map(r => {
      if (r.id === 'sem_restricoes_assertiva' || r.id === 'cadastro_completo') {
        return { ...r, ativo: false };
      }
      return r;
    });

    const result = calcularScore(dados, customRules, FAIXAS_RISCO_PADRAO);
    // Base 70 + pagamentos_em_dia (20) + volume_pago partial (3) = 93
    assert.strictEqual(result.score, 93, 'Inactive rules should not add points');
  });

  await t.test('Calculates suggested limits and rates accurately based on risk band', () => {
    const dados = {
      total_parcelas: 10,
      pagas_pontualmente: 8,
      pagas_antecipado: 0,
      emprestimos_quitados: 1,
      parcelas_atrasadas_atuais: 0,
      max_dias_atraso: 0,
      cliente_bloqueado: false,
      cadastro_completo: true,
      volume_total_pago: 2000,
      assertiva_score: 650, // base 65
    };

    const result = calcularScore(dados, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO, 15000);
    // Let's verify the suggestions are based on the risk band
    assert.ok(result.faixa, 'Should return matching risk band');
    assert.ok(result.limiteSugerido !== undefined, 'Should compute suggested limit');
    assert.ok(result.taxaSugerida !== undefined, 'Should compute suggested monthly interest rate');
    
    const expectedLimit = Math.round(15000 * (result.faixa.limiteSugeridoPercentual / 100));
    assert.strictEqual(result.limiteSugerido, expectedLimit, 'Suggested limit should match risk band percent');
  });
});
