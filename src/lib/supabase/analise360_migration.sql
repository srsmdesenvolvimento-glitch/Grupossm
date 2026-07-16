-- Migration: Análise Comportamental / Análise 360 (Assertiva) — consulta assíncrona
-- via webhook, usada para trazer bens e patrimônio (imóveis, quadro societário,
-- limite de crédito sugerido, antifraude) de clientes PESSOA JURÍDICA.
-- A Assertiva não oferece dados de imóveis para pessoa física (CPF) em nenhum
-- produto — só para CNPJ, e apenas por este produto assíncrono.
-- Run this in the Supabase SQL Editor for your project (relldwstuqmrefeviaua)

-- 0. clientes_factoring nunca armazenava o CNPJ nem o tipo de pessoa — o cadastro
-- de cliente PJ usava o CNPJ só transitoriamente (no wizard) para consultar a
-- Assertiva e depois descartava o número. Sem isso não dá pra disparar a Análise
-- 360 depois do cadastro, nem saber com certeza se o cliente é PF ou PJ.
ALTER TABLE clientes_factoring
  ADD COLUMN IF NOT EXISTS cnpj        VARCHAR(18) UNIQUE,
  ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(10) NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica', 'juridica'));

CREATE TABLE IF NOT EXISTS assertiva_analise360_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id     UUID        NOT NULL REFERENCES clientes_factoring(id) ON DELETE CASCADE,
  documento      VARCHAR(14) NOT NULL,
  webhook_token  TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'erro')),
  resultado      JSONB,
  erro           TEXT,
  solicitado_por UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  solicitado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analise360_cliente ON assertiva_analise360_jobs (cliente_id);
CREATE INDEX IF NOT EXISTS idx_analise360_status   ON assertiva_analise360_jobs (status);
CREATE INDEX IF NOT EXISTS idx_analise360_token    ON assertiva_analise360_jobs (webhook_token);

ALTER TABLE assertiva_analise360_jobs ENABLE ROW LEVEL SECURITY;

-- Service role (edge/API routes) tem acesso total, incluindo o webhook receiver
CREATE POLICY "service_role_all_analise360" ON assertiva_analise360_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários da empresa podem ver/solicitar consultas dos seus próprios clientes
CREATE POLICY "analise360_all" ON assertiva_analise360_jobs
  FOR ALL USING (has_empresa_access(empresa_id));
