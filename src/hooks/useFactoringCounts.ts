'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'

interface FactoringCounts {
  inadimplentes: number
  vencendoHoje: number
}

export function useFactoringCounts(enabled: boolean) {
  const [counts, setCounts] = useState<FactoringCounts>({ inadimplentes: 0, vencendoHoje: 0 })
  const { empresaAtual } = useEmpresa()

  useEffect(() => {
    if (!enabled || !empresaAtual?.id) return

    const supabase = createClient()
    const hoje = new Date().toISOString().split('T')[0]

    Promise.all([
      supabase
        .from('parcelas_emprestimo')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaAtual.id)
        .eq('status', 'atrasado'),
      supabase
        .from('parcelas_emprestimo')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaAtual.id)
        .eq('data_vencimento', hoje)
        .in('status', ['pendente', 'atrasado']),
    ]).then(([inadimpl, vencendo]) => {
      setCounts({
        inadimplentes: inadimpl.count ?? 0,
        vencendoHoje: vencendo.count ?? 0,
      })
    })
  }, [enabled, empresaAtual?.id])

  return counts
}
