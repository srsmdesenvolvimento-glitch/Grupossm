'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingPage } from '@/components/shared/LoadingPage'

export default function PagamentoRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/factoring/emprestimos') }, [router])
  return <LoadingPage />
}
