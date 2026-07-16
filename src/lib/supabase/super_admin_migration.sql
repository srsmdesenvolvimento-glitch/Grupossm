-- As rotas /api/admin/** (limpar-dados, usuarios, assinaturas, planos, salarios)
-- gerenciam TODAS as empresas da plataforma (é o painel do operador do SaaS,
-- não do dono de uma empresa cliente) — mas até agora elas só conferiam se o
-- usuário era "admin" de QUALQUER empresa (`usuario_empresa.papel = 'admin'`).
-- Isso significa que o admin de uma empresa cliente (ex: dono do Empório)
-- conseguia apagar dados, ver salários e gerenciar assinaturas de QUALQUER
-- OUTRA empresa cadastrada na plataforma — inclusive futuras clientes do SaaS.
--
-- Este campo separa "admin de uma empresa" de "administrador da plataforma".
-- Rodar no SQL Editor do Supabase.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT false;

-- Os únicos 4 usuários existentes hoje são todos da equipe Grupo SRSM,
-- administradores de ambas as empresas atuais (Empório + Factoring) —
-- marcados como super_admin pra não perder acesso ao painel administrativo.
-- Ajuste a lista de e-mails se algum desses não deveria ter esse nível de acesso.
-- Comparação por lower(email): a coluna não é case-insensitive (não é citext),
-- e um dos e-mails reais está gravado como "Guilherme@..." (G maiúsculo) —
-- IN (...) sem lower() teria deixado esse usuário de fora silenciosamente.
UPDATE usuarios
SET super_admin = true
WHERE lower(email) IN (
  'admin@gruposrsm.com',
  'admin@grupossrsm.com',
  'guilherme@gruposrsm.com',
  'gustavo@srsm.com'
);
