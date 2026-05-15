'use client'

import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { EmpresaInfo } from '@/lib/types/shared'

export function EmpresaSelector() {
  const router = useRouter()
  const { empresas, selecionarEmpresa } = useEmpresa()

  function selecionar(empresa: EmpresaInfo) {
    selecionarEmpresa(empresa.id)
    router.push(empresa.tipo === 'emporio' ? '/emporio/dashboard' : '/factoring/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-3xl px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Grupo SRSM</h1>
          <p className="text-slate-400">Selecione a empresa para continuar</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {empresas.map(empresa => {
            const isEmporio = empresa.tipo === 'emporio'
            return (
              <button
                key={empresa.id}
                onClick={() => selecionar(empresa)}
                className="group relative overflow-hidden rounded-2xl p-8 border-2 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                style={{
                  backgroundColor: isEmporio ? '#1A1A2E' : '#0D1B2A',
                  borderColor: isEmporio ? 'rgba(212,165,40,0.3)' : 'rgba(30,90,168,0.3)',
                }}
              >
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                    style={{ backgroundColor: isEmporio ? 'rgba(212,165,40,0.15)' : 'rgba(30,90,168,0.15)' }}
                  >
                    <span className="text-3xl">{isEmporio ? '🪑' : '💰'}</span>
                  </div>
                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{ color: isEmporio ? '#D4A528' : '#60A5FA' }}
                  >
                    {empresa.nome}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {isEmporio
                      ? 'Gestão de loja, produtos, vendas e clientes'
                      : 'Gestão de empréstimos, parcelas e crédito'}
                  </p>
                  <div
                    className="mt-6 flex items-center text-sm font-medium"
                    style={{ color: isEmporio ? '#D4A528' : '#60A5FA' }}
                  >
                    Acessar{' '}
                    <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
