-- Assertiva Integration Tables + Columns
-- Run this in the Supabase SQL Editor for project: relldwstuqmrefeviaua

-- 1. Adiciona colunas Assertiva na tabela de clientes
ALTER TABLE clientes_factoring
  ADD COLUMN IF NOT EXISTS dados_assertiva         jsonb,
  ADD COLUMN IF NOT EXISTS score_assertiva         integer,
  ADD COLUMN IF NOT EXISTS faixa_risco_assertiva   text,
  ADD COLUMN IF NOT EXISTS renda_estimada_assertiva numeric(15,2),
  ADD COLUMN IF NOT EXISTS assertiva_consultado_em  timestamptz;

-- 2. Idem para clientes do empório (opcional)
ALTER TABLE clientes_emporio
  ADD COLUMN IF NOT EXISTS dados_assertiva         jsonb,
  ADD COLUMN IF NOT EXISTS score_assertiva         integer,
  ADD COLUMN IF NOT EXISTS assertiva_consultado_em  timestamptz;


CREATE TABLE IF NOT EXISTS assertiva_cache_factoring (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text UNIQUE NOT NULL,
  resultado   jsonb NOT NULL,
  consultado_em timestamptz DEFAULT now(),
  expira_em   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assertiva_cache_chave    ON assertiva_cache_factoring (chave);
CREATE INDEX IF NOT EXISTS idx_assertiva_cache_expira   ON assertiva_cache_factoring (expira_em);

CREATE TABLE IF NOT EXISTS assertiva_log_factoring (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text,
  chave       text,
  usuario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hit_cache   boolean DEFAULT false,
  status_http int,
  erro        text,
  criado_em   timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE assertiva_cache_factoring   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assertiva_log_factoring     ENABLE ROW LEVEL SECURITY;

-- Service role full access (used by API routes)
CREATE POLICY "service_role_all_cache" ON assertiva_cache_factoring
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_log" ON assertiva_log_factoring
  FOR ALL TO service_role USING (true) WITH CHECK (true);
