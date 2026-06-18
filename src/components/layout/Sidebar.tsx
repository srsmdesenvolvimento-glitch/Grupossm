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
  MessageCircle, Armchair, UserCog, CreditCard, ShieldCheck, Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useFactoringCounts } from '@/hooks/useFactoringCounts'
import type { TipoEmpresa } from '@/lib/types/database'
import type { MenuItem } from '@/lib/constants/menus'
import { MENU_ADMIN } from '@/lib/constants/menus'

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
  UserCog: <UserCog size={18} />,
  CreditCard: <CreditCard size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  Link: <LinkIcon size={18} />,
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
    bg: '#07101E',
    bgSecondary: '#040B16',
    primary: '#8AB4F8',
    activeItemBg: 'rgba(138,180,248,0.12)',
    activeBorder: '#8AB4F8',
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
  const { empresaAtual, role } = useEmpresa()
  const counts = useFactoringCounts(empresa === 'factoring')
  const isAdmin = role === 'admin'
  const logoSrc = empresaAtual?.logo_url ?? cfg.logo
  const isFactoring = empresa === 'factoring'
  const displayLogoSrc = collapsed && isFactoring ? '/logos/factoring_emblem.png' : logoSrc

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
        : { duration: 0.25, ease: [0.2, 0, 0, 1] },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.2, ease: [0.4, 0, 1, 1] },
    },
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.2, 0, 0, 1] }
      }
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{ backgroundColor: cfg.bg }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center border-b border-white/[0.06] shrink-0',
          collapsed ? 'justify-center px-2 py-5' : 'px-5 py-6.5',
        )}
        style={{ backgroundColor: cfg.bgSecondary }}
      >
        {collapsed ? (
          <div
            className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/10 flex items-center justify-center p-1 transition-all duration-300 hover:scale-[1.05] relative"
            style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
          >
            <Image
              src={displayLogoSrc}
              alt={cfg.nome}
              width={36}
              height={36}
              className="object-contain w-full h-full select-none"
              unoptimized
              priority
            />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full relative">
            <div className="relative flex items-center h-14 w-[180px] overflow-hidden pl-1">
              <Image
                src={displayLogoSrc}
                alt={cfg.nome}
                width={180}
                height={50}
                className={cn(
                  "object-contain w-full h-full select-none transition-transform duration-300",
                  isFactoring ? "scale-100 hover:scale-[1.03]" : "scale-[1.2] origin-left hover:scale-[1.25]"
                )}
                unoptimized
                priority
              />
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 shrink-0 z-10"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className={cn('flex-1 overflow-y-auto scrollbar-none py-4 space-y-1', collapsed ? 'px-2' : 'px-3')}>
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
                      'w-full flex items-center justify-center h-10 rounded-xl transition-all duration-200',
                      hasActive
                        ? 'text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                    )}
                    style={hasActive ? { backgroundColor: cfg.activeItemBg, boxShadow: `0 0 12px ${cfg.primary}15` } : {}}
                  >
                    <span style={{ color: hasActive ? cfg.primary : 'inherit' }}>
                      {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                    </span>
                  </button>

                  {/* Submenu flutuante */}
                  <div className="absolute left-full top-0 ml-3 z-50 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-200 pointer-events-none group-hover/nav:pointer-events-auto">
                    <div
                      className="rounded-2xl min-w-[200px] py-2.5 overflow-hidden"
                      style={{
                        backgroundColor: cfg.bgSecondary,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.15em] px-4 py-2 border-b border-white/[0.06] mb-1"
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
                              'flex items-center gap-2.5 px-4 py-2.5 mx-1.5 rounded-xl text-sm transition-all duration-200',
                              active
                                ? 'font-semibold'
                                : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
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
                                className="shrink-0 min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1.5"
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
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative overflow-hidden',
                    hasActive ? 'text-white font-medium' : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                  )}
                  style={hasActive ? { backgroundColor: cfg.activeItemBg, boxShadow: `0 0 12px ${cfg.primary}08` } : {}}
                >
                  {hasActive && (
                    <span 
                      className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full" 
                      style={{ backgroundColor: cfg.primary }} 
                    />
                  )}
                  <span
                    className="shrink-0 transition-colors duration-200"
                    style={{ color: hasActive ? cfg.primary : 'inherit' }}
                  >
                    {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                  </span>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {empresa === 'factoring' &&
                    item.href === '/factoring/parcelas' &&
                    counts.inadimplentes > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5 mr-1">
                        {counts.inadimplentes > 99 ? '99+' : counts.inadimplentes}
                      </span>
                    )}
                  <motion.span
                    animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ChevronDown size={14} className="text-white/30" />
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
                      <div
                        className="ml-4 mt-1 mb-1 space-y-0.5 pl-3.5 border-l"
                        style={{ borderColor: `${cfg.primary}18` }}
                      >
                        {item.subitems.map(sub => {
                          const active = isActive(sub.href)
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={onClose}
                              className={cn(
                                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative overflow-hidden',
                                active
                                  ? 'font-semibold'
                                  : 'text-white/40 hover:text-white/90 hover:bg-white/[0.05]',
                              )}
                              style={active ? { color: cfg.primary, backgroundColor: cfg.activeItemBg } : {}}
                            >
                              {active && (
                                <span 
                                  className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full" 
                                  style={{ backgroundColor: cfg.primary }} 
                                />
                              )}
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
                                      className="shrink-0 min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1.5"
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
                  'flex items-center justify-center h-10 rounded-xl text-sm transition-all duration-200',
                  active
                    ? 'text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                )}
                style={
                  active
                    ? { backgroundColor: cfg.activeItemBg, boxShadow: `0 0 12px ${cfg.primary}15` }
                    : {}
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative overflow-hidden',
                active
                  ? 'text-white font-semibold'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
              )}
              style={
                active
                  ? {
                      backgroundColor: cfg.activeItemBg,
                      boxShadow: `0 0 12px ${cfg.primary}08`,
                    }
                  : {}
              }
            >
              {active && (
                <span 
                  className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full" 
                  style={{ backgroundColor: cfg.primary }} 
                />
              )}
              <span className="shrink-0" style={{ color: active ? cfg.primary : 'inherit' }}>
                {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Admin Section (admins only) ──────────────────────── */}
      {isAdmin && (
        <>
          <div className={cn('px-3 pb-1 pt-3', collapsed ? 'hidden' : '')}>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em] px-2"
              style={{ color: `${cfg.primary}70` }}
            >
              Administração
            </p>
          </div>
          {collapsed && (
            <div className="px-2 py-1">
              <div className="h-px w-full opacity-20" style={{ backgroundColor: cfg.primary }} />
            </div>
          )}
          <nav className={cn('pb-2 space-y-1', collapsed ? 'px-2' : 'px-3')}>
            {MENU_ADMIN.map(item => {
              if (item.subitems && item.subitems.length > 0) {
                const hasActive = item.subitems.some(s => isActive(s.href))
                if (collapsed) {
                  return (
                    <div key={item.label} className="relative group/nav">
                      <button
                        title={item.label}
                        className={cn(
                          'w-full flex items-center justify-center h-10 rounded-xl transition-all duration-200',
                          hasActive ? 'text-white' : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                        )}
                        style={hasActive ? { backgroundColor: cfg.activeItemBg } : {}}
                      >
                        <span style={{ color: hasActive ? cfg.primary : 'inherit' }}>
                          {ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}
                        </span>
                      </button>
                      <div className="absolute left-full top-0 ml-3 z-50 opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-200 pointer-events-none group-hover/nav:pointer-events-auto">
                        <div className="rounded-2xl min-w-[200px] py-2.5 overflow-hidden" style={{ backgroundColor: cfg.bgSecondary, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] px-4 py-2 border-b border-white/[0.06] mb-1" style={{ color: cfg.primary }}>{item.label}</p>
                          {item.subitems.map(sub => {
                            const active = isActive(sub.href)
                            return (
                              <Link key={sub.href} href={sub.href} onClick={onClose} className={cn('flex items-center gap-2.5 px-4 py-2.5 mx-1.5 rounded-xl text-sm transition-all duration-200', active ? 'font-semibold' : 'text-white/50 hover:text-white hover:bg-white/[0.06]')} style={active ? { color: cfg.primary, backgroundColor: cfg.activeItemBg } : {}}>
                                {ICON_MAP[sub.icon] && <span className="opacity-70 shrink-0">{ICON_MAP[sub.icon]}</span>}
                                <span className="flex-1">{sub.label}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                }
                const isOpen = openGroups.includes(item.label)
                return (
                  <div key={item.label}>
                    <button onClick={() => toggleGroup(item.label)} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative overflow-hidden', hasActive ? 'text-white font-medium' : 'text-white/50 hover:text-white hover:bg-white/[0.06]')} style={hasActive ? { backgroundColor: cfg.activeItemBg } : {}}>
                      {hasActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full" style={{ backgroundColor: cfg.primary }} />}
                      <span className="shrink-0" style={{ color: hasActive ? cfg.primary : 'inherit' }}>{ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}</span>
                      <span className="flex-1 text-left font-medium">{item.label}</span>
                      <motion.span animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0"><ChevronDown size={14} className="text-white/30" /></motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div key="submenu-admin" initial="closed" animate="open" exit="closed" variants={submenuVariants} style={{ overflow: 'hidden' }}>
                          <div className="ml-4 mt-1 mb-1 space-y-0.5 pl-3.5 border-l" style={{ borderColor: `${cfg.primary}18` }}>
                            {item.subitems.map(sub => {
                              const active = isActive(sub.href)
                              return (
                                <Link key={sub.href} href={sub.href} onClick={onClose} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 relative overflow-hidden', active ? 'font-semibold' : 'text-white/40 hover:text-white/90 hover:bg-white/[0.05]')} style={active ? { color: cfg.primary, backgroundColor: cfg.activeItemBg } : {}}>
                                  {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full" style={{ backgroundColor: cfg.primary }} />}
                                  {ICON_MAP[sub.icon] && <span className="opacity-70 shrink-0">{ICON_MAP[sub.icon]}</span>}
                                  <span className="flex-1">{sub.label}</span>
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
              if (collapsed) {
                return (
                  <Link key={item.href} href={item.href ?? '/'} onClick={onClose} title={item.label} className={cn('flex items-center justify-center h-10 rounded-xl text-sm transition-all duration-200', active ? 'text-white' : 'text-white/50 hover:text-white hover:bg-white/[0.06]')} style={active ? { backgroundColor: cfg.activeItemBg } : {}}>
                    <span className="shrink-0" style={{ color: active ? cfg.primary : 'inherit' }}>{ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}</span>
                  </Link>
                )
              }
              return (
                <Link key={item.href} href={item.href ?? '/'} onClick={onClose} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative overflow-hidden', active ? 'text-white font-semibold' : 'text-white/50 hover:text-white hover:bg-white/[0.06]')} style={active ? { backgroundColor: cfg.activeItemBg } : {}}>
                  {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full" style={{ backgroundColor: cfg.primary }} />}
                  <span className="shrink-0" style={{ color: active ? cfg.primary : 'inherit' }}>{ICON_MAP[item.icon] ?? <LayoutDashboard size={18} />}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className={cn('border-t border-white/[0.06] shrink-0', collapsed ? 'px-2 py-3' : 'px-3 py-3')}
        style={{ backgroundColor: cfg.bgSecondary }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold cursor-default select-none ring-2"
              title={userName}
              style={{ backgroundColor: `${cfg.primary}25`, color: cfg.primary, boxShadow: `0 0 0 2px ${cfg.primary}20` }}
            >
              {userInitials}
            </div>
            {onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                title="Expandir menu"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-2"
                style={{ backgroundColor: `${cfg.primary}25`, color: cfg.primary, boxShadow: `0 0 0 2px ${cfg.primary}20` }}
              >
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate tracking-[-0.01em]">{userName}</p>
                <p className="text-white/30 text-[10px] truncate mt-0.5">{userRole}</p>
              </div>
              {onToggleCollapsed && (
                <button
                  onClick={onToggleCollapsed}
                  className="p-1.5 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.08] transition-all duration-200 shrink-0"
                  title="Recolher menu"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-1.5">
              <Link
                href="/selecionar-empresa"
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-sm text-white/30 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              >
                <Building2 size={16} />
                <span>Trocar Empresa</span>
              </Link>
            </div>

            <p className="text-white/[0.12] text-[10px] text-center tracking-wide mt-0.5">v1.0.0</p>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
