'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Loader2, ArrowUpRight } from 'lucide-react'
import type { EmpresaInfo } from '@/lib/types/shared'

const EMPRESA_META: Record<string, {
  cardBg: string
  cardBorder: string
  textColor: string
  mutedColor: string
  arrowColor: string
  labelColor: string
  logo: string
  desc: string
  tag: string
}> = {
  emporio: {
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(0,0,0,0.08)',
    textColor: '#111111',
    mutedColor: 'rgba(0,0,0,0.42)',
    arrowColor: 'rgba(0,0,0,0.3)',
    labelColor: 'rgba(0,0,0,0.32)',
    logo: '/logos/emporio.png',
    desc: 'Curadoria de móveis com história — peças que carregam tradição, artesania e sofisticação.',
    tag: 'EMPRESA 02',
  },
  factoring: {
    cardBg: '#0B1628',
    cardBorder: 'rgba(255,255,255,0.07)',
    textColor: '#FFFFFF',
    mutedColor: 'rgba(255,255,255,0.42)',
    arrowColor: 'rgba(255,255,255,0.35)',
    labelColor: 'rgba(255,255,255,0.35)',
    logo: '/logos/factoring.png',
    desc: 'Soluções financeiras — fomento mercantil, antecipação de recebíveis e crédito empresarial.',
    tag: 'EMPRESA 01',
  },
}

function EmpresaCard({
  empresa,
  index,
  onClick,
}: {
  empresa: EmpresaInfo
  index: number
  onClick: () => void
}) {
  const meta = EMPRESA_META[empresa.tipo] ?? EMPRESA_META.factoring

  return (
    <motion.button
      initial={{ opacity: 0, y: 32, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, delay: 0.15 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="group relative rounded-3xl text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A528] overflow-hidden"
      style={{
        background: meta.cardBg,
        border: `1px solid ${meta.cardBorder}`,
        boxShadow: empresa.tipo === 'emporio'
          ? '0 8px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 8px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      }}
      whileHover={{ scale: 1.025, transition: { duration: 0.22 } }}
      whileTap={{ scale: 0.975 }}
    >
      {/* Top row: label + arrow */}
      <div className="flex items-center justify-between px-7 pt-7 pb-0">
        <span
          className="text-[11px] font-semibold tracking-[0.14em] uppercase"
          style={{ color: meta.labelColor }}
        >
          {meta.tag}
        </span>
        <ArrowUpRight
          size={18}
          className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: meta.arrowColor }}
        />
      </div>

      {/* Logo — centered, prominent */}
      <div className="flex items-center justify-center px-8 py-8">
        <div className="relative w-full flex items-center justify-center" style={{ minHeight: 160 }}>
          <Image
            src={empresa.logo_url ?? meta.logo}
            alt={empresa.nome}
            width={200}
            height={160}
            className="object-contain transition-transform duration-300 group-hover:scale-[1.04]"
            style={{ maxHeight: 160, width: 'auto' }}
          />
        </div>
      </div>

      {/* Name + description */}
      <div className="px-7 pb-8">
        <h2
          className="text-[22px] font-bold leading-tight mb-2"
          style={{ color: meta.textColor }}
        >
          {empresa.nome}
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: meta.mutedColor }}
        >
          {meta.desc}
        </p>
      </div>
    </motion.button>
  )
}

export default function SelecionarEmpresaPage() {
  const router = useRouter()
  const { user, perfil, loading: authLoading, signOut } = useAuth()
  const { empresas, loading: empLoading, selecionarEmpresa } = useEmpresa()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  function handleSelecionar(empresa: EmpresaInfo) {
    selecionarEmpresa(empresa.id)
    router.push(empresa.tipo === 'emporio' ? '/emporio/dashboard' : '/factoring/dashboard')
  }

  const isLoading = authLoading || empLoading

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 10%, #1a2040 0%, #080C1A 55%, #0B0F20 100%)' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Blur orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-80 h-80 rounded-full opacity-20 blur-[80px]" style={{ backgroundColor: '#D4A528' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-15 blur-[100px]" style={{ backgroundColor: '#1E5AA8' }} />

      <div className="relative w-full max-w-2xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: 'rgba(212,165,40,0.5)' }}>
            Sistema de Gestão
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white mb-1">
            Grupo{' '}
            <span style={{
              background: 'linear-gradient(160deg,#F5CC55 0%,#D4A528 45%,#A07010 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              SRSM
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Selecione a empresa para continuar
          </p>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="animate-spin" style={{ color: '#D4A528' }} size={28} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Carregando empresas...</p>
          </div>
        ) : empresas.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-3xl border border-white/10 bg-white/[0.03] px-8"
          >
            <p className="text-white/50 mb-2 font-medium">Nenhuma empresa disponível</p>
            <p className="text-white/25 text-sm">Seu usuário não tem acesso a nenhuma empresa. Entre em contato com o administrador.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {empresas.map((e, i) => (
              <EmpresaCard key={e.id} empresa={e} index={i} onClick={() => handleSelecionar(e)} />
            ))}
          </div>
        )}

        {/* User footer */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-8 flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(212,165,40,0.18)', color: '#D4A528' }}
              >
                {(perfil?.nome ?? user.email ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-xs font-semibold leading-none">{perfil?.nome ?? 'Usuário'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs transition-colors px-3 py-1.5 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              <LogOut size={13} />
              Sair
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
