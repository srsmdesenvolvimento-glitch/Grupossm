-- Bug crítico descoberto ao testar storage_documentos_rls_migration.sql ao vivo
-- com um usuário real: upload (INSERT) funcionava, mas o próprio usuário não
-- conseguia mais ver o arquivo que acabou de subir (`GET /object/info` e
-- `/object/list` voltavam vazio/"not found" mesmo sendo dono legítimo).
-- Isso quebrava silenciosamente o DELETE também: a Storage API primeiro
-- verifica a existência do objeto respeitando RLS de SELECT antes de
-- remover; sem policy de SELECT, o delete falha com "Access denied" mesmo
-- quando a policy de DELETE em si está correta.
--
-- A suposição original (comentário em storage_documentos_rls_migration.sql)
-- de que leitura só passa pela rota assinada /api/documentos/assinar (via
-- service role, que ignora RLS) estava certa para o CASO DE USO de exibir
-- o documento — mas não cobre as chamadas internas da própria Storage API
-- (info/list/delete), que respeitam RLS de SELECT independentemente disso.
--
-- Rodar no SQL Editor do Supabase.

DROP POLICY IF EXISTS "documentos_clientes_select" ON storage.objects;
CREATE POLICY "documentos_clientes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-clientes'
    AND has_empresa_access((storage.foldername(name))[1]::uuid)
  );
