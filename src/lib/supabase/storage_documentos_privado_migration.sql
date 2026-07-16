-- Torna o bucket de documentos de cliente (RG, CNH, comprovante de renda/
-- residência) privado, com limite de tamanho e tipos permitidos aplicados
-- pelo próprio Storage (não só no front). Depois desta migration, os
-- documentos só são acessíveis via URL assinada de curta duração, obtida
-- pela rota /api/documentos/assinar (que confere acesso à empresa antes de
-- assinar) — nunca mais por URL pública permanente.
--
-- Rodar no SQL Editor do Supabase.

UPDATE storage.buckets
SET
  public             = false,
  file_size_limit    = 10485760, -- 10 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'documentos-clientes';
