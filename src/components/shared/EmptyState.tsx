'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icone: LucideIcon
  titulo: string
  descricao?: string
  acao?: { label: string; onClick: () => void; icone?: LucideIcon }
  acaoSecundaria?: { label: string; onClick: () => void }
}

export function EmptyState({ icone: Icone, titulo, descricao, acao, acaoSecundaria }: EmptyStateProps) {
  const shouldReduce = useReducedMotion()

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-md mx-auto"
      initial={shouldReduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative mb-8 flex items-center justify-center w-24 h-24">
        {/* Soft, modern glowing rings */}
        <div className="absolute inset-0 rounded-full bg-[var(--gt-blue-light)] opacity-20 scale-[1.3] animate-pulse-ring" />
        <div
          className="absolute inset-0 rounded-full bg-[var(--gt-blue-light)] opacity-10 scale-[1.6] animate-pulse-ring"
          style={{ animationDelay: '1.2s' }}
        />

        {/* Icon container with modern gradient and M3 shadow */}
        <motion.div
          className="relative w-18 h-18 rounded-2xl bg-gradient-to-tr from-card to-background border border-border/60 flex items-center justify-center shadow-m3-2"
          animate={shouldReduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icone size={30} className="text-[var(--gt-blue)] opacity-80" />
        </motion.div>
      </div>

      <motion.h3
        className="text-base font-bold text-foreground tracking-tight"
        initial={shouldReduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {titulo}
      </motion.h3>

      {descricao && (
        <motion.p
          className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed"
          initial={shouldReduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          {descricao}
        </motion.p>
      )}

      {(acao || acaoSecundaria) && (
        <motion.div
          className="flex items-center gap-3 mt-8"
          initial={shouldReduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {acaoSecundaria && (
            <Button 
              variant="outline" 
              size="default" 
              onClick={acaoSecundaria.onClick}
              className="h-10 rounded-full px-5 border-border hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              {acaoSecundaria.label}
            </Button>
          )}
          {acao && (
            <Button 
              size="default" 
              onClick={acao.onClick} 
              className="h-10 gap-2 bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] text-white font-medium rounded-full px-5 shadow-m3-1 hover:shadow-m3-2 border-0 transition-all duration-200"
            >
              {acao.icone && <acao.icone size={15} />}
              {acao.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
