import type { ClienteFactoring, ReferenciaClienteFactoring, Emprestimo, ParcelaEmprestimo } from './database'

export type ReferenciaCliente = ReferenciaClienteFactoring

export type ClienteFactoringCompleto = ClienteFactoring & {
  referencias: ReferenciaClienteFactoring[]
}

export type EmprestimoComParcelas = Emprestimo & {
  parcelas: ParcelaEmprestimo[]
  cliente: Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'telefone' | 'score_interno'>
}

export type EmprestimoComCliente = Emprestimo & {
  cliente: Pick<ClienteFactoring, 'id' | 'nome' | 'cpf' | 'score_interno' | 'status'>
}

export type ParcelaComDetalhes = ParcelaEmprestimo & {
  emprestimo_numero: string
  emprestimo_valor_principal: number
  cliente_nome: string
  cliente_telefone: string
}

export type ResumoDashboardFactoring = {
  emprestimos_ativos: number
  carteira_total: number
  recebimentos_mes: number
  inadimplencia_valor: number
  inadimplencia_pct: number
  novos_contratos_mes: number
  parcelas_vencendo_hoje: number
  parcelas_atrasadas: number
  clientes_novos_mes: number
}

export type SimulacaoEmprestimo = {
  valor_principal: number
  taxa_juros: number
  tipo_taxa: 'mensal' | 'anual'
  prazo_meses: number
  valor_entrada: number
  valor_parcela: number
  total_pagar: number
  total_juros: number
  cet_mensal: number
  tabela: TabelaAmortizacao[]
}

export type TabelaAmortizacao = {
  numero_parcela: number
  data_vencimento: string
  valor_principal: number
  valor_juros: number
  valor_parcela: number
  saldo_devedor: number
}
