-- Motor de Score — adiciona coluna regras_score na config_factoring
-- Execute no Supabase SQL Editor (projeto: relldwstuqmrefeviaua)

ALTER TABLE config_factoring
  ADD COLUMN IF NOT EXISTS regras_score JSONB,
  ADD COLUMN IF NOT EXISTS faixas_risco  JSONB;

-- Verifica
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'config_factoring'
  AND column_name IN ('regras_score', 'faixas_risco');
