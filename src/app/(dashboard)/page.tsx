'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { LoadingPage } from '@/components/shared/LoadingPage'

export default function DashboardIndexPage() {
  const router = useRouter()
  const { empresaAtual, loading } = useEmpresa()

  useEffect(() => {
    if (loading) return
    if (empresaAtual?.tipo === 'emporio') router.replace('/emporio/dashboard')
    else if (empresaAtual?.tipo === 'factoring') router.replace('/factoring/dashboard')
    else router.replace('/selecionar-empresa')
  }, [loading, empresaAtual, router])

  return <LoadingPage />
}
