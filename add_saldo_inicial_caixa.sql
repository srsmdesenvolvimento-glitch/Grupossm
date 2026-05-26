-- Executar no Supabase SQL Editor
ALTER TABLE config_factoring
  ADD COLUMN IF NOT EXISTS saldo_inicial_caixa DECIMAL(12,2) NOT NULL DEFAULT 0.00;
