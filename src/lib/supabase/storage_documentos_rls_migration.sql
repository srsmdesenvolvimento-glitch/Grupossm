-- Bug crítico pré-existente descoberto ao testar o novo recurso de anexos
-- como um usuário real (não service role): o bucket `documentos-clientes`
-- foi marcado como privado (storage_documentos_privado_migration.sql), mas
-- NUNCA existiu uma policy de RLS em storage.objects liberando upload/
-- remoção pra usuários autenticados. Resultado: TODO upload de documento
-- feito direto do navegador (RG, CNH, comprovante de renda/residência, foto,
-- e agora os anexos de conversa) falhava com "new row violates row-level
-- security policy" pra qualquer usuário real — só funcionava via service
-- role (por isso passou despercebido nos testes anteriores desta sessão,
-- que usavam a service key). Leitura já era seguraem: passa pela rota
-- /api/documentos/assinar, que confere acesso via tabela antes de assinar
-- a URL — não depende de RLS no Storage, então não precisa de policy de
-- SELECT aqui.
--
-- O primeiro segmento do path sempre é o empresa_id (ex:
-- "{empresa_id}/{cliente_id}/categoria-timestamp.ext"), daí o uso de
-- storage.foldername(name) para checar o acesso.

DROP POLICY IF EXISTS "documentos_clientes_insert" ON storage.objects;
CREATE POLICY "documentos_clientes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-clientes'
    AND has_empresa_access((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "documentos_clientes_delete" ON storage.objects;
CREATE POLICY "documentos_clientes_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-clientes'
    AND has_empresa_access((storage.foldername(name))[1]::uuid)
  );
