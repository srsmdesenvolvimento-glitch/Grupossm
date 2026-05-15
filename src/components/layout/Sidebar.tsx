'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Banknote, BarChart3,
  Settings, History, FileText, ChevronDown, ChevronRight, X, Building2,
  Wallet, Globe, TrendingUp, TrendingDown, Calculator, CalendarDays,
  CheckCircle, AlertTriangle, AlertCircle, Tag, Boxes, List, Plus,
  MessageCircle, Armchair, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { TipoEmpresa } from '@/lib/types/database'
import type { MenuItem } from '@/lib/constants/menus'

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />,
  Users: <Users size={18} />,
  Package: <Package size={18} />,
  ShoppingCart: <ShoppingCart size={18} />,
  Banknote: <Banknote size={18} />,
  BarChart3: <BarChart3 size={18} />,
  Settings: <Settings size={18} />,
  History: <History size={18} />,
  FileText: <FileText size={18} />,
  Wallet: <Wallet size={18} />,
  Globe: <Globe size={18} />,
  TrendingUp: <TrendingUp size={18} />,
  TrendingDown: <TrendingDown size={18} />,
  Calculator: <Calculator size={18} />,
  CalendarDays: <CalendarDays size={18} />,
  CheckCircle: <CheckCircle size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
  AlertCircle: <AlertCircle size={18} />,
  Tag: <Tag size={18} />,
  Boxes: <Boxes size={18} />,
  List: <List size={18} />,
  Plus: <Plus size={18} />,
  MessageCircle: <MessageCircle size={18} />,
  Armchair: <Armchair size={18} />,
}

interface SidebarProps {
  empresa: TipoEmpresa
  menu: MenuItem[]
  onClose?: () => void
}

const EMPRESA_CONFIG = {
  emporio: {
    bg: '#1A1A2E',
    bgSecondary: '#16162A',
    primary: '#D4A528',
    activeItemBg: 'rgba(212,165,40,0.12)',
    activeBorder: '#D4A528',
    nome: 'Empório dos Móveis',
    tipo: 'Móveis & Decoração',
    emoji: '🪑',
  },
  factoring: {
    bg: '#0F172A',
    bgSecondary: '#0B1120',
    primary: '#60A5FA',
    activeItemBg: 'rgba(30,90,168,0.25)',
    activeBorder: '#60A5FA',
    nome: 'SRS M Factoring',
    tipo: 'Financeiro',
    emoji: '💰',
  },
}

export function Sidebar({ empresa, menu, onClose }: SidebarProps) {
  const pathname = usePathname()
  const cfg = EMPRESA_CONFIG[empresa]
  const shouldReduceMotion = useReducedMotion()
  const { perfil, user } = useAuth()

  const defaultOpen = menu
    .filter(item => item.subitems?.some(s => pathname.startsWith(s.href)))
    .map(item => item.label)

  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpen)

  function toggleGroup(label: string) {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    )
  }

  function isActive(href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
  }

  const userName = perfil?.nome ?? user?.email ?? 'Usuário'
  const userRole = empresa === 'emporio' ? 'Empório dos Móveis' : 'SRS M Factoring'
  const userInitials = userName
    .trim()
    .split(/\s+/)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const submenuVariants: Variants = {
    open: {
      height: 'auto',
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.18, ease: [0.4, 0, 1, 1] },
    },
  }

  return (
    <aside className="flex flex-col h-full w-64 shrink-0" style={{ backgroundColor: cfg.bg }}>
      {/* Brand area */}
      <div
        className="flex items-center justify-between px-5 py-5 border-b border-white/10"
        style={{ backgroundColor: cfg.bgSecondary }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
            style={{ backgroundColor: `${cfg.primary}20`, border: `1.5px solid ${cfg.primary}40` }}
          >
            {cfg.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{cfg.nome}</p>
            <span
              className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 leading-none"
              style={{ backgroundColor: `${cfg.primary}25`, color: cfg.primary }}
            >
              {cfg.tipo}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden ml-2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {menu.map(item => {
          if (item.subitems && item.subitems.length > 0) {
            const isOpen = openGroups.includes(item.label)
            const hasActive = item.subitems.some(s => isActive(s.href))

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                    hasActive ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/5'
                  )}
                  style={hasActive ? { backgroundColor: cfg.activeItemBg } : {}}
                >
                  <span
                    className="shrink-0 transition-colors"
                    style={{ color: hasActive ? cfg.primary : 'inherit' }}
                  >
                    {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                  </span>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  <motion.span
                    animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ChevronDown size={14} className="text-white/35" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="submenu"
                      initial="closed"
                      animate="open"
                      exit="closed"
                      variants={submenuVariants}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="ml-4 mt-0.5 mb-0.5 space-y-0.5 pl-3 border-l border-white/10">
                        {item.subitems.map(sub => {
                          const active = isActive(sub.href)
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onClose}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                                active
                                  ? 'font-semibold'
                                  : 'text-white/45 hover:text-white hover:bg-white/5'
                              )}
                              style={active ? { color: cfg.primary } : {}}
                            >
                              {ICON_MAP[sub.icon] && (
                                <span className="opacity-70 shrink-0">{ICON_MAP[sub.icon]}</span>
                              )}
                              <span>{sub.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }

          const active = isActive(item.href ?? '/')
          return (
            <Link
              key={item.href}
              href={item.href ?? '/'}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2',
                active
                  ? 'text-white font-semibold'
                  : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent'
              )}
              style={active ? {
                backgroundColor: cfg.activeItemBg,
                borderLeftColor: cfg.activeBorder,
              } : { borderColor: 'transparent' }}
            >
              <span
                className="shrink-0 transition-colors"
                style={{ color: active ? cfg.primary : 'inherit' }}
              >
                {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer: user info + switch company */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1" style={{ backgroundColor: cfg.bgSecondary }}>
        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: `${cfg.primary}30`, color: cfg.primary }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{userName}</p>
            <p className="text-white/35 text-[10px] truncate">{userRole}</p>
          </div>
        </div>

        <div className="border-t border-white/8 pt-1">
          <Link
            href="/selecionar-empresa"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/35 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Building2 size={16} />
            <span>Trocar Empresa</span>
          </Link>
        </div>

        <p className="text-white/15 text-[10px] text-center pb-1">v1.0.0</p>
      </div>
    </aside>
  )
}
