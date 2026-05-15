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
      data_vencimento: formatISO(addMonths(dataInicio, i)),
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
      data_vencimento: formatISO(addMonths(dataInicio, i)),
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

export function calcularJurosAtraso(
  valorOriginal: number,
  taxa: number,
  tipoTaxa: 'diario' | 'mensal',
  diasAtraso: number,
): number {
  if (diasAtraso <= 0) return 0
  const taxaDiaria = tipoTaxa === 'mensal' ? taxa / 100 / 30 : taxa / 100
  return Math.round(valorOriginal * taxaDiaria * diasAtraso * 100) / 100
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

// ---------------------------------------------------------------------------
// Score Engine — 0–100 scale with configurable weighted rules
// ---------------------------------------------------------------------------

export type RegraScore = {
  id: string
  label: string
  descricao: string
  tipo: 'positivo' | 'negativo'
  peso: number           // max points this rule contributes (+ or -)
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
  { id: 'pagamentos_em_dia', label: 'Pagamentos em dia', descricao: 'Bom histórico de pontualidade', tipo: 'positivo', peso: 25, ativo: true, categoria: 'historico_pagamento', limite_maximo_pontos: 25, ordem: 1 },
  { id: 'pagamentos_antecipados', label: 'Pagamentos antecipados', descricao: 'Quitações antes do vencimento', tipo: 'positivo', peso: 10, ativo: true, categoria: 'historico_pagamento', limite_maximo_pontos: 10, ordem: 2 },
  { id: 'emprestimos_quitados', label: 'Empréstimos quitados', descricao: 'Contratos encerrados com sucesso', tipo: 'positivo', peso: 15, ativo: true, categoria: 'historico_contrato', limite_maximo_pontos: 15, ordem: 3 },
  { id: 'volume_pago', label: 'Volume total pago', descricao: 'Relacionamento financeiro consolidado', tipo: 'positivo', peso: 5, ativo: true, categoria: 'relacionamento', limite_maximo_pontos: 5, ordem: 4 },
  { id: 'cadastro_completo', label: 'Cadastro completo', descricao: 'Todos os dados preenchidos', tipo: 'positivo', peso: 5, ativo: true, categoria: 'cadastro', limite_maximo_pontos: 5, ordem: 5 },
  { id: 'atraso_atual', label: 'Parcelas atrasadas atuais', descricao: 'Parcelas com atraso no momento', tipo: 'negativo', peso: -25, ativo: true, categoria: 'inadimplencia', limite_maximo_pontos: 25, ordem: 6 },
  { id: 'atraso_60dias', label: 'Atraso acima de 60 dias', descricao: 'Histórico de atraso severo', tipo: 'negativo', peso: -10, ativo: true, categoria: 'inadimplencia', limite_maximo_pontos: 10, ordem: 7 },
  { id: 'atraso_90dias', label: 'Atraso acima de 90 dias', descricao: 'Histórico de inadimplência grave', tipo: 'negativo', peso: -20, ativo: true, categoria: 'inadimplencia', limite_maximo_pontos: 20, ordem: 8 },
  { id: 'cliente_bloqueado', label: 'Cliente bloqueado', descricao: 'Status bloqueado no sistema', tipo: 'negativo', peso: -40, ativo: true, categoria: 'status', limite_maximo_pontos: 40, ordem: 9 },
  { id: 'cadastro_incompleto', label: 'Cadastro incompleto', descricao: 'Dados cadastrais ausentes', tipo: 'negativo', peso: -5, ativo: true, categoria: 'cadastro', limite_maximo_pontos: 5, ordem: 10 },
]

export const FAIXAS_RISCO_PADRAO: FaixaRisco[] = [
  { id: 'baixo', nome: 'Baixo Risco', min: 70, max: 100, cor: '#16A34A', recomendacao: 'aprovar', limiteSugeridoPercentual: 100, taxaSugerida: 4.5 },
  { id: 'medio', nome: 'Médio Risco', min: 50, max: 69, cor: '#D4A528', recomendacao: 'analisar', limiteSugeridoPercentual: 60, taxaSugerida: 6.5 },
  { id: 'alto', nome: 'Alto Risco', min: 30, max: 49, cor: '#F97316', recomendacao: 'analisar', limiteSugeridoPercentual: 30, taxaSugerida: 8.5 },
  { id: 'critico', nome: 'Crítico', min: 0, max: 29, cor: '#EF4444', recomendacao: 'negar', limiteSugeridoPercentual: 0, taxaSugerida: 0 },
]

export type DadosScore = {
  total_parcelas: number
  pagas_pontualmente: number
  pagas_antecipado: number
  emprestimos_quitados: number
  parcelas_atrasadas_atuais: number
  max_dias_atraso: number
  cliente_bloqueado?: boolean
  cadastro_completo?: boolean
  volume_total_pago?: number
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

export function calcularScore(
  dados: DadosScore,
  regrasCustom?: RegraScore[],
  faixasCustom?: FaixaRisco[],
  limiteCredito?: number,
): ResultadoScore {
  const regras = (regrasCustom ?? REGRAS_SCORE_PADRAO).filter(r => r.ativo)
  const faixas = faixasCustom ?? FAIXAS_RISCO_PADRAO

  let pontos = 50 // base
  const fatores: FatorScore[] = []

  for (const regra of regras.sort((a, b) => a.ordem - b.ordem)) {
    let contribuicao = 0

    switch (regra.id) {
      case 'pagamentos_em_dia':
        if (dados.total_parcelas > 0) {
          const pct = dados.pagas_pontualmente / dados.total_parcelas
          contribuicao = Math.round(pct * regra.peso)
        }
        break
      case 'pagamentos_antecipados':
        contribuicao = Math.min(regra.peso, dados.pagas_antecipado * Math.ceil(regra.peso / 5))
        break
      case 'emprestimos_quitados':
        contribuicao = Math.min(regra.peso, dados.emprestimos_quitados * Math.ceil(regra.peso / 3))
        break
      case 'volume_pago':
        contribuicao = dados.volume_total_pago && dados.volume_total_pago > 10000 ? regra.peso : Math.round(regra.peso * 0.5)
        break
      case 'cadastro_completo':
        contribuicao = dados.cadastro_completo ? regra.peso : 0
        break
      case 'atraso_atual':
        if (dados.parcelas_atrasadas_atuais > 0) {
          contribuicao = Math.max(regra.peso, -Math.abs(regra.peso) * Math.min(1, dados.parcelas_atrasadas_atuais / 3))
        }
        break
      case 'atraso_60dias':
        contribuicao = dados.max_dias_atraso >= 60 ? regra.peso : 0
        break
      case 'atraso_90dias':
        contribuicao = dados.max_dias_atraso >= 90 ? regra.peso : 0
        break
      case 'cliente_bloqueado':
        contribuicao = dados.cliente_bloqueado ? regra.peso : 0
        break
      case 'cadastro_incompleto':
        contribuicao = dados.cadastro_completo ? 0 : regra.peso
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
