import { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SignatureWizard from '@/components/factoring/SignatureWizard'

export const metadata: Metadata = {
  title: 'Assinatura Eletrônica de Contrato — Grupo SRSM',
  description: 'Área de assinatura digital e autenticidade eletrônica de contratos.',
}

export default async function AssinarContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams
  const supabase = createAdminClient()

  // 1. Fetch Loan Details securely on the server
  const { data: emprestimo } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('id', id)
    .single()

  // Sem o token do contrato (enviado só no link que vai pro cliente por
  // WhatsApp), qualquer pessoa com o UUID do empréstimo conseguiria ver os
  // dados do cliente e assinar o contrato no lugar dele — tratamos igual a
  // "não encontrado" pra não revelar se o UUID existe ou não.
  const tokenValido = !!token && !!emprestimo && token === emprestimo.assinatura_token

  if (!emprestimo || !tokenValido) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <X size={32} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-100">Contrato não localizado</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            O link de assinatura eletrônica acessado é inválido ou expirou. Por favor, solicite um novo link de assinatura ao seu operador de atendimento.
          </p>
        </div>
      </div>
    )
  }

  // 2. Fetch Customer Details
  const { data: cliente } = await supabase
    .from('clientes_factoring')
    .select('*')
    .eq('id', emprestimo.cliente_id)
    .single()

  if (!cliente) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-100">Cliente não localizado</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Não conseguimos localizar a ficha cadastral associada a este contrato de empréstimo. Entre em contato com a factoring.
          </p>
        </div>
      </div>
    )
  }

  // 3. Fetch Installments
  const { data: parcelas } = await supabase
    .from('parcelas_emprestimo')
    .select('*')
    .eq('emprestimo_id', id)
    .order('numero_parcela', { ascending: true })

  // 4. Verify if already signed
  const isAssinado = Array.isArray(emprestimo.documentos) && 
    emprestimo.documentos.some((doc: any) => doc.tipo === 'assinatura_digital')

  if (isAssinado) {
    const signatureDoc = (emprestimo.documentos as any[]).find((doc: any) => doc.tipo === 'assinatura_digital')
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-slate-100">Contrato Já Assinado!</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Este contrato de empréstimo ({emprestimo.numero_contrato}) já foi assinado e validado digitalmente com sucesso. Nenhuma ação adicional é necessária.
          </p>
          {signatureDoc?.url && (
            <div className="pt-2">
              <a href={signatureDoc.url} target="_blank" rel="noopener noreferrer" 
                className="flex items-center justify-center w-full h-10 rounded-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/40 transition-colors text-sm">
                Baixar Contrato Assinado (PDF)
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 5. Render signature wizard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      <SignatureWizard
        id={id}
        token={token!}
        contrato={emprestimo}
        cliente={cliente}
        parcelas={parcelas || []}
      />
    </div>
  )
}
