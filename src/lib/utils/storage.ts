import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'documentos-clientes'

export type DocumentoMeta = {
  id: string
  categoria: string
  label: string
  nome_original: string
  path: string
  url: string
  tipo_mime: string
  tamanho: number
  criado_em: string
}

export const CATEGORIAS_DOCUMENTO = [
  { id: 'foto',                    label: 'Foto do cliente',            accept: 'image/*' },
  { id: 'rg_cnh',                  label: 'RG / CNH',                   accept: 'image/*,application/pdf' },
  { id: 'cpf',                     label: 'CPF',                        accept: 'image/*,application/pdf' },
  { id: 'comprovante_residencia',  label: 'Comprovante de residência',  accept: 'image/*,application/pdf' },
  { id: 'comprovante_renda',       label: 'Comprovante de renda',       accept: 'image/*,application/pdf' },
  { id: 'outro',                   label: 'Outro documento',            accept: 'image/*,application/pdf,.doc,.docx' },
] as const

export type CategoriaId = typeof CATEGORIAS_DOCUMENTO[number]['id']

export async function uploadDocumentoCliente(
  supabase: SupabaseClient,
  empresaId: string,
  clienteId: string,
  categoria: string,
  file: File,
): Promise<DocumentoMeta> {
  const label = CATEGORIAS_DOCUMENTO.find(c => c.id === categoria)?.label ?? categoria
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${empresaId}/${clienteId}/${categoria}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return {
    id: crypto.randomUUID(),
    categoria,
    label,
    nome_original: file.name,
    path,
    url: urlData.publicUrl,
    tipo_mime: file.type,
    tamanho: file.size,
    criado_em: new Date().toISOString(),
  }
}

export async function deletarDocumentoCliente(
  supabase: SupabaseClient,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function ehImagem(tipoMime: string): boolean {
  return tipoMime.startsWith('image/')
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
