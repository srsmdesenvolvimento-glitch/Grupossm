'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, Lock, Mail, ArrowRight, Loader2,
  Sun, CloudSun, Moon, ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Threads = dynamic(() => import('@/components/Threads') as Promise<{ default: React.ComponentType<any> }>, { ssr: false })

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

// ── Greeting ────────────────────────────────────────────────────────────────
type Phase = 'morning' | 'afternoon' | 'evening'
interface Greeting { phase: Phase; text: string; time: string; date: string }

function buildGreeting(): Greeting {
  const now = new Date()
  const h   = now.getHours()
  const phase: Phase = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const text = phase === 'morning' ? 'Bom dia' : phase === 'afternoon' ? 'Boa tarde' : 'Boa noite'
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const raw  = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return { phase, text, time, date: raw.charAt(0).toUpperCase() + raw.slice(1) }
}

function useGreeting() {
  const [g, setG] = useState<Greeting | null>(() =>
    typeof window !== 'undefined' ? buildGreeting() : null
  )
  useEffect(() => {
    const id = setInterval(() => setG(buildGreeting()), 30_000)
    return () => clearInterval(id)
  }, [])
  return g
}

const phaseIcon: Record<Phase, React.ReactNode> = {
  morning:   <Sun size={12} className="text-amber-400" />,
  afternoon: <CloudSun size={12} className="text-yellow-300" />,
  evening:   <Moon size={12} className="text-blue-300" />,
}

const FEATURES = [
  { logo: '/logos/emporio.png',          label: 'Empório dos Móveis' },
  { logo: '/logos/factoring_emblem.png', label: 'SRS M Factoring'   },
]

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const GOLD: [number, number, number]         = [0.831, 0.647, 0.157]

// ── 3D tilt ─────────────────────────────────────────────────────────────────
function useTilt() {
  const ref = useRef<HTMLDivElement>(null)
  const mx  = useMotionValue(0)
  const my  = useMotionValue(0)
  const sx  = useSpring(mx, { stiffness: 170, damping: 22 })
  const sy  = useSpring(my, { stiffness: 170, damping: 22 })
  const rotateX = useTransform(sy, [-0.5, 0.5], ['1.6deg', '-1.6deg'])
  const rotateY = useTransform(sx, [-0.5, 0.5], ['-1.6deg', '1.6deg'])

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return
    const r  = el.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width  - 0.5)
    my.set((e.clientY - r.top)  / r.height - 0.5)
  }
  function onLeave() { mx.set(0); my.set(0) }

  return { ref, rotateX, rotateY, onMove, onLeave }
}

// ── Animated clock digits ────────────────────────────────────────────────────
function Clock({ time }: { time: string }) {
  return (
    <AnimatePresence mode="popLayout">
      {time.split('').map((ch, i) => (
        <motion.span
          key={`${i}-${ch}`}
          initial={{ opacity: 0, y: -7 }}
          animate={{ opacity: 1, y:  0 }}
          exit={{    opacity: 0, y:  7 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="inline-block"
        >
          {ch}
        </motion.span>
      ))}
    </AnimatePresence>
  )
}

// Só aceita caminhos internos relativos ("/algo") — "//evil.com" ou
// "https://evil.com" são tratados pelo navegador como URLs de outro site
// (redirecionamento aberto/phishing), então caem no fallback.
function redirectSeguro(valor: string | null): string {
  if (valor && valor.startsWith('/') && !valor.startsWith('//')) return valor
  return '/selecionar-empresa'
}

// ── Page ─────────────────────────────────────────────────────────────────────
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = redirectSeguro(searchParams.get('redirect'))
  const [verSenha, setVerSenha] = useState(false)
  const [focused,  setFocused]  = useState<'email' | 'senha' | null>(null)
  const greeting = useGreeting()
  const tilt     = useTilt()

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
    <div className="lp-root relative min-h-screen overflow-hidden" style={{ background: '#05080F' }}>

      {/* Threads — full screen, slow & dramatic */}
      <div className="fixed inset-0 z-0">
        <Threads
          color={GOLD}
          amplitude={3.0}
          distance={0}
          speed={0.30}
          enableMouseInteraction
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Deep radial vignette — center lighter */}
      <div className="fixed inset-0 z-[1] pointer-events-none" style={{
        background: [
          'radial-gradient(ellipse 75% 65% at 50% 50%, rgba(5,8,15,0.10) 0%, rgba(5,8,15,0.70) 60%, rgba(5,8,15,0.97) 100%)',
        ].join(','),
      }} />

      {/* Technical grid — grounds the ambient threads in an engineered feel */}
      <div className="lp-grid fixed inset-0 z-[1] pointer-events-none" />

      {/* Grain */}
      <div className="lp-grain fixed inset-0 z-[2] pointer-events-none" />

      {/* Ambient HUD readouts — environmental dressing, viewport corners */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1.4 }}
        className="hidden sm:flex fixed top-6 left-6 z-10 font-mono text-[10px] pointer-events-none"
        style={{ color: 'rgba(212,165,40,0.28)', letterSpacing: '0.18em' }}
      >
        GRUPO SRSM
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1.4 }}
        className="hidden sm:flex fixed top-6 right-6 z-10 items-center gap-1.5 font-mono text-[10px] pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em' }}
      >
        <span className="lp-dot w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#4ADE80' }} />
        SISTEMA ONLINE
      </motion.div>

      {/* ── Centered content ─────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px] flex flex-col items-center">

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: -20, filter: 'blur(14px)' }}
            animate={{ opacity: 1, y:   0, filter: 'blur(0px)'  }}
            transition={{ duration: 1.5, delay: 0.1, ease: EASE }}
            className="flex flex-col items-center mb-6"
          >
            <motion.span
              initial={{ opacity: 0, letterSpacing: '0.6em' }}
              animate={{ opacity: 1, letterSpacing: '0.4em' }}
              transition={{ duration: 2.0, delay: 0.3, ease: EASE }}
              className="text-[10px] font-bold uppercase block mb-2"
              style={{ color: 'rgba(212,165,40,0.4)' }}
            >
              Grupo
            </motion.span>

            {/* SRSM — staggered entrance + continuous glow sweep */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.13, delayChildren: 0.5 } } }}
              className="flex font-black select-none"
              style={{ fontSize: 'clamp(3.2rem, 10vw, 4.8rem)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              {['S', 'R', 'S', 'M'].map((l, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 40, filter: 'blur(10px)', scale: 0.8 },
                    show:   { opacity: 1, y:  0, filter: 'blur(0px)',  scale: 1   },
                  }}
                  transition={{ duration: 1.1, ease: EASE }}
                  className={`lp-srsm-letter lp-srsm-${i}`}
                  style={{
                    background: 'linear-gradient(160deg, #F5CC55 0%, #D4A528 45%, #A07010 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {l}
                </motion.span>
              ))}
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 1.2, duration: 1.1, ease: EASE }}
              className="mt-3 h-px w-14"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(212,165,40,0.55), transparent)' }}
            />
          </motion.div>

          {/* Greeting card */}
          <AnimatePresence mode="wait">
            {greeting && (
              <motion.div
                key={greeting.phase}
                initial={{ opacity: 0, y: -14, scale: 0.92, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y:   0, scale: 1,    filter: 'blur(0px)' }}
                exit={{    opacity: 0, y:  14, scale: 0.92, filter: 'blur(8px)' }}
                transition={{ duration: 0.6, ease: EASE }}
                className="relative flex items-stretch rounded-2xl mb-6 overflow-hidden lp-greeting"
                style={{
                  background: 'rgba(10,14,28,0.75)',
                  border: '1px solid rgba(212,165,40,0.13)',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212,165,40,0.1)',
                }}
              >
                {/* Gold top shimmer line */}
                <div className="absolute top-0 left-4 right-4 h-px pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(212,165,40,0.45), transparent)' }} />

                {/* Left — icon + greeting text */}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1,   opacity: 1, rotate:   0 }}
                    transition={{ duration: 0.7, delay: 0.15, type: 'spring', bounce: 0.4 }}
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(212,165,40,0.1)', border: '1px solid rgba(212,165,40,0.18)' }}
                  >
                    {phaseIcon[greeting.phase]}
                  </motion.div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold leading-tight" style={{ color: '#D4A528' }}>
                      {greeting.text}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>
                      {greeting.date.split(',')[0]}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="self-stretch w-px my-2.5"
                  style={{ background: 'rgba(212,165,40,0.1)' }} />

                {/* Right — clock */}
                <div className="flex items-center justify-center px-4">
                  <span className="font-mono font-semibold tabular-nums"
                    style={{ fontSize: '18px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>
                    <Clock time={greeting.time} />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 3D tilt form card ───────────────────────────────────────── */}
          <motion.div
            ref={tilt.ref}
            onMouseMove={tilt.onMove}
            onMouseLeave={tilt.onLeave}
            style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: '1100px', width: '100%' }}
            initial={{ opacity: 0, y: 28, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y:  0, filter: 'blur(0px)'  }}
            transition={{ duration: 1.3, delay: 0.55, ease: EASE }}
          >
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="lp-card relative w-full rounded-2xl p-6 space-y-5"
            >
              {/* HUD corner brackets — power-on entrance */}
              {(['tl', 'tr', 'bl', 'br'] as const).map((pos, i) => (
                <motion.span
                  key={pos}
                  className={`lp-corner lp-corner-${pos}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.9 + i * 0.08, ease: EASE }}
                />
              ))}

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email"
                  className="block font-mono text-[10.5px] font-medium uppercase transition-colors duration-300"
                  style={{
                    letterSpacing: '0.16em',
                    color: focused === 'email' ? 'rgba(212,165,40,0.85)' : 'rgba(255,255,255,0.4)',
                  }}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300"
                    style={{ color: focused === 'email' ? 'rgba(212,165,40,0.5)' : 'rgba(255,255,255,0.16)' }}
                  />
                  <Input
                    id="email" type="email" placeholder="seu@email.com" autoComplete="email"
                    onFocus={() => setFocused('email')}
                    className="lp-input pl-10 h-11 rounded-xl text-sm
                      bg-white/[0.04] border-white/[0.07] text-white placeholder:text-white/[0.15]
                      focus-visible:border-[#D4A528]/45 focus-visible:ring-1 focus-visible:ring-[#D4A528]/10
                      focus-visible:bg-white/[0.06] transition-all duration-300"
                    {...register('email', { onBlur: () => setFocused(null) })}
                  />
                  <span className="lp-scan pointer-events-none" style={{ transform: focused === 'email' ? 'scaleX(1)' : 'scaleX(0)' }} />
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{    opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="text-xs text-red-400 overflow-hidden"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <label htmlFor="senha"
                  className="block font-mono text-[10.5px] font-medium uppercase transition-colors duration-300"
                  style={{
                    letterSpacing: '0.16em',
                    color: focused === 'senha' ? 'rgba(212,165,40,0.85)' : 'rgba(255,255,255,0.4)',
                  }}>
                  Senha
                </label>
                <div className="relative">
                  <Lock size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300"
                    style={{ color: focused === 'senha' ? 'rgba(212,165,40,0.5)' : 'rgba(255,255,255,0.16)' }}
                  />
                  <Input
                    id="senha" type={verSenha ? 'text' : 'password'} placeholder="••••••••"
                    autoComplete="current-password"
                    onFocus={() => setFocused('senha')}
                    className="lp-input pl-10 pr-10 h-11 rounded-xl text-sm
                      bg-white/[0.04] border-white/[0.07] text-white placeholder:text-white/[0.15]
                      focus-visible:border-[#D4A528]/45 focus-visible:ring-1 focus-visible:ring-[#D4A528]/10
                      focus-visible:bg-white/[0.06] transition-all duration-300"
                    {...register('senha', { onBlur: () => setFocused(null) })}
                  />
                  <span className="lp-scan pointer-events-none" style={{ transform: focused === 'senha' ? 'scaleX(1)' : 'scaleX(0)' }} />
                  <button type="button" onClick={() => setVerSenha(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.22)' }}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={verSenha ? 'off' : 'on'}
                        initial={{ opacity: 0, scale: 0.65, rotate: -18 }}
                        animate={{ opacity: 1, scale: 1,    rotate:   0 }}
                        exit={{    opacity: 0, scale: 0.65, rotate:  18 }}
                        transition={{ duration: 0.2 }}
                        className="block"
                      >
                        {verSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
                <AnimatePresence>
                  {errors.senha && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{    opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="text-xs text-red-400 overflow-hidden"
                    >
                      {errors.senha.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="lp-btn w-full h-11 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2
                    active:scale-[0.975] disabled:opacity-50 relative overflow-hidden cursor-pointer transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #E0B030 0%, #C9901A 55%, #B07808 100%)',
                    color: '#0C0700',
                    boxShadow: '0 4px 32px rgba(212,165,40,0.2)',
                    letterSpacing: '0.03em',
                  }}
                >
                  <span className="lp-shimmer absolute inset-0 pointer-events-none" />
                  <AnimatePresence mode="wait">
                    {isSubmitting ? (
                      <motion.span key="loading"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{    opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 size={14} className="animate-spin" /> Entrando...
                      </motion.span>
                    ) : (
                      <motion.span key="idle"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{    opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-2"
                      >
                        Entrar no sistema <ArrowRight size={14} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Secure connection indicator — quiet enterprise trust signal */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span className="lp-dot w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#4ADE80' }} />
                <ShieldCheck size={11} style={{ color: 'rgba(255,255,255,0.22)' }} />
                <span className="font-mono text-[9.5px]" style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em' }}>
                  CONEXÃO CRIPTOGRAFADA
                </span>
              </div>

            </form>
          </motion.div>


        </div>
      </main>

      {/* ── Styles ─────────────────────────────────────────────────────────── */}
      <style>{`
        .lp-grain {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.022;
        }

        /* Fine engineered grid — reads as instrumentation, not decoration */
        .lp-grid {
          background-image:
            linear-gradient(rgba(212,165,40,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,165,40,0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          -webkit-mask-image: radial-gradient(ellipse 60% 55% at 50% 45%, transparent 30%, black 100%);
          mask-image: radial-gradient(ellipse 60% 55% at 50% 45%, transparent 30%, black 100%);
          opacity: 0.5;
        }

        @keyframes lpDot {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          60%      { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
        }
        .lp-dot { animation: lpDot 2.8s ease-out infinite; }

        @keyframes lpCard {
          0%,100% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.04),
                        0 24px 70px rgba(0,0,0,0.55),
                        inset 0 1px 0 rgba(212,165,40,0.06);
            border-color: rgba(255,255,255,0.07);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.05),
                        0 24px 70px rgba(0,0,0,0.55),
                        0 0 56px rgba(212,165,40,0.06),
                        inset 0 1px 0 rgba(212,165,40,0.11);
            border-color: rgba(212,165,40,0.16);
          }
        }
        .lp-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-top-color: rgba(212,165,40,0.17);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          animation: lpCard 9s ease-in-out infinite;
        }

        /* HUD corner brackets — quiet instrumentation framing, not neon */
        .lp-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          pointer-events: none;
          opacity: 0.5;
        }
        .lp-corner-tl { top: -1px;    left: -1px;    border-top: 1px solid rgba(212,165,40,0.4);    border-left: 1px solid rgba(212,165,40,0.4);    border-radius: 6px 0 0 0; }
        .lp-corner-tr { top: -1px;    right: -1px;   border-top: 1px solid rgba(212,165,40,0.4);    border-right: 1px solid rgba(212,165,40,0.4);   border-radius: 0 6px 0 0; }
        .lp-corner-bl { bottom: -1px; left: -1px;    border-bottom: 1px solid rgba(212,165,40,0.4); border-left: 1px solid rgba(212,165,40,0.4);    border-radius: 0 0 0 6px; }
        .lp-corner-br { bottom: -1px; right: -1px;   border-bottom: 1px solid rgba(212,165,40,0.4); border-right: 1px solid rgba(212,165,40,0.4);   border-radius: 0 0 6px 0; }

        /* Focus scan-line — sweeps in under the active field */
        .lp-scan {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #D4A528, transparent);
          transform-origin: center;
          transition: transform 0.35s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes lpShimmer {
          0%   { transform: translateX(-150%) skewX(-22deg); opacity: 0; }
          35%  { opacity: 0.5; }
          100% { transform: translateX(260%) skewX(-22deg); opacity: 0; }
        }
        .lp-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent);
          animation: lpShimmer 4s ease-in-out infinite;
        }
        .lp-btn:disabled .lp-shimmer { display: none; }
        .lp-btn:not(:disabled):hover {
          filter: brightness(1.1) saturate(1.1);
          box-shadow: 0 8px 44px rgba(212,165,40,0.42) !important;
          transform: translateY(-1.5px);
        }

        /* SRSM glow sweep — restrained breathing highlight, not a flash */
        @keyframes lpGlow {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 0px rgba(245,204,85,0)); }
          50%      { filter: brightness(1.18) drop-shadow(0 0 6px rgba(245,204,85,0.3)); }
        }
        .lp-srsm-letter { animation: lpGlow 7s ease-in-out infinite; }
        .lp-srsm-0 { animation-delay: 0.0s; }
        .lp-srsm-1 { animation-delay: 0.9s; }
        .lp-srsm-2 { animation-delay: 1.8s; }
        .lp-srsm-3 { animation-delay: 2.7s; }

        /* Greeting card ambient pulse */
        @keyframes lpGreeting {
          0%,100% { box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212,165,40,0.10); }
          50%      { box-shadow: 0 8px 40px rgba(0,0,0,0.4), 0 0 28px rgba(212,165,40,0.07), inset 0 1px 0 rgba(212,165,40,0.18); }
        }
        .lp-greeting { animation: lpGreeting 5s ease-in-out infinite; }

        .lp-pill { transition: background .25s, border-color .25s; }
        .lp-pill:hover {
          background: rgba(212,165,40,0.07) !important;
          border-color: rgba(212,165,40,0.2) !important;
        }

        .lp-input:focus-visible { outline: none; }

        .threads-container canvas { width: 100% !important; height: 100% !important; }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080F' }}>
        <div className="w-5 h-5 border-2 border-[#D4A528] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
