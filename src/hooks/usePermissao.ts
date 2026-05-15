'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'

type Acao = 'cadastrar' | 'editar' | 'excluir' | 'financeiro' | 'config'

const PERMISSOES: Record<string, Acao[]> = {
  admin:        ['cadastrar', 'editar', 'excluir', 'financeiro', 'config'],
  gerente:      ['cadastrar', 'editar', 'financeiro'],
  operador:     ['cadastrar', 'editar'],
  visualizador: [],
}

export function usePermissao() {
  const { role } = useEmpresa()

  function temPermissao(acao: Acao): boolean {
    if (!role) return false
    return PERMISSOES[role]?.includes(acao) ?? false
  }

  return { temPermissao, role }
}
