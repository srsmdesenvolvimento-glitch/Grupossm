// Rascunho de formulário — sobrevive a QUALQUER troca de aba/tela e volta,
// inclusive quando o navegador recarrega a página sozinho (comum quando uma
// aba em segundo plano fica muito tempo sem foco e o Chrome a descarta pra
// liberar memória). Só é perdido de propósito: ao concluir o cadastro/venda
// com sucesso (via limparRascunho) ou ao fechar a aba/navegador de vez.
//
// Guardamos em dois lugares:
//  1. Um Map em memória — cobre navegação dentro do app sem perder nada,
//     incluindo valores que não são serializáveis em JSON (File, Map),
//     usados nos anexos de documento do cadastro.
//  2. sessionStorage — sobrevive mesmo se o processo JS reiniciar (reload
//     real). Só consegue guardar o que é serializável em JSON, então File e
//     Map são descartados nessa cópia — se a aba realmente recarregar, os
//     campos de texto/número voltam do jeito que estavam, mas um arquivo já
//     selecionado pra upload precisa ser reanexado (limitação do navegador,
//     não dá pra reidratar um File depois que a página recarrega de verdade).

const rascunhosMemoria = new Map<string, unknown>()

function chaveStorage(chave: string): string {
  return `rascunho:${chave}`
}

// Chaves centralizadas aqui (em vez de cada tela declarar a sua) por dois
// motivos: evita string duplicada/errada por engano, e permite
// `limparTodosRascunhos` saber a lista completa sem precisar importar cada
// página — sessionStorage sobrevive a logout, então sem isso um rascunho de
// cadastro de um usuário poderia reaparecer pra outro usuário que loga na
// mesma aba/computador depois (ver EmpresaContext, chamado no SIGNED_OUT).
export const RASCUNHO_CADASTRO_CLIENTE = 'cadastro-cliente-factoring'
export const RASCUNHO_NOVO_EMPRESTIMO = 'novo-emprestimo-factoring'
export const RASCUNHO_NOVA_VENDA = 'nova-venda-emporio'

const TODAS_AS_CHAVES_DE_RASCUNHO = [
  RASCUNHO_CADASTRO_CLIENTE,
  RASCUNHO_NOVO_EMPRESTIMO,
  RASCUNHO_NOVA_VENDA,
] as const

// Chamar no logout — sessionStorage não é limpo automaticamente ao trocar de
// usuário na mesma aba, só quando a aba é fechada de fato.
export function limparTodosRascunhos(): void {
  for (const chave of TODAS_AS_CHAVES_DE_RASCUNHO) limparRascunho(chave)
}

function ignorarNaoSerializavel(_key: string, value: unknown) {
  if (value instanceof Map) return undefined
  if (typeof File !== 'undefined' && value instanceof File) return undefined
  return value
}

export function salvarRascunho<T>(chave: string, dados: T): void {
  rascunhosMemoria.set(chave, dados)
  try {
    sessionStorage.setItem(chaveStorage(chave), JSON.stringify(dados, ignorarNaoSerializavel))
  } catch {
    // sessionStorage indisponível (modo privado, cota excedida, SSR) —
    // segue funcionando só com a cópia em memória (não sobrevive a reload).
  }
}

export function lerRascunho<T>(chave: string): T | undefined {
  if (rascunhosMemoria.has(chave)) return rascunhosMemoria.get(chave) as T
  try {
    const raw = sessionStorage.getItem(chaveStorage(chave))
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function limparRascunho(chave: string): void {
  rascunhosMemoria.delete(chave)
  try {
    sessionStorage.removeItem(chaveStorage(chave))
  } catch {
    // ignora
  }
}
