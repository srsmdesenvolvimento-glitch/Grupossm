'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'
import type { PapelUsuario } from '@/lib/types/database'

export type Acao = 'cadastrar' | 'editar' | 'excluir' | 'financeiro' | 'config'

export function verificarPermissao(role: PapelUsuario | null | undefined, acao: Acao): boolean {
  if (!role) return false

  switch (role) {
    case 'admin':
      return true
    case 'gerente':
      return acao === 'cadastrar' || acao === 'editar' || acao === 'financeiro'
    case 'operador':
      return acao === 'cadastrar' || acao === 'editar'
    case 'visualizador':
      return false
    default:
      return false
  }
}

export function usePermissao() {
  const { role } = useEmpresa()

  function temPermissao(acao: Acao): boolean {
    return verificarPermissao(role, acao)
  }

  return { temPermissao, role }
}
