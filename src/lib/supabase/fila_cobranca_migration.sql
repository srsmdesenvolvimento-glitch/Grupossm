-- Fila de cobrança: permite atribuir um cliente inadimplente a um cobrador
-- responsável (pra filtrar "meus clientes" na tela de Inadimplentes) — hoje
-- a tela lista todo mundo pra todo mundo, sem dono definido.

ALTER TABLE clientes_factoring
  ADD COLUMN IF NOT EXISTS responsavel_cobranca_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_factoring_responsavel ON clientes_factoring(responsavel_cobranca_id);
