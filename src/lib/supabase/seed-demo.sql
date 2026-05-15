-- ═══════════════════════════════════════════════════════════════
-- GRUPO SRSM — DADOS DE DEMONSTRAÇÃO
-- Roda no Supabase SQL Editor
-- Cobre todas as telas de ambas as empresas
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Empresas
  v_emp UUID;   -- Empório dos Móveis
  v_fac UUID;   -- SRS M Factoring

  -- Empório: categorias
  v_cat_sofa  UUID := gen_random_uuid();
  v_cat_mesa  UUID := gen_random_uuid();
  v_cat_cama  UUID := gen_random_uuid();
  v_cat_arm   UUID := gen_random_uuid();

  -- Empório: fornecedor
  v_forn UUID := gen_random_uuid();

  -- Empório: produtos
  v_p1 UUID := gen_random_uuid();
  v_p2 UUID := gen_random_uuid();
  v_p3 UUID := gen_random_uuid();
  v_p4 UUID := gen_random_uuid();
  v_p5 UUID := gen_random_uuid();
  v_p6 UUID := gen_random_uuid();
  v_p7 UUID := gen_random_uuid();
  v_p8 UUID := gen_random_uuid();
  v_p9 UUID := gen_random_uuid();
  v_p10 UUID := gen_random_uuid();
  v_p11 UUID := gen_random_uuid();
  v_p12 UUID := gen_random_uuid();

  -- Empório: clientes
  v_ec1 UUID := gen_random_uuid();
  v_ec2 UUID := gen_random_uuid();
  v_ec3 UUID := gen_random_uuid();
  v_ec4 UUID := gen_random_uuid();
  v_ec5 UUID := gen_random_uuid();
  v_ec6 UUID := gen_random_uuid();

  -- Empório: vendas
  v_v1 UUID := gen_random_uuid();
  v_v2 UUID := gen_random_uuid();
  v_v3 UUID := gen_random_uuid();
  v_v4 UUID := gen_random_uuid();
  v_v5 UUID := gen_random_uuid();
  v_v6 UUID := gen_random_uuid();
  v_v7 UUID := gen_random_uuid();
  v_v8 UUID := gen_random_uuid();

  -- Factoring: clientes
  v_fc1 UUID := gen_random_uuid();
  v_fc2 UUID := gen_random_uuid();
  v_fc3 UUID := gen_random_uuid();
  v_fc4 UUID := gen_random_uuid();
  v_fc5 UUID := gen_random_uuid();
  v_fc6 UUID := gen_random_uuid();
  v_fc7 UUID := gen_random_uuid();
  v_fc8 UUID := gen_random_uuid();

  -- Factoring: empréstimos
  v_e1 UUID := gen_random_uuid();
  v_e2 UUID := gen_random_uuid();
  v_e3 UUID := gen_random_uuid();
  v_e4 UUID := gen_random_uuid();
  v_e5 UUID := gen_random_uuid();
  v_e6 UUID := gen_random_uuid();

BEGIN

  -- ── Busca IDs das empresas ──────────────────────────────────
  SELECT id INTO v_emp FROM empresas WHERE tipo = 'emporio'   LIMIT 1;
  SELECT id INTO v_fac FROM empresas WHERE tipo = 'factoring' LIMIT 1;

  IF v_emp IS NULL OR v_fac IS NULL THEN
    RAISE EXCEPTION 'Empresas não encontradas. Verifique se o schema foi executado.';
  END IF;

  -- ════════════════════════════════════════════════════════════
  -- EMPÓRIO DOS MÓVEIS
  -- ════════════════════════════════════════════════════════════

  -- Config catálogo
  INSERT INTO config_catalogo (empresa_id, slug, titulo, descricao, whatsapp, mostrar_preco)
  VALUES (v_emp, 'emporio-dos-moveis', 'Empório dos Móveis', 'Os melhores móveis com o melhor preço da região.', '64999990001', TRUE)
  ON CONFLICT (empresa_id) DO NOTHING;

  -- Config loja
  INSERT INTO config_emporio (empresa_id, whatsapp_padrao, prefixo_numero_venda, dias_vencimento_padrao,
    msg_orcamento, msg_aprovacao, msg_entrega, msg_cobranca)
  VALUES (v_emp, '64999990001', 'EMP', 30,
    'Olá {nome}! Seu orçamento #{numero} no valor de {total} está pronto.',
    'Olá {nome}! Sua venda #{numero} foi aprovada. Aguarde contato para entrega.',
    'Olá {nome}! Seu pedido #{numero} está a caminho. Prazo: {data_entrega}.',
    'Olá {nome}! Sua parcela {numero}/{total} de {valor} vence em {vencimento}.')
  ON CONFLICT (empresa_id) DO NOTHING;

  -- ── Categorias ───────────────────────────────────────────────
  INSERT INTO categorias_produto (id, empresa_id, nome, slug, icone, ordem) VALUES
    (v_cat_sofa, v_emp, 'Sofás e Poltronas', 'sofas-poltronas', '🛋️', 1),
    (v_cat_mesa, v_emp, 'Mesas e Cadeiras',  'mesas-cadeiras',  '🪑', 2),
    (v_cat_cama, v_emp, 'Camas e Colchões',  'camas-colchoes',  '🛏️', 3),
    (v_cat_arm,  v_emp, 'Armários e Roupeiros', 'armarios-roupeiros', '🚪', 4);

  -- ── Fornecedor ────────────────────────────────────────────────
  INSERT INTO fornecedores (id, empresa_id, nome, cnpj, telefone, email, cidade, estado) VALUES
    (v_forn, v_emp, 'Móveis Brasil Atacado', '12.345.678/0001-90', '64933334444',
     'vendas@moveisbrasil.com.br', 'Goiânia', 'GO');

  -- ── Produtos ─────────────────────────────────────────────────
  INSERT INTO produtos (id, empresa_id, categoria_id, fornecedor_id, nome, sku, preco, preco_custo,
    estoque, estoque_minimo, descricao_curta, destaque, disponivel_catalogo, status) VALUES
    (v_p1,  v_emp, v_cat_sofa, v_forn, 'Sofá 3 Lugares Retrátil',    'SOF-001', 2490.00, 1400.00, 8,  2, 'Sofá retrátil reclinável em tecido suede.', TRUE,  TRUE, 'ativo'),
    (v_p2,  v_emp, v_cat_sofa, v_forn, 'Poltrona Decorativa Veludo',  'SOF-002', 890.00,  480.00,  5,  1, 'Poltrona em veludo azul petróleo.', FALSE, TRUE, 'ativo'),
    (v_p3,  v_emp, v_cat_sofa, v_forn, 'Sofá Canto 5 Lugares',       'SOF-003', 3890.00, 2200.00, 3,  1, 'Sofá de canto L com chaise.', TRUE,  TRUE, 'ativo'),
    (v_p4,  v_emp, v_cat_mesa, v_forn, 'Mesa de Jantar 6 Lugares',   'MES-001', 1890.00, 950.00,  6,  2, 'Mesa de jantar em MDF com tampo de vidro.', TRUE,  TRUE, 'ativo'),
    (v_p5,  v_emp, v_cat_mesa, v_forn, 'Cadeira Estofada Giratória', 'MES-002', 320.00,  170.00,  20, 5, 'Cadeira giratória com base cromada.', FALSE, TRUE, 'ativo'),
    (v_p6,  v_emp, v_cat_mesa, v_forn, 'Mesa de Centro Sala',        'MES-003', 680.00,  350.00,  0,  2, 'Mesa de centro em vidro temperado.', FALSE, TRUE, 'sem_estoque'),
    (v_p7,  v_emp, v_cat_cama, v_forn, 'Cama Box Casal Queen',       'CAM-001', 2190.00, 1100.00, 4,  1, 'Cama box queen size com colchão incluso.', TRUE,  TRUE, 'ativo'),
    (v_p8,  v_emp, v_cat_cama, v_forn, 'Colchão Molas Ensacadas',    'CAM-002', 1490.00, 750.00,  7,  2, 'Colchão casal molas ensacadas 25cm.', FALSE, TRUE, 'ativo'),
    (v_p9,  v_emp, v_cat_cama, v_forn, 'Cabeceira Estofada King',    'CAM-003', 890.00,  440.00,  3,  1, 'Cabeceira king size em courino.', FALSE, TRUE, 'ativo'),
    (v_p10, v_emp, v_cat_arm,  v_forn, 'Guarda-Roupa 6 Portas',      'ARM-001', 2890.00, 1450.00, 5,  1, 'Guarda-roupa 6 portas com espelho.', TRUE,  TRUE, 'ativo'),
    (v_p11, v_emp, v_cat_arm,  v_forn, 'Cômoda 5 Gavetas',           'ARM-002', 980.00,  490.00,  8,  2, 'Cômoda em MDF amadeirado.', FALSE, TRUE, 'ativo'),
    (v_p12, v_emp, v_cat_arm,  v_forn, 'Armário Multiuso',           'ARM-003', 640.00,  320.00,  0,  2, 'Armário multiuso 4 portas.', FALSE, FALSE, 'sem_estoque');

  -- ── Clientes Empório ─────────────────────────────────────────
  INSERT INTO clientes_emporio (id, empresa_id, nome, cpf, telefone, email, cidade, estado,
    bairro, endereco, numero, total_compras, valor_total_compras, ultima_compra, status) VALUES
    (v_ec1, v_emp, 'Ana Paula Rodrigues',  '111.222.333-44', '64999110001', 'ana.paula@email.com',    'Rio Verde', 'GO', 'Setor Sul',    'Rua das Flores',     '120', 3, 8970.00,  NOW() - INTERVAL '5 days',  'ativo'),
    (v_ec2, v_emp, 'Carlos Eduardo Lima',  '222.333.444-55', '64999220002', 'carlos.lima@email.com',  'Rio Verde', 'GO', 'Jardim Goiás', 'Av. Brasil',         '450', 2, 4780.00,  NOW() - INTERVAL '15 days', 'ativo'),
    (v_ec3, v_emp, 'Fernanda Costa Silva', '333.444.555-66', '64999330003', 'fernanda.cs@email.com',  'Rio Verde', 'GO', 'Centro',       'Rua 7 de Setembro',  '88',  1, 2490.00,  NOW() - INTERVAL '30 days', 'ativo'),
    (v_ec4, v_emp, 'Roberto Alves Souza',  '444.555.666-77', '64999440004', 'roberto.alves@email.com','Jataí',     'GO', 'Setor Norte',  'Rua João Pessoa',    '230', 4, 12600.00, NOW() - INTERVAL '2 days',  'ativo'),
    (v_ec5, v_emp, 'Mariana Tavares',       '555.666.777-88', '64999550005', 'mariana.t@email.com',    'Rio Verde', 'GO', 'Vila Nova',    'Rua Goiás',          '15',  1, 890.00,   NOW() - INTERVAL '60 days', 'inativo'),
    (v_ec6, v_emp, 'José Henrique Nunes',  '666.777.888-99', '64999660006', 'jose.nunes@email.com',   'Mineiros',  'GO', 'Centro',       'Av. Goiás',          '780', 0, 0.00,     NULL,                        'ativo');

  -- ── Vendas ───────────────────────────────────────────────────
  INSERT INTO vendas (id, empresa_id, cliente_id, subtotal, desconto, total,
    tipo_pagamento, parcelas, valor_entrada, status, data_entrega, created_at) VALUES
    (v_v1, v_emp, v_ec1, 2490.00, 0.00,    2490.00, 'cartao_credito', 10, 0.00,    'entregue',   CURRENT_DATE - 90, NOW() - INTERVAL '90 days'),
    (v_v2, v_emp, v_ec1, 3890.00, 200.00,  3690.00, 'pix',            1,  0.00,    'entregue',   CURRENT_DATE - 60, NOW() - INTERVAL '60 days'),
    (v_v3, v_emp, v_ec2, 4780.00, 0.00,    4780.00, 'cartao_credito', 12, 500.00,  'aprovada',   CURRENT_DATE + 7,  NOW() - INTERVAL '15 days'),
    (v_v4, v_emp, v_ec3, 2490.00, 0.00,    2490.00, 'dinheiro',       1,  2490.00, 'entregue',   CURRENT_DATE - 25, NOW() - INTERVAL '30 days'),
    (v_v5, v_emp, v_ec4, 5380.00, 380.00,  5000.00, 'boleto',         5,  1000.00, 'aprovada',   CURRENT_DATE + 14, NOW() - INTERVAL '7 days'),
    (v_v6, v_emp, v_ec4, 7700.00, 200.00,  7500.00, 'cartao_credito', 18, 1500.00, 'entregue',   CURRENT_DATE - 10, NOW() - INTERVAL '45 days'),
    (v_v7, v_emp, v_ec5, 890.00,  0.00,    890.00,  'pix',            1,  890.00,  'cancelada',  NULL,              NOW() - INTERVAL '55 days'),
    (v_v8, v_emp, v_ec6, 3870.00, 0.00,    3870.00, 'boleto',         3,  0.00,    'orcamento',  CURRENT_DATE + 10, NOW() - INTERVAL '1 day');

  -- ── Itens de Venda ──────────────────────────────────────────
  INSERT INTO itens_venda (venda_id, produto_id, nome_produto, sku_produto, quantidade, preco_unitario, desconto, total) VALUES
    (v_v1, v_p1,  'Sofá 3 Lugares Retrátil',    'SOF-001', 1, 2490.00, 0.00,   2490.00),
    (v_v2, v_p3,  'Sofá Canto 5 Lugares',       'SOF-003', 1, 3890.00, 200.00, 3690.00),
    (v_v3, v_p4,  'Mesa de Jantar 6 Lugares',   'MES-001', 1, 1890.00, 0.00,   1890.00),
    (v_v3, v_p5,  'Cadeira Estofada Giratória', 'MES-002', 6, 320.00,  0.00,   1920.00),
    (v_v3, v_p11, 'Cômoda 5 Gavetas',           'ARM-002', 1, 980.00,  0.00,   980.00),
    (v_v4, v_p1,  'Sofá 3 Lugares Retrátil',    'SOF-001', 1, 2490.00, 0.00,   2490.00),
    (v_v5, v_p7,  'Cama Box Casal Queen',       'CAM-001', 1, 2190.00, 0.00,   2190.00),
    (v_v5, v_p8,  'Colchão Molas Ensacadas',    'CAM-002', 1, 1490.00, 0.00,   1490.00),
    (v_v5, v_p9,  'Cabeceira Estofada King',    'CAM-003', 1, 890.00,  380.00, 320.00),
    (v_v6, v_p10, 'Guarda-Roupa 6 Portas',      'ARM-001', 1, 2890.00, 0.00,   2890.00),
    (v_v6, v_p7,  'Cama Box Casal Queen',       'CAM-001', 2, 2190.00, 200.00, 4180.00),
    (v_v6, v_p9,  'Cabeceira Estofada King',    'CAM-003', 1, 890.00,  0.00,   890.00),
    (v_v7, v_p2,  'Poltrona Decorativa Veludo', 'SOF-002', 1, 890.00,  0.00,   890.00),
    (v_v8, v_p10, 'Guarda-Roupa 6 Portas',      'ARM-001', 1, 2890.00, 0.00,   2890.00),
    (v_v8, v_p5,  'Cadeira Estofada Giratória', 'MES-002', 3, 320.00,  0.00,   960.00);

  -- ── Parcelas a Receber ───────────────────────────────────────
  -- Venda v3 (12x de ~398) — aprovada, parcelas pendentes e uma atrasada
  INSERT INTO parcelas_receber (empresa_id, venda_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_emp, v_v3, v_ec2, 1,  12, 398.00, 398.00, CURRENT_DATE - 45, CURRENT_DATE - 46, 'cartao_credito', 'pago'),
    (v_emp, v_v3, v_ec2, 2,  12, 398.00, 398.00, CURRENT_DATE - 15, CURRENT_DATE - 14, 'cartao_credito', 'pago'),
    (v_emp, v_v3, v_ec2, 3,  12, 398.00, NULL,   CURRENT_DATE + 15, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 4,  12, 398.00, NULL,   CURRENT_DATE + 45, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 5,  12, 398.00, NULL,   CURRENT_DATE + 75, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 6,  12, 398.00, NULL,   CURRENT_DATE + 105, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 7,  12, 398.00, NULL,   CURRENT_DATE + 135, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 8,  12, 398.00, NULL,   CURRENT_DATE + 165, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 9,  12, 398.00, NULL,   CURRENT_DATE + 195, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 10, 12, 398.00, NULL,   CURRENT_DATE + 225, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 11, 12, 398.00, NULL,   CURRENT_DATE + 255, NULL, NULL, 'pendente'),
    (v_emp, v_v3, v_ec2, 12, 12, 362.00, NULL,   CURRENT_DATE + 285, NULL, NULL, 'pendente');

  -- Venda v5 (5x de R$800) — aprovada
  INSERT INTO parcelas_receber (empresa_id, venda_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_emp, v_v5, v_ec4, 1, 5, 800.00, 800.00, CURRENT_DATE - 7,  CURRENT_DATE - 6, 'boleto', 'pago'),
    (v_emp, v_v5, v_ec4, 2, 5, 800.00, NULL,   CURRENT_DATE + 23, NULL, NULL, 'pendente'),
    (v_emp, v_v5, v_ec4, 3, 5, 800.00, NULL,   CURRENT_DATE + 53, NULL, NULL, 'pendente'),
    (v_emp, v_v5, v_ec4, 4, 5, 800.00, NULL,   CURRENT_DATE + 83, NULL, NULL, 'pendente'),
    (v_emp, v_v5, v_ec4, 5, 5, 800.00, NULL,   CURRENT_DATE + 113, NULL, NULL, 'pendente');

  -- Venda v8 (3x de R$1290) — orçamento
  INSERT INTO parcelas_receber (empresa_id, venda_id, cliente_id, numero_parcela, total_parcelas,
    valor, data_vencimento, status) VALUES
    (v_emp, v_v8, v_ec6, 1, 3, 1290.00, CURRENT_DATE + 30, 'pendente'),
    (v_emp, v_v8, v_ec6, 2, 3, 1290.00, CURRENT_DATE + 60, 'pendente'),
    (v_emp, v_v8, v_ec6, 3, 3, 1290.00, CURRENT_DATE + 90, 'pendente');

  -- ── Contas a Pagar (Empório) ─────────────────────────────────
  INSERT INTO contas_pagar (empresa_id, descricao, categoria, fornecedor_id, fornecedor_nome,
    valor, valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_emp, 'Aluguel maio/2026',          'aluguel',    NULL,   'Imobiliária Central',      4500.00, 4500.00, CURRENT_DATE - 5,   CURRENT_DATE - 5,   'transferencia', 'pago'),
    (v_emp, 'Salários maio/2026',         'salario',    NULL,   NULL,                        8200.00, 8200.00, CURRENT_DATE - 2,   CURRENT_DATE - 2,   'transferencia', 'pago'),
    (v_emp, 'Fatura Móveis Brasil',       'fornecedor', v_forn, 'Móveis Brasil Atacado',    12400.00, NULL,    CURRENT_DATE + 10,  NULL, NULL, 'pendente'),
    (v_emp, 'Energia elétrica maio',      'servico',    NULL,   'CELG',                      680.00,  NULL,    CURRENT_DATE + 5,   NULL, NULL, 'pendente'),
    (v_emp, 'Internet e telefone',        'servico',    NULL,   'Claro Empresarial',         290.00,  NULL,    CURRENT_DATE + 8,   NULL, NULL, 'pendente'),
    (v_emp, 'SIMPLES Nacional abril',     'imposto',    NULL,   'Receita Federal',           1840.00, NULL,    CURRENT_DATE - 3,   NULL, NULL, 'atrasado'),
    (v_emp, 'Manutenção AC e elétrica',   'servico',    NULL,   'JM Elétrica',               350.00,  350.00,  CURRENT_DATE - 20,  CURRENT_DATE - 19,  'pix',           'pago'),
    (v_emp, 'Fatura fornecedor março',    'fornecedor', v_forn, 'Móveis Brasil Atacado',     9600.00, 9600.00, CURRENT_DATE - 30,  CURRENT_DATE - 28,  'transferencia', 'pago');

  -- ── Movimentações Caixa (Empório) ────────────────────────────
  INSERT INTO movimentacoes_caixa (empresa_id, tipo, categoria, descricao, valor, data_movimentacao) VALUES
    (v_emp, 'entrada', 'Vendas',       'Venda #1 - Sofá 3 Lugares',          2490.00, CURRENT_DATE - 90),
    (v_emp, 'saida',   'Fornecedores', 'Compra estoque Móveis Brasil',       9600.00, CURRENT_DATE - 85),
    (v_emp, 'entrada', 'Vendas',       'Venda #2 - Sofá Canto 5L',           3690.00, CURRENT_DATE - 60),
    (v_emp, 'saida',   'Aluguel',      'Aluguel março/2026',                  4500.00, CURRENT_DATE - 55),
    (v_emp, 'saida',   'Salários',     'Salários março/2026',                 8200.00, CURRENT_DATE - 50),
    (v_emp, 'entrada', 'Vendas',       'Venda #4 - Sofá Ana Paula',          2490.00, CURRENT_DATE - 30),
    (v_emp, 'saida',   'Aluguel',      'Aluguel abril/2026',                  4500.00, CURRENT_DATE - 25),
    (v_emp, 'saida',   'Salários',     'Salários abril/2026',                 8200.00, CURRENT_DATE - 20),
    (v_emp, 'entrada', 'Crediário',    'Parcela 1/12 - Carlos Lima',          398.00,  CURRENT_DATE - 14),
    (v_emp, 'entrada', 'Vendas',       'Venda #6 - Quarto Roberto (entrada)', 1500.00, CURRENT_DATE - 10),
    (v_emp, 'saida',   'Serviços',     'Manutenção AC',                        350.00,  CURRENT_DATE - 9),
    (v_emp, 'entrada', 'Crediário',    'Parcela 1/5 - Roberto Alves',          800.00,  CURRENT_DATE - 6),
    (v_emp, 'saida',   'Aluguel',      'Aluguel maio/2026',                   4500.00, CURRENT_DATE - 5),
    (v_emp, 'saida',   'Salários',     'Salários maio/2026',                  8200.00, CURRENT_DATE - 2),
    (v_emp, 'entrada', 'Crediário',    'Parcela 2/12 - Carlos Lima',           398.00,  CURRENT_DATE - 1);

  -- ════════════════════════════════════════════════════════════
  -- SRS M FACTORING
  -- ════════════════════════════════════════════════════════════

  -- Config factoring
  INSERT INTO config_factoring (empresa_id, whatsapp_padrao, prefixo_contrato, taxa_juros_padrao,
    prazo_minimo_meses, prazo_maximo_meses, valor_minimo_emprestimo, valor_maximo_emprestimo,
    multa_atraso, juros_mora_diario,
    msg_aprovacao, msg_liberacao, msg_vencimento, msg_cobranca, msg_quitacao)
  VALUES (v_fac, '64999990002', 'SRS', 3.50, 2, 60, 500.00, 50000.00, 2.00, 0.0333,
    'Olá {nome}! Seu empréstimo #{contrato} de {valor} foi aprovado.',
    'Olá {nome}! Seu empréstimo #{contrato} foi liberado. Valor: {valor}.',
    'Olá {nome}! Sua parcela {numero}/{total} de {valor} vence amanhã.',
    'Olá {nome}! Parcela {numero}/{total} de {valor} venceu em {vencimento}. Entre em contato.',
    'Parabéns {nome}! Seu empréstimo #{contrato} foi quitado!')
  ON CONFLICT (empresa_id) DO NOTHING;

  -- ── Clientes Factoring ───────────────────────────────────────
  INSERT INTO clientes_factoring (id, empresa_id, nome, cpf, telefone, email, cidade, estado,
    profissao, renda_mensal, limite_credito, credito_utilizado, score_interno,
    total_emprestimos, valor_total_emprestado, ultima_operacao, status) VALUES
    (v_fc1, v_fac, 'Marcos Antônio Ferreira', '101.202.303-10', '64988110001', 'marcos.a@email.com',   'Rio Verde', 'GO', 'Comerciante',  5800.00, 15000.00, 12000.00, 82, 3, 28000.00, NOW() - INTERVAL '5 days',  'ativo'),
    (v_fc2, v_fac, 'Luciana Borges Melo',     '202.303.404-20', '64988220002', 'luciana.bm@email.com', 'Rio Verde', 'GO', 'Professora',   3200.00, 8000.00,  5000.00,  75, 2, 13000.00, NOW() - INTERVAL '20 days', 'ativo'),
    (v_fc3, v_fac, 'Paulo Sérgio Araújo',     '303.404.505-30', '64988330003', 'paulo.sa@email.com',   'Jataí',     'GO', 'Agricultor',   7500.00, 20000.00, 8000.00,  68, 2, 18000.00, NOW() - INTERVAL '10 days', 'ativo'),
    (v_fc4, v_fac, 'Tatiana Ramos Vieira',    '404.505.606-40', '64988440004', 'tatiana.rv@email.com', 'Rio Verde', 'GO', 'Enfermeira',   4100.00, 10000.00, 4000.00,  55, 1, 4000.00,  NOW() - INTERVAL '45 days', 'ativo'),
    (v_fc5, v_fac, 'Elias Gonçalves Pinto',   '505.606.707-50', '64988550005', 'elias.gp@email.com',   'Mineiros',  'GO', 'Autônomo',     2800.00, 5000.00,  5000.00,  38, 2, 9500.00,  NOW() - INTERVAL '60 days', 'ativo'),
    (v_fc6, v_fac, 'Simone Dias Cardoso',     '606.707.808-60', '64988660006', 'simone.dc@email.com',  'Rio Verde', 'GO', 'Vendedora',    1900.00, 3000.00,  3000.00,  25, 1, 3000.00,  NOW() - INTERVAL '90 days', 'bloqueado'),
    (v_fc7, v_fac, 'André Luiz Barbosa',      '707.808.909-70', '64988770007', 'andre.lb@email.com',   'Rio Verde', 'GO', 'Motorista',    3600.00, 8000.00,  0.00,     78, 1, 6000.00,  NOW() - INTERVAL '120 days','ativo'),
    (v_fc8, v_fac, 'Cristina Moura Santos',   '808.909.010-80', '64988880008', 'cristina.ms@email.com','Jataí',     'GO', 'Contadora',    6200.00, 18000.00, 0.00,     91, 3, 32000.00, NOW() - INTERVAL '30 days', 'ativo');

  -- Referências
  INSERT INTO referencias_cliente_factoring (cliente_id, nome, parentesco, telefone) VALUES
    (v_fc1, 'Maria Ferreira',    'Esposa',   '64988111111'),
    (v_fc1, 'José Ferreira',     'Pai',      '64988111112'),
    (v_fc2, 'Rafael Melo',       'Marido',   '64988222221'),
    (v_fc3, 'Ana Araújo',        'Filha',    '64988333331'),
    (v_fc5, 'Renata Pinto',      'Cônjuge',  '64988555551'),
    (v_fc6, 'Lucas Cardoso',     'Irmão',    '64988666661');

  -- ── Empréstimos ──────────────────────────────────────────────
  -- e1: Marcos — ativo em dia (12 parcelas, 3 pagas)
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e1, v_fac, 'SRS-2026-00001', v_fc1, 10000.00, 3.50, 'mensal', 12,
     1047.05, 12564.60, 2564.60, 0.00, 9471.45,
     CURRENT_DATE - 90, CURRENT_DATE - 95, 'ativo');

  -- e2: Luciana — ativo em dia (6 parcelas, 2 pagas)
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e2, v_fac, 'SRS-2026-00002', v_fc2, 5000.00, 3.50, 'mensal', 6,
     924.71, 5548.26, 548.26, 0.00, 3698.84,
     CURRENT_DATE - 60, CURRENT_DATE - 65, 'ativo');

  -- e3: Paulo — ativo com parcela atrasada
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e3, v_fac, 'SRS-2026-00003', v_fc3, 8000.00, 3.50, 'mensal', 10,
     980.04, 9800.40, 1800.40, 0.00, 7840.32,
     CURRENT_DATE - 75, CURRENT_DATE - 80, 'ativo');

  -- e4: Tatiana — ativo em dia (3 parcelas, 1 paga)
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e4, v_fac, 'SRS-2026-00004', v_fc4, 4000.00, 3.50, 'mensal', 4,
     1082.14, 4328.56, 328.56, 0.00, 3246.42,
     CURRENT_DATE - 35, CURRENT_DATE - 40, 'ativo');

  -- e5: Elias — inadimplente (90+ dias atrasado)
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e5, v_fac, 'SRS-2026-00005', v_fc5, 3000.00, 3.50, 'mensal', 6,
     554.23, 3325.38, 325.38, 0.00, 3325.38,
     CURRENT_DATE - 120, CURRENT_DATE - 125, 'inadimplente');

  -- e6: Simone — inadimplente (60+ dias)
  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao, status) VALUES
    (v_e6, v_fac, 'SRS-2026-00006', v_fc6, 3000.00, 3.50, 'mensal', 6,
     554.23, 3325.38, 325.38, 0.00, 3325.38,
     CURRENT_DATE - 95, CURRENT_DATE - 100, 'inadimplente');

  -- ── Parcelas Empréstimo ──────────────────────────────────────
  -- e1 — Marcos 12x: 3 pagas, 9 pendentes
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_fac, v_e1, v_fc1, 1,  12, 1047.05, 697.05, 350.00, 10000.00, 9302.95, 1047.05, CURRENT_DATE - 90, CURRENT_DATE - 90, 'pix',      'pago'),
    (v_fac, v_e1, v_fc1, 2,  12, 1047.05, 721.44, 325.61, 9302.95,  8581.51, 1047.05, CURRENT_DATE - 60, CURRENT_DATE - 59, 'pix',      'pago'),
    (v_fac, v_e1, v_fc1, 3,  12, 1047.05, 746.69, 300.36, 8581.51,  7834.82, 1047.05, CURRENT_DATE - 30, CURRENT_DATE - 30, 'dinheiro', 'pago'),
    (v_fac, v_e1, v_fc1, 4,  12, 1047.05, 772.82, 274.23, 7834.82,  7062.00, NULL,    CURRENT_DATE,       NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 5,  12, 1047.05, 799.87, 247.18, 7062.00,  6262.13, NULL,    CURRENT_DATE + 30,  NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 6,  12, 1047.05, 827.87, 219.18, 6262.13,  5434.26, NULL,    CURRENT_DATE + 60,  NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 7,  12, 1047.05, 856.84, 190.21, 5434.26,  4577.42, NULL,    CURRENT_DATE + 90,  NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 8,  12, 1047.05, 886.83, 160.22, 4577.42,  3690.59, NULL,    CURRENT_DATE + 120, NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 9,  12, 1047.05, 917.87, 129.18, 3690.59,  2772.72, NULL,    CURRENT_DATE + 150, NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 10, 12, 1047.05, 950.00, 97.05,  2772.72,  1822.72, NULL,    CURRENT_DATE + 180, NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 11, 12, 1047.05, 983.25, 63.80,  1822.72,  839.47,  NULL,    CURRENT_DATE + 210, NULL, NULL, 'pendente'),
    (v_fac, v_e1, v_fc1, 12, 12, 869.05,  839.47, 29.58,  839.47,   0.00,    NULL,    CURRENT_DATE + 240, NULL, NULL, 'pendente');

  -- e2 — Luciana 6x: 2 pagas, 4 pendentes
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_fac, v_e2, v_fc2, 1, 6, 924.71, 749.71, 175.00, 5000.00, 4250.29, 924.71, CURRENT_DATE - 60, CURRENT_DATE - 59, 'transferencia', 'pago'),
    (v_fac, v_e2, v_fc2, 2, 6, 924.71, 775.95, 148.76, 4250.29, 3474.34, 924.71, CURRENT_DATE - 30, CURRENT_DATE - 30, 'pix',           'pago'),
    (v_fac, v_e2, v_fc2, 3, 6, 924.71, 803.11, 121.60, 3474.34, 2671.23, NULL,   CURRENT_DATE,       NULL, NULL, 'pendente'),
    (v_fac, v_e2, v_fc2, 4, 6, 924.71, 831.22, 93.49,  2671.23, 1840.01, NULL,   CURRENT_DATE + 30,  NULL, NULL, 'pendente'),
    (v_fac, v_e2, v_fc2, 5, 6, 924.71, 860.31, 64.40,  1840.01, 979.70,  NULL,   CURRENT_DATE + 60,  NULL, NULL, 'pendente'),
    (v_fac, v_e2, v_fc2, 6, 6, 1013.97, 979.70, 34.27, 979.70,  0.00,    NULL,   CURRENT_DATE + 90,  NULL, NULL, 'pendente');

  -- e3 — Paulo 10x: 2 pagas, 1 ATRASADA, 7 pendentes
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    valor_pago, data_vencimento, data_pagamento, tipo_pagamento, multa, juros_mora, status) VALUES
    (v_fac, v_e3, v_fc3, 1,  10, 980.04, 700.04, 280.00, 8000.00, 7299.96, 980.04, CURRENT_DATE - 75, CURRENT_DATE - 75, 'dinheiro', 0.00, 0.00, 'pago'),
    (v_fac, v_e3, v_fc3, 2,  10, 980.04, 724.54, 255.50, 7299.96, 6575.42, 980.04, CURRENT_DATE - 45, CURRENT_DATE - 44, 'dinheiro', 0.00, 0.00, 'pago'),
    (v_fac, v_e3, v_fc3, 3,  10, 980.04, 749.90, 230.14, 6575.42, 5825.52, NULL,   CURRENT_DATE - 15, NULL, NULL, 45.50, 38.25, 'atrasado'),
    (v_fac, v_e3, v_fc3, 4,  10, 980.04, 776.15, 203.89, 5825.52, 5049.37, NULL,   CURRENT_DATE + 15, NULL, NULL, 0.00,  0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 5,  10, 980.04, 803.32, 176.72, 5049.37, 4246.05, NULL,   CURRENT_DATE + 45, NULL, NULL, 0.00,  0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 6,  10, 980.04, 831.44, 148.60, 4246.05, 3414.61, NULL,   CURRENT_DATE + 75, NULL, NULL, 0.00,  0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 7,  10, 980.04, 860.54, 119.50, 3414.61, 2554.07, NULL,   CURRENT_DATE + 105, NULL, NULL, 0.00, 0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 8,  10, 980.04, 890.66, 89.38,  2554.07, 1663.41, NULL,   CURRENT_DATE + 135, NULL, NULL, 0.00, 0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 9,  10, 980.04, 921.83, 58.21,  1663.41, 741.58,  NULL,   CURRENT_DATE + 165, NULL, NULL, 0.00, 0.00,  'pendente'),
    (v_fac, v_e3, v_fc3, 10, 10, 767.54, 741.58, 25.96,  741.58,  0.00,    NULL,   CURRENT_DATE + 195, NULL, NULL, 0.00, 0.00,  'pendente');

  -- e4 — Tatiana 4x: 1 paga, 3 pendentes
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    valor_pago, data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_fac, v_e4, v_fc4, 1, 4, 1082.14, 942.14, 140.00, 4000.00, 3057.86, 1082.14, CURRENT_DATE - 35, CURRENT_DATE - 35, 'pix', 'pago'),
    (v_fac, v_e4, v_fc4, 2, 4, 1082.14, 975.12, 107.02, 3057.86, 2082.74, NULL,    CURRENT_DATE - 5,  NULL, NULL, 'pendente'),
    (v_fac, v_e4, v_fc4, 3, 4, 1082.14, 1009.25, 72.89, 2082.74, 1073.49, NULL,    CURRENT_DATE + 25, NULL, NULL, 'pendente'),
    (v_fac, v_e4, v_fc4, 4, 4, 1110.60, 1073.49, 37.11, 1073.49, 0.00,    NULL,    CURRENT_DATE + 55, NULL, NULL, 'pendente');

  -- e5 — Elias (inadimplente) — todas atrasadas
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    data_vencimento, multa, juros_mora, status) VALUES
    (v_fac, v_e5, v_fc5, 1, 6, 554.23, 449.23, 105.00, 3000.00, 2550.77, CURRENT_DATE - 120, 11.08, 59.86, 'atrasado'),
    (v_fac, v_e5, v_fc5, 2, 6, 554.23, 465.16, 89.07,  2550.77, 2085.61, CURRENT_DATE - 90,  11.08, 44.89, 'atrasado'),
    (v_fac, v_e5, v_fc5, 3, 6, 554.23, 481.64, 72.59,  2085.61, 1603.97, CURRENT_DATE - 60,  11.08, 29.93, 'atrasado'),
    (v_fac, v_e5, v_fc5, 4, 6, 554.23, 498.50, 55.73,  1603.97, 1105.47, CURRENT_DATE - 30,  11.08, 14.96, 'atrasado'),
    (v_fac, v_e5, v_fc5, 5, 6, 554.23, 515.95, 38.28,  1105.47, 589.52,  CURRENT_DATE,       0.00,  0.00,  'atrasado'),
    (v_fac, v_e5, v_fc5, 6, 6, 610.14, 589.52, 20.62,  589.52,  0.00,    CURRENT_DATE + 30,  0.00,  0.00,  'pendente');

  -- e6 — Simone (inadimplente, bloqueada)
  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    data_vencimento, multa, juros_mora, status) VALUES
    (v_fac, v_e6, v_fc6, 1, 6, 554.23, 449.23, 105.00, 3000.00, 2550.77, CURRENT_DATE - 95, 11.08, 47.60, 'atrasado'),
    (v_fac, v_e6, v_fc6, 2, 6, 554.23, 465.16, 89.07,  2550.77, 2085.61, CURRENT_DATE - 65, 11.08, 32.62, 'atrasado'),
    (v_fac, v_e6, v_fc6, 3, 6, 554.23, 481.64, 72.59,  2085.61, 1603.97, CURRENT_DATE - 35, 11.08, 17.65, 'atrasado'),
    (v_fac, v_e6, v_fc6, 4, 6, 554.23, 498.50, 55.73,  1603.97, 1105.47, CURRENT_DATE - 5,  11.08, 2.50,  'atrasado'),
    (v_fac, v_e6, v_fc6, 5, 6, 554.23, 515.95, 38.28,  1105.47, 589.52,  CURRENT_DATE + 25, 0.00,  0.00,  'pendente'),
    (v_fac, v_e6, v_fc6, 6, 6, 610.14, 589.52, 20.62,  589.52,  0.00,    CURRENT_DATE + 55, 0.00,  0.00,  'pendente');

  -- ── Contas a Pagar (Factoring) ────────────────────────────────
  INSERT INTO contas_pagar (empresa_id, descricao, categoria, valor, valor_pago,
    data_vencimento, data_pagamento, tipo_pagamento, status) VALUES
    (v_fac, 'Aluguel escritório maio/2026',  'aluguel',  2200.00, 2200.00, CURRENT_DATE - 3,   CURRENT_DATE - 3,   'pix',           'pago'),
    (v_fac, 'Salário analista Junho/2026',   'salario',  3800.00, NULL,    CURRENT_DATE + 15,  NULL, NULL, 'pendente'),
    (v_fac, 'Sistema de gestão (licença)',   'servico',  480.00,  NULL,    CURRENT_DATE + 5,   NULL, NULL, 'pendente'),
    (v_fac, 'SIMPLES Nacional abril/2026',   'imposto',  920.00,  NULL,    CURRENT_DATE - 5,   NULL, NULL, 'atrasado'),
    (v_fac, 'Contabilidade mensal',          'servico',  750.00,  750.00,  CURRENT_DATE - 10,  CURRENT_DATE - 10,  'transferencia', 'pago'),
    (v_fac, 'Internet fibra escritório',     'servico',  189.00,  NULL,    CURRENT_DATE + 3,   NULL, NULL, 'pendente');

  -- ── Movimentações Caixa (Factoring) ─────────────────────────
  INSERT INTO movimentacoes_caixa (empresa_id, tipo, categoria, descricao, valor, data_movimentacao) VALUES
    (v_fac, 'saida',   'Capital',      'Liberação empréstimo Marcos Ferreira',   10000.00, CURRENT_DATE - 95),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 1/12 - Marcos Ferreira',          1047.05, CURRENT_DATE - 90),
    (v_fac, 'saida',   'Capital',      'Liberação empréstimo Luciana Borges',     5000.00, CURRENT_DATE - 65),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 1/6 - Luciana Borges',             924.71, CURRENT_DATE - 60),
    (v_fac, 'saida',   'Capital',      'Liberação empréstimo Paulo Araújo',       8000.00, CURRENT_DATE - 80),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 1/10 - Paulo Araújo',              980.04, CURRENT_DATE - 75),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 2/12 - Marcos Ferreira',          1047.05, CURRENT_DATE - 60),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 2/10 - Paulo Araújo',              980.04, CURRENT_DATE - 45),
    (v_fac, 'saida',   'Capital',      'Liberação empréstimo Tatiana Vieira',     4000.00, CURRENT_DATE - 40),
    (v_fac, 'saida',   'Aluguel',      'Aluguel escritório abril/2026',           2200.00, CURRENT_DATE - 35),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 1/4 - Tatiana Vieira',            1082.14, CURRENT_DATE - 35),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 3/12 - Marcos Ferreira',          1047.05, CURRENT_DATE - 30),
    (v_fac, 'entrada', 'Parcelas',     'Parcela 2/6 - Luciana Borges',             924.71, CURRENT_DATE - 30),
    (v_fac, 'saida',   'Serviços',     'Contabilidade mensal',                     750.00, CURRENT_DATE - 10),
    (v_fac, 'saida',   'Aluguel',      'Aluguel escritório maio/2026',            2200.00, CURRENT_DATE - 3);

  -- ── Notificações ─────────────────────────────────────────────
  INSERT INTO notificacoes_log (empresa_id, canal, destinatario, assunto, mensagem,
    referencia_tipo, referencia_id, status, enviado_em) VALUES
    (v_fac, 'whatsapp', '64988110001', 'Parcela vencendo', 'Olá Marcos! Sua parcela 4/12 de R$ 1.047,05 vence hoje.', 'parcela_emprestimo', v_e1, 'enviado', NOW() - INTERVAL '2 hours'),
    (v_fac, 'whatsapp', '64988220002', 'Parcela vencendo', 'Olá Luciana! Sua parcela 3/6 de R$ 924,71 vence hoje.', 'parcela_emprestimo', v_e2, 'enviado', NOW() - INTERVAL '2 hours'),
    (v_fac, 'whatsapp', '64988330003', 'Parcela atrasada', 'Olá Paulo! Sua parcela 3/10 de R$ 980,04 está 15 dias atrasada.', 'parcela_emprestimo', v_e3, 'enviado', NOW() - INTERVAL '1 hour'),
    (v_fac, 'whatsapp', '64988550005', 'Cobrança urgente', 'Olá Elias! Você possui 4 parcelas em atraso. Entre em contato.', 'emprestimo', v_e5, 'enviado', NOW() - INTERVAL '30 minutes'),
    (v_fac, 'whatsapp', '64988660006', 'Conta bloqueada',  'Olá Simone! Sua conta está bloqueada por inadimplência.', 'emprestimo', v_e6, 'pendente', NULL);

  RAISE NOTICE 'Dados de demonstração inseridos com sucesso!';
  RAISE NOTICE 'Empório ID: %', v_emp;
  RAISE NOTICE 'Factoring ID: %', v_fac;

END;
$$;

-- Atualiza parcelas vencidas para status atrasado
SELECT fn_marcar_parcelas_atrasadas();
