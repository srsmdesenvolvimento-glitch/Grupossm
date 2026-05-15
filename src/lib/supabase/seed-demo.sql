-- ═══════════════════════════════════════════════════════════════
-- GRUPO SRSM — DADOS DE DEMONSTRAÇÃO (CAMPOS COMPLETOS)
-- Roda no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_emp UUID; v_fac UUID;
  v_cat_sofa UUID := gen_random_uuid(); v_cat_mesa UUID := gen_random_uuid();
  v_cat_cama UUID := gen_random_uuid(); v_cat_arm  UUID := gen_random_uuid();
  v_forn UUID := gen_random_uuid();
  v_p1 UUID:=gen_random_uuid(); v_p2 UUID:=gen_random_uuid(); v_p3 UUID:=gen_random_uuid();
  v_p4 UUID:=gen_random_uuid(); v_p5 UUID:=gen_random_uuid(); v_p6 UUID:=gen_random_uuid();
  v_p7 UUID:=gen_random_uuid(); v_p8 UUID:=gen_random_uuid(); v_p9 UUID:=gen_random_uuid();
  v_p10 UUID:=gen_random_uuid(); v_p11 UUID:=gen_random_uuid(); v_p12 UUID:=gen_random_uuid();
  v_ec1 UUID:=gen_random_uuid(); v_ec2 UUID:=gen_random_uuid(); v_ec3 UUID:=gen_random_uuid();
  v_ec4 UUID:=gen_random_uuid(); v_ec5 UUID:=gen_random_uuid(); v_ec6 UUID:=gen_random_uuid();
  v_v1 UUID:=gen_random_uuid(); v_v2 UUID:=gen_random_uuid(); v_v3 UUID:=gen_random_uuid();
  v_v4 UUID:=gen_random_uuid(); v_v5 UUID:=gen_random_uuid(); v_v6 UUID:=gen_random_uuid();
  v_v7 UUID:=gen_random_uuid(); v_v8 UUID:=gen_random_uuid();
  v_fc1 UUID:=gen_random_uuid(); v_fc2 UUID:=gen_random_uuid(); v_fc3 UUID:=gen_random_uuid();
  v_fc4 UUID:=gen_random_uuid(); v_fc5 UUID:=gen_random_uuid(); v_fc6 UUID:=gen_random_uuid();
  v_fc7 UUID:=gen_random_uuid(); v_fc8 UUID:=gen_random_uuid();
  v_e1 UUID:=gen_random_uuid(); v_e2 UUID:=gen_random_uuid(); v_e3 UUID:=gen_random_uuid();
  v_e4 UUID:=gen_random_uuid(); v_e5 UUID:=gen_random_uuid(); v_e6 UUID:=gen_random_uuid();
BEGIN

  SELECT id INTO v_emp FROM empresas WHERE tipo = 'emporio'   LIMIT 1;
  SELECT id INTO v_fac FROM empresas WHERE tipo = 'factoring' LIMIT 1;
  IF v_emp IS NULL OR v_fac IS NULL THEN
    RAISE EXCEPTION 'Empresas não encontradas.';
  END IF;

  -- ════════════════════════════════════════════════════════════
  -- EMPÓRIO DOS MÓVEIS
  -- ════════════════════════════════════════════════════════════

  INSERT INTO config_catalogo (empresa_id, slug, titulo, descricao, whatsapp, instagram, mostrar_preco, mostrar_estoque, ativo)
  VALUES (v_emp, 'emporio-dos-moveis', 'Empório dos Móveis', 'Os melhores móveis com o melhor preço da região. Qualidade e conforto para sua casa.', '64999990001', '@emporiodosmoveis', TRUE, FALSE, TRUE)
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO config_emporio (empresa_id, whatsapp_padrao, prefixo_numero_venda, dias_vencimento_padrao,
    msg_orcamento, msg_aprovacao, msg_entrega, msg_cobranca, msg_aniversario)
  VALUES (v_emp, '64999990001', 'EMP', 30,
    'Olá {nome}! Seu orçamento #{numero} no valor de {total} está pronto. Acesse nosso catálogo: emporiodosmoveis.com.br',
    'Olá {nome}! Sua venda #{numero} foi aprovada. Em breve entraremos em contato para agendar a entrega.',
    'Olá {nome}! Seu pedido #{numero} está a caminho. Previsão de entrega: {data_entrega}. Obrigado pela confiança!',
    'Olá {nome}! Sua parcela {numero}/{total} de {valor} vence em {vencimento}. Pague via PIX: 64999990001.',
    'Parabéns {nome}! Toda a equipe do Empório deseja um feliz aniversário! Aproveite 5% de desconto na sua próxima compra.')
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO categorias_produto (id, empresa_id, nome, slug, icone, ordem, descricao) VALUES
    (v_cat_sofa, v_emp, 'Sofás e Poltronas',      'sofas-poltronas',     '🛋️', 1, 'Sofás, poltronas e chaises para sala de estar'),
    (v_cat_mesa, v_emp, 'Mesas e Cadeiras',        'mesas-cadeiras',      '🪑', 2, 'Mesas de jantar, escritório e cadeiras diversas'),
    (v_cat_cama, v_emp, 'Camas e Colchões',        'camas-colchoes',      '🛏️', 3, 'Camas box, colchões e cabeceiras'),
    (v_cat_arm,  v_emp, 'Armários e Roupeiros',    'armarios-roupeiros',  '🚪', 4, 'Guarda-roupas, armários e cômodas');

  INSERT INTO fornecedores (id, empresa_id, nome, cnpj, telefone, email, endereco, cidade, estado, contato, observacoes) VALUES
    (v_forn, v_emp, 'Móveis Brasil Atacado Ltda', '12.345.678/0001-90', '64933334444',
     'vendas@moveisbrasil.com.br', 'Av. Industrial, 1500, Galpão 3', 'Goiânia', 'GO',
     'Rodrigo Almeida', 'Fornecedor principal. Prazo de entrega 15 dias. Desconto de 5% acima de R$10.000.');

  INSERT INTO produtos (id, empresa_id, categoria_id, fornecedor_id, nome, sku, descricao, descricao_curta,
    preco, preco_custo, estoque, estoque_minimo, unidade, peso, destaque, disponivel_catalogo, status,
    tags) VALUES
    (v_p1,  v_emp, v_cat_sofa, v_forn, 'Sofá 3 Lugares Retrátil Suede',   'SOF-001',
     'Sofá retrátil e reclinável em tecido suede. Estrutura em madeira maciça. Espuma D33. Disponível em 8 cores.',
     'Sofá retrátil reclinável em tecido suede com estrutura em madeira maciça.',
     2490.00, 1400.00, 8, 2, 'un', 68.5, TRUE, TRUE, 'ativo', ARRAY['sala','sofa','retratil','suede']),
    (v_p2,  v_emp, v_cat_sofa, v_forn, 'Poltrona Decorativa Veludo Azul', 'SOF-002',
     'Poltrona decorativa em veludo azul petróleo. Pés em madeira. Perfeita para leitura e descanso.',
     'Poltrona em veludo azul petróleo com pés em madeira natural.',
     890.00, 480.00, 5, 1, 'un', 22.0, FALSE, TRUE, 'ativo', ARRAY['poltrona','veludo','decoracao']),
    (v_p3,  v_emp, v_cat_sofa, v_forn, 'Sofá Canto 5 Lugares com Chaise', 'SOF-003',
     'Sofá de canto em L com chaise. Tecido chenille impermeável. 5 lugares. Almofadas inclusas.',
     'Sofá de canto L com chaise em chenille impermeável, 5 lugares.',
     3890.00, 2200.00, 3, 1, 'un', 110.0, TRUE, TRUE, 'ativo', ARRAY['sofa','canto','chaise','impermeavel']),
    (v_p4,  v_emp, v_cat_mesa, v_forn, 'Mesa de Jantar 6 Lugares MDF',   'MES-001',
     'Mesa de jantar para 6 pessoas. Tampo em vidro temperado 8mm. Base em MDF amadeirado. Fácil limpeza.',
     'Mesa de jantar 6 lugares com tampo de vidro temperado e base MDF.',
     1890.00, 950.00, 6, 2, 'un', 45.0, TRUE, TRUE, 'ativo', ARRAY['mesa','jantar','vidro','6lugares']),
    (v_p5,  v_emp, v_cat_mesa, v_forn, 'Cadeira Estofada Giratória Slim', 'MES-002',
     'Cadeira giratória com base cromada e regulagem de altura. Assento estofado em couro sintético. Suporta até 120kg.',
     'Cadeira giratória com base cromada e estofado em couro sintético.',
     320.00, 170.00, 20, 5, 'un', 8.5, FALSE, TRUE, 'ativo', ARRAY['cadeira','giratoria','escritorio']),
    (v_p6,  v_emp, v_cat_mesa, v_forn, 'Mesa de Centro Redonda Vidro',    'MES-003',
     'Mesa de centro redonda com tampo de vidro temperado 10mm. Base em aço inox escovado. Diâmetro 90cm.',
     'Mesa de centro em vidro temperado com base inox escovado.',
     680.00, 350.00, 0, 2, 'un', 18.0, FALSE, TRUE, 'sem_estoque', ARRAY['mesa','centro','vidro','sala']),
    (v_p7,  v_emp, v_cat_cama, v_forn, 'Cama Box Casal Queen 1,58m',      'CAM-001',
     'Cama box queen size 1,58x1,98m. Colchão incluso com molas ensacadas 28cm. Base com gaveta. Cabeceira simples.',
     'Cama box queen com colchão molas ensacadas 28cm e base com gaveta.',
     2190.00, 1100.00, 4, 1, 'un', 95.0, TRUE, TRUE, 'ativo', ARRAY['cama','box','queen','colchao']),
    (v_p8,  v_emp, v_cat_cama, v_forn, 'Colchão Molas Ensacadas Casal',   'CAM-002',
     'Colchão casal 1,38x1,88m. Tecnologia de molas ensacadas individualmente. 25cm de altura. Pillow top. Garantia 5 anos.',
     'Colchão casal molas ensacadas 25cm com pillow top, garantia 5 anos.',
     1490.00, 750.00, 7, 2, 'un', 42.0, FALSE, TRUE, 'ativo', ARRAY['colchao','molas','casal','pillow']),
    (v_p9,  v_emp, v_cat_cama, v_forn, 'Cabeceira Estofada King 2,00m',   'CAM-003',
     'Cabeceira king size 2,00m. Estofada em courino branco capitonê. Fixação fácil na parede. Altura 1,20m.',
     'Cabeceira king size em courino capitonê, fixação na parede.',
     890.00, 440.00, 3, 1, 'un', 28.0, FALSE, TRUE, 'ativo', ARRAY['cabeceira','king','courino','capitone']),
    (v_p10, v_emp, v_cat_arm,  v_forn, 'Guarda-Roupa 6 Portas Espelho',   'ARM-001',
     'Guarda-roupa 6 portas com espelho. 3 espelhos embutidos. 4 gavetas internas. Cabideiro duplo. Cor branco/amadeirado.',
     'Guarda-roupa 6 portas com espelho e 4 gavetas internas.',
     2890.00, 1450.00, 5, 1, 'un', 135.0, TRUE, TRUE, 'ativo', ARRAY['guarda-roupa','espelho','6portas','quarto']),
    (v_p11, v_emp, v_cat_arm,  v_forn, 'Cômoda 5 Gavetas Amadeirada',     'ARM-002',
     'Cômoda com 5 gavetas em MDF amadeirado. Puxadores em metal escovado. Dimensões: 80x45x100cm.',
     'Cômoda 5 gavetas em MDF amadeirado com puxadores em metal.',
     980.00, 490.00, 8, 2, 'un', 38.0, FALSE, TRUE, 'ativo', ARRAY['comoda','gavetas','quarto','madeira']),
    (v_p12, v_emp, v_cat_arm,  v_forn, 'Armário Multiuso 4 Portas',       'ARM-003',
     'Armário multiuso 4 portas em MDF. Pode ser usado em qualquer ambiente. Prateleiras reguláveis. Cor branco.',
     'Armário multiuso 4 portas com prateleiras reguláveis em MDF.',
     640.00, 320.00, 0, 2, 'un', 52.0, FALSE, FALSE, 'sem_estoque', ARRAY['armario','multiuso','branco']);

  INSERT INTO clientes_emporio (id, empresa_id, nome, cpf, rg, data_nascimento, telefone, telefone2, email,
    endereco, numero, complemento, bairro, cidade, estado, cep,
    total_compras, valor_total_compras, ultima_compra, observacoes, status) VALUES
    (v_ec1, v_emp, 'Ana Paula Rodrigues',  '111.222.333-44', '1234567 SSP/GO', '1988-03-15',
     '64999110001', '64999110002', 'ana.paula@email.com',
     'Rua das Flores', '120', 'Apto 12', 'Setor Sul', 'Rio Verde', 'GO', '75900-000',
     3, 8970.00, NOW()-INTERVAL '5 days', 'Cliente fiel, prefere entrega no turno da tarde.', 'ativo'),
    (v_ec2, v_emp, 'Carlos Eduardo Lima',  '222.333.444-55', '2345678 SSP/GO', '1975-07-22',
     '64999220002', NULL, 'carlos.lima@email.com',
     'Av. Brasil', '450', 'Casa', 'Jardim Goiás', 'Rio Verde', 'GO', '75901-010',
     2, 4780.00, NOW()-INTERVAL '15 days', 'Compra parcelado, sempre pontual nos pagamentos.', 'ativo'),
    (v_ec3, v_emp, 'Fernanda Costa Silva', '333.444.555-66', '3456789 SSP/GO', '1992-11-08',
     '64999330003', '64999330004', 'fernanda.cs@email.com',
     'Rua 7 de Setembro', '88', NULL, 'Centro', 'Rio Verde', 'GO', '75902-020',
     1, 2490.00, NOW()-INTERVAL '30 days', NULL, 'ativo'),
    (v_ec4, v_emp, 'Roberto Alves Souza',  '444.555.666-77', '4567890 SSP/GO', '1969-05-30',
     '64999440004', '64998440004', 'roberto.alves@email.com',
     'Rua João Pessoa', '230', 'Bloco B Apto 3', 'Setor Norte', 'Jataí', 'GO', '75800-000',
     4, 12600.00, NOW()-INTERVAL '2 days', 'Cliente VIP. Sempre compra mobília completa. Preferência por entrega às terças.', 'ativo'),
    (v_ec5, v_emp, 'Mariana Tavares',      '555.666.777-88', '5678901 SSP/GO', '1995-01-14',
     '64999550005', NULL, 'mariana.t@email.com',
     'Rua Goiás', '15', NULL, 'Vila Nova', 'Rio Verde', 'GO', '75903-030',
     1, 890.00, NOW()-INTERVAL '60 days', 'Cancelou última compra. Monitorar.', 'inativo'),
    (v_ec6, v_emp, 'José Henrique Nunes',  '666.777.888-99', '6789012 SSP/GO', '1983-09-19',
     '64999660006', '64999660007', 'jose.nunes@email.com',
     'Av. Goiás', '780', 'Sala 5', 'Centro', 'Mineiros', 'GO', '75830-000',
     0, 0.00, NULL, 'Novo cliente, veio por indicação do Roberto Souza.', 'ativo');

  INSERT INTO vendas (id, empresa_id, cliente_id, subtotal, desconto, total,
    tipo_pagamento, parcelas, valor_entrada, observacoes, status, data_entrega, created_at) VALUES
    (v_v1, v_emp, v_ec1, 2490.00, 0.00,   2490.00, 'cartao_credito', 10, 0.00,   'Entrega realizada com sucesso. Cliente satisfeita.', 'entregue',  CURRENT_DATE-90, NOW()-INTERVAL '90 days'),
    (v_v2, v_emp, v_ec1, 3890.00, 200.00, 3690.00, 'pix',             1,  0.00,   'Desconto negociado. Pagamento à vista no PIX.', 'entregue',  CURRENT_DATE-60, NOW()-INTERVAL '60 days'),
    (v_v3, v_emp, v_ec2, 4780.00, 0.00,   4780.00, 'cartao_credito', 12, 500.00, 'Parcelado em 12x. Entrada de R$500 no ato.', 'aprovada',  CURRENT_DATE+7,  NOW()-INTERVAL '15 days'),
    (v_v4, v_emp, v_ec3, 2490.00, 0.00,   2490.00, 'dinheiro',        1,  2490.00,'Pagamento à vista em dinheiro.', 'entregue',  CURRENT_DATE-25, NOW()-INTERVAL '30 days'),
    (v_v5, v_emp, v_ec4, 5380.00, 380.00, 5000.00, 'boleto',          5,  1000.00,'Desconto de R$380. Entrada + 4 boletos mensais.', 'aprovada',  CURRENT_DATE+14, NOW()-INTERVAL '7 days'),
    (v_v6, v_emp, v_ec4, 7700.00, 200.00, 7500.00, 'cartao_credito', 18, 1500.00,'Mobília completa quarto casal. Cliente VIP.', 'entregue',  CURRENT_DATE-10, NOW()-INTERVAL '45 days'),
    (v_v7, v_emp, v_ec5, 890.00,  0.00,   890.00,  'pix',             1,  890.00, 'Cancelado a pedido da cliente.', 'cancelada', NULL,            NOW()-INTERVAL '55 days'),
    (v_v8, v_emp, v_ec6, 3870.00, 0.00,   3870.00, 'boleto',          3,  0.00,   'Orçamento em aprovação. Cliente vai confirmar na sexta.', 'orcamento', CURRENT_DATE+10, NOW()-INTERVAL '1 day');

  INSERT INTO itens_venda (venda_id, produto_id, nome_produto, sku_produto, quantidade, preco_unitario, desconto, total) VALUES
    (v_v1, v_p1, 'Sofá 3 Lugares Retrátil Suede', 'SOF-001', 1, 2490.00, 0.00, 2490.00),
    (v_v2, v_p3, 'Sofá Canto 5 Lugares com Chaise','SOF-003', 1, 3890.00, 200.00, 3690.00),
    (v_v3, v_p4, 'Mesa de Jantar 6 Lugares MDF',  'MES-001', 1, 1890.00, 0.00, 1890.00),
    (v_v3, v_p5, 'Cadeira Estofada Giratória Slim','MES-002', 6, 320.00, 0.00, 1920.00),
    (v_v3, v_p11,'Cômoda 5 Gavetas Amadeirada',    'ARM-002', 1, 980.00, 0.00, 980.00),
    (v_v4, v_p1, 'Sofá 3 Lugares Retrátil Suede', 'SOF-001', 1, 2490.00, 0.00, 2490.00),
    (v_v5, v_p7, 'Cama Box Casal Queen 1,58m',     'CAM-001', 1, 2190.00, 0.00, 2190.00),
    (v_v5, v_p8, 'Colchão Molas Ensacadas Casal',  'CAM-002', 1, 1490.00, 0.00, 1490.00),
    (v_v5, v_p9, 'Cabeceira Estofada King 2,00m',  'CAM-003', 1, 890.00, 380.00, 510.00),
    (v_v6, v_p10,'Guarda-Roupa 6 Portas Espelho',  'ARM-001', 1, 2890.00, 0.00, 2890.00),
    (v_v6, v_p7, 'Cama Box Casal Queen 1,58m',     'CAM-001', 2, 2190.00, 200.00, 4180.00),
    (v_v6, v_p9, 'Cabeceira Estofada King 2,00m',  'CAM-003', 1, 890.00, 0.00, 890.00),
    (v_v7, v_p2, 'Poltrona Decorativa Veludo Azul','SOF-002', 1, 890.00, 0.00, 890.00),
    (v_v8, v_p10,'Guarda-Roupa 6 Portas Espelho',  'ARM-001', 1, 2890.00, 0.00, 2890.00),
    (v_v8, v_p5, 'Cadeira Estofada Giratória Slim','MES-002', 3, 320.00, 0.00, 960.00);

  INSERT INTO parcelas_receber (empresa_id, venda_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_pago, data_vencimento, data_pagamento, tipo_pagamento, observacoes, status) VALUES
    (v_emp,v_v3,v_ec2, 1,12,398.00,398.00,CURRENT_DATE-45,CURRENT_DATE-46,'cartao_credito','Pago no prazo.','pago'),
    (v_emp,v_v3,v_ec2, 2,12,398.00,398.00,CURRENT_DATE-15,CURRENT_DATE-14,'cartao_credito','Pago no prazo.','pago'),
    (v_emp,v_v3,v_ec2, 3,12,398.00,NULL,CURRENT_DATE+15,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 4,12,398.00,NULL,CURRENT_DATE+45,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 5,12,398.00,NULL,CURRENT_DATE+75,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 6,12,398.00,NULL,CURRENT_DATE+105,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 7,12,398.00,NULL,CURRENT_DATE+135,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 8,12,398.00,NULL,CURRENT_DATE+165,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2, 9,12,398.00,NULL,CURRENT_DATE+195,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2,10,12,398.00,NULL,CURRENT_DATE+225,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2,11,12,398.00,NULL,CURRENT_DATE+255,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v3,v_ec2,12,12,362.00,NULL,CURRENT_DATE+285,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v5,v_ec4, 1,5,800.00,800.00,CURRENT_DATE-7,CURRENT_DATE-6,'boleto','Pago via boleto.','pago'),
    (v_emp,v_v5,v_ec4, 2,5,800.00,NULL,CURRENT_DATE+23,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v5,v_ec4, 3,5,800.00,NULL,CURRENT_DATE+53,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v5,v_ec4, 4,5,800.00,NULL,CURRENT_DATE+83,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v5,v_ec4, 5,5,800.00,NULL,CURRENT_DATE+113,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v8,v_ec6, 1,3,1290.00,NULL,CURRENT_DATE+30,NULL,NULL,'Aguardando aprovação do orçamento.','pendente'),
    (v_emp,v_v8,v_ec6, 2,3,1290.00,NULL,CURRENT_DATE+60,NULL,NULL,NULL,'pendente'),
    (v_emp,v_v8,v_ec6, 3,3,1290.00,NULL,CURRENT_DATE+90,NULL,NULL,NULL,'pendente');

  INSERT INTO contas_pagar (empresa_id, descricao, categoria, fornecedor_id, fornecedor_nome,
    valor, valor_pago, data_vencimento, data_pagamento, tipo_pagamento, numero_documento, observacoes, status) VALUES
    (v_emp,'Aluguel maio/2026',       'aluguel',    NULL,  'Imobiliária Central Rio Verde', 4500.00,4500.00,CURRENT_DATE-5, CURRENT_DATE-5, 'transferencia','REC-2026-05','Aluguel do galpão principal. Vence todo dia 10.','pago'),
    (v_emp,'Salários maio/2026',      'salario',    NULL,  NULL,                             8200.00,8200.00,CURRENT_DATE-2, CURRENT_DATE-2, 'transferencia','FLH-2026-05','Folha de pagamento: 2 vendedores + 1 auxiliar.','pago'),
    (v_emp,'Fatura Móveis Brasil mai','fornecedor', v_forn,'Móveis Brasil Atacado Ltda',   12400.00,NULL,   CURRENT_DATE+10,NULL,NULL,'NF-45821','Compra de sofás e colchões. 45 dias prazo.','pendente'),
    (v_emp,'Energia elétrica maio',   'servico',    NULL,  'CELG Distribuição',              680.00, NULL,   CURRENT_DATE+5, NULL,NULL,'UC-123456','Consumo do mês de maio.','pendente'),
    (v_emp,'Internet e telefone',     'servico',    NULL,  'Claro Empresarial',              290.00, NULL,   CURRENT_DATE+8, NULL,NULL,'CLR-789','Plano fibra 500MB + linha fixa.','pendente'),
    (v_emp,'SIMPLES Nacional abril',  'imposto',    NULL,  'Receita Federal',                1840.00,NULL,   CURRENT_DATE-3, NULL,NULL,'DAS-04/2026','VENCIDO! Pagar com multa de 2%+juros.','atrasado'),
    (v_emp,'Manutenção AC e elétrica','servico',    NULL,  'JM Elétrica e Refrigeração',     350.00, 350.00, CURRENT_DATE-20,CURRENT_DATE-19,'pix','OS-2026-88','Revisão dos ares condicionados.','pago'),
    (v_emp,'Fatura fornecedor março', 'fornecedor', v_forn,'Móveis Brasil Atacado Ltda',    9600.00,9600.00,CURRENT_DATE-30,CURRENT_DATE-28,'transferencia','NF-44103','Quitado. Referente ao pedido de março.','pago');

  INSERT INTO movimentacoes_caixa (empresa_id, tipo, categoria, descricao, valor, data_movimentacao, observacoes) VALUES
    (v_emp,'entrada','Vendas',      'Venda #1 - Sofá 3 Lugares (Ana Paula)',    2490.00,CURRENT_DATE-90,'Pagamento à vista cartão'),
    (v_emp,'saida',  'Fornecedores','Compra estoque - Móveis Brasil (NF-44103)',9600.00,CURRENT_DATE-85,'Pagamento transferência'),
    (v_emp,'entrada','Vendas',      'Venda #2 - Sofá Canto (Ana Paula PIX)',    3690.00,CURRENT_DATE-60,'Pagamento PIX à vista'),
    (v_emp,'saida',  'Aluguel',     'Aluguel março/2026',                       4500.00,CURRENT_DATE-55,'Galpão principal'),
    (v_emp,'saida',  'Salários',    'Salários março/2026',                      8200.00,CURRENT_DATE-50,'3 funcionários'),
    (v_emp,'entrada','Vendas',      'Venda #4 - Sofá (Fernanda - dinheiro)',    2490.00,CURRENT_DATE-30,'À vista em dinheiro'),
    (v_emp,'saida',  'Aluguel',     'Aluguel abril/2026',                       4500.00,CURRENT_DATE-25,'Galpão principal'),
    (v_emp,'saida',  'Salários',    'Salários abril/2026',                      8200.00,CURRENT_DATE-20,'3 funcionários'),
    (v_emp,'saida',  'Serviços',    'Manutenção AC (JM Elétrica)',               350.00,CURRENT_DATE-19,'OS-2026-88'),
    (v_emp,'entrada','Crediário',   'Parcela 1/12 - Carlos Lima',                398.00,CURRENT_DATE-14,'Venda #3 cartão'),
    (v_emp,'entrada','Vendas',      'Venda #6 - Quarto Roberto (entrada)',      1500.00,CURRENT_DATE-10,'Entrada 18x cartão'),
    (v_emp,'entrada','Crediário',   'Parcela 1/5 - Roberto Alves',               800.00,CURRENT_DATE-6, 'Venda #5 boleto'),
    (v_emp,'saida',  'Aluguel',     'Aluguel maio/2026',                        4500.00,CURRENT_DATE-5, 'Galpão principal'),
    (v_emp,'saida',  'Salários',    'Salários maio/2026',                       8200.00,CURRENT_DATE-2, '3 funcionários'),
    (v_emp,'entrada','Crediário',   'Parcela 2/12 - Carlos Lima',                398.00,CURRENT_DATE-1, 'Venda #3 cartão');

  -- ════════════════════════════════════════════════════════════
  -- SRS M FACTORING
  -- ════════════════════════════════════════════════════════════

  INSERT INTO config_factoring (empresa_id, whatsapp_padrao, prefixo_contrato, taxa_juros_padrao,
    tipo_taxa_padrao, prazo_minimo_meses, prazo_maximo_meses,
    valor_minimo_emprestimo, valor_maximo_emprestimo,
    dias_carencia, multa_atraso, juros_mora_diario,
    msg_aprovacao, msg_liberacao, msg_vencimento, msg_cobranca, msg_quitacao, msg_boas_vindas)
  VALUES (v_fac,'64999990002','SRS',3.50,'mensal',2,60,500.00,50000.00,0,2.00,0.033300,
    'Olá {nome}! Seu empréstimo #{contrato} de {valor} foi aprovado! Em breve entraremos em contato.',
    'Olá {nome}! Seu empréstimo #{contrato} foi liberado. Valor: {valor}. Primeira parcela em {vencimento}.',
    'Olá {nome}! Lembrete: parcela {numero}/{total} de {valor} vence amanhã. PIX: 64999990002.',
    'Olá {nome}! Sua parcela {numero}/{total} de {valor} venceu em {vencimento}. Entre em contato: 64999990002.',
    'Parabéns {nome}! Seu empréstimo #{contrato} foi quitado! Obrigado pela confiança na SRS M Factoring.',
    'Olá {nome}! Seja bem-vindo à SRS M Factoring. Estamos à disposição: 64999990002.')
  ON CONFLICT (empresa_id) DO NOTHING;

  INSERT INTO clientes_factoring (id, empresa_id, nome, cpf, rg, orgao_emissor, data_nascimento,
    estado_civil, profissao, renda_mensal, telefone, telefone2, email,
    endereco, numero, complemento, bairro, cidade, estado, cep,
    banco, agencia, conta, tipo_conta, pix,
    limite_credito, credito_utilizado, score_interno,
    total_emprestimos, valor_total_emprestado, ultima_operacao, observacoes, status) VALUES
    (v_fc1,v_fac,'Marcos Antônio Ferreira','101.202.303-10','1234567','SSP/GO','1979-04-12',
     'casado','Comerciante / Dono de mercearia',5800.00,
     '64988110001','64988110002','marcos.a@email.com',
     'Rua das Acácias','245','Casa','Setor Leste','Rio Verde','GO','75900-100',
     'Banco do Brasil','0745-3','12345-6','corrente','marcos.ferreira@bb.com.br',
     15000.00,12000.00,82,3,28000.00,NOW()-INTERVAL '5 days',
     'Bom pagador. Nunca atrasou. Dono de mercearia há 15 anos. Recomendado pelo Sr. Paulo.','ativo'),
    (v_fc2,v_fac,'Luciana Borges Melo','202.303.404-20','2345678','SSP/GO','1987-09-25',
     'casada','Professora municipal',3200.00,
     '64988220002',NULL,'luciana.bm@email.com',
     'Av. Independência','880','Apto 201','Jardim América','Rio Verde','GO','75901-200',
     'Caixa Econômica','1234','98765-4','poupança','luciana.melo@caixa.gov.br',
     8000.00,5000.00,75,2,13000.00,NOW()-INTERVAL '20 days',
     'Servidora pública. Renda estável. Pontual nos pagamentos.','ativo'),
    (v_fc3,v_fac,'Paulo Sérgio Araújo','303.404.505-30','3456789','SSP/GO','1968-01-30',
     'casado','Agricultor / Produtor rural',7500.00,
     '64988330003','64988330004','paulo.sa@email.com',
     'Fazenda São João, Zona Rural','S/N',NULL,'Zona Rural','Jataí','GO','75800-000',
     'Sicredi','0412','54321-0','corrente','paulo.araujo@sicredi.com.br',
     20000.00,8000.00,68,2,18000.00,NOW()-INTERVAL '10 days',
     'Produtor rural. Renda sazonal (safra de soja). Pagamento sempre no início do mês.','ativo'),
    (v_fc4,v_fac,'Tatiana Ramos Vieira','404.505.606-40','4567890','SSP/GO','1990-06-18',
     'solteira','Enfermeira',4100.00,
     '64988440004',NULL,'tatiana.rv@email.com',
     'Rua Pinheiros','33','','Vila Esperança','Rio Verde','GO','75902-300',
     'Nubank','0001','11111-1','corrente','tatiana.vieira@nubank.com.br',
     10000.00,4000.00,55,1,4000.00,NOW()-INTERVAL '45 days',
     'Primeiro empréstimo. Histórico de crédito limitado mas renda formal comprovada.','ativo'),
    (v_fc5,v_fac,'Elias Gonçalves Pinto','505.606.707-50','5678901','SSP/GO','1983-12-03',
     'divorciado','Autônomo / Eletricista',2800.00,
     '64988550005',NULL,'elias.gp@email.com',
     'Rua dos Pinheiros','78','Casa dos fundos','Setor Oeste','Mineiros','GO','75830-100',
     'Bradesco','2710','77777-2','corrente','64988550005',
     5000.00,5000.00,38,2,9500.00,NOW()-INTERVAL '60 days',
     'INADIMPLENTE. 4 parcelas atrasadas. Tentativas de contato sem sucesso. Encaminhar ao jurídico.','ativo'),
    (v_fc6,v_fac,'Simone Dias Cardoso','606.707.808-60','6789012','SSP/GO','1995-08-22',
     'solteira','Vendedora',1900.00,
     '64988660006',NULL,'simone.dc@email.com',
     'Rua Jequitibá','15','',  'Nova Esperança','Rio Verde','GO','75903-400',
     'Itaú','3003','44444-3','corrente','simone.cardoso@cpf.pix',
     3000.00,3000.00,25,1,3000.00,NOW()-INTERVAL '90 days',
     'BLOQUEADA por inadimplência. 4 parcelas em atraso. Conta bloqueada em 10/04/2026.','bloqueado'),
    (v_fc7,v_fac,'André Luiz Barbosa','707.808.909-70','7890123','SSP/GO','1977-03-09',
     'casado','Motorista de caminhão',3600.00,
     '64988770007','64988770008','andre.lb@email.com',
     'Av. Palmeiras','520','','Setor Central','Rio Verde','GO','75900-500',
     'Banco do Brasil','0745-3','22222-5','corrente','andre.barbosa@bb.com.br',
     8000.00,0.00,78,1,6000.00,NOW()-INTERVAL '120 days',
     'Quitou empréstimo anterior em dia. Candidato a novo crédito com limite ampliado.','ativo'),
    (v_fc8,v_fac,'Cristina Moura Santos','808.909.010-80','8901234','SSP/GO','1982-05-14',
     'casada','Contadora',6200.00,
     '64988880008',NULL,'cristina.ms@email.com',
     'Rua das Magnólias','190','Apto 305','Jardim Bela Vista','Jataí','GO','75800-200',
     'Santander','3214','33333-7','corrente','cristina.santos@santander.com.br',
     18000.00,0.00,91,3,32000.00,NOW()-INTERVAL '30 days',
     'Melhor cliente. Score máximo. Nunca atrasou. Indicou 3 novos clientes para a empresa.','ativo');

  INSERT INTO referencias_cliente_factoring (cliente_id, nome, parentesco, telefone, observacoes) VALUES
    (v_fc1,'Maria Aparecida Ferreira','Esposa',  '64988111111','Confirmou emprego e residência do Marcos.'),
    (v_fc1,'José Carlos Ferreira',   'Pai',      '64988111112','Reside no mesmo bairro. Confirmou dados.'),
    (v_fc2,'Rafael Augusto Melo',    'Esposo',   '64988222221','Professor. Confirmou dados da Luciana.'),
    (v_fc3,'Ana Paula Araújo',       'Esposa',   '64988333331','Confirmou propriedade rural.'),
    (v_fc4,'Roberta Ramos',          'Mãe',      '64988444441','Confirmou residência e emprego.'),
    (v_fc5,'Renata Gonçalves',       'Ex-esposa','64988555551','Referência limitada. Contato dificultado.'),
    (v_fc6,'Lucas Cardoso',          'Irmão',    '64988666661','Confirmou residência mas não quis dar mais informações.'),
    (v_fc7,'Marcia Luiz Barbosa',    'Esposa',   '64988777771','Confirmou todos os dados. Muito colaborativa.'),
    (v_fc8,'Roberto Santos',         'Esposo',   '64988888881','Engenheiro. Confirmou renda e residência da Cristina.');

  INSERT INTO emprestimos (id, empresa_id, numero_contrato, cliente_id, valor_principal,
    taxa_juros, tipo_taxa, prazo_meses, valor_parcela, total_pagar, total_juros,
    valor_entrada, saldo_devedor, data_primeiro_vencimento, data_liberacao,
    observacoes, garantias, status) VALUES
    (v_e1,v_fac,'SRS-2026-00001',v_fc1,10000.00,3.50,'mensal',12,
     1047.05,12564.60,2564.60,0.00,9471.45,
     CURRENT_DATE-90,CURRENT_DATE-95,
     'Empréstimo para capital de giro da mercearia. Aprovado pelo comitê em 14/02/2026.',
     'Nota promissória assinada. Veículo VW Gol 2019 placa RVD-1234 dado como garantia.','ativo'),
    (v_e2,v_fac,'SRS-2026-00002',v_fc2,5000.00,3.50,'mensal',6,
     924.71,5548.26,548.26,0.00,3698.84,
     CURRENT_DATE-60,CURRENT_DATE-65,
     'Reforma da casa. Aprovado em 14/03/2026. Documentação completa em arquivo.',
     'Nota promissória assinada. Avalista: Rafael Augusto Melo (esposo).','ativo'),
    (v_e3,v_fac,'SRS-2026-00003',v_fc3,8000.00,3.50,'mensal',10,
     980.04,9800.40,1800.40,0.00,7840.32,
     CURRENT_DATE-75,CURRENT_DATE-80,
     'Custeio safra soja 2026. Parcela 3 em atraso. Entrar em contato para negociar.',
     'Nota promissória assinada. Penhor de equipamentos agrícolas (trator 65cv).','ativo'),
    (v_e4,v_fac,'SRS-2026-00004',v_fc4,4000.00,3.50,'mensal',4,
     1082.14,4328.56,328.56,0.00,3246.42,
     CURRENT_DATE-35,CURRENT_DATE-40,
     'Pagamento de dívida pessoal. Primeiro empréstimo da cliente. Acompanhar de perto.',
     'Nota promissória assinada. Holerite dos últimos 3 meses anexado.','ativo'),
    (v_e5,v_fac,'SRS-2026-00005',v_fc5,3000.00,3.50,'mensal',6,
     554.23,3325.38,325.38,0.00,3325.38,
     CURRENT_DATE-120,CURRENT_DATE-125,
     'INADIMPLENTE. 4 parcelas sem pagamento. Contato sem retorno. Encaminhar ao jurídico.',
     'Nota promissória assinada. Sem garantias adicionais.','inadimplente'),
    (v_e6,v_fac,'SRS-2026-00006',v_fc6,3000.00,3.50,'mensal',6,
     554.23,3325.38,325.38,0.00,3325.38,
     CURRENT_DATE-95,CURRENT_DATE-100,
     'INADIMPLENTE. Cliente bloqueada. Caso encaminhado para análise jurídica em 10/04/2026.',
     'Nota promissória assinada. Sem garantias reais.','inadimplente');

  INSERT INTO parcelas_emprestimo (empresa_id, emprestimo_id, cliente_id, numero_parcela, total_parcelas,
    valor, valor_principal, valor_juros, saldo_devedor_antes, saldo_devedor_apos,
    valor_pago, data_vencimento, data_pagamento, tipo_pagamento, multa, juros_mora, observacoes, status) VALUES
    (v_fac,v_e1,v_fc1, 1,12,1047.05,697.05,350.00,10000.00,9302.95,1047.05,CURRENT_DATE-90,CURRENT_DATE-90,'pix',     0.00,0.00,'Pago no vencimento via PIX.','pago'),
    (v_fac,v_e1,v_fc1, 2,12,1047.05,721.44,325.61,9302.95, 8581.51,1047.05,CURRENT_DATE-60,CURRENT_DATE-59,'pix',     0.00,0.00,'Pago 1 dia após vencimento.','pago'),
    (v_fac,v_e1,v_fc1, 3,12,1047.05,746.69,300.36,8581.51, 7834.82,1047.05,CURRENT_DATE-30,CURRENT_DATE-30,'dinheiro',0.00,0.00,'Pago presencialmente em dinheiro.','pago'),
    (v_fac,v_e1,v_fc1, 4,12,1047.05,772.82,274.23,7834.82, 7062.00,NULL,   CURRENT_DATE,   NULL,NULL,0.00,0.00,'Vence hoje.','pendente'),
    (v_fac,v_e1,v_fc1, 5,12,1047.05,799.87,247.18,7062.00, 6262.13,NULL,   CURRENT_DATE+30,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1, 6,12,1047.05,827.87,219.18,6262.13, 5434.26,NULL,   CURRENT_DATE+60,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1, 7,12,1047.05,856.84,190.21,5434.26, 4577.42,NULL,   CURRENT_DATE+90,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1, 8,12,1047.05,886.83,160.22,4577.42, 3690.59,NULL,   CURRENT_DATE+120,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1, 9,12,1047.05,917.87,129.18,3690.59, 2772.72,NULL,   CURRENT_DATE+150,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1,10,12,1047.05,950.00, 97.05,2772.72, 1822.72,NULL,   CURRENT_DATE+180,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1,11,12,1047.05,983.25, 63.80,1822.72,  839.47,NULL,   CURRENT_DATE+210,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e1,v_fc1,12,12, 869.05,839.47, 29.58, 839.47,    0.00,NULL,   CURRENT_DATE+240,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e2,v_fc2, 1, 6, 924.71,749.71,175.00,5000.00, 4250.29, 924.71,CURRENT_DATE-60,CURRENT_DATE-59,'transferencia',0.00,0.00,'Pago via transferência.','pago'),
    (v_fac,v_e2,v_fc2, 2, 6, 924.71,775.95,148.76,4250.29, 3474.34, 924.71,CURRENT_DATE-30,CURRENT_DATE-30,'pix',     0.00,0.00,'Pago no vencimento.','pago'),
    (v_fac,v_e2,v_fc2, 3, 6, 924.71,803.11,121.60,3474.34, 2671.23,NULL,   CURRENT_DATE,   NULL,NULL,0.00,0.00,'Vence hoje.','pendente'),
    (v_fac,v_e2,v_fc2, 4, 6, 924.71,831.22, 93.49,2671.23, 1840.01,NULL,   CURRENT_DATE+30,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e2,v_fc2, 5, 6, 924.71,860.31, 64.40,1840.01,  979.70,NULL,   CURRENT_DATE+60,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e2,v_fc2, 6, 6,1013.97,979.70, 34.27, 979.70,    0.00,NULL,   CURRENT_DATE+90,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 1,10, 980.04,700.04,280.00,8000.00, 7299.96, 980.04,CURRENT_DATE-75,CURRENT_DATE-75,'dinheiro',0.00,0.00,'Pago no vencimento.','pago'),
    (v_fac,v_e3,v_fc3, 2,10, 980.04,724.54,255.50,7299.96, 6575.42, 980.04,CURRENT_DATE-45,CURRENT_DATE-44,'dinheiro',0.00,0.00,'Pago 1 dia após o vencimento.','pago'),
    (v_fac,v_e3,v_fc3, 3,10, 980.04,749.90,230.14,6575.42, 5825.52,NULL,   CURRENT_DATE-15,NULL,NULL,45.50,38.25,'EM ATRASO há 15 dias. Contato realizado em 01/05/2026 sem retorno.','atrasado'),
    (v_fac,v_e3,v_fc3, 4,10, 980.04,776.15,203.89,5825.52, 5049.37,NULL,   CURRENT_DATE+15,NULL,NULL,0.00, 0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 5,10, 980.04,803.32,176.72,5049.37, 4246.05,NULL,   CURRENT_DATE+45,NULL,NULL,0.00, 0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 6,10, 980.04,831.44,148.60,4246.05, 3414.61,NULL,   CURRENT_DATE+75,NULL,NULL,0.00, 0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 7,10, 980.04,860.54,119.50,3414.61, 2554.07,NULL,   CURRENT_DATE+105,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 8,10, 980.04,890.66, 89.38,2554.07, 1663.41,NULL,   CURRENT_DATE+135,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3, 9,10, 980.04,921.83, 58.21,1663.41,  741.58,NULL,   CURRENT_DATE+165,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e3,v_fc3,10,10, 767.54,741.58, 25.96, 741.58,    0.00,NULL,   CURRENT_DATE+195,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e4,v_fc4, 1, 4,1082.14,942.14,140.00,4000.00, 3057.86,1082.14,CURRENT_DATE-35,CURRENT_DATE-35,'pix',0.00,0.00,'Pago via PIX no vencimento.','pago'),
    (v_fac,v_e4,v_fc4, 2, 4,1082.14,975.12,107.02,3057.86, 2082.74,NULL,   CURRENT_DATE-5, NULL,NULL,0.00,0.00,'Venceu há 5 dias. Ainda dentro da carência.','pendente'),
    (v_fac,v_e4,v_fc4, 3, 4,1082.14,1009.25,72.89,2082.74, 1073.49,NULL,   CURRENT_DATE+25,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e4,v_fc4, 4, 4,1110.60,1073.49,37.11,1073.49,    0.00,NULL,   CURRENT_DATE+55,NULL,NULL,0.00,0.00,NULL,'pendente'),
    (v_fac,v_e5,v_fc5, 1, 6, 554.23,449.23,105.00,3000.00, 2550.77,NULL,   CURRENT_DATE-120,NULL,NULL,11.08,59.86,'120 dias em atraso. Sem contato.','atrasado'),
    (v_fac,v_e5,v_fc5, 2, 6, 554.23,465.16, 89.07,2550.77, 2085.61,NULL,   CURRENT_DATE-90, NULL,NULL,11.08,44.89,'90 dias em atraso.','atrasado'),
    (v_fac,v_e5,v_fc5, 3, 6, 554.23,481.64, 72.59,2085.61, 1603.97,NULL,   CURRENT_DATE-60, NULL,NULL,11.08,29.93,'60 dias em atraso.','atrasado'),
    (v_fac,v_e5,v_fc5, 4, 6, 554.23,498.50, 55.73,1603.97, 1105.47,NULL,   CURRENT_DATE-30, NULL,NULL,11.08,14.96,'30 dias em atraso.','atrasado'),
    (v_fac,v_e5,v_fc5, 5, 6, 554.23,515.95, 38.28,1105.47,  589.52,NULL,   CURRENT_DATE,    NULL,NULL, 0.00, 0.00,'Vence hoje. Situação crítica.','atrasado'),
    (v_fac,v_e5,v_fc5, 6, 6, 610.14,589.52, 20.62, 589.52,    0.00,NULL,   CURRENT_DATE+30, NULL,NULL, 0.00, 0.00,NULL,'pendente'),
    (v_fac,v_e6,v_fc6, 1, 6, 554.23,449.23,105.00,3000.00, 2550.77,NULL,   CURRENT_DATE-95, NULL,NULL,11.08,47.60,'95 dias atrasado. Cliente bloqueada.','atrasado'),
    (v_fac,v_e6,v_fc6, 2, 6, 554.23,465.16, 89.07,2550.77, 2085.61,NULL,   CURRENT_DATE-65, NULL,NULL,11.08,32.62,'65 dias atrasado.','atrasado'),
    (v_fac,v_e6,v_fc6, 3, 6, 554.23,481.64, 72.59,2085.61, 1603.97,NULL,   CURRENT_DATE-35, NULL,NULL,11.08,17.65,'35 dias atrasado.','atrasado'),
    (v_fac,v_e6,v_fc6, 4, 6, 554.23,498.50, 55.73,1603.97, 1105.47,NULL,   CURRENT_DATE-5,  NULL,NULL,11.08, 2.50,'5 dias atrasado.','atrasado'),
    (v_fac,v_e6,v_fc6, 5, 6, 554.23,515.95, 38.28,1105.47,  589.52,NULL,   CURRENT_DATE+25, NULL,NULL, 0.00, 0.00,NULL,'pendente'),
    (v_fac,v_e6,v_fc6, 6, 6, 610.14,589.52, 20.62, 589.52,    0.00,NULL,   CURRENT_DATE+55, NULL,NULL, 0.00, 0.00,NULL,'pendente');

  INSERT INTO contas_pagar (empresa_id, descricao, categoria, valor, valor_pago,
    data_vencimento, data_pagamento, tipo_pagamento, numero_documento, observacoes, status) VALUES
    (v_fac,'Aluguel escritório maio/2026','aluguel', 2200.00,2200.00,CURRENT_DATE-3, CURRENT_DATE-3, 'pix',          'REC-FAC-0526','Sala 308, Ed. Empresarial Rio Verde. Vence dia 12.','pago'),
    (v_fac,'Salário analista maio/2026', 'salario',  3800.00,3800.00,CURRENT_DATE-1, CURRENT_DATE-1, 'transferencia','FLH-FAC-0526','Analista de crédito João Victor.','pago'),
    (v_fac,'Sistema de gestão (licença)','servico',   480.00,NULL,   CURRENT_DATE+5, NULL,NULL,'SYS-2026-05','Renovação anual do sistema de gestão.','pendente'),
    (v_fac,'SIMPLES Nacional abril/2026','imposto',   920.00,NULL,   CURRENT_DATE-5, NULL,NULL,'DAS-04/2026','VENCIDO! Calcular multa de 2% + juros Selic.','atrasado'),
    (v_fac,'Contabilidade mensal',       'servico',   750.00,750.00, CURRENT_DATE-10,CURRENT_DATE-10,'transferencia','CTB-2026-04','Escritório Santos & Associados Contabilidade.','pago'),
    (v_fac,'Internet fibra escritório',  'servico',   189.00,NULL,   CURRENT_DATE+3, NULL,NULL,'CLR-EMP-456','Plano fibra 300MB.','pendente'),
    (v_fac,'Renovação registro JUCESP',  'imposto',   380.00,NULL,   CURRENT_DATE+20,NULL,NULL,'JUC-2026','Renovação anual da empresa.','pendente');

  INSERT INTO movimentacoes_caixa (empresa_id, tipo, categoria, descricao, valor, data_movimentacao, observacoes) VALUES
    (v_fac,'saida',  'Capital',  'Liberação SRS-2026-00001 - Marcos Ferreira',  10000.00,CURRENT_DATE-95,'Transferência conta corrente BB'),
    (v_fac,'entrada','Parcelas', 'Parcela 1/12 SRS-2026-00001 - Marcos',         1047.05,CURRENT_DATE-90,'PIX recebido'),
    (v_fac,'saida',  'Capital',  'Liberação SRS-2026-00003 - Paulo Araújo',      8000.00,CURRENT_DATE-80,'Transferência Sicredi'),
    (v_fac,'entrada','Parcelas', 'Parcela 1/10 SRS-2026-00003 - Paulo',           980.04,CURRENT_DATE-75,'Dinheiro em espécie'),
    (v_fac,'saida',  'Capital',  'Liberação SRS-2026-00002 - Luciana Borges',    5000.00,CURRENT_DATE-65,'Transferência CEF'),
    (v_fac,'entrada','Parcelas', 'Parcela 1/6 SRS-2026-00002 - Luciana',          924.71,CURRENT_DATE-60,'Transferência recebida'),
    (v_fac,'entrada','Parcelas', 'Parcela 2/12 SRS-2026-00001 - Marcos',         1047.05,CURRENT_DATE-60,'PIX recebido'),
    (v_fac,'entrada','Parcelas', 'Parcela 2/10 SRS-2026-00003 - Paulo',           980.04,CURRENT_DATE-45,'Dinheiro em espécie'),
    (v_fac,'saida',  'Capital',  'Liberação SRS-2026-00004 - Tatiana Vieira',    4000.00,CURRENT_DATE-40,'Transferência Nubank'),
    (v_fac,'saida',  'Aluguel',  'Aluguel escritório abril/2026',                2200.00,CURRENT_DATE-35,'PIX efetuado'),
    (v_fac,'entrada','Parcelas', 'Parcela 1/4 SRS-2026-00004 - Tatiana',         1082.14,CURRENT_DATE-35,'PIX recebido no vencimento'),
    (v_fac,'entrada','Parcelas', 'Parcela 3/12 SRS-2026-00001 - Marcos',         1047.05,CURRENT_DATE-30,'Dinheiro em espécie'),
    (v_fac,'entrada','Parcelas', 'Parcela 2/6 SRS-2026-00002 - Luciana',          924.71,CURRENT_DATE-30,'PIX recebido'),
    (v_fac,'saida',  'Serviços', 'Contabilidade Santos & Associados',             750.00,CURRENT_DATE-10,'Transferência'),
    (v_fac,'saida',  'Aluguel',  'Aluguel escritório maio/2026',                 2200.00,CURRENT_DATE-3, 'PIX efetuado'),
    (v_fac,'saida',  'Salários', 'Salário analista maio/2026',                   3800.00,CURRENT_DATE-1, 'Transferência');

  INSERT INTO notificacoes_log (empresa_id, canal, destinatario, assunto, mensagem,
    referencia_tipo, referencia_id, status, enviado_em) VALUES
    (v_fac,'whatsapp','64988110001','Parcela vencendo hoje',
     'Olá Marcos! Sua parcela 4/12 do contrato SRS-2026-00001 no valor de R$ 1.047,05 vence hoje. PIX: 64999990002.',
     'parcela_emprestimo',v_e1,'enviado',NOW()-INTERVAL '2 hours'),
    (v_fac,'whatsapp','64988220002','Parcela vencendo hoje',
     'Olá Luciana! Sua parcela 3/6 do contrato SRS-2026-00002 no valor de R$ 924,71 vence hoje. PIX: 64999990002.',
     'parcela_emprestimo',v_e2,'enviado',NOW()-INTERVAL '2 hours'),
    (v_fac,'whatsapp','64988330003','Parcela em atraso - 15 dias',
     'Olá Paulo! Sua parcela 3/10 de R$ 980,04 está 15 dias em atraso. Multa: R$ 45,50 + juros R$ 38,25. Regularize: 64999990002.',
     'parcela_emprestimo',v_e3,'enviado',NOW()-INTERVAL '1 hour'),
    (v_fac,'whatsapp','64988550005','URGENTE - 4 parcelas em atraso',
     'Olá Elias! Você possui 4 parcelas em atraso no total de R$ 2.216,92. Entre em contato URGENTE: 64999990002.',
     'emprestimo',v_e5,'enviado',NOW()-INTERVAL '30 minutes'),
    (v_fac,'whatsapp','64988660006','Conta bloqueada por inadimplência',
     'Olá Simone! Sua conta está bloqueada por inadimplência. Dívida total: R$ 3.325,38 + encargos. Ligue: 64999990002.',
     'emprestimo',v_e6,'pendente',NULL),
    (v_fac,'whatsapp','64988880008','Bem-vinda de volta - Novo limite disponível',
     'Olá Cristina! Seu limite de crédito de R$ 18.000,00 está disponível. Precisando de crédito, fale conosco!',
     'cliente_factoring',v_fc8,'enviado',NOW()-INTERVAL '3 days');

  RAISE NOTICE 'SUCESSO! Dados de demonstração inseridos.';
  RAISE NOTICE 'Empório ID: % | Factoring ID: %', v_emp, v_fac;
END;
$$;

SELECT fn_marcar_parcelas_atrasadas();
