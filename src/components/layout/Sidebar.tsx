'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard, Users, Package, ShoppingCart, Banknote, BarChart3,
  Settings, History, FileText, ChevronLeft, ChevronRight, X, Building2,
  Wallet, Globe, TrendingUp, TrendingDown, Calculator, CalendarDays,
  CheckCircle, AlertTriangle, AlertCircle, Tag, Boxes, List, Plus,
  MessageCircle, Armchair, UserCog, CreditCard, ShieldCheck, Link as LinkIcon,
  LineChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useFactoringCounts } from '@/hooks/useFactoringCounts'
import type { TipoEmpresa } from '@/lib/types/database'
import type { MenuItem } from '@/lib/constants/menus'
import { MENU_ADMIN } from '@/lib/constants/menus'

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={16} />,
  Users: <Users size={16} />,
  Package: <Package size={16} />,
  ShoppingCart: <ShoppingCart size={16} />,
  Banknote: <Banknote size={16} />,
  BarChart3: <BarChart3 size={16} />,
  LineChart: <LineChart size={16} />,
  Settings: <Settings size={16} />,
  History: <History size={16} />,
  FileText: <FileText size={16} />,
  Wallet: <Wallet size={16} />,
  Globe: <Globe size={16} />,
  TrendingUp: <TrendingUp size={16} />,
  TrendingDown: <TrendingDown size={16} />,
  Calculator: <Calculator size={16} />,
  CalendarDays: <CalendarDays size={16} />,
  CheckCircle: <CheckCircle size={16} />,
  AlertTriangle: <AlertTriangle size={16} />,
  AlertCircle: <AlertCircle size={16} />,
  Tag: <Tag size={16} />,
  Boxes: <Boxes size={16} />,
  List: <List size={16} />,
  Plus: <Plus size={16} />,
  MessageCircle: <MessageCircle size={16} />,
  Armchair: <Armchair size={16} />,
  UserCog: <UserCog size={16} />,
  CreditCard: <CreditCard size={16} />,
  ShieldCheck: <ShieldCheck size={16} />,
  Link: <LinkIcon size={16} />,
}

const BADGE_ROUTES: Record<string, 'inadimplentes' | 'vencendoHoje'> = {
  '/factoring/parcelas/inadimplentes': 'inadimplentes',
  '/factoring/parcelas/pagamento': 'vencendoHoje',
}

const EMPRESA_CONFIG = {
  emporio: {
    bg: '#1A1A2E',
    bgSecondary: '#16162A',
    primary: '#D4A528',
    activeItemBg: 'rgba(212,165,40,0.10)',
    nome: 'Empório dos Móveis',
    logo: '/logos/emporio.png',
  },
  factoring: {
    bg: '#07101E',
    bgSecondary: '#040B16',
    primary: '#8AB4F8',
    activeItemBg: 'rgba(138,180,248,0.10)',
    nome: 'SRS M Factoring',
    logo: '/logos/factoring.png',
  },
} as const

type EmpresaConfig = (typeof EMPRESA_CONFIG)[TipoEmpresa]

// ─── Nav context ──────────────────────────────────────────────────────────────

interface NavCtx {
  cfg: EmpresaConfig
  collapsed: boolean
  isActive: (href: string) => boolean
  onClose?: () => void
  badges: Record<string, number>
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ count, type }: { count: number; type: 'inadimplentes' | 'vencendoHoje' }) {
  if (!count) return null
  return (
    <span
      className="shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-semibold flex items-center justify-center px-1"
      style={{ backgroundColor: type === 'inadimplentes' ? '#ef4444' : '#d97706' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ─── NavItem — single flat item (leaf or subitem, same visual level) ──────────

interface NavItemProps {
  href: string
  label: string
  icon?: React.ReactNode
  badgeKey?: 'inadimplentes' | 'vencendoHoje'
  ctx: NavCtx
  dim?: boolean
}

function NavItem({ href, label, icon, badgeKey, ctx, dim = false }: NavItemProps) {
  const { cfg, collapsed, isActive, onClose, badges } = ctx
  const active = isActive(href)

  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClose}
        title={label}
        className={cn(
          'flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-all duration-150',
          active ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]',
        )}
        style={active ? { backgroundColor: cfg.activeItemBg } : {}}
      >
        <span style={{ color: active ? cfg.primary : 'inherit' }}>{icon}</span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-all duration-150 relative cursor-pointer',
        active
          ? 'text-white font-medium'
          : dim
            ? 'text-white/38 hover:text-white/70 hover:bg-white/[0.04]'
            : 'text-white/55 hover:text-white/85 hover:bg-white/[0.05]',
      )}
      style={active ? { backgroundColor: cfg.activeItemBg } : {}}
    >
      {active && (
        <span
          className="absolute left-0 inset-y-[5px] w-[3px] rounded-r-full"
          style={{ backgroundColor: cfg.primary }}
        />
      )}
      {icon && (
        <span
          className="shrink-0 transition-colors duration-150"
          style={{ color: active ? cfg.primary : undefined }}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate leading-snug">{label}</span>
      {badgeKey && <Badge count={badges[badgeKey] ?? 0} type={badgeKey} />}
    </Link>
  )
}

// ─── SectionLabel — group header (replaces accordion button) ──────────────────

function SectionLabel({
  label,
  badgeCount,
  cfg,
  first = false,
}: {
  label: string
  badgeCount?: number
  cfg: EmpresaConfig
  first?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3 pb-1', first ? 'pt-1' : 'pt-4')}>
      <span
        className="flex-1 text-[10px] font-semibold uppercase tracking-[0.1em] truncate"
        style={{ color: `${cfg.primary}55` }}
      >
        {label}
      </span>
      {!!badgeCount && badgeCount > 0 && (
        <Badge count={badgeCount} type="inadimplentes" />
      )}
    </div>
  )
}

// ─── CollapsedFlyout — group popup in collapsed mode ─────────────────────────

function CollapsedFlyout({ item, ctx }: { item: MenuItem; ctx: NavCtx }) {
  const { cfg, isActive, onClose, badges } = ctx
  const hasActive = item.subitems!.some(s => isActive(s.href))
  const icon = ICON_MAP[item.icon] ?? <LayoutDashboard size={16} />

  return (
    <div className="relative group/fly">
      <button
        title={item.label}
        className={cn(
          'flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-all duration-150 cursor-pointer',
          hasActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]',
        )}
        style={hasActive ? { backgroundColor: cfg.activeItemBg } : {}}
      >
        <span style={{ color: hasActive ? cfg.primary : 'inherit' }}>{icon}</span>
      </button>

      {/* flyout */}
      <div className="absolute left-full top-0 ml-2 z-50 opacity-0 invisible group-hover/fly:opacity-100 group-hover/fly:visible transition-all duration-150 pointer-events-none group-hover/fly:pointer-events-auto">
        <div
          className="rounded-xl min-w-[192px] py-2 overflow-hidden"
          style={{
            backgroundColor: cfg.bgSecondary,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3.5 py-1.5 border-b border-white/[0.05] mb-1.5"
            style={{ color: cfg.primary }}
          >
            {item.label}
          </p>
          {item.subitems!.map(sub => {
            const active = isActive(sub.href)
            const badgeKey = BADGE_ROUTES[sub.href]
            return (
              <Link
                key={sub.href}
                href={sub.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2 mx-1 rounded-lg text-[13px] transition-all duration-150 cursor-pointer',
                  active ? 'font-medium' : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                )}
                style={active ? { color: cfg.primary, backgroundColor: cfg.activeItemBg } : {}}
              >
                {ICON_MAP[sub.icon] && (
                  <span className="shrink-0 opacity-70">{ICON_MAP[sub.icon]}</span>
                )}
                <span className="flex-1 truncate">{sub.label}</span>
                {badgeKey && <Badge count={badges[badgeKey] ?? 0} type={badgeKey} />}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── NavGroup — section label + flat items ────────────────────────────────────

function NavGroup({ item, ctx, first = false }: { item: MenuItem; ctx: NavCtx; first?: boolean }) {
  const { cfg, collapsed, badges } = ctx
  const subitems = item.subitems!

  if (collapsed) return <CollapsedFlyout item={item} ctx={ctx} />

  const hasInadimplente = subitems.some(s => BADGE_ROUTES[s.href] === 'inadimplentes')
  const groupBadge = hasInadimplente ? (badges['inadimplentes'] ?? 0) : 0

  return (
    <div>
      <SectionLabel label={item.label} badgeCount={groupBadge} cfg={cfg} first={first} />
      {subitems.map(sub => (
        <NavItem
          key={sub.href}
          href={sub.href}
          label={sub.label}
          icon={ICON_MAP[sub.icon]}
          badgeKey={BADGE_ROUTES[sub.href]}
          ctx={ctx}
          dim
        />
      ))}
    </div>
  )
}

// ─── NavSection — renders a list of menu items ────────────────────────────────

function NavSection({ items, ctx }: { items: MenuItem[]; ctx: NavCtx }) {
  return (
    <>
      {items.map((item, i) =>
        item.subitems?.length ? (
          <NavGroup key={item.label} item={item} ctx={ctx} first={i === 0} />
        ) : (
          <NavItem
            key={item.href ?? item.label}
            href={item.href ?? '/'}
            label={item.label}
            icon={ICON_MAP[item.icon]}
            ctx={ctx}
          />
        ),
      )}
    </>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  empresa: TipoEmpresa
  menu: MenuItem[]
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function Sidebar({ empresa, menu, onClose, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const cfg = EMPRESA_CONFIG[empresa]
  const shouldReduceMotion = useReducedMotion()
  const { perfil, user } = useAuth()
  const { empresaAtual } = useEmpresa()
  const counts = useFactoringCounts(empresa === 'factoring')
  const isFactoring = empresa === 'factoring'

  const logoSrc = empresaAtual?.logo_url ?? cfg.logo
  const displayLogoSrc = collapsed && isFactoring ? '/logos/factoring_emblem.png' : logoSrc

  function isActive(href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
  }

  const userName = perfil?.nome ?? user?.email ?? 'Usuário'
  const userRole = isFactoring ? 'SRS M Factoring' : 'Empório dos Móveis'
  const userInitials = userName
    .trim()
    .split(/\s+/)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const navCtx: NavCtx = {
    cfg,
    collapsed,
    isActive,
    onClose,
    badges: {
      inadimplentes: counts.inadimplentes,
      vencendoHoje: counts.vencendoHoje,
    },
  }

  const px = collapsed ? 'px-2' : 'px-3'

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 248 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{ backgroundColor: cfg.bg }}
    >
      {/* ── Brand ── */}
      <div
        className={cn(
          'flex items-center shrink-0',
          collapsed ? 'justify-center px-2 py-4' : 'px-4 py-4',
        )}
        style={{
          backgroundColor: cfg.bgSecondary,
          borderBottom: `1px solid ${cfg.primary}10`,
        }}
      >
        {collapsed ? (
          <div
            className="w-9 h-9 rounded-xl overflow-hidden bg-white/5 border border-white/8 flex items-center justify-center p-1 transition-transform duration-200 hover:scale-105"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <Image
              src={displayLogoSrc}
              alt={cfg.nome}
              width={32}
              height={32}
              className="object-contain w-full h-full select-none"
              unoptimized
              priority
            />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="relative flex items-center h-12 w-[168px] overflow-hidden">
              <Image
                src={displayLogoSrc}
                alt={cfg.nome}
                width={168}
                height={48}
                className={cn(
                  'object-contain w-full h-full select-none transition-transform duration-200',
                  isFactoring ? 'scale-100 hover:scale-[1.02]' : 'scale-[1.15] origin-left hover:scale-[1.2]',
                )}
                unoptimized
                priority
              />
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all duration-150 shrink-0 cursor-pointer"
                aria-label="Fechar menu"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav className={cn('flex-1 overflow-y-auto scrollbar-none py-2', px)}>
        <NavSection items={menu} ctx={navCtx} />
      </nav>

      {/* ── Admin divider ── */}
      {collapsed ? (
        <div className="px-3 py-2">
          <div
            className="h-px w-full"
            style={{ background: `linear-gradient(to right, transparent, ${cfg.primary}20, transparent)` }}
          />
        </div>
      ) : (
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${cfg.primary}18, transparent)` }} />
          <span
            className="text-[9px] font-bold uppercase tracking-[0.18em] shrink-0"
            style={{ color: `${cfg.primary}45` }}
          >
            Admin
          </span>
          <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${cfg.primary}18, transparent)` }} />
        </div>
      )}

      {/* ── Admin nav ── */}
      <nav className={cn('pb-2', px)}>
        <NavSection items={MENU_ADMIN} ctx={navCtx} />
      </nav>

      {/* ── Footer ── */}
      <div
        className={cn('shrink-0', collapsed ? 'px-1.5 py-3' : 'px-3 pt-2.5 pb-3')}
        style={{
          backgroundColor: cfg.bgSecondary,
          borderTop: `1px solid ${cfg.primary}08`,
        }}
      >
        {collapsed ? (
          /* collapsed: avatar + toggle stacked */
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold select-none"
              title={userName}
              style={{
                background: `linear-gradient(135deg, ${cfg.primary}35, ${cfg.primary}18)`,
                color: cfg.primary,
                boxShadow: `0 0 0 1.5px ${cfg.primary}30`,
              }}
            >
              {userInitials}
            </div>
            {onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/[0.07] transition-all duration-150 cursor-pointer"
                title="Expandir menu"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        ) : (
          /* expanded: 2-row compact footer */
          <div>
            {/* row 1: avatar + name + collapse */}
            <div className="flex items-center gap-2.5 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
                style={{
                  background: `linear-gradient(135deg, ${cfg.primary}38, ${cfg.primary}18)`,
                  color: cfg.primary,
                  boxShadow: `0 0 0 1.5px ${cfg.primary}28`,
                }}
              >
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/85 text-[12px] font-semibold truncate leading-none">{userName}</p>
                <p className="text-white/28 text-[10px] truncate mt-0.5 leading-none">{userRole}</p>
              </div>
              {onToggleCollapsed && (
                <button
                  onClick={onToggleCollapsed}
                  className="p-1 rounded-md text-white/20 hover:text-white/55 hover:bg-white/[0.05] transition-all duration-150 shrink-0 cursor-pointer"
                  title="Recolher menu"
                >
                  <ChevronLeft size={13} />
                </button>
              )}
            </div>

            {/* row 2: trocar empresa + version */}
            <div
              className="flex items-center justify-between mt-2.5 pt-2.5 px-1"
              style={{ borderTop: `1px solid ${cfg.primary}08` }}
            >
              <Link
                href="/selecionar-empresa"
                className="flex items-center gap-1.5 text-white/28 hover:text-white/60 text-[11px] transition-colors duration-150 group cursor-pointer"
              >
                <Building2 size={12} className="shrink-0 group-hover:opacity-100 opacity-70 transition-opacity" />
                <span>Trocar Empresa</span>
              </Link>
              <span
                className="text-[9px] font-medium tracking-widest"
                style={{ color: `${cfg.primary}35` }}
              >
                v1.0.0
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
