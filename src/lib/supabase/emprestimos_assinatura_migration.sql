-- A rota /api/emprestimos/[id]/assinar sempre assumiu que `emprestimos` tinha
-- as colunas assinado_em/assinado_ip, mas elas nunca foram criadas de verdade
-- no banco — por isso a assinatura eletrônica sempre falhava no último passo
-- (depois de já ter subido selfie, documento e gerado o PDF): a atualização
-- final do empréstimo dava erro "column emprestimos.assinado_em does not
-- exist" e a API retornava erro pro cliente, sem nunca marcar o contrato
-- como assinado.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE emprestimos
  ADD COLUMN IF NOT EXISTS assinado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinado_ip TEXT;
