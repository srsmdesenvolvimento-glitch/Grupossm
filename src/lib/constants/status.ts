export type StatusConfig = {
  label: string
  cor: string
  bg: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export const STATUS_VENDA: Record<string, StatusConfig> = {
  orcamento:  { label: 'Orçamento',  cor: '#CA8A04', bg: '#FEFCE8', variant: 'secondary' },
  aprovada:   { label: 'Aprovada',   cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  entregue:   { label: 'Entregue',   cor: '#2563EB', bg: '#EFF6FF', variant: 'default' },
  cancelada:  { label: 'Cancelada',  cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
}

export const STATUS_PARCELA: Record<string, StatusConfig> = {
  pendente:   { label: 'Pendente',   cor: '#CA8A04', bg: '#FEFCE8', variant: 'secondary' },
  pago:       { label: 'Pago',       cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  atrasado:   { label: 'Atrasado',   cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
  cancelado:  { label: 'Cancelado',  cor: '#6B7280', bg: '#F9FAFB', variant: 'outline' },
}

export const STATUS_CONTA_PAGAR: Record<string, StatusConfig> = {
  pendente:   { label: 'Pendente',   cor: '#CA8A04', bg: '#FEFCE8', variant: 'secondary' },
  pago:       { label: 'Pago',       cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  atrasado:   { label: 'Atrasado',   cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
  cancelado:  { label: 'Cancelado',  cor: '#6B7280', bg: '#F9FAFB', variant: 'outline' },
}

export const STATUS_EMPRESTIMO: Record<string, StatusConfig> = {
  analise:      { label: 'Análise',       cor: '#7C3AED', bg: '#F5F3FF', variant: 'secondary' },
  aprovado:     { label: 'Aprovado',      cor: '#2563EB', bg: '#EFF6FF', variant: 'default' },
  ativo:        { label: 'Ativo',         cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  quitado:      { label: 'Quitado',       cor: '#0891B2', bg: '#ECFEFF', variant: 'default' },
  inadimplente: { label: 'Inadimplente',  cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
  cancelado:    { label: 'Cancelado',     cor: '#6B7280', bg: '#F9FAFB', variant: 'outline' },
}

export const STATUS_PARCELA_EMPRESTIMO: Record<string, StatusConfig> = {
  pendente:     { label: 'Pendente',      cor: '#CA8A04', bg: '#FEFCE8', variant: 'secondary' },
  pago:         { label: 'Pago',          cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  atrasado:     { label: 'Atrasado',      cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
  renegociado:  { label: 'Renegociado',   cor: '#EA580C', bg: '#FFF7ED', variant: 'secondary' },
  cancelado:    { label: 'Cancelado',     cor: '#6B7280', bg: '#F9FAFB', variant: 'outline' },
}

export const STATUS_CLIENTE: Record<string, StatusConfig> = {
  ativo:      { label: 'Ativo',      cor: '#16A34A', bg: '#F0FDF4', variant: 'default' },
  inativo:    { label: 'Inativo',    cor: '#6B7280', bg: '#F9FAFB', variant: 'outline' },
  bloqueado:  { label: 'Bloqueado',  cor: '#DC2626', bg: '#FEF2F2', variant: 'destructive' },
}

export const RISCO_CORES: Record<string, StatusConfig> = {
  baixo:   { label: 'Baixo',   cor: '#16A34A', bg: '#F0FDF4' },
  medio:   { label: 'Médio',   cor: '#CA8A04', bg: '#FEFCE8' },
  alto:    { label: 'Alto',    cor: '#EA580C', bg: '#FFF7ED' },
  critico: { label: 'Crítico', cor: '#DC2626', bg: '#FEF2F2' },
}

export const MOVIMENTACAO_TIPO: Record<string, StatusConfig> = {
  entrada: { label: 'Entrada', cor: '#16A34A', bg: '#F0FDF4' },
  saida:   { label: 'Saída',   cor: '#DC2626', bg: '#FEF2F2' },
}

export const TIPO_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro:       'Dinheiro',
  pix:            'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito:  'Cartão de Débito',
  boleto:         'Boleto',
  transferencia:  'Transferência',
  cheque:         'Cheque',
}
