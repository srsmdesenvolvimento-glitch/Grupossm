'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormData = z.infer<typeof schema>

export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/atualizar-senha`,
    })
    if (error) {
      toast.error('Erro ao enviar e-mail. Tente novamente.')
      return
    }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8"
        >
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        {enviado ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">E-mail enviado!</h2>
            <p className="text-slate-500 text-sm">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Esqueceu a senha?</h2>
              <p className="text-slate-500 mt-1 text-sm">
                Informe seu e-mail e enviaremos as instruções para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-9"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1A1A2E] hover:bg-[#0F3460] text-white h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> Enviando...</>
                ) : 'Enviar instruções'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
