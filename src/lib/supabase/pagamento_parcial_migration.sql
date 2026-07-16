-- Adiciona o status 'parcial' para representar uma parcela/conta com
-- pagamento parcial registrado (valor_pago > 0 mas < valor total). Antes,
-- registrar um valor menor que o devido ainda marcava a linha como 'pago'
-- e sobrescrevia valor_pago (perdendo o histórico de pagamentos parciais
-- anteriores). O app agora acumula valor_pago e só usa 'pago' quando o
-- valor acumulado cobre o valor total.

ALTER TYPE status_parcela     ADD VALUE IF NOT EXISTS 'parcial';
ALTER TYPE status_conta_pagar ADD VALUE IF NOT EXISTS 'parcial';

-- Parcelas parcialmente pagas também devem virar 'atrasado' quando vencem
-- (o saldo restante continua visível via valor_pago, independente do status).
CREATE OR REPLACE FUNCTION fn_marcar_parcelas_atrasadas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE parcelas_emprestimo
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;

  UPDATE parcelas_receber
  SET status = 'atrasado'
  WHERE status IN ('pendente', 'parcial')
    AND data_vencimento < CURRENT_DATE;
END;
$$;
