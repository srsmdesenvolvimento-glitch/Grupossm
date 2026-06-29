-- ===================================================================
-- WHATSAPP MASTER MIGRATION — Seguro para re-executar (idempotente)
-- Execute no SQL Editor do Supabase Dashboard se o módulo WhatsApp
-- não estiver funcionando. Roda sem erros mesmo que já exista.
-- ===================================================================

-- 1. Tabela config_whatsapp (credenciais da Evolution API por empresa)
CREATE TABLE IF NOT EXISTS config_whatsapp (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  api_url          VARCHAR(255)  NOT NULL DEFAULT '',
  api_key          VARCHAR(255)  NOT NULL DEFAULT '',
  instance_name    VARCHAR(100)  NOT NULL DEFAULT '',
  status           VARCHAR(50)   NOT NULL DEFAULT 'desconectado',
  ativo            BOOLEAN       NOT NULL DEFAULT true,
  delay_ms         INTEGER       NOT NULL DEFAULT 1200,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- delay_ms pode não existir se migration parcial foi executada antes
ALTER TABLE config_whatsapp ADD COLUMN IF NOT EXISTS delay_ms INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE config_whatsapp ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- RLS
ALTER TABLE config_whatsapp ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config_whatsapp' AND policyname = 'config_whatsapp_select'
  ) THEN
    CREATE POLICY "config_whatsapp_select"
      ON config_whatsapp FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM usuario_empresa ue
        WHERE ue.empresa_id = config_whatsapp.empresa_id
          AND ue.usuario_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config_whatsapp' AND policyname = 'config_whatsapp_all'
  ) THEN
    CREATE POLICY "config_whatsapp_all"
      ON config_whatsapp FOR ALL
      USING (EXISTS (
        SELECT 1 FROM usuario_empresa ue
        WHERE ue.empresa_id = config_whatsapp.empresa_id
          AND ue.usuario_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM usuario_empresa ue
        WHERE ue.empresa_id = config_whatsapp.empresa_id
          AND ue.usuario_id = auth.uid()
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_config_whatsapp_empresa ON config_whatsapp(empresa_id);

-- 2. Colunas extras em notificacoes_log
ALTER TABLE notificacoes_log ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_whatsapp_msg_id
  ON notificacoes_log(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- 3. Tabela webhook_logs (auditoria de eventos da Evolution API)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       VARCHAR(50) NOT NULL,
  payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tipo_created
  ON webhook_logs(tipo, created_at DESC);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'webhook_logs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all"
      ON webhook_logs FOR ALL
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Coluna whatsapp_settings em config_factoring (automações e templates)
ALTER TABLE config_factoring ADD COLUMN IF NOT EXISTS whatsapp_settings JSONB DEFAULT NULL;
ALTER TABLE config_factoring ADD COLUMN IF NOT EXISTS whatsapp_padrao  VARCHAR(255) DEFAULT NULL;

-- Popula hora_envio em empresas que já têm whatsapp_settings mas sem hora_envio
UPDATE config_factoring
SET whatsapp_settings = jsonb_set(
  COALESCE(whatsapp_settings, '{}'::jsonb),
  '{hora_envio}',
  '"09:00"'::jsonb
)
WHERE whatsapp_settings IS NOT NULL
  AND whatsapp_settings->>'hora_envio' IS NULL;

-- 5. Verificação final — lista o que existe
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'config_whatsapp')   AS config_whatsapp_existe,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'webhook_logs')       AS webhook_logs_existe,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'notificacoes_log' AND column_name = 'whatsapp_message_id') AS col_msg_id_existe,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'config_whatsapp'   AND column_name = 'delay_ms')           AS col_delay_ms_existe,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'config_factoring'  AND column_name = 'whatsapp_settings')  AS col_wp_settings_existe;
