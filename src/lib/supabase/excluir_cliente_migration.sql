-- ═══════════════════════════════════════════════════════════════════════════════
-- EXCLUSÃO ATÔMICA DE CLIENTE (FACTORING)
-- ═══════════════════════════════════════════════════════════════════════════════
-- A rota DELETE /api/clientes/[id] fazia a checagem de "contrato em aberto"
-- e os dois deletes (emprestimos, depois clientes_factoring) como chamadas
-- separadas — se a segunda falhasse, o histórico de empréstimos já tinha
-- sido apagado sem o cliente ir junto (estado parcial), e havia uma janela
-- entre a checagem e o delete onde um empréstimo novo podia ser aberto pro
-- mesmo cliente sem ser pego pela validação. Esta função roda a checagem +
-- os dois deletes como uma única transação no Postgres.

CREATE OR REPLACE FUNCTION excluir_cliente_factoring(p_cliente_id UUID)
RETURNS TABLE(sucesso BOOLEAN, contratos_abertos JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contratos JSONB;
BEGIN
  -- Trava a linha do cliente: serializa exclusões concorrentes do mesmo
  -- cliente. Não impede um empréstimo novo ser criado em paralelo (esse
  -- INSERT não disputa este lock), mas elimina o round-trip de rede que
  -- existia entre a checagem e o delete na versão anterior — a janela de
  -- corrida cai de "segundos" (ida e volta Next.js → Postgres) para
  -- sub-milissegundo (statements sequenciais dentro da mesma função).
  PERFORM 1 FROM clientes_factoring WHERE id = p_cliente_id FOR UPDATE;

  SELECT jsonb_agg(jsonb_build_object('numero', numero_contrato, 'status', status))
    INTO v_contratos
    FROM emprestimos
   WHERE cliente_id = p_cliente_id
     AND status NOT IN ('quitado', 'cancelado');

  IF v_contratos IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_contratos;
    RETURN;
  END IF;

  -- emprestimos.cliente_id é ON DELETE RESTRICT — mesmo contratos já
  -- quitados/cancelados impedem apagar o cliente enquanto existirem.
  -- parcelas_emprestimo / historico_status_emprestimo / renegociacoes_emprestimo
  -- cascateiam sozinhos a partir de emprestimos.id.
  DELETE FROM emprestimos WHERE cliente_id = p_cliente_id;

  -- referencias_cliente_factoring, lembretes_cliente_factoring e
  -- assertiva_analise360_jobs cascateiam sozinhos a partir de
  -- clientes_factoring.id. movimentacoes_caixa.referencia_id é polimórfico
  -- (sem FK, por design — aponta pra emprestimos/clientes/outras origens
  -- conforme referencia_tipo) e fica órfão de propósito: é ledger
  -- financeiro, não pode desaparecer junto com o cadastro do cliente.
  DELETE FROM clientes_factoring WHERE id = p_cliente_id;

  RETURN QUERY SELECT TRUE, NULL::JSONB;
END;
$$;
