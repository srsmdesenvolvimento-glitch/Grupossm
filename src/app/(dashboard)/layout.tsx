'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { LoadingPage } from '@/components/shared/LoadingPage'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const { empresaAtual, loading: empLoading } = useEmpresa()

  const isSelecionarEmpresa = pathname === '/selecionar-empresa'

  useEffect(() => {
    if (authLoading || empLoading) return
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }
    if (!empresaAtual && !isSelecionarEmpresa) {
      router.replace('/selecionar-empresa')
    }
  }, [authLoading, empLoading, user, empresaAtual, isSelecionarEmpresa, pathname, router])

  if (authLoading || empLoading) return <LoadingPage fullscreen />

  if (!user) return null
  if (!empresaAtual && !isSelecionarEmpresa) return null

  return <>{children}</>
}
