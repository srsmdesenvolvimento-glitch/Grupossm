export type ParcelaTabela = {
  numero_parcela: number
  data_vencimento: string
  valor_principal: number
  valor_juros: number
  valor_parcela: number
  saldo_devedor: number
}

export type ResultadoCalculo = {
  valor_parcela: number
  total_juros: number
  total_pagar: number
  tabela: ParcelaTabela[]
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function calcularJurosCompostos(
  valor: number,
  taxaMensal: number,
  meses: number,
  dataInicio: Date = new Date(),
  valorEntrada = 0,
): ResultadoCalculo {
  const principal = valor - valorEntrada
  if (principal <= 0 || meses <= 0) return { valor_parcela: 0, total_juros: 0, total_pagar: 0, tabela: [] }

  const r = taxaMensal / 100
  const pmt = r === 0
    ? principal / meses
    : (principal * r * Math.pow(1 + r, meses)) / (Math.pow(1 + r, meses) - 1)

  const parcela = Math.round(pmt * 100) / 100
  let saldo = principal
  const tabela: ParcelaTabela[] = []

  for (let i = 1; i <= meses; i++) {
    const juros = Math.round(saldo * r * 100) / 100
    const principalParcela = i < meses ? Math.round((parcela - juros) * 100) / 100 : saldo
    const totalParcela = i < meses ? parcela : Math.round((principalParcela + juros) * 100) / 100
    saldo = Math.max(0, Math.round((saldo - principalParcela) * 100) / 100)

    tabela.push({
      numero_parcela: i,
      data_vencimento: formatISO(addMonths(dataInicio, i - 1)),
      valor_principal: principalParcela,
      valor_juros: juros,
      valor_parcela: totalParcela,
      saldo_devedor: saldo,
    })
  }

  const total_pagar = tabela.reduce((s, p) => s + p.valor_parcela, 0)
  return {
    valor_parcela: parcela,
    total_juros: Math.round((total_pagar - principal) * 100) / 100,
    total_pagar: Math.round(total_pagar * 100) / 100,
    tabela,
  }
}

export function calcularJurosSimples(
  valor: number,
  taxaMensal: number,
  meses: number,
  dataInicio: Date = new Date(),
  valorEntrada = 0,
): ResultadoCalculo {
  const principal = valor - valorEntrada
  if (principal <= 0 || meses <= 0) return { valor_parcela: 0, total_juros: 0, total_pagar: 0, tabela: [] }

  const r = taxaMensal / 100
  const totalJuros = principal * r * meses
  const totalPagar = principal + totalJuros
  const parcela = Math.round((totalPagar / meses) * 100) / 100
  const principalMensal = Math.round((principal / meses) * 100) / 100
  let saldo = principal
  const tabela: ParcelaTabela[] = []

  for (let i = 1; i <= meses; i++) {
    const juros = Math.round(principal * r * 100) / 100
    saldo = Math.max(0, Math.round((saldo - principalMensal) * 100) / 100)
    tabela.push({
      numero_parcela: i,
      data_vencimento: formatISO(addMonths(dataInicio, i - 1)),
      valor_principal: principalMensal,
      valor_juros: juros,
      valor_parcela: parcela,
      saldo_devedor: saldo,
    })
  }

  return {
    valor_parcela: parcela,
    total_juros: Math.round(totalJuros * 100) / 100,
    total_pagar: Math.round(totalPagar * 100) / 100,
    tabela,
  }
}

// Juros compostos diários: valor × (1 + taxaDiaria%)^dias − valor
// Idêntico ao que agiotas/financeiras cobram: o juro de hoje incide sobre o saldo de ontem
export function calcularJurosAtraso(
  valorOriginal: number,
  taxa: number,
  tipoTaxa: 'diario' | 'mensal',
  diasAtraso: number,
): number {
  if (diasAtraso <= 0) return 0
  const taxaDiaria = tipoTaxa === 'mensal' ? taxa / 100 / 30 : taxa / 100
  const montante = valorOriginal * Math.pow(1 + taxaDiaria, diasAtraso)
  return Math.round((montante - valorOriginal) * 100) / 100
}

// Calcula mora composta de uma parcela em atraso até hoje usando taxa diária (% puro, ex: 0.033)
export function calcularMoraHoje(
  valorParcela: number,
  dataVencimento: string,
  taxaDiariaPct: number,
): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  const dias = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000))
  if (dias === 0) return 0
  const taxaDiaria = taxaDiariaPct / 100
  const montante = valorParcela * Math.pow(1 + taxaDiaria, dias)
  return Math.round((montante - valorParcela) * 100) / 100
}

export function calcularMulta(valorOriginal: number, taxaMulta: number): number {
  return Math.round(valorOriginal * (taxaMulta / 100) * 100) / 100
}

export function calcularTotalDevido(
  valorOriginal: number,
  jurosAtraso: number,
  multa: number,
  desconto = 0,
): number {
  return Math.max(0, Math.round((valorOriginal + jurosAtraso + multa - desconto) * 100) / 100)
}

export function calcularCET(valor: number, totalPagar: number, meses: number): number {
  if (valor <= 0 || meses <= 0) return 0
  return Math.round(((Math.pow(totalPagar / valor, 1 / meses) - 1) * 100) * 100) / 100
}

// Juros compostos: taxa mensal → anual equivalente   ex: 5% a.m. → 79,59% a.a.
export function taxaMensalParaAnual(taxaMensal: number): number {
  return Math.round((Math.pow(1 + taxaMensal / 100, 12) - 1) * 10000) / 100
}

// Juros compostos: taxa anual → mensal equivalente   ex: 79,59% a.a. → 5% a.m.
export function taxaAnualParaMensal(taxaAnual: number): number {
  return Math.round((Math.pow(1 + taxaAnual / 100, 1 / 12) - 1) * 10000) / 100
}

// SAC — Sistema de Amortização Constante com juros compostos
// Amortização é fixa; juros decrescem conforme o saldo cai
export function calcularSAC(
  valor: number,
  taxaMensal: number,
  meses: number,
  dataInicio: Date = new Date(),
  valorEntrada = 0,
): ResultadoCalculo {
  const principal = valor - valorEntrada
  if (principal <= 0 || meses <= 0) return { valor_parcela: 0, total_juros: 0, total_pagar: 0, tabela: [] }

  const r = taxaMensal / 100
  const amortizacao = Math.round((principal / meses) * 100) / 100
  let saldo = principal
  const tabela: ParcelaTabela[] = []

  for (let i = 1; i <= meses; i++) {
    const juros = Math.round(saldo * r * 100) / 100
    const amortParcela = i < meses ? amortizacao : saldo
    const totalParcela = Math.round((amortParcela + juros) * 100) / 100
    saldo = Math.max(0, Math.round((saldo - amortParcela) * 100) / 100)
    tabela.push({
      numero_parcela: i,
      data_vencimento: formatISO(addMonths(dataInicio, i - 1)),
      valor_principal: amortParcela,
      valor_juros: juros,
      valor_parcela: totalParcela,
      saldo_devedor: saldo,
    })
  }

  const total_pagar = tabela.reduce((s, p) => s + p.valor_parcela, 0)
  return {
    valor_parcela: tabela[0]?.valor_parcela ?? 0,
    total_juros: Math.round((total_pagar - principal) * 100) / 100,
    total_pagar: Math.round(total_pagar * 100) / 100,
    tabela,
  }
}

// ---------------------------------------------------------------------------
// Score Engine — escala 0–100, base neutra 50, regras ponderadas configuráveis
// Inspirado no modelo Serasa/SCR: cada fator tem peso configurável e pode ser
// ativado/desativado individualmente pela empresa de crédito.
// ---------------------------------------------------------------------------

export type RegraScore = {
  id: string
  label: string
  descricao: string
  tipo: 'positivo' | 'negativo'
  peso: number
  ativo: boolean
  categoria: string
  limite_maximo_pontos: number
  ordem: number
}

export type FaixaRisco = {
  id: string
  nome: string
  min: number
  max: number
  cor: string
  recomendacao: 'aprovar' | 'analisar' | 'negar'
  limiteSugeridoPercentual: number
  taxaSugerida: number
}

export const REGRAS_SCORE_PADRAO: RegraScore[] = [
  // ── Histórico de Pagamento ────────────────────────────────────────────────
  { id: 'pagamentos_em_dia',        label: 'Pagamentos em dia',              descricao: '% de parcelas pagas pontualmente (≤ 0 dias de atraso)',    tipo: 'positivo', peso: 20, ativo: true, categoria: 'historico_pagamento', limite_maximo_pontos: 20, ordem: 1 },
  { id: 'pagamentos_antecipados',   label: 'Pagamentos antecipados',         descricao: 'Quitações realizadas antes do vencimento (> 5 dias)',       tipo: 'positivo', peso: 8,  ativo: true, categoria: 'historico_pagamento', limite_maximo_pontos: 8,  ordem: 2 },
  { id: 'sem_atraso_historico',     label: 'Sem histórico de atraso',        descricao: 'Cliente nunca registrou parcela em atraso',                 tipo: 'positivo', peso: 10, ativo: true, categoria: 'historico_pagamento', limite_maximo_pontos: 10, ordem: 3 },

  // ── Histórico de Contrato ─────────────────────────────────────────────────
  { id: 'emprestimos_quitados',     label: 'Empréstimos quitados',           descricao: 'Contratos encerrados com sucesso (aumenta por contrato)',   tipo: 'positivo', peso: 10, ativo: true, categoria: 'historico_contrato',  limite_maximo_pontos: 10, ordem: 4 },

  // ── Relacionamento Comercial ──────────────────────────────────────────────
  { id: 'volume_pago',              label: 'Volume total pago',              descricao: 'Relacionamento financeiro acumulado (> R$ 10 mil = máx)',   tipo: 'positivo', peso: 5,  ativo: true, categoria: 'relacionamento',      limite_maximo_pontos: 5,  ordem: 5 },
  { id: 'tempo_relacionamento',     label: 'Tempo de relacionamento',        descricao: 'Fidelidade medida em meses de histórico ativo',             tipo: 'positivo', peso: 7,  ativo: true, categoria: 'relacionamento',      limite_maximo_pontos: 7,  ordem: 6 },

  // ── Capacidade de Pagamento ───────────────────────────────────────────────
  { id: 'score_externo',            label: 'Score externo (Assertiva)',       descricao: 'Score bureau 0-1000 convertido proporcionalmente (fator)',  tipo: 'positivo', peso: 15, ativo: true, categoria: 'capacidade',          limite_maximo_pontos: 15, ordem: 7 },
  { id: 'renda_estimada',           label: 'Renda estimada adequada',        descricao: 'Renda Assertiva compatível com o histórico de crédito',    tipo: 'positivo', peso: 8,  ativo: true, categoria: 'capacidade',          limite_maximo_pontos: 8,  ordem: 8 },

  // ── Ficha Cadastral ───────────────────────────────────────────────────────
  { id: 'cadastro_completo',        label: 'Cadastro completo',              descricao: 'CPF, telefone, endereço e renda preenchidos',               tipo: 'positivo', peso: 5,  ativo: true, categoria: 'cadastro',            limite_maximo_pontos: 5,  ordem: 9 },
  { id: 'cadastro_incompleto',      label: 'Cadastro incompleto',            descricao: 'Dados cadastrais essenciais ausentes',                      tipo: 'negativo', peso: -5, ativo: true, categoria: 'cadastro',            limite_maximo_pontos: 5,  ordem: 10 },

  // ── Inadimplência Interna ─────────────────────────────────────────────────
  { id: 'atraso_atual',             label: 'Parcelas atrasadas atualmente',  descricao: 'Possui parcelas com status "atrasado" no momento',          tipo: 'negativo', peso: -20, ativo: true, categoria: 'inadimplencia',     limite_maximo_pontos: 20, ordem: 11 },
  { id: 'atraso_leve',              label: 'Histórico de atraso leve (1–30d)',descricao: 'Já teve parcelas pagas com 1 a 30 dias de atraso',         tipo: 'negativo', peso: -5,  ativo: true, categoria: 'inadimplencia',     limite_maximo_pontos: 5,  ordem: 12 },
  { id: 'atraso_moderado',          label: 'Atraso moderado (31–60 dias)',   descricao: 'Já teve parcelas pagas com 31 a 60 dias de atraso',         tipo: 'negativo', peso: -10, ativo: true, categoria: 'inadimplencia',     limite_maximo_pontos: 10, ordem: 13 },
  { id: 'atraso_severo',            label: 'Atraso severo (61–90 dias)',     descricao: 'Já teve parcelas pagas com 61 a 90 dias de atraso',         tipo: 'negativo', peso: -15, ativo: true, categoria: 'inadimplencia',     limite_maximo_pontos: 15, ordem: 14 },
  { id: 'atraso_critico',           label: 'Inadimplência crítica (90+ dias)',descricao: 'Histórico de atraso superior a 90 dias — risco máximo',    tipo: 'negativo', peso: -20, ativo: true, categoria: 'inadimplencia',     limite_maximo_pontos: 20, ordem: 15 },

  // ── Bureau de Crédito (Assertiva) ─────────────────────────────────────────
  { id: 'sem_restricoes_bureau',    label: 'Sem restrições no bureau',       descricao: 'Nenhuma negativação, protesto, CCF ou ação judicial',       tipo: 'positivo', peso: 10, ativo: true, categoria: 'bureau',             limite_maximo_pontos: 10, ordem: 16 },
  { id: 'negativacoes_assertiva',   label: 'Negativações no bureau',         descricao: 'Registros de negativação SPC/Serasa (escala por quantidade)',tipo: 'negativo', peso: -15, ativo: true, categoria: 'bureau',            limite_maximo_pontos: 15, ordem: 17 },
  { id: 'protestos_assertiva',      label: 'Protestos cartoriais',           descricao: 'Protestos em cartório registrados no bureau',               tipo: 'negativo', peso: -10, ativo: true, categoria: 'bureau',            limite_maximo_pontos: 10, ordem: 18 },
  { id: 'ccf_assertiva',            label: 'CCF — Cheques sem fundo',        descricao: 'Histórico de cheques devolvidos por insuficiência (CCF)',   tipo: 'negativo', peso: -10, ativo: true, categoria: 'bureau',            limite_maximo_pontos: 10, ordem: 19 },
  { id: 'acoes_judiciais_assertiva',label: 'Ações judiciais',                descricao: 'Processos judiciais em andamento ou histórico registrado',  tipo: 'negativo', peso: -12, ativo: true, categoria: 'bureau',            limite_maximo_pontos: 12, ordem: 20 },

  // ── Compliance e Restrições ───────────────────────────────────────────────
  { id: 'pep_assertiva',            label: 'Pessoa Politicamente Exposta',   descricao: 'Cliente classificado como PEP (risco regulatório alto)',    tipo: 'negativo', peso: -8,  ativo: true, categoria: 'compliance',        limite_maximo_pontos: 8,  ordem: 21 },
  { id: 'obito_assertiva',          label: 'Indicador de óbito',             descricao: 'Registro de óbito confirmado no bureau de crédito',         tipo: 'negativo', peso: -50, ativo: true, categoria: 'compliance',        limite_maximo_pontos: 50, ordem: 22 },

  // ── Status Administrativo ─────────────────────────────────────────────────
  { id: 'cliente_bloqueado',        label: 'Cliente bloqueado',              descricao: 'Status bloqueado administrativamente no sistema',           tipo: 'negativo', peso: -30, ativo: true, categoria: 'status',            limite_maximo_pontos: 30, ordem: 23 },
]

export const FAIXAS_RISCO_PADRAO: FaixaRisco[] = [
  { id: 'baixo',   nome: 'Baixo Risco', min: 70, max: 100, cor: '#16A34A', recomendacao: 'aprovar',  limiteSugeridoPercentual: 100, taxaSugerida: 4.5 },
  { id: 'medio',   nome: 'Médio Risco', min: 50, max: 69,  cor: '#D4A528', recomendacao: 'analisar', limiteSugeridoPercentual: 60,  taxaSugerida: 6.5 },
  { id: 'alto',    nome: 'Alto Risco',  min: 30, max: 49,  cor: '#F97316', recomendacao: 'analisar', limiteSugeridoPercentual: 30,  taxaSugerida: 8.5 },
  { id: 'critico', nome: 'Crítico',     min: 0,  max: 29,  cor: '#EF4444', recomendacao: 'negar',    limiteSugeridoPercentual: 0,   taxaSugerida: 0   },
]

export type DadosScore = {
  total_parcelas: number
  pagas_pontualmente: number
  pagas_antecipado: number
  emprestimos_quitados: number
  parcelas_atrasadas_atuais: number
  max_dias_atraso: number
  pagas_com_atraso_leve?: number       // pagas com 1–30 dias de atraso
  pagas_com_atraso_moderado?: number   // pagas com 31–60 dias de atraso
  pagas_com_atraso_severo?: number     // pagas com 61–90 dias de atraso
  tempo_relacionamento_meses?: number  // meses desde o primeiro contrato
  cliente_bloqueado?: boolean
  cadastro_completo?: boolean
  volume_total_pago?: number
  assertiva_score?: number | null     // escala 0-1000 (Assertiva)
  assertiva_negativacoes?: number
  assertiva_protestos?: number
  assertiva_ccf?: number
  assertiva_acoes_judiciais?: number
  assertiva_pep?: boolean
  assertiva_obito?: boolean
  assertiva_renda_estimada?: number | null
  assertiva_capacidade_pagamento?: number | null
}

export type FatorScore = {
  id: string
  tipo: 'positivo' | 'negativo' | 'neutro'
  label: string
  descricao: string
  pontos: number
  peso: number
  ativo: boolean
  categoria: string
}

export type ResultadoScore = {
  score: number
  nivel: 'baixo' | 'medio' | 'alto' | 'critico'
  faixa: FaixaRisco
  limiteSugerido?: number
  taxaSugerida?: number
  recomendacao: 'aprovar' | 'analisar' | 'negar'
  fatores: FatorScore[]
}

// Ponto neutro de partida. As regras somam ou subtraem a partir daqui.
const SCORE_BASE = 50

export function calcularScore(
  dados: DadosScore,
  regrasCustom?: RegraScore[],
  faixasCustom?: FaixaRisco[],
  limiteCredito?: number,
): ResultadoScore {
  const regras = (regrasCustom ?? REGRAS_SCORE_PADRAO).filter(r => r.ativo)
  const faixas = faixasCustom ?? FAIXAS_RISCO_PADRAO

  let pontos = SCORE_BASE
  const fatores: FatorScore[] = []

  for (const regra of regras.sort((a, b) => a.ordem - b.ordem)) {
    let contribuicao = 0

    switch (regra.id) {

      // ── Histórico de Pagamento ────────────────────────────────────────────
      case 'pagamentos_em_dia':
        if (dados.total_parcelas > 0) {
          const pct = dados.pagas_pontualmente / dados.total_parcelas
          contribuicao = Math.round(pct * regra.peso)
        }
        break

      case 'pagamentos_antecipados':
        if (dados.pagas_antecipado > 0) {
          contribuicao = Math.min(regra.peso, dados.pagas_antecipado * Math.ceil(regra.peso / 5))
        }
        break

      case 'sem_atraso_historico':
        if (dados.total_parcelas > 0 && dados.max_dias_atraso === 0 && dados.parcelas_atrasadas_atuais === 0) {
          contribuicao = regra.peso
        }
        break

      // ── Histórico de Contrato ─────────────────────────────────────────────
      case 'emprestimos_quitados':
        if (dados.emprestimos_quitados > 0) {
          contribuicao = Math.min(regra.peso, dados.emprestimos_quitados * Math.ceil(regra.peso / 3))
        }
        break

      // ── Relacionamento Comercial ──────────────────────────────────────────
      case 'volume_pago': {
        const vol = dados.volume_total_pago ?? 0
        if (vol >= 50000)      contribuicao = regra.peso
        else if (vol >= 10000) contribuicao = Math.round(regra.peso * 0.8)
        else if (vol >= 1000)  contribuicao = Math.round(regra.peso * 0.4)
        break
      }

      case 'tempo_relacionamento': {
        const meses = dados.tempo_relacionamento_meses ?? 0
        if (meses >= 24)      contribuicao = regra.peso
        else if (meses >= 12) contribuicao = Math.round(regra.peso * 0.7)
        else if (meses >= 6)  contribuicao = Math.round(regra.peso * 0.4)
        else if (meses >= 1)  contribuicao = Math.round(regra.peso * 0.2)
        break
      }

      // ── Capacidade de Pagamento ───────────────────────────────────────────
      case 'score_externo':
        // Assertiva 0-1000 → contribuição proporcional ao peso configurado
        if (dados.assertiva_score != null && dados.assertiva_score > 0) {
          contribuicao = Math.round((dados.assertiva_score / 1000) * regra.peso)
        }
        break

      case 'renda_estimada':
        if (dados.assertiva_renda_estimada && dados.assertiva_renda_estimada > 0) {
          if (dados.assertiva_renda_estimada >= 5000)      contribuicao = regra.peso
          else if (dados.assertiva_renda_estimada >= 2000) contribuicao = Math.round(regra.peso * 0.7)
          else if (dados.assertiva_renda_estimada >= 1000) contribuicao = Math.round(regra.peso * 0.4)
        }
        break

      // ── Ficha Cadastral ───────────────────────────────────────────────────
      case 'cadastro_completo':
        contribuicao = dados.cadastro_completo ? regra.peso : 0
        break

      case 'cadastro_incompleto':
        contribuicao = dados.cadastro_completo ? 0 : regra.peso
        break

      // ── Inadimplência Interna ─────────────────────────────────────────────
      case 'atraso_atual':
        if (dados.parcelas_atrasadas_atuais > 0) {
          const fator = Math.min(1, dados.parcelas_atrasadas_atuais / 3)
          contribuicao = Math.round(regra.peso * fator)
        }
        break

      case 'atraso_leve':
        contribuicao = (dados.pagas_com_atraso_leve ?? 0) > 0 ? regra.peso : 0
        break

      case 'atraso_moderado':
        contribuicao = (dados.pagas_com_atraso_moderado ?? 0) > 0 ? regra.peso : 0
        break

      case 'atraso_severo':
        contribuicao = (dados.pagas_com_atraso_severo ?? 0) > 0 ? regra.peso : 0
        break

      case 'atraso_critico':
        contribuicao = dados.max_dias_atraso > 90 ? regra.peso : 0
        break

      // ── Bureau de Crédito (Assertiva) ─────────────────────────────────────
      case 'sem_restricoes_bureau': {
        const semRestricao =
          (dados.assertiva_negativacoes ?? 0) === 0 &&
          (dados.assertiva_protestos ?? 0) === 0 &&
          (dados.assertiva_ccf ?? 0) === 0 &&
          (dados.assertiva_acoes_judiciais ?? 0) === 0
        // Só aplica bônus se tiver dados do bureau disponíveis
        contribuicao = semRestricao && dados.assertiva_score != null ? regra.peso : 0
        break
      }

      case 'negativacoes_assertiva': {
        const qtdNeg = dados.assertiva_negativacoes ?? 0
        if (qtdNeg >= 5)      contribuicao = regra.peso
        else if (qtdNeg >= 2) contribuicao = Math.round(regra.peso * 0.7)
        else if (qtdNeg >= 1) contribuicao = Math.round(regra.peso * 0.4)
        break
      }

      case 'protestos_assertiva':
        contribuicao = (dados.assertiva_protestos ?? 0) > 0 ? regra.peso : 0
        break

      case 'ccf_assertiva':
        contribuicao = (dados.assertiva_ccf ?? 0) > 0 ? regra.peso : 0
        break

      case 'acoes_judiciais_assertiva': {
        const qtdAcoes = dados.assertiva_acoes_judiciais ?? 0
        if (qtdAcoes >= 3)    contribuicao = regra.peso
        else if (qtdAcoes > 0) contribuicao = Math.round(regra.peso * 0.6)
        break
      }

      // ── Compliance ────────────────────────────────────────────────────────
      case 'pep_assertiva':
        contribuicao = dados.assertiva_pep ? regra.peso : 0
        break

      case 'obito_assertiva':
        contribuicao = dados.assertiva_obito ? regra.peso : 0
        break

      // ── Status Administrativo ─────────────────────────────────────────────
      case 'cliente_bloqueado':
        contribuicao = dados.cliente_bloqueado ? regra.peso : 0
        break

      default:
        contribuicao = 0
    }

    pontos += contribuicao
    if (contribuicao !== 0) {
      fatores.push({
        id: regra.id,
        tipo: contribuicao > 0 ? 'positivo' : 'negativo',
        label: regra.label,
        descricao: regra.descricao,
        pontos: Math.round(contribuicao),
        peso: regra.peso,
        ativo: regra.ativo,
        categoria: regra.categoria,
      })
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(pontos)))
  const faixa = faixas.find(f => score >= f.min && score <= f.max) ?? faixas[faixas.length - 1]

  const limiteSugerido = limiteCredito
    ? Math.round(limiteCredito * (faixa.limiteSugeridoPercentual / 100))
    : undefined

  return {
    score,
    nivel: faixa.id as ResultadoScore['nivel'],
    faixa,
    limiteSugerido,
    taxaSugerida: faixa.taxaSugerida,
    recomendacao: faixa.recomendacao,
    fatores: fatores.sort((a, b) => Math.abs(b.pontos) - Math.abs(a.pontos)),
  }
}
