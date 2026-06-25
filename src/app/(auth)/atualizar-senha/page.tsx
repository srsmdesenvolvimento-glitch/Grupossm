'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Threads = dynamic(() => import('@/components/Threads') as Promise<{ default: React.ComponentType<any> }>, { ssr: false })

const schema = z.object({
  senha: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar: z.string(),
}).refine(d => d.senha === d.confirmar, {
  message: 'As senhas não coincidem',
  path: ['confirmar'],
})
type FormData = z.infer<typeof schema>

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const GOLD: [number, number, number] = [0.831, 0.647, 0.157]

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration: 0.8, ease: EASE },
})

function AtualizarSenhaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [concluido, setConcluido] = useState(false)
  const [tokenValido, setTokenValido] = useState<boolean | null>(null)
  const [verSenha, setVerSenha] = useState(false)
  const [verConfirmar, setVerConfirmar] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    // Supabase redireciona com #access_token=...&type=recovery na URL
    // O cliente Supabase processa automaticamente o hash e cria sessão
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setTokenValido(true)
      } else {
        // Pode ainda estar processando o hash — aguarda evento
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            setTokenValido(true)
            subscription.unsubscribe()
          }
        })
        // Timeout de segurança
        setTimeout(() => {
          setTokenValido(prev => prev === null ? false : prev)
        }, 3000)
      }
    })
  }, [searchParams])

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.senha })
    if (error) {
      toast.error(error.message ?? 'Erro ao atualizar senha')
      return
    }
    setConcluido(true)
    setTimeout(() => router.replace('/login'), 3000)
  }

  return (
    <div
      className="lp-root relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4"
      style={{ background: '#060812' }}
    >
      <div className="fixed inset-0 z-0" style={{ opacity: 0.45 }}>
        <Threads color={GOLD} amplitude={1.1} distance={0.3} enableMouseInteraction={false} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <motion.div className="text-center mb-8" {...fadeUp(0)}>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-[#D4A528]/60 mb-2">
            Grupo SRSM
          </p>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Nova senha
          </h1>
          <p className="text-sm text-white/40 mt-2">
            {concluido ? 'Senha atualizada com sucesso!' : 'Crie uma nova senha para sua conta'}
          </p>
        </motion.div>

        {concluido ? (
          <motion.div
            className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center space-y-4"
            {...fadeUp(0.1)}
          >
            <CheckCircle2 className="mx-auto text-green-400" size={48} />
            <p className="text-white font-semibold">Senha atualizada!</p>
            <p className="text-white/50 text-sm">Redirecionando para o login...</p>
          </motion.div>
        ) : tokenValido === false ? (
          <motion.div
            className="bg-white/5 border border-red-500/30 backdrop-blur-xl rounded-2xl p-8 text-center space-y-4"
            {...fadeUp(0.1)}
          >
            <p className="text-red-400 font-semibold text-sm">
              Link de redefinição inválido ou expirado.
            </p>
            <Link
              href="/esqueci-senha"
              className="inline-block text-[#D4A528] text-sm hover:underline"
            >
              Solicitar novo link
            </Link>
          </motion.div>
        ) : (
          <motion.div
            className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8"
            {...fadeUp(0.1)}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Nova senha */}
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-white/70 text-xs font-semibold tracking-wide">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <Input
                    id="senha"
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="h-11 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl"
                    placeholder="Mínimo 8 caracteres"
                    {...register('senha')}
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.senha && (
                  <p className="text-red-400 text-xs">{errors.senha.message}</p>
                )}
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmar" className="text-white/70 text-xs font-semibold tracking-wide">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <Input
                    id="confirmar"
                    type={verConfirmar ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="h-11 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl"
                    placeholder="Repita a nova senha"
                    {...register('confirmar')}
                  />
                  <button
                    type="button"
                    onClick={() => setVerConfirmar(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {verConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmar && (
                  <p className="text-red-400 text-xs">{errors.confirmar.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || tokenValido === null}
                className="w-full h-11 rounded-xl bg-[#D4A528] hover:bg-[#C49A20] disabled:opacity-50 text-[#07080F] font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Atualizando...</>
                ) : tokenValido === null ? (
                  <><Loader2 size={16} className="animate-spin" /> Verificando link...</>
                ) : (
                  'Atualizar senha'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-xs text-white/40 hover:text-white/60 transition-colors">
                Voltar ao login
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function AtualizarSenhaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060812] flex items-center justify-center">
        <Loader2 className="text-[#D4A528] animate-spin" size={32} />
      </div>
    }>
      <AtualizarSenhaForm />
    </Suspense>
  )
}
