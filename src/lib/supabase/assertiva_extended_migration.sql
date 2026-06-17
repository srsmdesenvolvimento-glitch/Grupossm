-- Migration to add extended Assertiva data columns to clientes_factoring and clientes_emporio
-- Run this in the Supabase SQL Editor for your project (relldwstuqmrefeviaua)

-- 1. Extend clientes_factoring
ALTER TABLE clientes_factoring
  ADD COLUMN IF NOT EXISTS total_negativacoes_assertiva        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_negativacoes_assertiva  numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_protestos_assertiva           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_protestos_assertiva     numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_acoes_judiciais_assertiva     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_acoes_assertiva         numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_ccf_assertiva                 integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dividas_assertiva             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_dividas_assertiva       numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pep_assertiva                       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS indicador_obito_assertiva           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS situacao_documento_assertiva        text,
  ADD COLUMN IF NOT EXISTS faturamento_presumido_assertiva     numeric(15,2);

-- 2. Extend clientes_emporio with basic + new Assertiva columns
ALTER TABLE clientes_emporio
  ADD COLUMN IF NOT EXISTS dados_assertiva                     jsonb,
  ADD COLUMN IF NOT EXISTS score_assertiva                     integer,
  ADD COLUMN IF NOT EXISTS assertiva_consultado_em             timestamptz,
  ADD COLUMN IF NOT EXISTS faixa_risco_assertiva               text,
  ADD COLUMN IF NOT EXISTS renda_estimada_assertiva            numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_negativacoes_assertiva        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_negativacoes_assertiva  numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_protestos_assertiva           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_protestos_assertiva     numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_acoes_judiciais_assertiva     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_acoes_assertiva         numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_ccf_assertiva                 integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dividas_assertiva             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_dividas_assertiva       numeric(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pep_assertiva                       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS indicador_obito_assertiva           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS situacao_documento_assertiva        text,
  ADD COLUMN IF NOT EXISTS faturamento_presumido_assertiva     numeric(15,2);
