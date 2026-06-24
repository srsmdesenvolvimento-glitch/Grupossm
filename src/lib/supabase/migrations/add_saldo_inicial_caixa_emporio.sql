-- Migration: adiciona saldo_inicial_caixa em config_emporio
-- Execute no Supabase SQL Editor

ALTER TABLE config_emporio
  ADD COLUMN IF NOT EXISTS saldo_inicial_caixa DECIMAL(12,2) NOT NULL DEFAULT 0.00;
