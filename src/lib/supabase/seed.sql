-- ═══════════════════════════════════════════════════════════════
-- GRUPO SRSM — DADOS INICIAIS (SEED)
-- Executar no Supabase SQL Editor APÓS schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ── Empresas ─────────────────────────────────────────────────
INSERT INTO empresas (id, nome, tipo, cnpj, telefone, email, cidade, estado, ativo)
VALUES
  (
    'a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1',
    'Empório dos Móveis',
    'emporio',
    '00.000.000/0001-00',
    '(00) 00000-0000',
    'emporio@gruporsm.com.br',
    'São Paulo',
    'SP',
    TRUE
  ),
  (
    'b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2',
    'SRS M Factoring',
    'factoring',
    '00.000.000/0002-00',
    '(00) 00000-0001',
    'factoring@gruporsm.com.br',
    'São Paulo',
    'SP',
    TRUE
  );

-- ── Categorias de Produto (Empório) ──────────────────────────
INSERT INTO categorias_produto (empresa_id, nome, slug, icone, ordem, ativo)
VALUES
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Sala de Estar',    'sala-de-estar',  '🛋️', 1, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Quarto',           'quarto',          '🛏️', 2, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Cozinha e Jantar', 'cozinha-jantar',  '🍽️', 3, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Escritório',       'escritorio',      '💼', 4, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Área Externa',     'area-externa',    '🌿', 5, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Infantil',         'infantil',        '🧸', 6, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Decoração',        'decoracao',       '🎨', 7, TRUE),
  ('a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1', 'Estofados',        'estofados',       '🪑', 8, TRUE);

-- ── Configuração do Catálogo Público (Empório) ───────────────
INSERT INTO config_catalogo (
  empresa_id,
  slug,
  titulo,
  descricao,
  whatsapp,
  mostrar_preco,
  mostrar_estoque,
  ativo
) VALUES (
  'a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1',
  'emporio-dos-moveis',
  'Empório dos Móveis — Catálogo',
  'Móveis de qualidade para transformar sua casa. Confira nossos produtos e solicite um orçamento!',
  '5500000000000',
  TRUE,
  FALSE,
  TRUE
);

-- ── Configuração do Empório (mensagens WhatsApp) ─────────────
INSERT INTO config_emporio (
  empresa_id,
  whatsapp_padrao,
  prefixo_numero_venda,
  dias_vencimento_padrao,
  msg_orcamento,
  msg_aprovacao,
  msg_entrega,
  msg_cobranca,
  msg_aniversario
) VALUES (
  'a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1',
  '5500000000000',
  'EMP',
  30,

-- msg_orcamento
E'Olá, *{{nome}}*! 👋\n\n'
'Segue o orçamento Nº *{{numero_venda}}* do *Empório dos Móveis*:\n\n'
'{{itens}}\n\n'
'*Total: {{total}}*\n'
'{{#parcelas}}Parcelamento: {{parcelas}}x de {{valor_parcela}}{{/parcelas}}\n\n'
'Válido por 7 dias. Qualquer dúvida, estamos à disposição! 😊',

-- msg_aprovacao
E'Olá, *{{nome}}*! 🎉\n\n'
'Seu pedido Nº *{{numero_venda}}* foi *confirmado* com sucesso!\n\n'
'*Valor total:* {{total}}\n'
'*Forma de pagamento:* {{tipo_pagamento}}\n'
'{{#data_entrega}}*Previsão de entrega:* {{data_entrega}}{{/data_entrega}}\n\n'
'Obrigado por escolher o *Empório dos Móveis*! 🛋️',

-- msg_entrega
E'Olá, *{{nome}}*! 🚚\n\n'
'Sua entrega do pedido Nº *{{numero_venda}}* está a caminho!\n\n'
'Nosso time entrará em contato para confirmar o horário.\n\n'
'Obrigado pela confiança! ❤️',

-- msg_cobranca
E'Olá, *{{nome}}*!\n\n'
'Identificamos uma parcela em aberto referente ao pedido Nº *{{numero_venda}}*:\n\n'
'*Valor:* {{valor}}\n'
'*Vencimento:* {{vencimento}}\n'
'{{#dias_atraso}}*Atraso:* {{dias_atraso}} dias{{/dias_atraso}}\n\n'
'Por favor, regularize para evitar juros. Conte conosco! 😊',

-- msg_aniversario
E'Olá, *{{nome}}*! 🎂\n\n'
'O *Empório dos Móveis* deseja a você um feliz aniversário! 🎉\n\n'
'Para celebrar, temos condições especiais para você hoje. Venha nos visitar ou entre em contato!\n\n'
'Feliz aniversário! 🥳'

);

-- ── Configuração do Factoring (mensagens WhatsApp) ───────────
INSERT INTO config_factoring (
  empresa_id,
  whatsapp_padrao,
  prefixo_contrato,
  taxa_juros_padrao,
  tipo_taxa_padrao,
  prazo_minimo_meses,
  prazo_maximo_meses,
  valor_minimo_emprestimo,
  valor_maximo_emprestimo,
  dias_carencia,
  multa_atraso,
  juros_mora_diario,
  msg_aprovacao,
  msg_liberacao,
  msg_vencimento,
  msg_cobranca,
  msg_quitacao,
  msg_boas_vindas
) VALUES (
  'b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2',
  '5500000000001',
  'FAC',
  5.00,
  'mensal',
  1,
  60,
  500.00,
  50000.00,
  0,
  2.00,
  0.033300,

-- msg_aprovacao
E'Olá, *{{nome}}*! ✅\n\n'
'Temos uma ótima notícia! Seu crédito foi *APROVADO*! 🎉\n\n'
'*Contrato:* {{numero_contrato}}\n'
'*Valor aprovado:* {{valor_principal}}\n'
'*Taxa:* {{taxa_juros}}% ao mês\n'
'*Prazo:* {{prazo_meses}} meses\n'
'*Parcela:* {{valor_parcela}}\n\n'
'Em breve entraremos em contato para os próximos passos. Qualquer dúvida, estamos à disposição! 😊',

-- msg_liberacao
E'Olá, *{{nome}}*! 💰\n\n'
'O valor do seu empréstimo foi *LIBERADO* com sucesso!\n\n'
'*Contrato:* {{numero_contrato}}\n'
'*Valor liberado:* {{valor_principal}}\n'
'*1ª parcela:* {{valor_parcela}} em {{data_primeiro_vencimento}}\n\n'
'Obrigado por confiar na *SRS M Factoring*! 🤝',

-- msg_vencimento
E'Olá, *{{nome}}*! 📅\n\n'
'Lembramos que sua parcela vence em *{{dias_para_vencer}} dia(s)*:\n\n'
'*Contrato:* {{numero_contrato}}\n'
'*Parcela:* {{numero_parcela}}/{{total_parcelas}}\n'
'*Valor:* {{valor_parcela}}\n'
'*Vencimento:* {{data_vencimento}}\n\n'
'Pagamentos via PIX ou depósito bancário. Em caso de dúvidas, fale conosco! 😊',

-- msg_cobranca
E'Olá, *{{nome}}*! ⚠️\n\n'
'Identificamos a parcela {{numero_parcela}}/{{total_parcelas}} em atraso:\n\n'
'*Contrato:* {{numero_contrato}}\n'
'*Valor original:* {{valor_parcela}}\n'
'*Atraso:* {{dias_atraso}} dias\n'
'*Multa + juros:* {{valor_adicional}}\n'
'*Total a pagar:* {{valor_total}}\n\n'
'Regularize o quanto antes para evitar encargos adicionais. Entre em contato para negociar! 🤝',

-- msg_quitacao
E'Olá, *{{nome}}*! 🎉\n\n'
'Parabéns! Seu contrato *{{numero_contrato}}* foi *QUITADO* com sucesso!\n\n'
'*Data de quitação:* {{data_quitacao}}\n'
'*Total pago:* {{total_pago}}\n\n'
'Obrigado pela parceria e confiança! Foi um prazer fazer negócios com você.\n\n'
'Quando precisar, estamos aqui! 😊 *SRS M Factoring*',

-- msg_boas_vindas
E'Olá, *{{nome}}*! 👋\n\n'
'Seja bem-vindo(a) à *SRS M Factoring*!\n\n'
'Seu cadastro foi realizado com sucesso. Agora você pode solicitar crédito de forma rápida e transparente.\n\n'
'*Limite de crédito pré-aprovado:* {{limite_credito}}\n\n'
'Entre em contato para simular seu empréstimo! 💰'

);
