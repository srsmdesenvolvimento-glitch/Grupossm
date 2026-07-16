-- Renegociação de empréstimo — hoje "renegociado" existia só como rótulo de
-- status, sem nenhuma tela pra de fato quebrar parcela, esticar prazo, dar
-- desconto de quitação e recalcular uma tabela de amortização nova. Esta
-- tabela guarda o histórico de cada renegociação feita (auditoria: valor
-- antes/depois, quantas parcelas, taxa usada, motivo).

CREATE TABLE IF NOT EXISTS renegociacoes_emprestimo (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  emprestimo_id       UUID          NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  usuario_id          UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo                VARCHAR(30)   NOT NULL, -- 'nova_tabela' | 'desconto_quitacao'
  saldo_anterior      DECIMAL(12,2) NOT NULL,
  saldo_novo          DECIMAL(12,2) NOT NULL,
  desconto_valor      DECIMAL(12,2) NOT NULL DEFAULT 0,
  parcelas_antigas_qtd INT          NOT NULL DEFAULT 0,
  parcelas_novas_qtd  INT           NOT NULL DEFAULT 0,
  taxa_juros_usada    DECIMAL(8,4),
  motivo              TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renegociacoes_emprestimo ON renegociacoes_emprestimo(emprestimo_id);

ALTER TABLE renegociacoes_emprestimo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "renegociacoes_emprestimo_all" ON renegociacoes_emprestimo;
CREATE POLICY "renegociacoes_emprestimo_all" ON renegociacoes_emprestimo
  FOR ALL USING (has_empresa_access(empresa_id));
