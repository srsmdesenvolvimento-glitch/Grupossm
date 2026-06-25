'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

// Dynamically load the canvas WebGL threads component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Threads = dynamic(() => import('@/components/Threads') as Promise<{ default: React.ComponentType<any> }>, { ssr: false })

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})
type FormData = z.infer<typeof schema>

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const GOLD: [number, number, number] = [0.831, 0.647, 0.157]

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration: 0.8, ease: EASE },
})

export default function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${appUrl}/atualizar-senha`,
    })
    if (error) {
      toast.error('Erro ao enviar e-mail. Tente novamente.')
      return
    }
    setEnviado(true)
  }

  return (
    <div className="lp-root relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4" style={{ background: '#060812' }}>
      
      {/* ── WebGL Threads — background ────────────────────────────────── */}
      <div className="fixed inset-0 z-0" style={{ opacity: 0.45 }}>
        <Threads
          color={GOLD}
          amplitude={1.1}
          distance={0}
          enableMouseInteraction
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* ── Vignette ──────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 85% 75% at 50% 50%, rgba(6,8,18,0.2) 0%, rgba(6,8,18,0.7) 65%, rgba(6,8,18,0.95) 100%)',
        }}
      />

      {/* ── Noise grain ────────────────────────────────────────────────── */}
      <div className="lp-grain fixed inset-0 z-[2] pointer-events-none" />

      {/* ── Form wrapper ──────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[400px]">
        
        {/* Back Link */}
        <motion.div {...fadeUp(0.15)}>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-6 transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#D4A528'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            <span>Voltar ao Login</span>
          </Link>
        </motion.div>

        {enviado ? (
          <motion.div 
            {...fadeUp(0.3)} 
            className="lp-card rounded-2xl p-8 text-center flex flex-col items-center"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(52,168,83,0.12)', border: '1px solid rgba(52,168,83,0.25)' }}>
              <CheckCircle2 size={32} className="text-[#34A853] animate-status-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3 tracking-tight">E-mail Enviado!</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Verificamos seu e-mail de acesso. Por favor, cheque sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Header info */}
            <motion.div {...fadeUp(0.3)} className="mb-8">
              <h2 className="text-3xl font-black text-white mb-2.5 tracking-tight leading-tight">
                Esqueceu a senha?
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Informe seu e-mail e enviaremos as instruções para redefinir sua credencial.
              </p>
            </motion.div>

            {/* Input card */}
            <motion.div {...fadeUp(0.45)} className="w-full lp-card rounded-2xl p-7">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="space-y-2">
                  <Label 
                    htmlFor="email" 
                    className="block text-[11px] font-bold uppercase tracking-[0.13em]"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    E-mail de Cadastro
                  </Label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="lp-input pl-10 h-11 rounded-xl text-[15px] transition-all duration-200
                        bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/[0.18]
                        focus-visible:border-[#D4A528]/55 focus-visible:ring-1 focus-visible:ring-[#D4A528]/20
                        focus-visible:bg-white/[0.08]"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="lp-btn w-full h-11.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                    transition-all duration-200 active:scale-[0.98] disabled:opacity-50 relative overflow-hidden shrink-0"
                  style={{
                    background: 'linear-gradient(135deg,#D4A528 0%,#C9981C 50%,#B8860B 100%)',
                    color: '#0D0900',
                    boxShadow: '0 4px 24px rgba(212,165,40,0.35)',
                    fontSize: '14px',
                    letterSpacing: '0.03em',
                  }}
                >
                  <span className="lp-shimmer absolute inset-0 pointer-events-none" />
                  {isSubmitting ? (
                    <><Loader2 size={15} className="animate-spin mr-1" /> Enviando...</>
                  ) : (
                    <>
                      <span>Enviar instruções</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>

              </form>
            </motion.div>
          </>
        )}
      </div>

      {/* ── Inline Styles ────────────────────────────────────────────── */}
      <style>{`
        .lp-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.022;
        }

        @keyframes lpCard {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 24px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(212,165,40,0.07);
            border-color: rgba(255,255,255,0.07);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 70px rgba(0,0,0,.55), 0 0 60px rgba(212,165,40,0.09), inset 0 1px 0 rgba(212,165,40,0.15);
            border-color: rgba(212,165,40,0.22);
          }
        }
        .lp-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-top-color: rgba(212,165,40,0.2);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          animation: lpCard 5s ease-in-out infinite;
        }

        @keyframes lpShimmer {
          0%  { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          45% { opacity: 1; }
          100%{ transform: translateX(230%) skewX(-18deg); opacity: 0; }
        }
        .lp-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
          animation: lpShimmer 3s ease-in-out infinite;
        }

        .lp-btn:disabled .lp-shimmer { display: none; }
        .lp-btn:not(:disabled):hover {
          filter: brightness(1.08);
          box-shadow: 0 6px 32px rgba(212,165,40,0.5) !important;
          transform: translateY(-1px);
        }

        .lp-input:focus-visible { outline: none; }
      `}</style>
    </div>
  )
}
