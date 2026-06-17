-- ===================================================================
-- MIGRATION: WHATSAPP IMPROVEMENTS & WEBHOOK INTEGRATION
-- ===================================================================

-- 1. Add delay_ms to config_whatsapp (default 1200 milliseconds)
ALTER TABLE config_whatsapp ADD COLUMN IF NOT EXISTS delay_ms INTEGER NOT NULL DEFAULT 1200;

-- 2. Add whatsapp_message_id to notificacoes_log to track delivery status from webhooks
ALTER TABLE notificacoes_log ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(100);

-- 3. Create index for performance on webhook lookups
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_whatsapp_msg_id ON notificacoes_log(whatsapp_message_id);

-- 4. Update existing factoring configs to ensure they have the hora_envio field
UPDATE config_factoring 
SET whatsapp_settings = jsonb_set(
  COALESCE(whatsapp_settings, '{}'::jsonb), 
  '{hora_envio}', 
  '"09:00"'::jsonb
)
WHERE whatsapp_settings->>'hora_envio' IS NULL;
