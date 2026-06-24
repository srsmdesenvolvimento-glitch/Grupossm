-- ═══════════════════════════════════════════════════════════════
-- GRUPO SRSM — SCHEMA COMPLETO
-- Executar no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE tipo_empresa        AS ENUM ('emporio', 'factoring');
CREATE TYPE status_usuario      AS ENUM ('ativo', 'inativo');
CREATE TYPE papel_usuario       AS ENUM ('admin', 'gerente', 'operador', 'visualizador');
CREATE TYPE status_produto      AS ENUM ('ativo', 'inativo', 'sem_estoque');
CREATE TYPE status_cliente      AS ENUM ('ativo', 'inativo', 'bloqueado');
CREATE TYPE status_venda        AS ENUM ('orcamento', 'aprovada', 'entregue', 'cancelada');
CREATE TYPE tipo_pagamento      AS ENUM ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'cheque');
CREATE TYPE status_parcela      AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE categoria_conta     AS ENUM ('fornecedor', 'aluguel', 'salario', 'imposto', 'servico', 'outros');
CREATE TYPE status_conta_pagar  AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE status_emprestimo   AS ENUM ('analise', 'aprovado', 'ativo', 'quitado', 'inadimplente', 'cancelado');
CREATE TYPE tipo_taxa            AS ENUM ('mensal', 'anual');
CREATE TYPE status_parcela_emp  AS ENUM ('pendente', 'pago', 'atrasado', 'renegociado', 'cancelado');
CREATE TYPE canal_notificacao   AS ENUM ('whatsapp', 'sms', 'email', 'sistema');
CREATE TYPE tipo_movimentacao   AS ENUM ('entrada', 'saida');

-- ═══════════════════════════════════════════════════════════════
-- TABELAS
-- ═══════════════════════════════════════════════════════════════

-- 1. empresas
CREATE TABLE empresas (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(255) NOT NULL,
  tipo        tipo_empresa NOT NULL,
  cnpj        VARCHAR(18)  UNIQUE,
  telefone    VARCHAR(20),
  email       VARCHAR(255),
  endereco    TEXT,
  cidade      VARCHAR(100),
  estado      CHAR(2),
  cep         VARCHAR(9),
  logo_url    TEXT,
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. usuarios (espelha auth.users)
CREATE TABLE usuarios (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  telefone    VARCHAR(20),
  avatar_url  TEXT,
  status      status_usuario NOT NULL DEFAULT 'ativo',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. usuario_empresa (acesso multi-tenant)
CREATE TABLE usuario_empresa (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  papel       papel_usuario NOT NULL DEFAULT 'operador',
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);

-- 4. categorias_produto (Empório)
CREATE TABLE categorias_produto (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  slug        VARCHAR(100),
  icone       VARCHAR(50),
  ordem       INT          NOT NULL DEFAULT 0,
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, slug)
);

-- 5. fornecedores (Empório)
CREATE TABLE fornecedores (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID         NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome        VARCHAR(255) NOT NULL,
  cnpj        VARCHAR(18),
  cpf         VARCHAR(14),
  telefone    VARCHAR(20),
  email       VARCHAR(255),
  endereco    TEXT,
  cidade      VARCHAR(100),
  estado      CHAR(2),
  contato     VARCHAR(255),
  observacoes TEXT,
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 6. produtos (Empório)
CREATE TABLE produtos (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id         UUID          REFERENCES categorias_produto(id) ON DELETE SET NULL,
  fornecedor_id        UUID          REFERENCES fornecedores(id) ON DELETE SET NULL,
  nome                 VARCHAR(255)  NOT NULL,
  descricao            TEXT,
  descricao_curta      VARCHAR(500),
  sku                  VARCHAR(100),
  preco                DECIMAL(12,2) NOT NULL DEFAULT 0,
  preco_custo          DECIMAL(12,2),
  estoque              INT           NOT NULL DEFAULT 0,
  estoque_minimo       INT           NOT NULL DEFAULT 0,
  unidade              VARCHAR(20)   NOT NULL DEFAULT 'un',
  peso                 DECIMAL(8,3),
  dimensoes            JSONB,
  imagens              JSONB         NOT NULL DEFAULT '[]',
  tags                 TEXT[],
  destaque             BOOLEAN       NOT NULL DEFAULT FALSE,
  disponivel_catalogo  BOOLEAN       NOT NULL DEFAULT TRUE,
  status               status_produto NOT NULL DEFAULT 'ativo',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, sku)
);

-- 7. config_catalogo (configuração do catálogo público)
CREATE TABLE config_catalogo (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  slug            VARCHAR(100)  NOT NULL UNIQUE,
  titulo          VARCHAR(255)  NOT NULL DEFAULT 'Catálogo de Produtos',
  descricao       TEXT,
  whatsapp        VARCHAR(20),
  instagram       VARCHAR(100),
  facebook        VARCHAR(100),
  banner_url      TEXT,
  cores           JSONB         NOT NULL DEFAULT '{"primary":"#D4A528","secondary":"#1A1A2E"}',
  mostrar_preco   BOOLEAN       NOT NULL DEFAULT TRUE,
  mostrar_estoque BOOLEAN       NOT NULL DEFAULT FALSE,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 8. clientes_emporio (clientes da loja)
CREATE TABLE clientes_emporio (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                 VARCHAR(255)  NOT NULL,
  cpf                  VARCHAR(14)   UNIQUE,
  rg                   VARCHAR(20),
  data_nascimento      DATE,
  telefone             VARCHAR(20)   NOT NULL,
  telefone2            VARCHAR(20),
  email                VARCHAR(255),
  endereco             VARCHAR(255),
  numero               VARCHAR(20),
  complemento          VARCHAR(100),
  bairro               VARCHAR(100),
  cidade               VARCHAR(100),
  estado               CHAR(2),
  cep                  VARCHAR(9),
  observacoes          TEXT,
  total_compras        INT           NOT NULL DEFAULT 0,
  valor_total_compras  DECIMAL(12,2) NOT NULL DEFAULT 0,
  ultima_compra        TIMESTAMPTZ,
  status               status_cliente NOT NULL DEFAULT 'ativo',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 9. vendas (Empório)
CREATE TABLE vendas (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_venda    BIGINT        GENERATED BY DEFAULT AS IDENTITY,
  cliente_id      UUID          REFERENCES clientes_emporio(id) ON DELETE SET NULL,
  usuario_id      UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  tipo_pagamento  tipo_pagamento,
  parcelas        INT           NOT NULL DEFAULT 1,
  valor_entrada   DECIMAL(12,2) NOT NULL DEFAULT 0,
  observacoes     TEXT,
  data_entrega    DATE,
  status          status_venda  NOT NULL DEFAULT 'orcamento',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 10. itens_venda
CREATE TABLE itens_venda (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id        UUID          NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id      UUID          REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto    VARCHAR(255)  NOT NULL,
  sku_produto     VARCHAR(100),
  quantidade      INT           NOT NULL DEFAULT 1,
  preco_unitario  DECIMAL(12,2) NOT NULL,
  desconto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 11. parcelas_receber (Empório — contas a receber)
CREATE TABLE parcelas_receber (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  venda_id         UUID          NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  cliente_id       UUID          REFERENCES clientes_emporio(id) ON DELETE SET NULL,
  numero_parcela   INT           NOT NULL,
  total_parcelas   INT           NOT NULL,
  valor            DECIMAL(12,2) NOT NULL,
  valor_pago       DECIMAL(12,2),
  data_vencimento  DATE          NOT NULL,
  data_pagamento   DATE,
  tipo_pagamento   tipo_pagamento,
  status           status_parcela NOT NULL DEFAULT 'pendente',
  observacoes      TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 12. contas_pagar (Empório — contas a pagar)
CREATE TABLE contas_pagar (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  descricao         VARCHAR(255)  NOT NULL,
  categoria         categoria_conta NOT NULL DEFAULT 'outros',
  fornecedor_id     UUID          REFERENCES fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome   VARCHAR(255),
  valor             DECIMAL(12,2) NOT NULL,
  valor_pago        DECIMAL(12,2),
  data_vencimento   DATE          NOT NULL,
  data_pagamento    DATE,
  tipo_pagamento    tipo_pagamento,
  numero_documento  VARCHAR(100),
  observacoes       TEXT,
  comprovante_url   TEXT,
  status            status_conta_pagar NOT NULL DEFAULT 'pendente',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 13. config_emporio (configurações e mensagens da loja)
CREATE TABLE config_emporio (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                UUID    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  whatsapp_padrao           VARCHAR(20),
  prefixo_numero_venda      VARCHAR(10) NOT NULL DEFAULT 'EMP',
  dias_vencimento_padrao    INT         NOT NULL DEFAULT 30,
  saldo_inicial_caixa       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  msg_orcamento             TEXT,
  msg_aprovacao             TEXT,
  msg_entrega               TEXT,
  msg_cobranca              TEXT,
  msg_aniversario           TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. clientes_factoring (clientes da financeira)
CREATE TABLE clientes_factoring (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                  VARCHAR(255)  NOT NULL,
  cpf                   VARCHAR(14)   UNIQUE,
  rg                    VARCHAR(20),
  orgao_emissor         VARCHAR(20),
  data_nascimento       DATE,
  estado_civil          VARCHAR(20),
  profissao             VARCHAR(100),
  renda_mensal          DECIMAL(12,2),
  telefone              VARCHAR(20)   NOT NULL,
  telefone2             VARCHAR(20),
  email                 VARCHAR(255),
  endereco              VARCHAR(255),
  numero                VARCHAR(20),
  complemento           VARCHAR(100),
  bairro                VARCHAR(100),
  cidade                VARCHAR(100),
  estado                CHAR(2),
  cep                   VARCHAR(9),
  banco                 VARCHAR(100),
  agencia               VARCHAR(20),
  conta                 VARCHAR(30),
  tipo_conta            VARCHAR(20),
  pix                   VARCHAR(100),
  limite_credito        DECIMAL(12,2) NOT NULL DEFAULT 0,
  credito_utilizado     DECIMAL(12,2) NOT NULL DEFAULT 0,
  credito_disponivel    DECIMAL(12,2) GENERATED ALWAYS AS (limite_credito - credito_utilizado) STORED,
  score_interno         INT           NOT NULL DEFAULT 0,
  total_emprestimos     INT           NOT NULL DEFAULT 0,
  valor_total_emprestado DECIMAL(12,2) NOT NULL DEFAULT 0,
  ultima_operacao       TIMESTAMPTZ,
  observacoes           TEXT,
  documentos            JSONB         NOT NULL DEFAULT '[]',
  status                status_cliente NOT NULL DEFAULT 'ativo',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 15. referencias_cliente_factoring (referências pessoais)
CREATE TABLE referencias_cliente_factoring (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID         NOT NULL REFERENCES clientes_factoring(id) ON DELETE CASCADE,
  nome        VARCHAR(255) NOT NULL,
  parentesco  VARCHAR(100),
  telefone    VARCHAR(20)  NOT NULL,
  observacoes TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 16. emprestimos (Factoring)
CREATE TABLE emprestimos (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  numero_contrato         VARCHAR(50)   NOT NULL,
  cliente_id              UUID          NOT NULL REFERENCES clientes_factoring(id) ON DELETE RESTRICT,
  usuario_id              UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  valor_principal         DECIMAL(12,2) NOT NULL,
  taxa_juros              DECIMAL(8,4)  NOT NULL,
  tipo_taxa               tipo_taxa     NOT NULL DEFAULT 'mensal',
  prazo_meses             INT           NOT NULL,
  valor_parcela           DECIMAL(12,2) NOT NULL,
  total_pagar             DECIMAL(12,2) NOT NULL,
  total_juros             DECIMAL(12,2) NOT NULL,
  valor_entrada           DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_devedor           DECIMAL(12,2) NOT NULL,
  data_primeiro_vencimento DATE         NOT NULL,
  data_liberacao          DATE,
  data_quitacao           DATE,
  observacoes             TEXT,
  garantias               TEXT,
  documentos              JSONB         NOT NULL DEFAULT '[]',
  status                  status_emprestimo NOT NULL DEFAULT 'analise',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(empresa_id, numero_contrato)
);

-- 17. parcelas_emprestimo (Factoring — tabela de amortização)
CREATE TABLE parcelas_emprestimo (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  emprestimo_id         UUID          NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  cliente_id            UUID          NOT NULL REFERENCES clientes_factoring(id) ON DELETE RESTRICT,
  numero_parcela        INT           NOT NULL,
  total_parcelas        INT           NOT NULL,
  valor                 DECIMAL(12,2) NOT NULL,
  valor_principal       DECIMAL(12,2) NOT NULL,
  valor_juros           DECIMAL(12,2) NOT NULL,
  saldo_devedor_antes   DECIMAL(12,2) NOT NULL,
  saldo_devedor_apos    DECIMAL(12,2) NOT NULL,
  valor_pago            DECIMAL(12,2),
  data_vencimento       DATE          NOT NULL,
  data_pagamento        DATE,
  dias_atraso           INT           GENERATED ALWAYS AS (
    CASE
      WHEN data_pagamento IS NOT NULL
        THEN GREATEST(0, (data_pagamento - data_vencimento)::INT)
      ELSE 0
    END
  ) STORED,
  multa                 DECIMAL(12,2) NOT NULL DEFAULT 0,
  juros_mora            DECIMAL(12,2) NOT NULL DEFAULT 0,
  tipo_pagamento        tipo_pagamento,
  status                status_parcela_emp NOT NULL DEFAULT 'pendente',
  observacoes           TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 18. historico_status_emprestimo (auditoria de mudança de status)
CREATE TABLE historico_status_emprestimo (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  emprestimo_id   UUID              NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
  usuario_id      UUID              REFERENCES usuarios(id) ON DELETE SET NULL,
  status_anterior status_emprestimo,
  status_novo     status_emprestimo NOT NULL,
  motivo          TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 19. config_factoring (configurações e mensagens da financeira)
CREATE TABLE config_factoring (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               UUID          NOT NULL REFERENCES empresas(id) ON DELETE CASCADE UNIQUE,
  whatsapp_padrao          VARCHAR(20),
  prefixo_contrato         VARCHAR(10)   NOT NULL DEFAULT 'FAC',
  taxa_juros_padrao        DECIMAL(8,4)  NOT NULL DEFAULT 5.00,
  tipo_taxa_padrao         tipo_taxa     NOT NULL DEFAULT 'mensal',
  prazo_minimo_meses       INT           NOT NULL DEFAULT 1,
  prazo_maximo_meses       INT           NOT NULL DEFAULT 60,
  valor_minimo_emprestimo  DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  valor_maximo_emprestimo  DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
  dias_carencia            INT           NOT NULL DEFAULT 0,
  multa_atraso             DECIMAL(8,4)  NOT NULL DEFAULT 2.00,
  juros_mora_diario        DECIMAL(8,6)  NOT NULL DEFAULT 0.033300,
  saldo_inicial_caixa      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  msg_aprovacao            TEXT,
  msg_liberacao            TEXT,
  msg_vencimento           TEXT,
  msg_cobranca             TEXT,
  msg_quitacao             TEXT,
  msg_boas_vindas          TEXT,
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 20. movimentacoes_caixa (fluxo de caixa)
CREATE TABLE movimentacoes_caixa (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID             NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id          UUID             REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo                tipo_movimentacao NOT NULL,
  categoria           VARCHAR(100)     NOT NULL,
  descricao           VARCHAR(255)     NOT NULL,
  valor               DECIMAL(12,2)    NOT NULL,
  referencia_tipo     VARCHAR(50),
  referencia_id       UUID,
  data_movimentacao   DATE             NOT NULL DEFAULT CURRENT_DATE,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 21. notificacoes_log (log de mensagens enviadas)
CREATE TABLE notificacoes_log (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID              NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal            canal_notificacao NOT NULL DEFAULT 'whatsapp',
  destinatario     VARCHAR(255)      NOT NULL,
  assunto          VARCHAR(255),
  mensagem         TEXT              NOT NULL,
  referencia_tipo  VARCHAR(50),
  referencia_id    UUID,
  status           VARCHAR(20)       NOT NULL DEFAULT 'pendente',
  enviado_em       TIMESTAMPTZ,
  erro             TEXT,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

-- empresas
CREATE INDEX idx_empresas_tipo  ON empresas(tipo);
CREATE INDEX idx_empresas_ativo ON empresas(ativo);

-- usuarios
CREATE INDEX idx_usuarios_email  ON usuarios(email);
CREATE INDEX idx_usuarios_status ON usuarios(status);

-- usuario_empresa
CREATE INDEX idx_usuario_empresa_usuario ON usuario_empresa(usuario_id);
CREATE INDEX idx_usuario_empresa_empresa ON usuario_empresa(empresa_id);
CREATE INDEX idx_usuario_empresa_ativo   ON usuario_empresa(ativo);

-- categorias_produto
CREATE INDEX idx_categorias_empresa ON categorias_produto(empresa_id);
CREATE INDEX idx_categorias_ativo   ON categorias_produto(ativo);
CREATE INDEX idx_categorias_ordem   ON categorias_produto(empresa_id, ordem);

-- fornecedores
CREATE INDEX idx_fornecedores_empresa ON fornecedores(empresa_id);
CREATE INDEX idx_fornecedores_ativo   ON fornecedores(ativo);

-- produtos
CREATE INDEX idx_produtos_empresa  ON produtos(empresa_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_status    ON produtos(status);
CREATE INDEX idx_produtos_destaque  ON produtos(destaque);
CREATE INDEX idx_produtos_catalogo  ON produtos(empresa_id, disponivel_catalogo, status);
CREATE INDEX idx_produtos_sku       ON produtos(empresa_id, sku);
CREATE INDEX idx_produtos_nome_trgm ON produtos USING GIN(nome gin_trgm_ops);

-- config_catalogo
CREATE INDEX idx_config_catalogo_slug ON config_catalogo(slug);

-- clientes_emporio
CREATE INDEX idx_clientes_emporio_empresa  ON clientes_emporio(empresa_id);
CREATE INDEX idx_clientes_emporio_cpf      ON clientes_emporio(cpf);
CREATE INDEX idx_clientes_emporio_telefone ON clientes_emporio(telefone);
CREATE INDEX idx_clientes_emporio_status   ON clientes_emporio(status);
CREATE INDEX idx_clientes_emporio_nome_trgm ON clientes_emporio USING GIN(nome gin_trgm_ops);

-- vendas
CREATE INDEX idx_vendas_empresa    ON vendas(empresa_id);
CREATE INDEX idx_vendas_cliente    ON vendas(cliente_id);
CREATE INDEX idx_vendas_usuario    ON vendas(usuario_id);
CREATE INDEX idx_vendas_status     ON vendas(status);
CREATE INDEX idx_vendas_created_at ON vendas(empresa_id, created_at DESC);
CREATE UNIQUE INDEX idx_vendas_numero ON vendas(empresa_id, numero_venda);

-- itens_venda
CREATE INDEX idx_itens_venda_venda   ON itens_venda(venda_id);
CREATE INDEX idx_itens_venda_produto ON itens_venda(produto_id);

-- parcelas_receber
CREATE INDEX idx_parcelas_receber_empresa    ON parcelas_receber(empresa_id);
CREATE INDEX idx_parcelas_receber_venda      ON parcelas_receber(venda_id);
CREATE INDEX idx_parcelas_receber_cliente    ON parcelas_receber(cliente_id);
CREATE INDEX idx_parcelas_receber_status     ON parcelas_receber(status);
CREATE INDEX idx_parcelas_receber_vencimento ON parcelas_receber(empresa_id, data_vencimento);

-- contas_pagar
CREATE INDEX idx_contas_pagar_empresa    ON contas_pagar(empresa_id);
CREATE INDEX idx_contas_pagar_status     ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(empresa_id, data_vencimento);
CREATE INDEX idx_contas_pagar_categoria  ON contas_pagar(categoria);

-- clientes_factoring
CREATE INDEX idx_clientes_factoring_empresa   ON clientes_factoring(empresa_id);
CREATE INDEX idx_clientes_factoring_cpf       ON clientes_factoring(cpf);
CREATE INDEX idx_clientes_factoring_telefone  ON clientes_factoring(telefone);
CREATE INDEX idx_clientes_factoring_status    ON clientes_factoring(status);
CREATE INDEX idx_clientes_factoring_nome_trgm ON clientes_factoring USING GIN(nome gin_trgm_ops);

-- referencias_cliente_factoring
CREATE INDEX idx_referencias_cliente ON referencias_cliente_factoring(cliente_id);

-- emprestimos
CREATE INDEX idx_emprestimos_empresa    ON emprestimos(empresa_id);
CREATE INDEX idx_emprestimos_cliente    ON emprestimos(cliente_id);
CREATE INDEX idx_emprestimos_usuario    ON emprestimos(usuario_id);
CREATE INDEX idx_emprestimos_status     ON emprestimos(status);
CREATE INDEX idx_emprestimos_created_at ON emprestimos(empresa_id, created_at DESC);
CREATE INDEX idx_emprestimos_numero     ON emprestimos(empresa_id, numero_contrato);

-- parcelas_emprestimo
CREATE INDEX idx_parcelas_emp_empresa    ON parcelas_emprestimo(empresa_id);
CREATE INDEX idx_parcelas_emp_emprestimo ON parcelas_emprestimo(emprestimo_id);
CREATE INDEX idx_parcelas_emp_cliente    ON parcelas_emprestimo(cliente_id);
CREATE INDEX idx_parcelas_emp_status     ON parcelas_emprestimo(status);
CREATE INDEX idx_parcelas_emp_vencimento ON parcelas_emprestimo(empresa_id, data_vencimento);

-- historico_status_emprestimo
CREATE INDEX idx_historico_emprestimo ON historico_status_emprestimo(emprestimo_id);

-- movimentacoes_caixa
CREATE INDEX idx_movimentacoes_empresa ON movimentacoes_caixa(empresa_id);
CREATE INDEX idx_movimentacoes_data    ON movimentacoes_caixa(empresa_id, data_movimentacao DESC);
CREATE INDEX idx_movimentacoes_tipo    ON movimentacoes_caixa(tipo);

-- notificacoes_log
CREATE INDEX idx_notificacoes_empresa    ON notificacoes_log(empresa_id);
CREATE INDEX idx_notificacoes_status     ON notificacoes_log(status);
CREATE INDEX idx_notificacoes_created_at ON notificacoes_log(empresa_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÕES AUXILIARES
-- ═══════════════════════════════════════════════════════════════

-- Verifica se o usuário autenticado tem acesso à empresa
CREATE OR REPLACE FUNCTION has_empresa_access(eid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuario_empresa ue
    WHERE ue.empresa_id = eid
      AND ue.usuario_id = auth.uid()
      AND ue.ativo = TRUE
  )
$$;

-- Gera número de contrato sequencial por ano
CREATE OR REPLACE FUNCTION generate_numero_contrato(p_empresa_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefixo VARCHAR(10);
  v_ano     VARCHAR(4);
  v_seq     INT;
BEGIN
  SELECT COALESCE(prefixo_contrato, 'FAC')
  INTO v_prefixo
  FROM config_factoring
  WHERE empresa_id = p_empresa_id;

  v_prefixo := COALESCE(v_prefixo, 'FAC');
  v_ano     := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(COUNT(*), 0) + 1
  INTO v_seq
  FROM emprestimos
  WHERE empresa_id = p_empresa_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  RETURN v_prefixo || '-' || v_ano || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

-- Marca parcelas vencidas como atrasadas (chamada por cron ou manualmente)
CREATE OR REPLACE FUNCTION fn_marcar_parcelas_atrasadas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE parcelas_emprestimo
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;

  UPDATE parcelas_receber
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS — updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'empresas',
    'usuarios',
    'fornecedores',
    'produtos',
    'config_catalogo',
    'clientes_emporio',
    'vendas',
    'parcelas_receber',
    'contas_pagar',
    'config_emporio',
    'clientes_factoring',
    'emprestimos',
    'parcelas_emprestimo',
    'config_factoring'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS — LÓGICA DE NEGÓCIO
-- ═══════════════════════════════════════════════════════════════

-- Atualiza métricas do cliente após venda aprovada
CREATE OR REPLACE FUNCTION fn_update_cliente_emporio_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL
    AND NEW.status = 'aprovada'
    AND (TG_OP = 'INSERT' OR OLD.status != 'aprovada')
  THEN
    UPDATE clientes_emporio
    SET
      total_compras       = total_compras + 1,
      valor_total_compras = valor_total_compras + NEW.total,
      ultima_compra       = NOW()
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendas_cliente_metrics
AFTER INSERT OR UPDATE OF status ON vendas
FOR EACH ROW EXECUTE FUNCTION fn_update_cliente_emporio_metrics();

-- Atualiza saldo devedor do empréstimo ao pagar parcela
CREATE OR REPLACE FUNCTION fn_update_saldo_devedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_pago DECIMAL(12,2);
  v_entrada    DECIMAL(12,2);
  v_total      DECIMAL(12,2);
BEGIN
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status != 'pago') THEN

    SELECT COALESCE(SUM(valor_pago), 0), e.valor_entrada, e.total_pagar
    INTO v_total_pago, v_entrada, v_total
    FROM parcelas_emprestimo pe
    JOIN emprestimos e ON e.id = pe.emprestimo_id
    WHERE pe.emprestimo_id = NEW.emprestimo_id
      AND pe.status = 'pago'
    GROUP BY e.valor_entrada, e.total_pagar;

    UPDATE emprestimos
    SET saldo_devedor = GREATEST(0, total_pagar - v_entrada - v_total_pago)
    WHERE id = NEW.emprestimo_id;

    -- Quitar automaticamente se saldo zerado
    UPDATE emprestimos
    SET status = 'quitado', data_quitacao = CURRENT_DATE
    WHERE id = NEW.emprestimo_id
      AND GREATEST(0, total_pagar - v_entrada - v_total_pago) = 0
      AND status = 'ativo';

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcela_saldo_devedor
AFTER INSERT OR UPDATE OF status ON parcelas_emprestimo
FOR EACH ROW EXECUTE FUNCTION fn_update_saldo_devedor();

-- Atualiza métricas e crédito do cliente factoring ao ativar empréstimo
CREATE OR REPLACE FUNCTION fn_update_cliente_factoring_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Empréstimo ativado: ocupa crédito e conta métricas
  IF NEW.status IN ('ativo', 'aprovado')
    AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('ativo', 'aprovado'))
  THEN
    UPDATE clientes_factoring
    SET
      total_emprestimos      = total_emprestimos + 1,
      valor_total_emprestado = valor_total_emprestado + NEW.valor_principal,
      credito_utilizado      = credito_utilizado + NEW.valor_principal,
      ultima_operacao        = NOW()
    WHERE id = NEW.cliente_id;
  END IF;

  -- Empréstimo quitado ou cancelado: libera crédito restante
  IF NEW.status IN ('quitado', 'cancelado')
    AND TG_OP = 'UPDATE'
    AND OLD.status NOT IN ('quitado', 'cancelado')
  THEN
    UPDATE clientes_factoring
    SET credito_utilizado = GREATEST(0, credito_utilizado - NEW.saldo_devedor)
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_emprestimo_cliente_metrics
AFTER INSERT OR UPDATE OF status ON emprestimos
FOR EACH ROW EXECUTE FUNCTION fn_update_cliente_factoring_metrics();

-- Grava histórico ao mudar status do empréstimo
CREATE OR REPLACE FUNCTION fn_historico_status_emprestimo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO historico_status_emprestimo
      (emprestimo_id, usuario_id, status_anterior, status_novo)
    VALUES
      (NEW.id, NEW.usuario_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_emprestimo_historico_status
AFTER UPDATE OF status ON emprestimos
FOR EACH ROW EXECUTE FUNCTION fn_historico_status_emprestimo();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE empresas                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_empresa                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_produto              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_catalogo                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_emporio                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_receber                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_emporio                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_factoring              ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_cliente_factoring   ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_emprestimo             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_status_emprestimo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_factoring                ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caixa             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_log                ENABLE ROW LEVEL SECURITY;

-- empresas: ver apenas as que tem acesso
CREATE POLICY "empresas_select" ON empresas
  FOR SELECT USING (has_empresa_access(id));

-- usuarios: ver a si mesmo
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (id = auth.uid());

-- usuario_empresa
CREATE POLICY "usuario_empresa_select" ON usuario_empresa
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR has_empresa_access(empresa_id)
  );

-- categorias_produto: leitura pública (catálogo), escrita restrita
CREATE POLICY "categorias_select_public" ON categorias_produto
  FOR SELECT USING (TRUE);

CREATE POLICY "categorias_write" ON categorias_produto
  FOR ALL USING (has_empresa_access(empresa_id));

-- fornecedores
CREATE POLICY "fornecedores_all" ON fornecedores
  FOR ALL USING (has_empresa_access(empresa_id));

-- produtos: leitura pública para catálogo, escrita restrita
CREATE POLICY "produtos_select" ON produtos
  FOR SELECT USING (
    has_empresa_access(empresa_id)
    OR disponivel_catalogo = TRUE
  );

CREATE POLICY "produtos_write" ON produtos
  FOR ALL USING (has_empresa_access(empresa_id));

-- config_catalogo: leitura pública (catálogo público via slug)
CREATE POLICY "config_catalogo_select" ON config_catalogo
  FOR SELECT USING (TRUE);

CREATE POLICY "config_catalogo_write" ON config_catalogo
  FOR ALL USING (has_empresa_access(empresa_id));

-- clientes_emporio
CREATE POLICY "clientes_emporio_all" ON clientes_emporio
  FOR ALL USING (has_empresa_access(empresa_id));

-- vendas
CREATE POLICY "vendas_all" ON vendas
  FOR ALL USING (has_empresa_access(empresa_id));

-- itens_venda (via join com vendas)
CREATE POLICY "itens_venda_all" ON itens_venda
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vendas v
      WHERE v.id = venda_id
        AND has_empresa_access(v.empresa_id)
    )
  );

-- parcelas_receber
CREATE POLICY "parcelas_receber_all" ON parcelas_receber
  FOR ALL USING (has_empresa_access(empresa_id));

-- contas_pagar
CREATE POLICY "contas_pagar_all" ON contas_pagar
  FOR ALL USING (has_empresa_access(empresa_id));

-- config_emporio
CREATE POLICY "config_emporio_all" ON config_emporio
  FOR ALL USING (has_empresa_access(empresa_id));

-- clientes_factoring
CREATE POLICY "clientes_factoring_all" ON clientes_factoring
  FOR ALL USING (has_empresa_access(empresa_id));

-- referencias_cliente_factoring (via join com clientes_factoring)
CREATE POLICY "referencias_factoring_all" ON referencias_cliente_factoring
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clientes_factoring cf
      WHERE cf.id = cliente_id
        AND has_empresa_access(cf.empresa_id)
    )
  );

-- emprestimos
CREATE POLICY "emprestimos_all" ON emprestimos
  FOR ALL USING (has_empresa_access(empresa_id));

-- parcelas_emprestimo
CREATE POLICY "parcelas_emprestimo_all" ON parcelas_emprestimo
  FOR ALL USING (has_empresa_access(empresa_id));

-- historico_status_emprestimo (via join com emprestimos)
CREATE POLICY "historico_emprestimo_all" ON historico_status_emprestimo
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM emprestimos e
      WHERE e.id = emprestimo_id
        AND has_empresa_access(e.empresa_id)
    )
  );

-- config_factoring
CREATE POLICY "config_factoring_all" ON config_factoring
  FOR ALL USING (has_empresa_access(empresa_id));

-- movimentacoes_caixa
CREATE POLICY "movimentacoes_caixa_all" ON movimentacoes_caixa
  FOR ALL USING (has_empresa_access(empresa_id));

-- notificacoes_log
CREATE POLICY "notificacoes_log_all" ON notificacoes_log
  FOR ALL USING (has_empresa_access(empresa_id));
