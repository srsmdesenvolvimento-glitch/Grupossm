-- A página pública de assinatura (/assinar/[id]) e a rota que processa a
-- assinatura (POST /api/emprestimos/[id]/assinar) só conferiam o UUID do
-- empréstimo na URL — sem nenhum segredo. Quem tivesse ou adivinhasse esse
-- UUID conseguia ver o contrato completo (dados do cliente) e, pior, ASSINAR
-- o contrato no lugar do cliente de verdade, enviando selfie/documento falsos
-- antes que o cliente real o fizesse — invalidando a força jurídica da
-- assinatura eletrônica.
--
-- Este token é um segredo por contrato, gerado uma vez e enviado só no link
-- que vai pro cliente (por WhatsApp) — sem ele, a página/rota recusam.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE emprestimos
  ADD COLUMN IF NOT EXISTS assinatura_token TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Garante token único mesmo pros empréstimos criados antes desta coluna existir
UPDATE emprestimos SET assinatura_token = gen_random_uuid()::text WHERE assinatura_token IS NULL;
