-- Score Refactor Migration
-- Projeto: relldwstuqmrefeviaua
-- Execute no Supabase SQL Editor

-- 1. Atualiza clientes que já têm score Assertiva mas ainda têm score_interno padrão (50)
--    Converte: assertiva (0-1000) → interno (0-100) via divisão por 10
UPDATE clientes_factoring
SET score_interno = GREATEST(0, LEAST(100, ROUND(score_assertiva::float / 10)::int))
WHERE score_assertiva IS NOT NULL
  AND score_interno = 50;

-- 2. Clientes sem Assertiva: mantém 50 como padrão (sem alteração necessária)

-- 3. Verifica resultado
SELECT
  COUNT(*) FILTER (WHERE score_assertiva IS NOT NULL) AS "com assertiva",
  COUNT(*) FILTER (WHERE score_assertiva IS NULL)     AS "sem assertiva",
  AVG(score_interno)::numeric(5,1)                   AS "score médio",
  MIN(score_interno)                                  AS "score mín",
  MAX(score_interno)                                  AS "score máx"
FROM clientes_factoring;
