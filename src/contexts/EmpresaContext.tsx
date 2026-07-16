'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EmpresaInfo } from '@/lib/types/shared'
import type { PapelUsuario } from '@/lib/types/database'

type EmpresaContextType = {
  empresas: EmpresaInfo[]
  empresaAtual: EmpresaInfo | null
  role: PapelUsuario | null
  loading: boolean
  selecionarEmpresa: (id: string) => void
  trocarEmpresa: (id: string) => void
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaInfo[]>([])
  const [empresaAtual, setEmpresaAtual] = useState<EmpresaInfo | null>(null)
  const [role, setRole] = useState<PapelUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [rolesMap, setRolesMap] = useState<Record<string, PapelUsuario>>({})

  // Guarda o id do usuário já carregado — o Supabase reemite SIGNED_IN toda
  // vez que a aba volta a ficar visível (ele revalida o token em segundo
  // plano), mesmo sem ter havido logout/login de verdade. Sem essa checagem,
  // cada troca de aba disparava `loading = true` de novo, e o layout do
  // dashboard troca a tela inteira por um spinner enquanto isso — ou seja,
  // toda tela (cadastro, formulário de empréstimo etc.) era desmontada e
  // remontada do zero só por causa de o usuário ter saído e voltado pra aba.
  const usuarioCarregadoRef = useRef<string | null>(null)

  const carregarEmpresas = useCallback(async (userId: string) => {
    const supabase = createClient()

    const { data: ues } = await supabase
      .from('usuario_empresa')
      .select('papel, empresa_id, empresas(id, nome, tipo, logo_url, ativo, cnpj, telefone, email, endereco, cidade, estado, cep)')
      .eq('usuario_id', userId)
      .eq('ativo', true)

    let lista: EmpresaInfo[] = []
    const rMap: Record<string, PapelUsuario> = {}

    if (ues && ues.length > 0) {
      for (const ue of ues) {
        const e = ue.empresas as unknown as EmpresaInfo
        if (e && e.ativo) {
          lista.push(e)
          rMap[e.id] = ue.papel as PapelUsuario
        }
      }
    }

    setEmpresas(lista)
    setRolesMap(rMap)

    // Restore saved empresa
    const savedId = typeof window !== 'undefined'
      ? localStorage.getItem('srsm:empresa_id')
      : null
    const restored = savedId ? lista.find(e => e.id === savedId) : null

    if (restored) {
      setEmpresaAtual(restored)
      setRole(rMap[restored.id] ?? 'operador')
    } else if (lista.length === 1) {
      setEmpresaAtual(lista[0])
      setRole(rMap[lista[0].id] ?? 'operador')
      localStorage.setItem('srsm:empresa_id', lista[0].id)
    }

    usuarioCarregadoRef.current = userId
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        carregarEmpresas(user.id)
      } else {
        setLoading(false)
      }
    })

    // React to sign-in / sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Já carregamos esse mesmo usuário — isso é só o Supabase revalidando
        // o token ao focar a aba de novo, não um login de verdade. Ignorar
        // evita recarregar tudo e remontar a tela atual sem necessidade.
        if (usuarioCarregadoRef.current === session.user.id) return
        setLoading(true)
        carregarEmpresas(session.user.id)
      }
      if (event === 'SIGNED_OUT') {
        usuarioCarregadoRef.current = null
        setEmpresas([])
        setEmpresaAtual(null)
        setRole(null)
        setRolesMap({})
        setLoading(false)
        if (typeof window !== 'undefined') localStorage.removeItem('srsm:empresa_id')
      }
    })

    return () => subscription.unsubscribe()
  }, [carregarEmpresas])

  const selecionarEmpresa = useCallback((id: string) => {
    const e = empresas.find(x => x.id === id)
    if (!e) return
    setEmpresaAtual(e)
    setRole(rolesMap[id] ?? 'operador')
    if (typeof window !== 'undefined') localStorage.setItem('srsm:empresa_id', id)
  }, [empresas, rolesMap])

  const trocarEmpresa = selecionarEmpresa

  return (
    <EmpresaContext.Provider value={{ empresas, empresaAtual, role, loading, selecionarEmpresa, trocarEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider')
  return ctx
}
