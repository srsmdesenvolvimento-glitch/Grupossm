-- Rastreio de origem dos dados (Assertiva x manual) no cadastro de clientes.
-- campos_origem_manual: nomes dos campos de clientes_factoring cujo valor
-- atual foi digitado/corrigido manualmente (difere do que a Assertiva
-- retornou, ou foi preenchido em campo que a Assertiva deixou vazio).
-- Se o array está vazio, o campo correspondente (quando havia dado da
-- Assertiva) continua exatamente como veio da API.
ALTER TABLE clientes_factoring
  ADD COLUMN IF NOT EXISTS campos_origem_manual TEXT[] NOT NULL DEFAULT '{}';

-- origem de cada referência/contato: 'assertiva' quando foi preenchida
-- automaticamente a partir da rede de vínculos (e nunca editada depois),
-- 'manual' quando foi criada pelo usuário ou quando uma referência vinda da
-- Assertiva foi editada (a edição vira uma correção manual).
ALTER TABLE referencias_cliente_factoring
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('assertiva', 'manual'));
