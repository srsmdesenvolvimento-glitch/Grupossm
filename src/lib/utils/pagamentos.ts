// Lógica única de status de pagamento parcial, compartilhada entre
// contas-receber, contas-pagar, clientes/[id] e vendas/[id]. Antes, cada
// tela marcava a parcela/conta como 'pago' mesmo quando o valor informado
// era menor que o valor devido — o saldo restante desaparecia sem deixar
// rastro. Agora o valor pago é sempre acumulado (nunca sobrescrito) e o
// status reflete se ainda falta receber/pagar algo.

export type StatusPagamento = 'pago' | 'parcial'

export function calcularStatusPagamento(valorTotal: number, valorPagoAcumulado: number): StatusPagamento {
  return valorPagoAcumulado >= valorTotal ? 'pago' : 'parcial'
}

export function calcularValorPagoAcumulado(valorPagoAnterior: number | null, valorRecebidoAgora: number): number {
  return (valorPagoAnterior ?? 0) + valorRecebidoAgora
}

export function calcularSaldoRestante(valorTotal: number, valorPagoAcumulado: number | null): number {
  return Math.max(0, valorTotal - (valorPagoAcumulado ?? 0))
}
