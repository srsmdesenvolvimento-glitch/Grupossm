-- Lembretes por cliente (factoring), com data e popup de aviso — pedido do
-- usuário para não perder follow-ups importantes ("me lembra tal dia").
-- Anexos de conversa/prints reaproveitam a coluna `documentos` (JSONB) que já
-- existe em clientes_factoring — não precisam de tabela nova.

CREATE TABLE IF NOT EXISTS lembretes_cliente_factoring (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id    UUID          NOT NULL REFERENCES clientes_factoring(id) ON DELETE CASCADE,
  usuario_id    UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo        VARCHAR(255)  NOT NULL,
  descricao     TEXT,
  data_lembrete DATE          NOT NULL,
  concluido     BOOLEAN       NOT NULL DEFAULT FALSE,
  concluido_em  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lembretes_empresa_data ON lembretes_cliente_factoring(empresa_id, data_lembrete) WHERE NOT concluido;
CREATE INDEX IF NOT EXISTS idx_lembretes_cliente       ON lembretes_cliente_factoring(cliente_id, data_lembrete);

ALTER TABLE lembretes_cliente_factoring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lembretes_cliente_factoring_all" ON lembretes_cliente_factoring;
CREATE POLICY "lembretes_cliente_factoring_all" ON lembretes_cliente_factoring
  FOR ALL USING (has_empresa_access(empresa_id));
