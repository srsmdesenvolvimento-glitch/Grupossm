-- ═══════════════════════════════════════════════════════════════
-- GRUPO SRSM — SISTEMA DE ASSINATURAS (SaaS Plans)
-- Executar no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Planos de Assinatura ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS planos_assinatura (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(100)  NOT NULL,
  descricao       TEXT,
  preco_mensal    DECIMAL(12,2) NOT NULL DEFAULT 0,
  preco_anual     DECIMAL(12,2),
  max_usuarios    INT           NOT NULL DEFAULT 5,
  max_empresas    INT           NOT NULL DEFAULT 1,
  recursos        JSONB         NOT NULL DEFAULT '{}',
  destaque        BOOLEAN       NOT NULL DEFAULT FALSE,
  ordem           INT           NOT NULL DEFAULT 0,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Status de Assinatura ─────────────────────────────────────
CREATE TYPE status_assinatura AS ENUM (
  'trial',
  'ativa',
  'inadimplente',
  'cancelada',
  'suspensa',
  'expirada'
);

-- ── Assinaturas das Empresas ─────────────────────────────────
CREATE TABLE IF NOT EXISTS assinaturas (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID               NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plano_id              UUID               NOT NULL REFERENCES planos_assinatura(id),
  status                status_assinatura  NOT NULL DEFAULT 'trial',
  periodicidade         VARCHAR(10)        NOT NULL DEFAULT 'mensal' CHECK (periodicidade IN ('mensal', 'anual')),
  data_inicio           DATE               NOT NULL DEFAULT CURRENT_DATE,
  data_fim              DATE,
  data_renovacao        DATE,
  valor_cobrado         DECIMAL(12,2),
  desconto_pct          DECIMAL(5,2)       NOT NULL DEFAULT 0,
  contrato_url          TEXT,
  assinado_em           TIMESTAMPTZ,
  assinado_por          VARCHAR(255),
  assinado_ip           VARCHAR(64),
  observacoes           TEXT,
  created_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id)
);

-- ── Histórico de Pagamentos de Assinatura ────────────────────
CREATE TABLE IF NOT EXISTS pagamentos_assinatura (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id   UUID          NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  empresa_id      UUID          NOT NULL REFERENCES empresas(id),
  valor           DECIMAL(12,2) NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'falhou', 'estornado')),
  tipo_pagamento  VARCHAR(30),
  referencia      VARCHAR(100),
  comprovante_url TEXT,
  vencimento      DATE          NOT NULL,
  pago_em         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Salários / Encargos de Funcionários ─────────────────────
CREATE TABLE IF NOT EXISTS salarios (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id      UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cargo           VARCHAR(100),
  valor_base      DECIMAL(12,2) NOT NULL,
  beneficios      DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_liquido   DECIMAL(12,2) GENERATED ALWAYS AS (valor_base + beneficios - desconto) STORED,
  data_inicio     DATE          NOT NULL DEFAULT CURRENT_DATE,
  data_fim        DATE,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assinaturas_empresa   ON assinaturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status    ON assinaturas(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_renovacao ON assinaturas(data_renovacao);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON pagamentos_assinatura(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_salarios_usuario      ON salarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_salarios_empresa      ON salarios(empresa_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE planos_assinatura    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarios             ENABLE ROW LEVEL SECURITY;

-- Planos: leitura pública para usuários autenticados
CREATE POLICY "planos_read_authenticated"
  ON planos_assinatura FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Assinaturas: admin da empresa enxerga a própria
CREATE POLICY "assinaturas_read_own_empresa"
  ON assinaturas FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa
      WHERE usuario_id = auth.uid() AND ativo = true
    )
  );

-- Pagamentos: admin da empresa enxerga os próprios
CREATE POLICY "pagamentos_read_own_empresa"
  ON pagamentos_assinatura FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa
      WHERE usuario_id = auth.uid() AND ativo = true
    )
  );

-- Salários: admin da empresa enxerga os próprios
CREATE POLICY "salarios_read_own_empresa"
  ON salarios FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuario_empresa
      WHERE usuario_id = auth.uid() AND papel = 'admin' AND ativo = true
    )
  );

-- ── Planos padrão ────────────────────────────────────────────
INSERT INTO planos_assinatura (nome, descricao, preco_mensal, preco_anual, max_usuarios, max_empresas, recursos, destaque, ordem)
VALUES
  (
    'Starter',
    'Ideal para empresas em crescimento com necessidades básicas de gestão.',
    297.00, 2970.00, 3, 1,
    '{"emporio": true, "factoring": false, "whatsapp": true, "relatorios_basicos": true, "suporte_email": true}',
    false, 1
  ),
  (
    'Profissional',
    'Para empresas que precisam de gestão completa com módulo financeiro avançado.',
    597.00, 5970.00, 10, 2,
    '{"emporio": true, "factoring": true, "whatsapp": true, "relatorios_avancados": true, "assinatura_digital": true, "suporte_prioritario": true}',
    true, 2
  ),
  (
    'Empresarial',
    'Para grupos e multinacionais com múltiplas unidades e usuários ilimitados.',
    1197.00, 11970.00, 100, 10,
    '{"emporio": true, "factoring": true, "whatsapp": true, "relatorios_avancados": true, "assinatura_digital": true, "api_access": true, "sla_99_9": true, "suporte_dedicado": true, "onboarding_personalizado": true}',
    false, 3
  )
ON CONFLICT DO NOTHING;
