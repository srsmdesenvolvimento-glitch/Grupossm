'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { type LucideIcon, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'

interface StatCardProps {
  titulo: string
  valor: string | number
  subtitulo?: string
  icone: LucideIcon
  tendencia?: { valor: string; positivo: boolean }
  corIcone?: string
  corFundo?: string
  onClick?: () => void
  atalho?: string
  ativo?: boolean
  delay?: number
}

export function StatCard({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  tendencia,
  corIcone = '#3B82F6',
  corFundo = '#EFF6FF',
  onClick,
  atalho,
  ativo,
  delay = 0,
}: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const shouldReduce = useReducedMotion()

  const isInteractive = !!onClick

  return (
    <motion.div
      ref={ref}
      initial={shouldReduce ? false : { opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={isInteractive && !shouldReduce ? { y: -2, boxShadow: 'var(--shadow-m3-2)' } : undefined}
      whileTap={isInteractive && !shouldReduce ? { scale: 0.98 } : undefined}
      className={cn(
        'relative bg-card rounded-2xl overflow-hidden group',
        isInteractive && 'cursor-pointer select-none',
        ativo
          ? 'border-2 ring-2'
          : 'border border-border/50',
      )}
      style={{
        boxShadow: ativo
          ? `0 0 0 3px ${corIcone}25, var(--shadow-m3-2)`
          : 'var(--shadow-m3-1)',
        borderColor: ativo ? corIcone : undefined,
      }}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? e => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }
          : undefined
      }
    >
      {/* Top accent bar */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: corIcone }}
      />

      {/* Ambient glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at top left, ${corIcone}0A 0%, transparent 65%)`,
          opacity: ativo ? 1 : 0,
        }}
      />
      {isInteractive && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: `radial-gradient(ellipse at top left, ${corIcone}08 0%, transparent 65%)`,
          }}
        />
      )}

      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {titulo}
          </p>

          <motion.p
            className="text-[1.75rem] font-bold text-foreground mt-2 leading-none tabular-nums tracking-tight"
            initial={shouldReduce ? false : { opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
            transition={{ duration: 0.45, delay: delay + 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {valor}
          </motion.p>

          {subtitulo && (
            <p className="text-xs text-muted-foreground mt-2 leading-snug">{subtitulo}</p>
          )}

          {tendencia && (
            <div
              className={cn(
                'inline-flex items-center gap-1 mt-3 text-[11px] font-semibold px-2.5 py-1 rounded-full',
                tendencia.positivo
                  ? 'text-[var(--gt-green)] dark:text-[var(--gt-green)]'
                  : 'text-[var(--gt-red)] dark:text-[var(--gt-red)]',
              )}
              style={{
                backgroundColor: tendencia.positivo
                  ? 'var(--gt-green-light)'
                  : 'var(--gt-red-light)',
              }}
            >
              {tendencia.positivo ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {tendencia.valor}
            </div>
          )}

          {atalho && isInteractive && (
            <p className="text-[10px] text-muted-foreground/40 mt-2.5 font-mono tracking-wide flex items-center gap-0.5">
              {atalho}
              {!ativo && (
                <ChevronRight
                  size={10}
                  className="opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200"
                />
              )}
            </p>
          )}
        </div>

        <motion.div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
          style={{ backgroundColor: corFundo }}
          whileHover={isInteractive && !shouldReduce ? { scale: 1.1 } : undefined}
        >
          <Icone size={22} style={{ color: corIcone }} />
        </motion.div>
      </div>
    </motion.div>
  )
}
