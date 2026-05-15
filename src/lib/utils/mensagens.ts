export type VariavelTemplate = {
  chave: string
  descricao: string
  exemplo: string
}

export const VARIAVEIS_EMPORIO: VariavelTemplate[] = [
  { chave: 'nome', descricao: 'Nome do cliente', exemplo: 'João Silva' },
  { chave: 'numero_venda', descricao: 'Número da venda', exemplo: 'EMP-2026-00001' },
  { chave: 'total', descricao: 'Valor total formatado', exemplo: 'R$ 1.500,00' },
  { chave: 'tipo_pagamento', descricao: 'Forma de pagamento', exemplo: 'PIX' },
  { chave: 'data_entrega', descricao: 'Data de entrega', exemplo: '20/05/2026' },
  { chave: 'itens', descricao: 'Lista de itens da venda', exemplo: '• Sofá 3 lugares — R$ 1.500,00' },
  { chave: 'parcelas', descricao: 'Número de parcelas', exemplo: '3' },
  { chave: 'valor_parcela', descricao: 'Valor de cada parcela', exemplo: 'R$ 500,00' },
  { chave: 'valor', descricao: 'Valor da parcela/cobrança', exemplo: 'R$ 500,00' },
  { chave: 'vencimento', descricao: 'Data de vencimento', exemplo: '10/06/2026' },
  { chave: 'dias_atraso', descricao: 'Dias em atraso', exemplo: '5' },
]

export const VARIAVEIS_FACTORING: VariavelTemplate[] = [
  { chave: 'nome', descricao: 'Nome do cliente', exemplo: 'Maria Souza' },
  { chave: 'numero_contrato', descricao: 'Número do contrato', exemplo: 'FAC-2026-00001' },
  { chave: 'valor_principal', descricao: 'Valor do empréstimo', exemplo: 'R$ 5.000,00' },
  { chave: 'taxa_juros', descricao: 'Taxa de juros mensal', exemplo: '5,00' },
  { chave: 'prazo_meses', descricao: 'Prazo em meses', exemplo: '12' },
  { chave: 'valor_parcela', descricao: 'Valor da parcela', exemplo: 'R$ 456,00' },
  { chave: 'data_primeiro_vencimento', descricao: '1ª data de vencimento', exemplo: '10/06/2026' },
  { chave: 'numero_parcela', descricao: 'Número da parcela atual', exemplo: '3' },
  { chave: 'total_parcelas', descricao: 'Total de parcelas', exemplo: '12' },
  { chave: 'data_vencimento', descricao: 'Data de vencimento da parcela', exemplo: '10/06/2026' },
  { chave: 'dias_para_vencer', descricao: 'Dias para o vencimento', exemplo: '3' },
  { chave: 'dias_atraso', descricao: 'Dias em atraso', exemplo: '5' },
  { chave: 'valor_adicional', descricao: 'Multa + juros de mora', exemplo: 'R$ 23,00' },
  { chave: 'valor_total', descricao: 'Total a pagar com encargos', exemplo: 'R$ 479,00' },
  { chave: 'data_quitacao', descricao: 'Data de quitação', exemplo: '15/05/2026' },
  { chave: 'total_pago', descricao: 'Total pago no contrato', exemplo: 'R$ 5.472,00' },
  { chave: 'limite_credito', descricao: 'Limite de crédito', exemplo: 'R$ 10.000,00' },
]

export function montarMensagem(
  template: string,
  variaveis: Record<string, string>,
): string {
  let msg = template

  msg = msg.replace(/\{\{(\w+)\}\}/g, (_, chave) => variaveis[chave] ?? `{{${chave}}}`)

  msg = msg.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, chave, content) => {
    return variaveis[chave] ? content : ''
  })

  return msg.trim()
}

export function previewMensagem(template: string, tipo: 'emporio' | 'factoring'): string {
  const variaveis = Object.fromEntries(
    (tipo === 'emporio' ? VARIAVEIS_EMPORIO : VARIAVEIS_FACTORING)
      .map(v => [v.chave, v.exemplo])
  )
  return montarMensagem(template, variaveis)
}
