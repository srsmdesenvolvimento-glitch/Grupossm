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
  descricao?: string
  valor?: number
  data?: string
  numero?: string
  tribunal?: string
  vara?: string
  cidade?: string
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

export interface RelatorioRedeSocial {
  nome?: string
  url?: string
}

export interface RelatorioRegistroProfissional {
  profissao?: string
  sigla?: string
  situacao?: string
  uf?: string
  numero_inscricao?: string
  data_inscricao?: string
  faixa_salarial?: string
}

export interface RelatorioHistoricoProfissional {
  empresa?: string
  cnpj?: string
  cargo?: string
  setor?: string
  data_registro?: string
  renda_estimada?: number
  faixa_salarial?: string
}

export interface RelatorioSegmentoConsulta {
  segmento?: string
  quantidade?: number
}

export interface RelatorioVinculo {
  nome?: string
  cpf?: string
  documento?: string
  documento_tipo?: 'PF' | 'PJ'
  tipo?: string
  parentesco?: string
  data?: string
  data_nascimento?: string
  telefone?: string
  whatsapp?: boolean
  email?: string
  endereco?: RelatorioEndereco
  _enriquecido?: boolean
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
  mae_cpf?: string
  mae_data_nascimento?: string
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
  redes_sociais?: RelatorioRedeSocial[]
  registros_profissionais?: RelatorioRegistroProfissional[]
  historico_profissional?: RelatorioHistoricoProfissional[]
  total_consultas_mercado?: number
  segmentos_consulta?: RelatorioSegmentoConsulta[]
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
  _credito_403?: boolean
  _auth_error?: string
}

// ── Análise Comportamental / Análise 360 (produto assíncrono, PF e PJ) ───────
// A Assertiva só retorna dados de imóveis para CNPJ, e apenas por este produto
// (webhook). Não existe fonte de imóveis para CPF em nenhum produto da API.
export interface Analise360Imovel {
  inscricao?: string
  endereco?: string
  valor_terreno?: number
  valor_imposto?: number
  uso_terreno?: string
  ano_construcao?: number
  area?: number
  situacao?: string
}

export interface Analise360ResultadoPJ {
  tipo: 'pj'
  quantidade_imoveis?: number
  imoveis?: Analise360Imovel[]
  score?: number
  faixa_risco?: string
  limite_credito_sugerido?: number
  quadro_societario_qtd?: number
  antifraude_score?: number
  reputacoes?: Analise360Reputacao[]
  movimentacoes?: Analise360Movimentacao[]
  concorrencia?: Analise360Concorrencia
  _raw?: any
}

export interface Analise360PerfilSocioeconomico {
  classe_social?: string
  faixa_etaria?: string
  profissao?: string
  funcionario_publico?: boolean
  cargo_publico?: string
  situacao_cargo_publico?: string
  tipo_imovel?: string
  tipo_cidade?: string
  qtd_empresas_trabalhadas?: number
  empresario_qtd_empresas_abertas?: number
  empresario_tipo?: string
  empresario_cnae_atuacao?: string
  melhoria_moradia?: string
  classe_social_cep?: string
}

export interface Analise360Reputacao {
  plataforma?: string
  nome?: string
  nota?: number
  nota_maxima?: number
  reputacao?: string
  telefone?: string
  endereco?: string
  segmento?: string
  site?: string
  link_fonte?: string
}

export interface Analise360Movimentacao {
  data?: string
  titulo?: string
  mudancas?: { titulo?: string; descricao?: string }[]
}

export interface Analise360TendenciaSegmento {
  data?: string
  valor?: number
  descricao?: string
}

export interface Analise360Concorrencia {
  analise_homonimia?: string
  segmento_atuacao?: string
  perfil_segmento?: string
  tendencia_segmento?: Analise360TendenciaSegmento[]
}

export interface Analise360DividaUniao {
  tipo?: string
  numero_inscricao?: string
  situacao?: string
  uf?: string
  entidade_responsavel?: string
  data?: string
  valor?: number
}

export interface Analise360Beneficio {
  nome?: string
  data?: string
  valor?: number
}

export interface Analise360ComposicaoDomiciliar {
  poder_compra?: string
  composicao?: string
  renda_presumida?: number
  lider_familia?: boolean
}

export interface Analise360ResultadoPF {
  tipo: 'pf'
  perfil_socioeconomico?: Analise360PerfilSocioeconomico
  dividas_uniao?: Analise360DividaUniao[]
  quantidade_dividas_uniao?: number
  valor_total_dividas_uniao?: number
  limite_credito_sugerido?: number
  restituicao_irpf_ano?: number
  restituicao_irpf_status?: string
  beneficios?: Analise360Beneficio[]
  valor_total_beneficios?: number
  composicao_domiciliar?: Analise360ComposicaoDomiciliar
  score?: number
  faixa_risco?: string
  antifraude_score?: number
  _raw?: any
}

export type Analise360Resultado = Analise360ResultadoPF | Analise360ResultadoPJ

export type Analise360JobStatus = 'pendente' | 'concluido' | 'erro'

export interface Analise360Job {
  id: string
  cliente_id: string
  empresa_id: string
  documento: string
  status: Analise360JobStatus
  resultado: Analise360Resultado | null
  erro: string | null
  solicitado_em: string
  respondido_em: string | null
}
