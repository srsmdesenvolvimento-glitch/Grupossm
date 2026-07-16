'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingPage } from '@/components/shared/LoadingPage'

// As telas em /admin/** (usuários, assinaturas, planos) gerenciam a
// plataforma inteira — todas as empresas, não só a do usuário logado. As
// rotas de API já recusam quem não é super_admin; este bloqueio é a segunda
// camada, pra ninguém sem esse acesso nem ver a tela renderizar.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { perfil, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!perfil?.super_admin) router.replace('/selecionar-empresa')
  }, [loading, perfil, router])

  if (loading) return <LoadingPage fullscreen />
  if (!perfil?.super_admin) return null

  return <>{children}</>
}
