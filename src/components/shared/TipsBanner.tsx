'use client'

import { useState, useEffect } from 'react'
import { X, Zap, Bell, HelpCircle, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'tips-banner-dismissed.v1'

export function TipsBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(STORAGE_KEY) !== '1') {
      setVisible(true)
    }
  }, [])

  function fechar() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const tips = [
    {
      icon: <Search size={15} className="text-[var(--gt-blue)]" />,
      bg: 'bg-[var(--gt-blue-light)]/40 border-[var(--gt-blue-light)]/60 dark:bg-[var(--gt-blue)]/10 dark:border-[var(--gt-blue)]/20',
      texto: 'Pressione',
      destaque: 'Ctrl + K',
      resto: 'para buscar clientes, contratos ou navegar rapidamente',
    },
    {
      icon: <Bell size={15} className="text-[var(--gt-yellow)]" />,
      bg: 'bg-[var(--gt-yellow-light)]/40 border-[var(--gt-yellow-light)]/60 dark:bg-[var(--gt-yellow)]/10 dark:border-[var(--gt-yellow)]/20',
      texto: 'O sino no canto superior mostra',
      destaque: 'alertas automáticos',
      resto: 'de vencimentos e estoque baixo',
    },
    {
      icon: <HelpCircle size={15} className="text-[var(--gt-green)]" />,
      bg: 'bg-[var(--gt-green-light)]/40 border-[var(--gt-green-light)]/60 dark:bg-[var(--gt-green)]/10 dark:border-[var(--gt-green)]/20',
      texto: 'Clique no ícone',
      destaque: '?',
      resto: 'em qualquer tela para ver um guia passo a passo',
    },
  ]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-6 rounded-2xl border-l-4 border-y border-r border-y-border/40 border-r-border/40 border-l-[var(--gt-blue)] bg-card p-5 shadow-m3-1 overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[var(--gt-blue-light)]/10 blur-xl pointer-events-none" />

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-[var(--gt-blue-light)] flex items-center justify-center shrink-0 mt-0.5 shadow-sm dark:bg-[var(--gt-blue)]/20">
              <Zap size={15} className="text-[var(--gt-blue)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-foreground mb-3 tracking-tight">Dicas rápidas do sistema</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tips.map((tip, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all duration-200 hover:shadow-m3-1 ${tip.bg}`}>
                    <span className="shrink-0 mt-0.5 p-1 rounded-lg bg-card shadow-sm">{tip.icon}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tip.texto}{' '}
                      <span className="font-bold text-foreground">{tip.destaque}</span>
                      {' '}{tip.resto}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={fechar}
              className="shrink-0 p-1.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-200"
              aria-label="Fechar dicas"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
