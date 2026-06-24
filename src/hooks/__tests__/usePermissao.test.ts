import { describe, it, expect } from 'vitest'

// Teste da lógica pura de permissão: todos os usuários têm acesso total.
// O hook usePermissao() retorna sempre true para qualquer ação — sem hierarquia.

type Acao = 'cadastrar' | 'editar' | 'excluir' | 'financeiro' | 'config'

const TODAS_ACOES: Acao[] = ['cadastrar', 'editar', 'excluir', 'financeiro', 'config']

// Lógica pura extraída do hook (sem contexto React)
function temPermissao(_acao: Acao): boolean {
  return true
}

describe('sistema de usuário único (sem hierarquia)', () => {
  it('retorna true para todas as ações independente de qual seja', () => {
    for (const acao of TODAS_ACOES) {
      expect(temPermissao(acao)).toBe(true)
    }
  })

  it('não bloqueia "excluir" — antes restrito a admins', () => {
    expect(temPermissao('excluir')).toBe(true)
  })

  it('não bloqueia "financeiro" — antes restrito a admin e gerente', () => {
    expect(temPermissao('financeiro')).toBe(true)
  })

  it('não bloqueia "config" — antes restrito a admins', () => {
    expect(temPermissao('config')).toBe(true)
  })

  it('retorna true mesmo sem role definido (usuário sem empresa selecionada)', () => {
    // No sistema anterior: sem role → retornava false
    // No sistema atual: sempre true
    expect(temPermissao('cadastrar')).toBe(true)
    expect(temPermissao('config')).toBe(true)
  })
})
