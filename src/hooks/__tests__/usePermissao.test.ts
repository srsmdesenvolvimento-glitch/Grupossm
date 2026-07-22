import { describe, it, expect } from 'vitest'
import { verificarPermissao, type Acao } from '../usePermissao'

describe('Matriz de Permissões RBAC (usePermissao)', () => {
  it('Admin possui acesso total a todas as ações', () => {
    const acoes: Acao[] = ['cadastrar', 'editar', 'excluir', 'financeiro', 'config']
    for (const a of acoes) {
      expect(verificarPermissao('admin', a)).toBe(true)
    }
  })

  it('Gerente pode cadastrar, editar e ver financeiro, mas não pode excluir ou configurar', () => {
    expect(verificarPermissao('gerente', 'cadastrar')).toBe(true)
    expect(verificarPermissao('gerente', 'editar')).toBe(true)
    expect(verificarPermissao('gerente', 'financeiro')).toBe(true)
    expect(verificarPermissao('gerente', 'excluir')).toBe(false)
    expect(verificarPermissao('gerente', 'config')).toBe(false)
  })

  it('Operador pode cadastrar e editar, mas não tem acesso a financeiro, excluir ou config', () => {
    expect(verificarPermissao('operador', 'cadastrar')).toBe(true)
    expect(verificarPermissao('operador', 'editar')).toBe(true)
    expect(verificarPermissao('operador', 'financeiro')).toBe(false)
    expect(verificarPermissao('operador', 'excluir')).toBe(false)
    expect(verificarPermissao('operador', 'config')).toBe(false)
  })

  it('Visualizador tem perfil somente-leitura (retorna false para todas as mutações)', () => {
    const acoes: Acao[] = ['cadastrar', 'editar', 'excluir', 'financeiro', 'config']
    for (const a of acoes) {
      expect(verificarPermissao('visualizador', a)).toBe(false)
    }
  })

  it('Retorna false se a role for nula ou indefinida', () => {
    expect(verificarPermissao(null, 'cadastrar')).toBe(false)
    expect(verificarPermissao(undefined, 'config')).toBe(false)
  })
})
