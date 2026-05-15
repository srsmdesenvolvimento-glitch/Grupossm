'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/selecionar-empresa'
  const [verSenha, setVerSenha] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.senha,
    })
    if (error) {
      toast.error('E-mail ou senha incorretos')
      return
    }
    router.push(redirectTo)
  }

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: '#080C1A' }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0D1530 0%, #111827 60%, #0A0E1A 100%)' }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20" style={{ backgroundColor: '#D4A528' }} />
        <div className="absolute bottom-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-15" style={{ backgroundColor: '#1E5AA8' }} />

        {/* Top logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="relative flex items-center gap-3"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #D4A528, #B8860B)', boxShadow: '0 0 20px rgba(212,165,40,0.4)' }}
          >
            G
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Grupo <span style={{ color: '#D4A528' }}>SRSM</span>
          </span>
        </motion.div>

        {/* Center content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '#D4A528' }}>
            Sistema de Gestão
          </p>
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
            Tudo que sua<br />
            empresa precisa<br />
            <span style={{ color: '#D4A528' }}>em um lugar.</span>
          </h2>
          <p className="text-base leading-relaxed max-w-md" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Gerencie empório, factoring, clientes, estoque, empréstimos e financeiro com segurança e eficiência.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Empório dos Móveis', 'SRS M Factoring', 'Score de Crédito', 'Crediário'].map(f => (
              <span
                key={f}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Bottom quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          Grupo SRSM © 2026 · Sistema interno
        </motion.p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        {/* Mobile background orb */}
        <div className="absolute top-[-10%] right-[-5%] w-72 h-72 rounded-full blur-[80px] opacity-10 lg:hidden" style={{ backgroundColor: '#D4A528' }} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm relative"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white"
              style={{ background: 'linear-gradient(135deg, #D4A528, #B8860B)' }}
            >
              G
            </div>
            <span className="text-white font-bold tracking-tight">
              Grupo <span style={{ color: '#D4A528' }}>SRSM</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo de volta</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                E-mail
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="pl-10 h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#D4A528]/50 focus:ring-0 focus:bg-white/[0.08] transition-all"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 flex items-center gap-1">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Senha
                </label>
                <a
                  href="/esqueci-senha"
                  className="text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#D4A528')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                  Esqueci a senha
                </a>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <Input
                  id="senha"
                  type={verSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-10 pr-10 h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/20 focus:border-[#D4A528]/50 focus:ring-0 focus:bg-white/[0.08] transition-all"
                  {...register('senha')}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {verSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.senha && (
                <p className="text-xs text-red-400">{errors.senha.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{
                background: isSubmitting ? '#B8860B' : 'linear-gradient(135deg, #D4A528, #C49B20)',
                color: '#0D0A00',
                boxShadow: '0 0 20px rgba(212,165,40,0.25)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no sistema
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-10" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Grupo SRSM · Sistema interno © 2026
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C1A' }}>
          <div className="w-7 h-7 border-2 border-[#D4A528] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
