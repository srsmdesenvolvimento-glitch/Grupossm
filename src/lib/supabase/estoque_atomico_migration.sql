-- Corrige duas falhas na gestão de estoque do Empório:
--
-- 1. Race condition: entrada/ajuste/perda e venda calculavam o novo estoque
--    a partir do valor lido no carregamento da tela (estoque desatualizado).
--    Duas operações simultâneas no mesmo produto liam o mesmo valor antigo e
--    a segunda sobrescrevia o resultado da primeira (estoque incorreto /
--    venda além do disponível).
-- 2. Falta de atomicidade: finalizarVenda() fazia 5+ chamadas Supabase
--    separadas (venda, itens, estoque, parcelas, caixa) sem transação — uma
--    falha no meio deixava dados parciais (venda criada sem baixa de
--    estoque, por exemplo).
--
-- A correção usa funções Postgres (SECURITY DEFINER) que fazem todo o
-- trabalho dentro de uma única transação implícita, com "SELECT ... FOR
-- UPDATE" para travar a linha do produto antes de ler/decrementar o
-- estoque — a segunda operação concorrente espera a primeira liberar o
-- lock e enxerga o valor já atualizado.

-- ═══════════════════════════════════════════════════════════════
-- TABELA: histórico de movimentações de estoque
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id        UUID          NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  usuario_id        UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo              VARCHAR(20)   NOT NULL, -- 'entrada' | 'ajuste' | 'perda' | 'venda'
  quantidade        INT           NOT NULL, -- delta aplicado (negativo em saída)
  estoque_anterior  INT           NOT NULL,
  estoque_novo      INT           NOT NULL,
  motivo            TEXT,
  referencia_tipo   VARCHAR(50),
  referencia_id     UUID,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_empresa ON movimentacoes_estoque(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_produto ON movimentacoes_estoque(produto_id, created_at DESC);

ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimentacoes_estoque_select" ON movimentacoes_estoque;
CREATE POLICY "movimentacoes_estoque_select" ON movimentacoes_estoque
  FOR SELECT USING (has_empresa_access(empresa_id));

-- Sem policy de INSERT/UPDATE/DELETE para o client: os únicos gravadores
-- são as funções SECURITY DEFINER abaixo, que já validam o acesso à
-- empresa internamente antes de escrever.

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÕES: movimentações unitárias (entrada / ajuste / perda)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION registrar_entrada_estoque(
  p_produto_id UUID,
  p_quantidade INT,
  p_usuario_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_atual      INT;
  v_novo       INT;
BEGIN
  SELECT empresa_id, estoque INTO v_empresa_id, v_atual
  FROM produtos WHERE id = p_produto_id FOR UPDATE;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF NOT has_empresa_access(v_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 1 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  v_novo := v_atual + p_quantidade;
  UPDATE produtos SET estoque = v_novo WHERE id = p_produto_id;

  INSERT INTO movimentacoes_estoque (
    empresa_id, produto_id, usuario_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo
  ) VALUES (
    v_empresa_id, p_produto_id, p_usuario_id, 'entrada', p_quantidade, v_atual, v_novo, p_motivo
  );

  RETURN v_novo;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_perda_estoque(
  p_produto_id UUID,
  p_quantidade INT,
  p_usuario_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_atual      INT;
  v_novo       INT;
BEGIN
  SELECT empresa_id, estoque INTO v_empresa_id, v_atual
  FROM produtos WHERE id = p_produto_id FOR UPDATE;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF NOT has_empresa_access(v_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 1 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  IF p_quantidade > v_atual THEN
    RAISE EXCEPTION 'Quantidade maior que o estoque atual (%)', v_atual;
  END IF;

  v_novo := v_atual - p_quantidade;
  UPDATE produtos SET estoque = v_novo WHERE id = p_produto_id;

  INSERT INTO movimentacoes_estoque (
    empresa_id, produto_id, usuario_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo
  ) VALUES (
    v_empresa_id, p_produto_id, p_usuario_id, 'perda', -p_quantidade, v_atual, v_novo, p_motivo
  );

  RETURN v_novo;
END;
$$;

CREATE OR REPLACE FUNCTION registrar_ajuste_estoque(
  p_produto_id UUID,
  p_quantidade_real INT,
  p_usuario_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_atual      INT;
BEGIN
  SELECT empresa_id, estoque INTO v_empresa_id, v_atual
  FROM produtos WHERE id = p_produto_id FOR UPDATE;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF NOT has_empresa_access(v_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  IF p_quantidade_real IS NULL OR p_quantidade_real < 0 THEN
    RAISE EXCEPTION 'Quantidade não pode ser negativa';
  END IF;

  UPDATE produtos SET estoque = p_quantidade_real WHERE id = p_produto_id;

  INSERT INTO movimentacoes_estoque (
    empresa_id, produto_id, usuario_id, tipo, quantidade, estoque_anterior, estoque_novo, motivo
  ) VALUES (
    v_empresa_id, p_produto_id, p_usuario_id, 'ajuste', p_quantidade_real - v_atual, v_atual, p_quantidade_real, p_motivo
  );

  RETURN p_quantidade_real;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÃO: finalizar venda do Empório de ponta a ponta (atômica)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finalizar_venda_emporio(
  p_empresa_id     UUID,
  p_cliente_id     UUID,
  p_usuario_id     UUID,
  p_itens          JSONB,   -- [{produto_id, nome_produto, sku_produto, quantidade, preco_unitario}]
  p_subtotal       DECIMAL,
  p_desconto       DECIMAL,
  p_total          DECIMAL,
  p_tipo_pagamento VARCHAR,
  p_parcelas       INT,
  p_valor_entrada  DECIMAL,
  p_observacoes    TEXT,
  p_gerar_parcelas BOOLEAN
)
RETURNS TABLE(venda_id UUID, numero_venda INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id      UUID;
  v_numero_venda  INT;
  v_item          JSONB;
  v_produto_id    UUID;
  v_quantidade    INT;
  v_estoque_atual INT;
  v_estoque_novo  INT;
  v_valor_parcela DECIMAL(12,2);
  v_vencimento    DATE;
  i               INT;
BEGIN
  IF NOT has_empresa_access(p_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A venda precisa de ao menos um item';
  END IF;

  INSERT INTO vendas (
    empresa_id, cliente_id, usuario_id, subtotal, desconto, total,
    tipo_pagamento, parcelas, valor_entrada, observacoes, status
  ) VALUES (
    p_empresa_id, p_cliente_id, p_usuario_id, p_subtotal, p_desconto, p_total,
    p_tipo_pagamento::tipo_pagamento, p_parcelas, p_valor_entrada, p_observacoes, 'aprovada'
  )
  RETURNING vendas.id, vendas.numero_venda INTO v_venda_id, v_numero_venda;

  -- Trava as linhas de produto em ordem determinística (por id) para
  -- eliminar deadlock entre vendas concorrentes com itens em comum.
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_itens) elem
    ORDER BY (elem->>'produto_id')
  LOOP
    v_produto_id := (v_item->>'produto_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::INT;

    IF v_quantidade IS NULL OR v_quantidade < 1 THEN
      RAISE EXCEPTION 'Quantidade inválida para o produto %', v_produto_id;
    END IF;

    INSERT INTO itens_venda (
      venda_id, produto_id, nome_produto, sku_produto, quantidade, preco_unitario, desconto, total
    ) VALUES (
      v_venda_id, v_produto_id, v_item->>'nome_produto', v_item->>'sku_produto',
      v_quantidade, (v_item->>'preco_unitario')::DECIMAL, 0,
      (v_item->>'preco_unitario')::DECIMAL * v_quantidade
    );

    SELECT estoque INTO v_estoque_atual FROM produtos WHERE id = v_produto_id FOR UPDATE;
    IF v_estoque_atual IS NULL THEN
      RAISE EXCEPTION 'Produto % não encontrado', v_produto_id;
    END IF;
    IF v_estoque_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%" (disponível: %, solicitado: %)',
        v_item->>'nome_produto', v_estoque_atual, v_quantidade;
    END IF;

    v_estoque_novo := v_estoque_atual - v_quantidade;
    UPDATE produtos SET estoque = v_estoque_novo WHERE id = v_produto_id;

    INSERT INTO movimentacoes_estoque (
      empresa_id, produto_id, usuario_id, tipo, quantidade,
      estoque_anterior, estoque_novo, referencia_tipo, referencia_id
    ) VALUES (
      p_empresa_id, v_produto_id, p_usuario_id, 'venda', -v_quantidade,
      v_estoque_atual, v_estoque_novo, 'venda', v_venda_id
    );
  END LOOP;

  IF p_gerar_parcelas AND p_parcelas > 1 THEN
    v_valor_parcela := (p_total - p_valor_entrada) / p_parcelas;
    FOR i IN 1..p_parcelas LOOP
      v_vencimento := (CURRENT_DATE + (i || ' months')::INTERVAL)::DATE;
      INSERT INTO parcelas_receber (
        empresa_id, venda_id, cliente_id, numero_parcela, total_parcelas,
        valor, data_vencimento, status
      ) VALUES (
        p_empresa_id, v_venda_id, p_cliente_id, i, p_parcelas,
        v_valor_parcela, v_vencimento, 'pendente'
      );
    END LOOP;
  END IF;

  INSERT INTO movimentacoes_caixa (
    empresa_id, usuario_id, tipo, categoria, descricao, valor,
    referencia_tipo, referencia_id, data_movimentacao
  ) VALUES (
    p_empresa_id, p_usuario_id, 'entrada', 'venda', 'Venda #' || v_numero_venda, p_total,
    'venda', v_venda_id, CURRENT_DATE
  );

  RETURN QUERY SELECT v_venda_id, v_numero_venda;
END;
$$;
