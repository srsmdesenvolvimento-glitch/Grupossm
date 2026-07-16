import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'documentos-clientes'

// Espelha o file_size_limit / allowed_mime_types configurados no bucket via
// storage_documentos_migration.sql — mantido em código pra dar feedback
// imediato no cliente, mas quem realmente barra é o Storage (bucket privado).
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ASSINATURAS: Record<string, number[][]> = {
  'image/jpeg':       [[0xFF, 0xD8, 0xFF]],
  'image/png':        [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp':       [[0x52, 0x49, 0x46, 0x46]], // 'RIFF' — WEBP confirmado nos bytes 8-11 ('WEBP'), checado à parte
  'application/pdf':  [[0x25, 0x50, 0x44, 0x46]], // '%PDF'
}

export type DocumentoMeta = {
  id: string
  categoria: string
  label: string
  nome_original: string
  path: string
  tipo_mime: string
  tamanho: number
  criado_em: string
  comentario?: string | null
}

export const CATEGORIAS_DOCUMENTO = [
  { id: 'foto',                    label: 'Foto do cliente',            accept: 'image/*' },
  { id: 'rg_cnh',                  label: 'RG / CNH',                   accept: 'image/*,application/pdf' },
  { id: 'cpf',                     label: 'CPF',                        accept: 'image/*,application/pdf' },
  { id: 'comprovante_residencia',  label: 'Comprovante de residência',  accept: 'image/*,application/pdf' },
  { id: 'comprovante_renda',       label: 'Comprovante de renda',       accept: 'image/*,application/pdf' },
  { id: 'outro',                   label: 'Outro documento',            accept: 'image/*,application/pdf' },
] as const

// Categoria à parte da grade fixa de documentos formais — usada pra prints
// de conversa (WhatsApp etc.), suporta múltiplos itens com comentário.
export const CATEGORIA_ANEXO_CONVERSA = 'anexo_conversa' as const

export type CategoriaId = typeof CATEGORIAS_DOCUMENTO[number]['id']

// Confere a assinatura real do arquivo (magic bytes) — o `accept` do <input>
// e o `file.type` do navegador são só metadados que o usuário pode forjar.
// Não substitui a validação do Storage (bucket com allowed_mime_types), mas
// dá um erro amigável antes de gastar a chamada de upload.
async function assinaturaValida(file: File): Promise<boolean> {
  const cabecalho = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'image/webp') {
    const riff = ASSINATURAS['image/webp'][0].every((b, i) => cabecalho[i] === b)
    const webp = [0x57, 0x45, 0x42, 0x50].every((b, i) => cabecalho[8 + i] === b)
    return riff && webp
  }
  const assinaturas = ASSINATURAS[file.type]
  if (!assinaturas) return false
  return assinaturas.some(sig => sig.every((b, i) => cabecalho[i] === b))
}

export async function validarArquivo(file: File): Promise<void> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo muito grande (${formatarTamanho(file.size)}) — limite de ${formatarTamanho(MAX_FILE_SIZE_BYTES)}`)
  }
  if (!ASSINATURAS[file.type]) {
    throw new Error('Tipo de arquivo não permitido — envie imagem (JPG, PNG, WEBP) ou PDF')
  }
  if (!(await assinaturaValida(file))) {
    throw new Error('O conteúdo do arquivo não corresponde ao tipo declarado — envie um arquivo válido')
  }
}

export async function uploadDocumentoCliente(
  supabase: SupabaseClient,
  empresaId: string,
  clienteId: string,
  categoria: string,
  file: File,
  comentario?: string,
): Promise<DocumentoMeta> {
  await validarArquivo(file)

  const label = CATEGORIAS_DOCUMENTO.find(c => c.id === categoria)?.label ?? categoria
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${empresaId}/${clienteId}/${categoria}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  return {
    id: crypto.randomUUID(),
    categoria,
    label,
    nome_original: file.name,
    path,
    tipo_mime: file.type,
    tamanho: file.size,
    criado_em: new Date().toISOString(),
    comentario: comentario || null,
  }
}

export async function deletarDocumentoCliente(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// Bucket é privado — não existe mais URL pública permanente. Pede uma URL
// assinada de curta duração à rota server-side (que confere se o usuário
// tem acesso à empresa dona do documento antes de assinar).
export async function obterUrlAssinada(path: string): Promise<string> {
  const res = await fetch(`/api/documentos/assinar?path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.erro ?? 'Falha ao gerar link do documento')
  return json.url as string
}

export function ehImagem(tipoMime: string): boolean {
  return tipoMime.startsWith('image/')
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
