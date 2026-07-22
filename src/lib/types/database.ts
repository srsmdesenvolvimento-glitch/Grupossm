export type TipoPagamento = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'cheque'
export type StatusVenda = 'orcamento' | 'aprovada' | 'entregue' | 'cancelada'
export type StatusParcela = 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'parcial'
export type StatusContaPagar = 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'parcial'
export type StatusEmprestimo = 'analise' | 'aprovado' | 'ativo' | 'quitado' | 'inadimplente' | 'cancelado'
export type StatusParcelaEmprestimo = 'pendente' | 'pago' | 'atrasado' | 'renegociado' | 'cancelado'
export type StatusCliente = 'ativo' | 'inativo' | 'bloqueado'
export type PapelUsuario = 'admin' | 'gerente' | 'operador' | 'visualizador'
export type TipoEmpresa = 'emporio' | 'factoring'
export type TipoTaxa = 'mensal' | 'anual'
export type CanalNotificacao = 'whatsapp' | 'sms' | 'email' | 'sistema'
export type TipoMovimentacao = 'entrada' | 'saida'
export type CategoriaContaPagar = 'fornecedor' | 'aluguel' | 'salario' | 'imposto' | 'servico' | 'outros'

export type Empresa = {
  id: string
  nome: string
  tipo: TipoEmpresa
  cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  logo_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}
export type EmpresaInsert = Omit<Empresa, 'id' | 'created_at' | 'updated_at'> & { id?: string; ativo?: boolean }
export type EmpresaUpdate = Partial<EmpresaInsert>

export type Usuario = {
  id: string
  nome: string
  email: string
  telefone: string | null
  avatar_url: string | null
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
}
export type UsuarioInsert = Omit<Usuario, 'id' | 'created_at' | 'updated_at'> & { id?: string; status?: 'ativo' | 'inativo' }
export type UsuarioUpdate = Partial<UsuarioInsert>

export type UsuarioEmpresa = {
  id: string
  usuario_id: string
  empresa_id: string
  papel: PapelUsuario
  ativo: boolean
  created_at: string
}
export type UsuarioEmpresaInsert = Omit<UsuarioEmpresa, 'id' | 'created_at'> & { id?: string; ativo?: boolean }
export type UsuarioEmpresaUpdate = Partial<UsuarioEmpresaInsert>

export type CategoriaProduto = {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  slug: string | null
  icone: string | null
  ordem: number
  ativo: boolean
  created_at: string
}
export type CategoriaProdutoInsert = Omit<CategoriaProduto, 'id' | 'created_at'> & { id?: string; ordem?: number; ativo?: boolean }
export type CategoriaProdutoUpdate = Partial<CategoriaProdutoInsert>

export type Fornecedor = {
  id: string
  empresa_id: string
  nome: string
  cnpj: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  contato: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}
export type FornecedorInsert = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'> & { id?: string; ativo?: boolean }
export type FornecedorUpdate = Partial<FornecedorInsert>

export type Produto = {
  id: string
  empresa_id: string
  categoria_id: string | null
  fornecedor_id: string | null
  nome: string
  descricao: string | null
  descricao_curta: string | null
  sku: string | null
  preco: number
  preco_custo: number | null
  estoque: number
  estoque_minimo: number
  unidade: string
  peso: number | null
  dimensoes: Record<string, unknown> | null
  imagens: unknown[]
  tags: string[] | null
  destaque: boolean
  disponivel_catalogo: boolean
  status: 'ativo' | 'inativo' | 'sem_estoque'
  created_at: string
  updated_at: string
}
export type ProdutoInsert = Omit<Produto, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  estoque?: number
  estoque_minimo?: number
  destaque?: boolean
  disponivel_catalogo?: boolean
  status?: 'ativo' | 'inativo' | 'sem_estoque'
}
export type ProdutoUpdate = Partial<ProdutoInsert>

export type ConfigCatalogo = {
  id: string
  empresa_id: string
  slug: string
  titulo: string
  descricao: string | null
  whatsapp: string | null
  instagram: string | null
  facebook: string | null
  banner_url: string | null
  cores: Record<string, string>
  mostrar_preco: boolean
  mostrar_estoque: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}
export type ConfigCatalogoInsert = Omit<ConfigCatalogo, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  mostrar_preco?: boolean
  mostrar_estoque?: boolean
  ativo?: boolean
}
export type ConfigCatalogoUpdate = Partial<ConfigCatalogoInsert>

export type ClienteEmporio = {
  id: string
  empresa_id: string
  nome: string
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  telefone: string
  telefone2: string | null
  email: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  observacoes: string | null
  total_compras: number
  valor_total_compras: number
  ultima_compra: string | null
  status: StatusCliente
  created_at: string
  updated_at: string
}
export type ClienteEmporioInsert = Omit<ClienteEmporio, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  total_compras?: number
  valor_total_compras?: number
  status?: StatusCliente
}
export type ClienteEmporioUpdate = Partial<ClienteEmporioInsert>

export type Venda = {
  id: string
  empresa_id: string
  numero_venda: number
  cliente_id: string | null
  usuario_id: string | null
  subtotal: number
  desconto: number
  total: number
  tipo_pagamento: TipoPagamento | null
  parcelas: number
  valor_entrada: number
  observacoes: string | null
  data_entrega: string | null
  status: StatusVenda
  created_at: string
  updated_at: string
}
export type VendaInsert = Omit<Venda, 'id' | 'created_at' | 'updated_at' | 'numero_venda'> & {
  id?: string
  desconto?: number
  parcelas?: number
  valor_entrada?: number
  status?: StatusVenda
}
export type VendaUpdate = Partial<VendaInsert>

export type ItemVenda = {
  id: string
  venda_id: string
  produto_id: string | null
  nome_produto: string
  sku_produto: string | null
  quantidade: number
  preco_unitario: number
  desconto: number
  total: number
  created_at: string
}
export type ItemVendaInsert = Omit<ItemVenda, 'id' | 'created_at'> & { id?: string; desconto?: number }
export type ItemVendaUpdate = Partial<ItemVendaInsert>

export type ParcelaReceber = {
  id: string
  empresa_id: string
  venda_id: string
  cliente_id: string | null
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: TipoPagamento | null
  status: StatusParcela
  observacoes: string | null
  created_at: string
  updated_at: string
}
export type ParcelaReceberInsert = Omit<ParcelaReceber, 'id' | 'created_at' | 'updated_at'> & { id?: string; status?: StatusParcela }
export type ParcelaReceberUpdate = Partial<ParcelaReceberInsert>

export type ContaPagar = {
  id: string
  empresa_id: string
  descricao: string
  categoria: CategoriaContaPagar
  fornecedor_id: string | null
  fornecedor_nome: string | null
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: TipoPagamento | null
  numero_documento: string | null
  observacoes: string | null
  comprovante_url: string | null
  status: StatusContaPagar
  created_at: string
  updated_at: string
}
export type ContaPagarInsert = Omit<ContaPagar, 'id' | 'created_at' | 'updated_at'> & { id?: string; status?: StatusContaPagar }
export type ContaPagarUpdate = Partial<ContaPagarInsert>

export type ConfigEmporio = {
  id: string
  empresa_id: string
  whatsapp_padrao: string | null
  prefixo_numero_venda: string
  dias_vencimento_padrao: number
  saldo_inicial_caixa: number
  msg_orcamento: string | null
  msg_aprovacao: string | null
  msg_entrega: string | null
  msg_cobranca: string | null
  msg_aniversario: string | null
  updated_at: string
}
export type ConfigEmporioInsert = Omit<ConfigEmporio, 'id' | 'updated_at'> & { id?: string }
export type ConfigEmporioUpdate = Partial<ConfigEmporioInsert>

export type ClienteFactoring = {
  id: string
  empresa_id: string
  nome: string
  tipo_pessoa: 'fisica' | 'juridica'
  cpf: string | null
  cnpj: string | null
  rg: string | null
  orgao_emissor: string | null
  data_nascimento: string | null
  estado_civil: string | null
  profissao: string | null
  renda_mensal: number | null
  telefone: string
  telefone2: string | null
  email: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo_conta: string | null
  pix: string | null
  limite_credito: number
  credito_utilizado: number
  credito_disponivel: number
  score_interno: number
  total_emprestimos: number
  valor_total_emprestado: number
  ultima_operacao: string | null
  observacoes: string | null
  documentos: unknown[]
  status: StatusCliente
  created_at: string
  updated_at: string
  // Assertiva
  dados_assertiva: Record<string, unknown> | null
  score_assertiva: number | null
  faixa_risco_assertiva: string | null
  renda_estimada_assertiva: number | null
  assertiva_consultado_em: string | null
  total_negativacoes_assertiva: number | null
  valor_total_negativacoes_assertiva: number | null
  total_protestos_assertiva: number | null
  valor_total_protestos_assertiva: number | null
  total_acoes_judiciais_assertiva: number | null
  valor_total_acoes_assertiva: number | null
  total_ccf_assertiva: number | null
  total_dividas_assertiva: number | null
  valor_total_dividas_assertiva: number | null
  pep_assertiva: boolean | null
  indicador_obito_assertiva: boolean | null
  situacao_documento_assertiva: string | null
  faturamento_presumido_assertiva: number | null
}
export type ClienteFactoringInsert = Omit<ClienteFactoring, 'id' | 'created_at' | 'updated_at' | 'credito_disponivel'> & {
  id?: string
  limite_credito?: number
  credito_utilizado?: number
  score_interno?: number
  total_emprestimos?: number
  valor_total_emprestado?: number
  status?: StatusCliente
}
export type ClienteFactoringUpdate = Partial<ClienteFactoringInsert>

export type ReferenciaClienteFactoring = {
  id: string
  cliente_id: string
  nome: string
  parentesco: string | null
  telefone: string
  observacoes: string | null
  created_at: string
}
export type ReferenciaClienteFactoringInsert = Omit<ReferenciaClienteFactoring, 'id' | 'created_at'> & { id?: string }
export type ReferenciaClienteFactoringUpdate = Partial<ReferenciaClienteFactoringInsert>

export type LembreteClienteFactoring = {
  id: string
  empresa_id: string
  cliente_id: string
  usuario_id: string | null
  titulo: string
  descricao: string | null
  data_lembrete: string
  concluido: boolean
  concluido_em: string | null
  created_at: string
}
export type LembreteClienteFactoringInsert = Omit<LembreteClienteFactoring, 'id' | 'created_at' | 'concluido' | 'concluido_em'> & {
  id?: string
  concluido?: boolean
  concluido_em?: string | null
}
export type LembreteClienteFactoringUpdate = Partial<LembreteClienteFactoringInsert>

export type Emprestimo = {
  id: string
  empresa_id: string
  numero_contrato: string
  cliente_id: string
  usuario_id: string | null
  valor_principal: number
  taxa_juros: number
  tipo_taxa: TipoTaxa
  prazo_meses: number
  valor_parcela: number
  total_pagar: number
  total_juros: number
  valor_entrada: number
  saldo_devedor: number
  data_primeiro_vencimento: string
  data_liberacao: string | null
  data_quitacao: string | null
  observacoes: string | null
  garantias: string | null
  documentos: unknown[]
  status: StatusEmprestimo
  assinado_em: string | null
  assinado_ip: string | null
  assinatura_token: string
  avalistas?: unknown[] | null
  garantias_detalhadas?: unknown[] | null
  created_at: string
  updated_at: string
}
export type EmprestimoInsert = Omit<Emprestimo, 'id' | 'created_at' | 'updated_at'> & { id?: string; status?: StatusEmprestimo }
export type EmprestimoUpdate = Partial<EmprestimoInsert>

export type ParcelaEmprestimo = {
  id: string
  empresa_id: string
  emprestimo_id: string
  cliente_id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_principal: number
  valor_juros: number
  saldo_devedor_antes: number
  saldo_devedor_apos: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  dias_atraso: number
  multa: number
  juros_mora: number
  tipo_pagamento: TipoPagamento | null
  status: StatusParcelaEmprestimo
  observacoes: string | null
  created_at: string
  updated_at: string
}
export type ParcelaEmprestimoInsert = Omit<ParcelaEmprestimo, 'id' | 'created_at' | 'updated_at' | 'dias_atraso'> & {
  id?: string
  multa?: number
  juros_mora?: number
  status?: StatusParcelaEmprestimo
}
export type ParcelaEmprestimoUpdate = Partial<ParcelaEmprestimoInsert>

export type HistoricoStatusEmprestimo = {
  id: string
  emprestimo_id: string
  usuario_id: string | null
  status_anterior: StatusEmprestimo | null
  status_novo: StatusEmprestimo
  motivo: string | null
  created_at: string
}
export type HistoricoStatusEmprestimoInsert = Omit<HistoricoStatusEmprestimo, 'id' | 'created_at'> & { id?: string }
export type HistoricoStatusEmprestimoUpdate = Partial<HistoricoStatusEmprestimoInsert>

export type ConfigFactoring = {
  id: string
  empresa_id: string
  whatsapp_padrao: string | null
  prefixo_contrato: string
  taxa_juros_padrao: number
  tipo_taxa_padrao: TipoTaxa
  prazo_minimo_meses: number
  prazo_maximo_meses: number
  valor_minimo_emprestimo: number
  valor_maximo_emprestimo: number
  dias_carencia: number
  multa_atraso: number
  juros_mora_diario: number
  saldo_inicial_caixa: number
  msg_aprovacao: string | null
  msg_liberacao: string | null
  msg_vencimento: string | null
  msg_cobranca: string | null
  msg_quitacao: string | null
  msg_boas_vindas: string | null
  regras_score?: any
  faixas_risco?: any
  updated_at: string
}
export type ConfigFactoringInsert = Omit<ConfigFactoring, 'id' | 'updated_at'> & { id?: string }
export type ConfigFactoringUpdate = Partial<ConfigFactoringInsert>

export type MovimentacaoCaixa = {
  id: string
  empresa_id: string
  usuario_id: string | null
  tipo: TipoMovimentacao
  categoria: string
  descricao: string
  valor: number
  referencia_tipo: string | null
  referencia_id: string | null
  data_movimentacao: string
  observacoes: string | null
  created_at: string
}
export type MovimentacaoCaixaInsert = Omit<MovimentacaoCaixa, 'id' | 'created_at'> & { id?: string }
export type MovimentacaoCaixaUpdate = Partial<MovimentacaoCaixaInsert>

export type NotificacaoLog = {
  id: string
  empresa_id: string
  canal: CanalNotificacao
  destinatario: string
  assunto: string | null
  mensagem: string
  referencia_tipo: string | null
  referencia_id: string | null
  status: string
  enviado_em: string | null
  erro: string | null
  created_at: string
}
export type NotificacaoLogInsert = Omit<NotificacaoLog, 'id' | 'created_at'> & { id?: string }
export type NotificacaoLogUpdate = Partial<NotificacaoLogInsert>

// ── Subscription System ──────────────────────────────────────

export type StatusAssinatura = 'trial' | 'ativa' | 'inadimplente' | 'cancelada' | 'suspensa' | 'expirada'

export type PlanoAssinatura = {
  id: string
  nome: string
  descricao: string | null
  preco_mensal: number
  preco_anual: number | null
  max_usuarios: number
  max_empresas: number
  recursos: Record<string, unknown>
  destaque: boolean
  ordem: number
  ativo: boolean
  created_at: string
  updated_at: string
}
export type PlanoAssinaturaInsert = Omit<PlanoAssinatura, 'id' | 'created_at' | 'updated_at'> & { id?: string }
export type PlanoAssinaturaUpdate = Partial<PlanoAssinaturaInsert>

export type Assinatura = {
  id: string
  empresa_id: string
  plano_id: string
  status: StatusAssinatura
  periodicidade: 'mensal' | 'anual'
  data_inicio: string
  data_fim: string | null
  data_renovacao: string | null
  valor_cobrado: number | null
  desconto_pct: number
  contrato_url: string | null
  assinado_em: string | null
  assinado_por: string | null
  assinado_ip: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}
export type AssinaturaInsert = Omit<Assinatura, 'id' | 'created_at' | 'updated_at'> & { id?: string }
export type AssinaturaUpdate = Partial<AssinaturaInsert>

export type PagamentoAssinatura = {
  id: string
  assinatura_id: string
  empresa_id: string
  valor: number
  status: 'pendente' | 'pago' | 'falhou' | 'estornado'
  tipo_pagamento: string | null
  referencia: string | null
  comprovante_url: string | null
  vencimento: string
  pago_em: string | null
  created_at: string
}
export type PagamentoAssinaturaInsert = Omit<PagamentoAssinatura, 'id' | 'created_at'> & { id?: string }

export type Salario = {
  id: string
  usuario_id: string
  empresa_id: string
  cargo: string | null
  valor_base: number
  beneficios: number
  desconto: number
  valor_liquido: number
  data_inicio: string
  data_fim: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}
export type SalarioInsert = Omit<Salario, 'id' | 'valor_liquido' | 'created_at' | 'updated_at'> & { id?: string }
export type SalarioUpdate = Partial<SalarioInsert>
