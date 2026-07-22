-- ═══════════════════════════════════════════════════════════════════════════════
-- EXPANSÃO FACTORING — INVESTIGAÇÃO DE POSSES, PARENTES E AVALISTAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. NOVAS COLUNAS EM EMPRÉSTIMOS PARA AVALISTAS E GARANTIAS DETALHADAS
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS avalistas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS garantias_detalhadas JSONB DEFAULT '[]'::jsonb;

-- 2. ATUALIZAÇÃO DA RPC ATÔMICA ORIGINAR_EMPRESTIMO_FACTORING
-- Inclui suporte aos campos p_avalistas e p_garantias_detalhadas
DROP FUNCTION IF EXISTS originar_emprestimo_factoring(UUID, UUID, UUID, DECIMAL, DECIMAL, INT, DECIMAL, DECIMAL, DECIMAL, DATE, DATE, JSONB, TEXT, TEXT, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION originar_emprestimo_factoring(
  p_empresa_id               UUID,
  p_cliente_id               UUID,
  p_usuario_id               UUID,
  p_valor_principal          DECIMAL(12,2),
  p_taxa_juros               DECIMAL(8,4),
  p_prazo_meses              INT,
  p_valor_parcela            DECIMAL(12,2),
  p_total_pagar              DECIMAL(12,2),
  p_total_juros              DECIMAL(12,2),
  p_data_liberacao           DATE,
  p_data_primeiro_vencimento DATE,
  p_tabela_parcelas          JSONB,
  p_garantias                TEXT DEFAULT NULL,
  p_observacoes              TEXT DEFAULT NULL,
  p_sistema_amortizacao      VARCHAR(20) DEFAULT 'PRICE',
  p_assinatura_token         VARCHAR(64) DEFAULT NULL,
  p_avalistas                JSONB DEFAULT '[]'::jsonb,
  p_garantias_detalhadas     JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE(emprestimo_id UUID, numero_contrato VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emprestimo_id     UUID;
  v_numero_contrato   VARCHAR(50);
  v_ano_atual         INT;
  v_seq               INT;
  v_cliente_nome      TEXT;
  v_limite_credito    DECIMAL(12,2);
  v_credito_utilizado DECIMAL(12,2);
  v_item              JSONB;
BEGIN
  -- 1. Verifica permissão de acesso à empresa
  IF NOT has_empresa_access(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado para esta empresa.';
  END IF;

  -- 2. Validações básicas de entrada
  IF p_valor_principal IS NULL OR p_valor_principal <= 0 THEN
    RAISE EXCEPTION 'O valor principal deve ser maior que zero.';
  END IF;
  IF p_tabela_parcelas IS NULL OR jsonb_array_length(p_tabela_parcelas) = 0 THEN
    RAISE EXCEPTION 'A tabela de parcelas não pode estar vazia.';
  END IF;

  -- 3. Bloqueia e lê o cadastro do cliente com FOR UPDATE
  SELECT nome, COALESCE(limite_credito, 0), COALESCE(credito_utilizado, 0)
    INTO v_cliente_nome, v_limite_credito, v_credito_utilizado
  FROM clientes_factoring
  WHERE id = p_cliente_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_cliente_nome IS NULL THEN
    RAISE EXCEPTION 'Cliente não localizado nesta empresa.';
  END IF;

  -- 4. Gera o número sequencial do contrato para o ano atual
  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_contrato, '-', 2) AS INT)), 0) + 1
    INTO v_seq
  FROM emprestimos
  WHERE empresa_id = p_empresa_id
    AND numero_contrato LIKE 'EMP-' || v_ano_atual || '-%';

  v_numero_contrato := 'EMP-' || v_ano_atual || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- 5. Insere o registro mestre do Empréstimo com Avalistas e Garantias Detalhadas
  INSERT INTO emprestimos (
    empresa_id, cliente_id, usuario_id, numero_contrato, valor_principal,
    taxa_juros, prazo_meses, valor_parcela, total_pagar, total_juros,
    data_liberacao, data_primeiro_vencimento, garantias, observacoes,
    sistema_amortizacao, assinatura_token, avalistas, garantias_detalhadas, status
  ) VALUES (
    p_empresa_id, p_cliente_id, p_usuario_id, v_numero_contrato, p_valor_principal,
    p_taxa_juros, p_prazo_meses, p_valor_parcela, p_total_pagar, p_total_juros,
    p_data_liberacao, p_data_primeiro_vencimento, p_garantias, p_observacoes,
    p_sistema_amortizacao, p_assinatura_token, COALESCE(p_avalistas, '[]'::jsonb), COALESCE(p_garantias_detalhadas, '[]'::jsonb), 'ativo'
  )
  RETURNING id INTO v_emprestimo_id;

  -- 6. Insere cada parcela da tabela de amortização
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_tabela_parcelas)
  LOOP
    INSERT INTO parcelas_emprestimo (
      empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
      data_vencimento, valor, valor_principal, valor_juros, saldo_devedor, status
    ) VALUES (
      p_empresa_id, v_emprestimo_id, p_cliente_id,
      (v_item->>'numero_parcela')::INT,
      p_prazo_meses,
      (v_item->>'data_vencimento')::DATE,
      (v_item->>'valor')::DECIMAL,
      (v_item->>'valor_principal')::DECIMAL,
      (v_item->>'valor_juros')::DECIMAL,
      (v_item->>'saldo_devedor')::DECIMAL,
      'pendente'
    );
  END LOOP;

  -- 7. Registra a saída de capital no Caixa
  INSERT INTO movimentacoes_caixa (
    empresa_id, usuario_id, tipo, categoria, descricao, valor,
    referencia_tipo, referencia_id, data_movimentacao
  ) VALUES (
    p_empresa_id, p_usuario_id, 'saida', 'liberacao_emprestimo',
    'Empréstimo ' || v_numero_contrato || ' — ' || v_cliente_nome,
    p_valor_principal, 'emprestimo', v_emprestimo_id, p_data_liberacao
  );

  -- 8. Atualiza o limite de crédito utilizado e data da última operação do cliente
  UPDATE clientes_factoring
  SET credito_utilizado = v_credito_utilizado + p_valor_principal,
      ultima_operacao = p_data_liberacao
  WHERE id = p_cliente_id;

  RETURN QUERY SELECT v_emprestimo_id, v_numero_contrato;
END;
$$;
