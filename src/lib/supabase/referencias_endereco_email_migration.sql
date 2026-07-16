-- Migration: adiciona endereço e email às referências de cliente (factoring)
-- Necessário para o autopreenchimento vindo dos vínculos da Assertiva
-- (pai, mãe, cônjuge, sócios, etc.), que agora trazem endereço/email/telefone.
-- Run this in the Supabase SQL Editor for your project (relldwstuqmrefeviaua)

ALTER TABLE referencias_cliente_factoring
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS email    VARCHAR(255);
