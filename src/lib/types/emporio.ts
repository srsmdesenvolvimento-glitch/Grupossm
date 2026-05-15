import type { Produto, CategoriaProduto, ClienteEmporio, Venda, ItemVenda, ParcelaReceber } from './database'

export type ProdutoComCategoria = Produto & {
  categoria: Pick<CategoriaProduto, 'id' | 'nome' | 'slug' | 'icone'> | null
}

export type VendaComItens = Venda & {
  itens: ItemVenda[]
  cliente: Pick<ClienteEmporio, 'id' | 'nome' | 'telefone' | 'cpf'> | null
}

export type ParcelaComCliente = ParcelaReceber & {
  cliente: Pick<ClienteEmporio, 'id' | 'nome' | 'telefone'> | null
  venda_numero: number | null
}

export type ClienteComResumo = ClienteEmporio & {
  parcelas_pendentes: number
  valor_pendente: number
  parcelas_atrasadas: number
  valor_atrasado: number
}

export type ResumoDashboardEmporio = {
  vendas_mes: number
  faturamento_mes: number
  ticket_medio: number
  clientes_novos_mes: number
  receber_total: number
  receber_vencendo_hoje: number
  receber_atrasado: number
  pagar_total: number
  pagar_vencendo_hoje: number
  produtos_sem_estoque: number
}

export type ItemCarrinho = {
  produto_id: string
  nome: string
  preco_unitario: number
  quantidade: number
  desconto: number
  total: number
}
