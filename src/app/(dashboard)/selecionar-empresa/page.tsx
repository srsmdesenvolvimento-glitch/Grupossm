'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Loader2, ArrowRight, ShoppingBag, Building2 } from 'lucide-react'
import type { EmpresaInfo } from '@/lib/types/shared'

const EMPRESA_META = {
  emporio: {
    gradient: 'linear-gradient(135deg, #1A1A2E 0%, #2D1B00 100%)',
    accent: '#D4A528',
    accentLight: 'rgba(212,165,40,0.15)',
    accentBorder: 'rgba(212,165,40,0.35)',
    accentHover: 'rgba(212,165,40,0.25)',
    icon: ShoppingBag,
    iconBg: 'rgba(212,165,40,0.12)',
    tag: 'Móveis & Decoração',
    desc: 'Gerencie estoque, vendas, clientes e crediário da loja',
    badge: '🪑',
  },
  factoring: {
    gradient: 'linear-gradient(135deg, #0D1B2A 0%, #0F1F3D 100%)',
    accent: '#60A5FA',
    accentLight: 'rgba(96,165,250,0.12)',
    accentBorder: 'rgba(96,165,250,0.30)',
    accentHover: 'rgba(96,165,250,0.20)',
    icon: Building2,
    iconBg: 'rgba(96,165,250,0.10)',
    tag: 'Financeiro',
    desc: 'Empréstimos, parcelas, score de crédito e inadimplentes',
    badge: '💰',
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
  const Icon = meta.icon

  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.12, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl text-left w-full focus:outline-none focus-visible:ring-2"
      style={{
        background: meta.gradient,
        border: `1.5px solid ${meta.accentBorder}`,
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(ellipse at 30% 30%, ${meta.accentLight} 0%, transparent 70%)` }}
      />

      {/* Shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)` }}
      />

      <div className="relative p-8">
        {/* Logo / icon */}
        <div className="flex items-start justify-between mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: meta.iconBg, border: `1px solid ${meta.accentBorder}` }}
          >
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt={empresa.nome} className="w-10 h-10 object-contain rounded-lg" />
            ) : (
              <span>{meta.badge}</span>
            )}
          </div>
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: meta.accentLight, color: meta.accent }}
          >
            {meta.tag}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-xl font-bold text-white mb-2 leading-tight">
          {empresa.nome}
        </h2>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {meta.desc}
        </p>

        {/* CTA */}
        <div
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: meta.accent }}
        >
          Acessar sistema
          <ArrowRight
            size={16}
            className="group-hover:translate-x-1.5 transition-transform duration-200"
          />
        </div>
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
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mb-12"
        >
          {/* Logo mark */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black"
              style={{
                background: 'linear-gradient(135deg, #D4A528, #B8860B)',
                boxShadow: '0 0 24px rgba(212,165,40,0.35)',
              }}
            >
              G
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            Grupo <span style={{ color: '#D4A528' }}>SRSM</span>
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
            className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.03] px-8"
          >
            <p className="text-white/50 mb-2 font-medium">Nenhuma empresa disponível</p>
            <p className="text-white/25 text-sm">Seu usuário não tem acesso a nenhuma empresa. Entre em contato com o administrador.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-10 flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03]"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(212,165,40,0.2)', color: '#D4A528' }}
              >
                {(perfil?.nome ?? user.email ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-xs font-semibold leading-none">{perfil?.nome ?? 'Usuário'}</p>
                <p className="text-white/30 text-[11px] mt-0.5">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
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
