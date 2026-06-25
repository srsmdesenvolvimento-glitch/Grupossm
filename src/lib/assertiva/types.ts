export interface RelatorioNegativacao {
  credor?: string
  valor?: number
  data?: string
  contrato?: string
  tipo?: string
  origem?: string
  cidade?: string
  uf?: string
  natureza?: string
}

export interface RelatorioProtesto {
  cartorio?: string
  valor?: number
  data?: string
  municipio?: string
  uf?: string
  tipo?: string
}

export interface RelatorioAcaoJudicial {
  tipo?: string
  valor?: number
  data?: string
  numero?: string
  tribunal?: string
  vara?: string
  polo_ativo?: string
  polo_passivo?: string
  uf?: string
}

export interface RelatorioSocio {
  nome?: string
  documento?: string
  participacao?: number
  cargo?: string
  data_entrada?: string
  qualificacao?: string
}

export interface RelatorioParticipacao {
  cnpj?: string
  razao_social?: string
  participacao?: number
  cargo?: string
  situacao?: string
  data_entrada?: string
  uf?: string
}

export interface RelatorioEndereco {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  tipo?: string
  data_inclusao?: string
  titulo?: string
}

export interface RelatorioTelefone {
  ddd?: string
  numero?: string
  tipo?: string
  whatsapp?: boolean
  score?: number
  operadora?: string
}

export interface RelatorioEmail {
  email?: string
  score?: number
  tipo?: string
}

export interface RelatorioVinculo {
  nome?: string
  cpf?: string
  tipo?: string
  parentesco?: string
  data?: string
}

export interface RelatorioVeiculo {
  placa?: string
  marca?: string
  modelo?: string
  ano_fabricacao?: number
  ano_modelo?: number
  cor?: string
  situacao?: string
  tipo?: string
  renavam?: string
  combustivel?: string
  municipio?: string
  uf?: string
}

export interface RelatorioCcf {
  banco?: string
  nome_banco?: string
  agencia?: string
  numero_cheque?: string
  cheque?: string
  data?: string
  motivo?: string
  valor?: number
}

export interface RelatorioOperacaoCredito {
  modalidade?: string
  contratante?: string
  valor?: number
  data?: string
  situacao?: string
  parcelas?: number
}

export interface RelatorioCadastroPositivo {
  suspenso?: boolean
  atrasoConsumo?: { descricao?: string; valor?: number | null; risco?: string | null }
  atrasoRecente?: { descricao?: string; valor?: number | null; risco?: string | null }
  relacionamentoCC?: { descricao?: string; valor?: number | null; risco?: string | null }
  comprometimentoRenda?: { descricao?: string; valor?: number | null; risco?: string | null }
}

export interface RelatorioScoreDetalhado {
  pontos?: number
  classe?: string
  faixa_titulo?: string
  faixa_descricao?: string
  probabilidade?: string
  cadastro_positivo?: RelatorioCadastroPositivo
}

export interface RelatorioConsultaAnterior {
  data?: string
  consultante?: string
}

export interface RelatorioCompleto {
  documento: string
  tipo: 'pf' | 'pj'

  // ── Identidade PF ──────────────────────────────────────────────────────────
  nome?: string
  nome_mae?: string
  nome_pai?: string
  data_nascimento?: string
  sexo?: string
  situacao_cpf?: string
  indicador_obito?: boolean
  pep?: boolean
  escolaridade?: string
  ocupacao?: string
  estado_civil_api?: string
  nacionalidade?: string
  faixa_etaria?: string
  idade?: number
  signo?: string

  // ── Identidade PJ ──────────────────────────────────────────────────────────
  razao_social?: string
  nome_fantasia?: string
  situacao_cnpj?: string
  cnae_principal?: string
  cnae_descricao?: string
  natureza_juridica?: string
  capital_social?: number
  data_abertura?: string
  porte?: string
  socios?: RelatorioSocio[]
  matriz?: boolean
  filiais_count?: number
  idade_empresa?: number
  qtd_funcionarios?: number
  faturamento_presumido?: number | string

  // ── Contatos ──────────────────────────────────────────────────────────────
  enderecos?: RelatorioEndereco[]
  telefones?: RelatorioTelefone[]
  emails?: RelatorioEmail[]
  vinculos?: RelatorioVinculo[]
  participacoes_societarias?: RelatorioParticipacao[]
  veiculos?: RelatorioVeiculo[]

  // ── Score & Renda ──────────────────────────────────────────────────────────
  score?: number
  score_detalhado?: RelatorioScoreDetalhado
  faixa_risco?: string
  renda_estimada?: number
  renda_presumida?: number
  capacidade_pagamento?: number
  faixa_renda?: string
  comprometimento_renda?: number

  // ── Negativações ──────────────────────────────────────────────────────────
  negativacoes?: RelatorioNegativacao[]
  total_negativacoes?: number
  valor_total_negativacoes?: number

  // ── Protestos ─────────────────────────────────────────────────────────────
  protestos?: RelatorioProtesto[]
  total_protestos?: number
  valor_total_protestos?: number

  // ── Ações Judiciais ────────────────────────────────────────────────────────
  acoes_judiciais?: RelatorioAcaoJudicial[]
  total_acoes_judiciais?: number
  valor_total_acoes?: number

  // ── CCF ───────────────────────────────────────────────────────────────────
  ccf?: RelatorioCcf[]
  total_ccf?: number

  // ── Operações de Crédito ──────────────────────────────────────────────────
  operacoes_credito?: RelatorioOperacaoCredito[]
  total_operacoes_credito?: number

  // ── Consultas Anteriores ──────────────────────────────────────────────────
  consultas_anteriores?: RelatorioConsultaAnterior[]
  total_consultas_anteriores?: number

  // ── Totais ────────────────────────────────────────────────────────────────
  total_dividas?: number
  valor_total_dividas?: number

  // ── Meta ──────────────────────────────────────────────────────────────────
  _cache?: boolean
  _sandbox?: boolean
  _gerado_em?: string
  _localize?: any
  _credito?: any
  _erros?: string[]
  _mix_403?: boolean
  _auth_error?: string
}
