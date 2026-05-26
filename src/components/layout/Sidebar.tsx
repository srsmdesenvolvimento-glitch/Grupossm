'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Banknote, BarChart3,
  Settings, History, FileText, ChevronDown, ChevronLeft, ChevronRight, X, Building2,
  Wallet, Globe, TrendingUp, TrendingDown, Calculator, CalendarDays,
  CheckCircle, AlertTriangle, AlertCircle, Tag, Boxes, List, Plus,
  MessageCircle, Armchair,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useFactoringCounts } from '@/hooks/useFactoringCounts'
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
  collapsed?: boolean
  onToggleCollapsed?: () => void
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
    logo: '/logos/emporio.png',
  },
  factoring: {
    bg: '#0F172A',
    bgSecondary: '#0B1120',
    primary: '#60A5FA',
    activeItemBg: 'rgba(30,90,168,0.25)',
    activeBorder: '#60A5FA',
    nome: 'SRS M Factoring',
    tipo: 'Financeiro',
    logo: '/logos/factoring.png',
  },
}

const BADGE_ROUTES_FACTORING: Record<string, 'inadimplentes' | 'vencendoHoje'> = {
  '/factoring/parcelas/inadimplentes': 'inadimplentes',
  '/factoring/parcelas/pagamento': 'vencendoHoje',
}

export function Sidebar({
  empresa,
  menu,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname()
  const cfg = EMPRESA_CONFIG[empresa]
  const shouldReduceMotion = useReducedMotion()
  const { perfil, user } = useAuth()
  const { empresaAtual } = useEmpresa()
  const counts = useFactoringCounts(empresa === 'factoring')
  const logoSrc = empresaAtual?.logo_url ?? cfg.logo

  const defaultOpen = menu
    .filter(item => item.subitems && item.subitems.length > 0)
    .map(item => item.label)

  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpen)

  function toggleGroup(label: string) {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label],
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
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
      }
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{ backgroundColor: cfg.bg }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center border-b border-white/10 shrink-0',
          collapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-5',
        )}
        style={{ backgroundColor: cfg.bgSecondary }}
      >
        <div className={cn('flex items-center gap-3 min-w-0', collapsed && 'justify-center')}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white flex items-center justify-center p-0.5">
            <Image
              src={logoSrc}
              alt={cfg.nome}
              width={40}
              height={40}
              className="object-contain w-full h-full"
              unoptimized
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{cfg.nome}</p>
              <span
                className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 leading-none"
                style={{ backgroundColor: `${cfg.primary}25`, color: cfg.primary }}
              >
                {cfg.tipo}
              </span>
            </div>
          )}
        </div>
        {!collapsed && onClose && (
          <button
            onClick={onClose}
            className="lg:hidden ml-2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className={cn('flex-1 overflow-y-auto py-3 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        {menu.map(item => {
          if (item.subitems && item.subitems.length > 0) {
            const hasActive = item.subitems.some(s => isActive(s.href))

            /* ── Collapsed: ícone + submenu flutuante no hover ── */
            if (collapsed) {
              return (
                <div key={item.label} className="relative group/nav">
                  <button
                    title={item.label}
                    className={cn(
                      'w-full flex items-center justify-center h-10 rounded-lg transition-colors',
                      hasActive
                        ? 'text-white'
                        : 'text-white/55 hover:text-white hover:bg-white/5',
                    )}
                    style={hasActive ? { backgroundColor: cfg.activeItemBg } : {}}
                  >
                    <span style={{ color: hasActive ? cfg.primary : 'inherit' }}>
                      {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                    </span>
                  </button>

                  {/* Submenu flutuante */}
                  <div className="absolute left-full top-0 ml-2 z-50 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-150 pointer-events-none group-hover/nav:pointer-events-auto">
                    <div
                      className="rounded-xl shadow-2xl border border-white/10 min-w-[190px] py-2 overflow-hidden"
                      style={{ backgroundColor: cfg.bgSecondary }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2 border-b border-white/10 mb-1"
                        style={{ color: cfg.primary }}
                      >
                        {item.label}
                      </p>
                      {item.subitems.map(sub => {
                        const active = isActive(sub.href)
                        const badgeKey = BADGE_ROUTES_FACTORING[sub.href]
                        const badgeCount = badgeKey ? counts[badgeKey] : 0
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 mx-1 rounded-lg text-sm transition-colors',
                              active
                                ? 'font-semibold'
                                : 'text-white/55 hover:text-white hover:bg-white/8',
                            )}
                            style={
                              active
                                ? { color: cfg.primary, backgroundColor: cfg.activeItemBg }
                                : {}
                            }
                          >
                            {ICON_MAP[sub.icon] && (
                              <span className="opacity-70 shrink-0">{ICON_MAP[sub.icon]}</span>
                            )}
                            <span className="flex-1">{sub.label}</span>
                            {badgeCount > 0 && (
                              <span
                                className="shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
                                style={{
                                  backgroundColor:
                                    badgeKey === 'inadimplentes' ? '#ef4444' : '#d97706',
                                }}
                              >
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            /* ── Expanded: accordion ── */
            const isOpen = openGroups.includes(item.label)

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    hasActive ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/5',
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
                  {empresa === 'factoring' &&
                    item.href === '/factoring/parcelas' &&
                    counts.inadimplentes > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 mr-1">
                        {counts.inadimplentes > 99 ? '99+' : counts.inadimplentes}
                      </span>
                    )}
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
                                  : 'text-white/45 hover:text-white hover:bg-white/5',
                              )}
                              style={active ? { color: cfg.primary } : {}}
                            >
                              {ICON_MAP[sub.icon] && (
                                <span className="opacity-70 shrink-0">{ICON_MAP[sub.icon]}</span>
                              )}
                              <span className="flex-1">{sub.label}</span>
                              {empresa === 'factoring' &&
                                BADGE_ROUTES_FACTORING[sub.href] &&
                                (() => {
                                  const key = BADGE_ROUTES_FACTORING[sub.href]
                                  const n = counts[key]
                                  if (!n) return null
                                  return (
                                    <span
                                      className="shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
                                      style={{
                                        backgroundColor:
                                          key === 'inadimplentes' ? '#ef4444' : '#d97706',
                                      }}
                                    >
                                      {n > 99 ? '99+' : n}
                                    </span>
                                  )
                                })()}
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

          /* ── Item sem subitems ── */
          const active = isActive(item.href ?? '/')

          if (collapsed) {
            return (
              <Link
                key={item.href}
                href={item.href ?? '/'}
                onClick={onClose}
                title={item.label}
                className={cn(
                  'flex items-center justify-center h-10 rounded-lg text-sm transition-colors border-l-2',
                  active
                    ? 'text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent',
                )}
                style={
                  active
                    ? { backgroundColor: cfg.activeItemBg, borderLeftColor: cfg.activeBorder }
                    : { borderColor: 'transparent' }
                }
              >
                <span className="shrink-0" style={{ color: active ? cfg.primary : 'inherit' }}>
                  {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href ?? '/'}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2',
                active
                  ? 'text-white font-semibold'
                  : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent',
              )}
              style={
                active
                  ? { backgroundColor: cfg.activeItemBg, borderLeftColor: cfg.activeBorder }
                  : { borderColor: 'transparent' }
              }
            >
              <span className="shrink-0" style={{ color: active ? cfg.primary : 'inherit' }}>
                {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className={cn('border-t border-white/10 shrink-0', collapsed ? 'px-2 py-3' : 'px-3 py-3')}
        style={{ backgroundColor: cfg.bgSecondary }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default select-none"
              title={userName}
              style={{ backgroundColor: `${cfg.primary}30`, color: cfg.primary }}
            >
              {userInitials}
            </div>
            {onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10 transition-colors"
                title="Expandir menu"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
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
              {onToggleCollapsed && (
                <button
                  onClick={onToggleCollapsed}
                  className="p-1 rounded-lg text-white/35 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="Recolher menu"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
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
        )}
      </div>
    </motion.aside>
  )
}
