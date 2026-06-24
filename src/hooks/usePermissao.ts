'use client'

import { useEmpresa } from '@/contexts/EmpresaContext'

type Acao = 'cadastrar' | 'editar' | 'excluir' | 'financeiro' | 'config'

export function usePermissao() {
  const { role } = useEmpresa()

  // Usuário único com acesso total — sem hierarquia de permissões
  function temPermissao(_acao: Acao): boolean {
    return true
  }

  return { temPermissao, role }
}
