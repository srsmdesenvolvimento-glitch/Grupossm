-- ===================================================================
-- MIGRATION: WHATSAPP FIX — whatsapp_message_id + webhook_logs
-- Aplique este script no Supabase SQL Editor se a coluna não existir.
-- É seguro re-executar (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ===================================================================

-- 1. Garante que whatsapp_message_id existe em notificacoes_log
--    (necessário para o webhook rastrear status entregue/lido)
ALTER TABLE notificacoes_log
  ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_notificacoes_log_whatsapp_msg_id
  ON notificacoes_log(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- 2. Garante que a tabela webhook_logs existe
--    (usada pelo POST /api/webhooks/whatsapp para auditoria)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       VARCHAR(50) NOT NULL,
  payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tipo_created
  ON webhook_logs(tipo, created_at DESC);

-- RLS: apenas service_role pode ler/inserir webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy para service_role (usado pelo createAdminClient)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webhook_logs'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all"
      ON webhook_logs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- 3. Garante que delay_ms existe em config_whatsapp
ALTER TABLE config_whatsapp
  ADD COLUMN IF NOT EXISTS delay_ms INTEGER NOT NULL DEFAULT 1200;

-- 4. Garante que hora_envio existe em config_factoring.whatsapp_settings
UPDATE config_factoring
SET whatsapp_settings = jsonb_set(
  COALESCE(whatsapp_settings, '{}'::jsonb),
  '{hora_envio}',
  '"09:00"'::jsonb
)
WHERE whatsapp_settings->>'hora_envio' IS NULL;
