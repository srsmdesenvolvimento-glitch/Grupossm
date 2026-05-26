'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Lock, Mail, ArrowRight, Loader2,
  Sun, CloudSun, Moon,
} from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Threads = dynamic(() => import('@/components/Threads') as Promise<{ default: React.ComponentType<any> }>, { ssr: false })

// ── Schema ─────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

// ── Greeting ───────────────────────────────────────────────────────────────
type Phase = 'morning' | 'afternoon' | 'evening'
interface Greeting { phase: Phase; text: string; time: string; date: string }

function buildGreeting(): Greeting {
  const now = new Date()
  const h = now.getHours()
  const phase: Phase = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const text = phase === 'morning' ? 'Bom dia' : phase === 'afternoon' ? 'Boa tarde' : 'Boa noite'
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const raw  = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return { phase, text, time, date: raw.charAt(0).toUpperCase() + raw.slice(1) }
}

function useGreeting() {
  const [g, setG] = useState<Greeting | null>(null)
  useEffect(() => {
    setG(buildGreeting())
    const id = setInterval(() => setG(buildGreeting()), 30_000)
    return () => clearInterval(id)
  }, [])
  return g
}

const phaseIcon: Record<Phase, React.ReactNode> = {
  morning:   <Sun size={13} className="text-amber-400" />,
  afternoon: <CloudSun size={13} className="text-yellow-300" />,
  evening:   <Moon size={13} className="text-blue-300" />,
}

// ── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  { logo: '/logos/emporio.png',   label: 'Empório dos Móveis' },
  { logo: '/logos/factoring_emblem.png', label: 'SRS M Factoring'    },
]

// ── Animation helpers ──────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

const fadeUp = (delay: number) => ({
  initial:  { opacity: 0, y: 28, filter: 'blur(8px)' },
  animate:  { opacity: 1, y: 0,  filter: 'blur(0px)' },
  transition: { delay, duration: 0.9, ease: EASE },
})

// SRSM gold in 0-1 normalized for WebGL shader
const GOLD: [number, number, number] = [0.831, 0.647, 0.157]

// ── Main ───────────────────────────────────────────────────────────────────
function LoginForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const redirectTo  = searchParams.get('redirect') ?? '/selecionar-empresa'
  const [verSenha, setVerSenha] = useState(false)
  const greeting = useGreeting()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.senha })
    if (error) { toast.error('E-mail ou senha incorretos'); return }
    router.push(redirectTo)
  }

  return (
    <div className="lp-root relative min-h-screen overflow-hidden" style={{ background: '#060812' }}>

      {/* ── WebGL Threads — full screen ───────────────────────────────── */}
      <div className="fixed inset-0 z-0" style={{ opacity: 0.6 }}>
        <Threads
          color={GOLD}
          amplitude={1.3}
          distance={0}
          enableMouseInteraction
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* ── Dark vignette (center lighter so content reads) ───────────── */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(6,8,18,0.25) 0%, rgba(6,8,18,0.72) 65%, rgba(6,8,18,0.96) 100%)',
          ].join(','),
        }}
      />

      {/* ── Subtle grain noise overlay ────────────────────────────────── */}
      <div className="lp-grain fixed inset-0 z-[2] pointer-events-none" />

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-14">
        <div className="w-full max-w-[400px] flex flex-col items-center">

          {/* ── Brand name ── */}
          <motion.div
            initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
            className="flex flex-col items-center gap-1 mb-1"
          >
            <span
              className="text-xs font-bold uppercase tracking-[0.3em]"
              style={{ color: 'rgba(212,165,40,0.5)' }}
            >
              Grupo
            </span>

            {/* SRSM — letter-by-letter entrance */}
            <motion.h2
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.13, delayChildren: 0.45 } } }}
              className="flex font-black leading-none tracking-tight select-none"
              style={{ fontSize: 'clamp(3rem, 9vw, 4.5rem)' }}
            >
              {['S','R','S','M'].map((l, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
                    show:   { opacity: 1, y: 0,  filter: 'blur(0px)' },
                  }}
                  transition={{ duration: 0.85, ease: EASE }}
                  style={{
                    background: 'linear-gradient(160deg,#F5CC55 0%,#D4A528 45%,#A07010 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {l}
                </motion.span>
              ))}
            </motion.h2>

            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.9, ease: EASE }}
              className="h-px w-16 origin-left"
              style={{ background: 'linear-gradient(90deg,#D4A528,rgba(212,165,40,0.1))' }}
            />
          </motion.div>

          {/* Divider */}
          <motion.div
            {...fadeUp(1.5)}
            className="flex items-center gap-3 my-6 w-full max-w-[280px]"
          >
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(212,165,40,0.25))' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(212,165,40,0.5)' }}>
              Sistema de Gestão
            </span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,rgba(212,165,40,0.25),transparent)' }} />
          </motion.div>

          {/* Greeting pill */}
          <AnimatePresence mode="wait">
            {greeting && (
              <motion.div
                key={greeting.phase}
                initial={{ opacity: 0, y: -10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-full mb-8"
                style={{
                  background: 'rgba(212,165,40,0.07)',
                  border: '1px solid rgba(212,165,40,0.2)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {phaseIcon[greeting.phase]}
                <span className="text-sm font-bold" style={{ color: '#D4A528' }}>{greeting.text}</span>
                <span className="w-px h-3.5" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="text-sm font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{greeting.time}</span>
                <span className="w-px h-3.5" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {greeting.date.split(',')[0]}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Heading */}
          <motion.div {...fadeUp(1.9)} className="text-center mb-9">
            <h1 className="text-4xl font-black text-white mb-2.5 tracking-tight leading-tight">
              Bem-vindo
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.34)' }}>
              Entre com suas credenciais para acessar o sistema
            </p>
          </motion.div>

          {/* Form card */}
          <motion.div {...fadeUp(2.2)} className="w-full lp-card rounded-2xl p-7 mb-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-[0.13em]"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <Input
                    id="email" type="email" placeholder="seu@email.com" autoComplete="email"
                    className="lp-input pl-10 h-11 rounded-xl text-[15px] transition-all duration-200
                      bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/[0.18]
                      focus-visible:border-[#D4A528]/55 focus-visible:ring-1 focus-visible:ring-[#D4A528]/20
                      focus-visible:bg-white/[0.08]"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.13em]"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Senha
                  </label>
                  <a href="/esqueci-senha" className="lp-forgot text-xs transition-colors duration-200"
                    style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Esqueci a senha
                  </a>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <Input
                    id="senha" type={verSenha ? 'text' : 'password'} placeholder="••••••••"
                    autoComplete="current-password"
                    className="lp-input pl-10 pr-10 h-11 rounded-xl text-[15px] transition-all duration-200
                      bg-white/[0.05] border-white/[0.09] text-white placeholder:text-white/[0.18]
                      focus-visible:border-[#D4A528]/55 focus-visible:ring-1 focus-visible:ring-[#D4A528]/20
                      focus-visible:bg-white/[0.08]"
                    {...register('senha')}
                  />
                  <button type="button" onClick={() => setVerSenha(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity duration-200 hover:opacity-70"
                    style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {verSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.senha && <p className="text-xs text-red-400">{errors.senha.message}</p>}
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="lp-btn w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5
                    transition-all duration-200 active:scale-[0.98] disabled:opacity-50 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg,#D4A528 0%,#C9981C 50%,#B8860B 100%)',
                    color: '#0D0900',
                    boxShadow: '0 4px 28px rgba(212,165,40,0.38)',
                    fontSize: '14px',
                    letterSpacing: '0.03em',
                  }}
                >
                  <span className="lp-shimmer absolute inset-0 pointer-events-none" />
                  {isSubmitting
                    ? <><Loader2 size={16} className="animate-spin" />Entrando...</>
                    : <>Entrar no sistema<ArrowRight size={15} /></>
                  }
                </button>
              </div>

            </form>
          </motion.div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {FEATURES.map(({ logo, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 2.8 + i * 0.1, duration: 0.6, type: 'spring', bounce: 0.25 }}
                className="lp-pill flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Image src={logo} alt={label} width={18} height={18} className="object-contain rounded-sm" />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{label}</span>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <motion.div {...fadeUp(3.1)} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="lp-dot w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Sistemas online</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Grupo SRSM © 2026
            </span>
          </motion.div>

        </div>
      </main>

      {/* ── Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        /* Noise grain */
        .lp-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.022;
        }

        /* Online dot */
        @keyframes lpDot {
          0%,100% { box-shadow:0 0 4px #4ade80; }
          50%      { box-shadow:0 0 10px #4ade80; }
        }
        .lp-dot { animation:lpDot 2.5s ease-in-out infinite; }

        /* Card glow pulse */
        @keyframes lpCard {
          0%,100% {
            box-shadow:0 0 0 1px rgba(255,255,255,0.03),0 24px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(212,165,40,0.07);
            border-color:rgba(255,255,255,0.07);
          }
          50% {
            box-shadow:0 0 0 1px rgba(255,255,255,0.04),0 24px 70px rgba(0,0,0,.55),0 0 60px rgba(212,165,40,0.09),inset 0 1px 0 rgba(212,165,40,0.15);
            border-color:rgba(212,165,40,0.22);
          }
        }
        .lp-card {
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.07);
          border-top-color:rgba(212,165,40,0.2);
          backdrop-filter:blur(28px);
          -webkit-backdrop-filter:blur(28px);
          animation:lpCard 5s ease-in-out infinite;
        }

        /* Button shimmer */
        @keyframes lpShimmer {
          0%  { transform:translateX(-130%) skewX(-18deg); opacity:0; }
          45% { opacity:1; }
          100%{ transform:translateX(230%) skewX(-18deg); opacity:0; }
        }
        .lp-shimmer {
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent);
          animation:lpShimmer 3s ease-in-out infinite;
        }
        .lp-btn:disabled .lp-shimmer { display:none; }
        .lp-btn:not(:disabled):hover {
          filter:brightness(1.08);
          box-shadow:0 6px 38px rgba(212,165,40,0.55) !important;
          transform:translateY(-1px);
        }

        /* Feature pill hover */
        .lp-pill { transition:background .2s,border-color .2s; }
        .lp-pill:hover {
          background:rgba(212,165,40,0.07) !important;
          border-color:rgba(212,165,40,0.22) !important;
        }

        /* Input & link */
        .lp-input:focus-visible { outline:none; }
        .lp-forgot:hover { color:#D4A528 !important; }

        /* Threads canvas size */
        .threads-container canvas { width:100% !important; height:100% !important; }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060812' }}>
        <div className="w-7 h-7 border-2 border-[#D4A528] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
