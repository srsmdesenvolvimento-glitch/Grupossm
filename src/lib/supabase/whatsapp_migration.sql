-- ===================================================================
-- MIGRATION: WHATSAPP INTEGRATION & AUTOMATIONS
-- ===================================================================

-- 1. Create WhatsApp credentials configuration table
CREATE TABLE IF NOT EXISTS config_whatsapp (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  api_url          VARCHAR(255)  NOT NULL,
  api_key          VARCHAR(255)  NOT NULL,
  instance_name    VARCHAR(100)  NOT NULL,
  status           VARCHAR(50)   NOT NULL DEFAULT 'desconectado',
  ativo            BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE config_whatsapp ENABLE ROW LEVEL SECURITY;

-- Create policies for config_whatsapp
CREATE POLICY "Permitir leitura de config_whatsapp por administradores da empresa"
  ON config_whatsapp
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_empresa ue
      WHERE ue.empresa_id = config_whatsapp.empresa_id
      AND ue.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Permitir inserção/atualização de config_whatsapp por administradores"
  ON config_whatsapp
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuario_empresa ue
      WHERE ue.empresa_id = config_whatsapp.empresa_id
      AND ue.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_empresa ue
      WHERE ue.empresa_id = config_whatsapp.empresa_id
      AND ue.usuario_id = auth.uid()
    )
  );

-- Create index on empresa_id for config_whatsapp
CREATE INDEX IF NOT EXISTS idx_config_whatsapp_empresa ON config_whatsapp(empresa_id);

-- 2. Add whatsapp_settings column to config_factoring
ALTER TABLE config_factoring ADD COLUMN IF NOT EXISTS whatsapp_settings JSONB DEFAULT '{
  "contrato_criado": {
    "ativo": true,
    "template": "Olá, {{nome}}! O seu contrato de empréstimo {{numero_contrato}} no valor de {{valor_principal}} foi criado e está pronto para assinatura. Por favor, acesse o link a seguir para assinar digitalmente: {{link_assinatura}}"
  },
  "contrato_assinado": {
    "ativo": true,
    "template": "Olá, {{nome}}! Seu contrato {{numero_contrato}} foi assinado digitalmente com sucesso. Segue em anexo a sua via do documento oficial com validade jurídica: {{link_contrato}}"
  },
  "lembrete_pre_vencimento": {
    "ativo": true,
    "dias_antes": 3,
    "template": "Olá, {{nome}}! Passando para lembrar que sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} vence em {{dias_antes}} dias ({{data_vencimento}}) no valor de {{valor}}. Chave PIX: {{whatsapp_padrao}}."
  },
  "lembrete_vencimento": {
    "ativo": true,
    "template": "Atenção, {{nome}}! Sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} vence HOJE ({{data_vencimento}}) no valor de {{valor}}. Chave PIX de pagamento: {{whatsapp_padrao}}. Favor desconsiderar caso já pago."
  },
  "cobranca_pos_vencimento": {
    "ativo": true,
    "template": "Prezado(a) {{nome}}, consta em nosso sistema que a sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} está em atraso há {{dias_atraso}} dias. O valor de {{valor}} foi atualizado para {{valor_total}} (multa de {{multa}} e juros de {{juros_mora}}). Favor regularizar via PIX: {{whatsapp_padrao}}."
  }
}''::jsonb;
