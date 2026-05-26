type SupabaseError = { code?: string; message?: string; details?: string }

const PG_MESSAGES: Record<string, string> = {
  '23505': 'Registro duplicado — verifique se CPF/CNPJ já está cadastrado',
  '23503': 'Referência inválida — dado vinculado não encontrado',
  '23502': 'Campo obrigatório não informado',
  '42703': 'Campo inválido — contate o suporte',
  '42P01': 'Tabela não encontrada — contate o suporte',
  '22P02': 'Valor inválido para o tipo do campo',
  'PGRST116': 'Nenhum registro encontrado',
}

export function parseSupabaseError(err: unknown, fallback = 'Erro inesperado — tente novamente'): string {
  if (!err) return fallback
  const e = err as SupabaseError
  if (e.code && PG_MESSAGES[e.code]) return PG_MESSAGES[e.code]
  if (e.message) {
    if (e.message.includes('duplicate key') || e.message.includes('unique')) {
      return 'Registro duplicado — CPF ou dado único já existe'
    }
    if (e.message.includes('violates not-null')) return 'Campo obrigatório não informado'
    if (e.message.includes('JWT')) return 'Sessão expirada — faça login novamente'
  }
  return fallback
}

export function logError(context: string, err: unknown) {
  console.error(`[${context}]`, err)
}
