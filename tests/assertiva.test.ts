import test from 'node:test';
import assert from 'node:assert';
import {
  parseLocalizePf,
  parseLocalizePj,
  parseMixPf,
  parseMixPj,
  mergeData,
  calcularTotais
} from '../src/app/api/assertiva/relatorio/route';

test('Assertiva Parsers - unit tests', async (t) => {

  await t.test('parseLocalizePf parses basic info, veiculos, and vinculos successfully', () => {
    const mockRawResponse = {
      resposta: {
        dadosCadastrais: {
          nome: 'GUSTAVO GOMES FRANCO LEITE',
          dataNascimento: '2004-11-26',
          sexo: 'M',
          situacaoCadastral: 'REGULAR',
          obitoProvavel: false,
          ppe: true
        },
        enderecos: [
          {
            tipoLogradouro: 'RUA',
            logradouro: 'DOS MARISTAS',
            numero: '123',
            bairro: 'CENTRO',
            cidade: 'GOIANIA',
            uf: 'GO',
            cep: '74000-000'
          }
        ],
        telefones: {
          moveis: [
            { numero: '992504174', aplicativos: { whatsApp: true }, operadora: 'CLARO' }
          ]
        },
        veiculos: [
          {
            placa: 'AAA0A00',
            marca: 'VOLKSWAGEN',
            modelo: 'GOL',
            anoFabricacao: '2020',
            anoModelo: '2021',
            cor: 'BRANCO',
            situacao: 'SEM RESTRICAO',
            tipo: 'AUTOMOVEL',
            combustivel: 'FLEX',
            cidade: 'GOIANIA',
            uf: 'GO'
          }
        ],
        vinculos: [
          {
            nome: 'MARIA FRANCO LEITE',
            cpf: '11122233344',
            tipo: 'MAE',
            parentesco: 'Familiar'
          }
        ]
      }
    };

    const parsed = parseLocalizePf(mockRawResponse);

    assert.strictEqual(parsed.nome, 'GUSTAVO GOMES FRANCO LEITE');
    assert.strictEqual(parsed.pep, true);
    assert.strictEqual(parsed.indicador_obito, false);
    assert.strictEqual(parsed.situacao_cpf, 'REGULAR');
    assert.strictEqual(parsed.data_nascimento, '2004-11-26');

    // Verify veiculos
    assert.ok(Array.isArray(parsed.veiculos));
    assert.strictEqual(parsed.veiculos.length, 1);
    assert.strictEqual(parsed.veiculos[0].placa, 'AAA0A00');
    assert.strictEqual(parsed.veiculos[0].modelo, 'GOL');
    assert.strictEqual(parsed.veiculos[0].ano_fabricacao, 2020);

    // Verify vinculos
    assert.ok(Array.isArray(parsed.vinculos));
    assert.strictEqual(parsed.vinculos.length, 1);
    assert.strictEqual(parsed.vinculos[0].nome, 'MARIA FRANCO LEITE');
    assert.strictEqual(parsed.vinculos[0].tipo, 'MAE');
  });

  await t.test('parseLocalizePj parses legal entities, veiculos, and vinculos successfully', () => {
    const mockRawResponse = {
      resposta: {
        dadosCadastrais: {
          razaoSocial: 'GRUPO SRSM LTDA',
          nomeFantasia: 'EMPORIO SRSM',
          situacaoCadastral: 'ATIVA',
          capitalSocial: 100000
        },
        veiculos: [
          {
            placa: 'BBB1B11',
            marca: 'FORD',
            modelo: 'CARGO',
            anoFabricacao: '2018',
            cor: 'AZUL'
          }
        ],
        vinculos: [
          {
            nome: 'GUSTAVO GOMES',
            cpf: '00000000000',
            tipo: 'SOCIO'
          }
        ]
      }
    };

    const parsed = parseLocalizePj(mockRawResponse);

    assert.strictEqual(parsed.razao_social, 'GRUPO SRSM LTDA');
    assert.strictEqual(parsed.nome_fantasia, 'EMPORIO SRSM');
    assert.strictEqual(parsed.situacao_cnpj, 'ATIVA');

    // Verify veiculos
    assert.ok(Array.isArray(parsed.veiculos));
    assert.strictEqual(parsed.veiculos[0].placa, 'BBB1B11');
    assert.strictEqual(parsed.veiculos[0].marca, 'FORD');

    // Verify vinculos
    assert.ok(Array.isArray(parsed.vinculos));
    assert.strictEqual(parsed.vinculos[0].nome, 'GUSTAVO GOMES');
  });

  await t.test('parseMixPf parses score and debts details correctly', () => {
    const mockRawResponse = {
      resposta: {
        resumos: {
          debitos: { sumQuantidade: 3, sumValorTotal: 1500.00 },
          protestos: { sumQuantidade: 1, sumValorTotal: 300.00 }
        },
        ocorrencias: {
          score: { score: { pontos: 750, classe: 'B' } },
          debitos: [
            { credor: 'BANCO DO BRASIL', valor: 500, dataOcorrencia: '2026-01-10' }
          ],
          protestos: [
            { cartorio: '1º CARTORIO', valor: 300, data: '2026-02-15' }
          ]
        }
      }
    };

    const parsed = parseMixPf(mockRawResponse);

    assert.strictEqual(parsed.score, 750);
    assert.strictEqual(parsed.total_negativacoes, 3);
    assert.strictEqual(parsed.valor_total_negativacoes, 1500.00);
    assert.strictEqual(parsed.total_protestos, 1);
    assert.strictEqual(parsed.valor_total_protestos, 300.00);
  });

  await t.test('mergeData and calcularTotais consolidate multiple reports correctly', () => {
    const localizeData = {
      nome: 'GUSTAVO GOMES',
      veiculos: [{ placa: 'AAA0A00' }]
    };

    const mixData = {
      score: 800,
      total_negativacoes: 2,
      valor_total_negativacoes: 1000.00,
      total_protestos: 1,
      valor_total_protestos: 200.00
    };

    const merged = mergeData(localizeData, mixData);
    const totals = calcularTotais(merged);

    assert.strictEqual(merged.nome, 'GUSTAVO GOMES');
    assert.strictEqual(merged.score, 800);
    assert.strictEqual(merged.veiculos[0].placa, 'AAA0A00');
    assert.strictEqual(totals.total_dividas, 3);
    assert.strictEqual(totals.valor_total_dividas, 1200.00);
  });
});
