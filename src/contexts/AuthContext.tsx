'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type PerfilUsuario = {
  id: string
  nome: string
  email: string
  telefone: string | null
  avatar_url: string | null
  super_admin: boolean
}

type AuthContextType = {
  user: User | null
  perfil: PerfilUsuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  atualizarPerfil: (dados: Partial<Pick<PerfilUsuario, 'nome' | 'telefone' | 'avatar_url'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const usuarioCarregadoRef = useRef<string | null>(null)

  async function fetchPerfil(userId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, avatar_url, super_admin')
      .eq('id', userId)
      .single()
    setPerfil(data ?? null)
  }

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        usuarioCarregadoRef.current = data.user.id
        fetchPerfil(data.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // O Supabase reemite eventos (SIGNED_IN etc.) ao revalidar o token
      // quando a aba volta a ficar visível, mesmo sem logout/login de
      // verdade — ignorar evita refetch e re-render desnecessários toda
      // vez que o usuário troca de aba e volta.
      if (event === 'SIGNED_OUT') {
        usuarioCarregadoRef.current = null
        setUser(null)
        setPerfil(null)
        return
      }
      if (session?.user && usuarioCarregadoRef.current === session.user.id) return
      setUser(session?.user ?? null)
      if (session?.user) {
        usuarioCarregadoRef.current = session.user.id
        fetchPerfil(session.user.id)
      } else {
        setPerfil(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email: string, senha: string): Promise<{ error?: string }> {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) return { error: error.message }
    return {}
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    setUser(null)
    setPerfil(null)
  }

  async function atualizarPerfil(dados: Partial<Pick<PerfilUsuario, 'nome' | 'telefone' | 'avatar_url'>>) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('usuarios').update(dados).eq('id', user.id)
    setPerfil(prev => prev ? { ...prev, ...dados } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, perfil, loading, login, signOut, atualizarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
