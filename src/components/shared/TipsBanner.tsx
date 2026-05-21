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
      icon: <Search size={16} className="text-blue-500" />,
      texto: 'Pressione',
      destaque: 'Ctrl + K',
      resto: 'para buscar clientes, contratos ou navegar rapidamente',
    },
    {
      icon: <Bell size={16} className="text-yellow-500" />,
      texto: 'O sino no canto superior mostra',
      destaque: 'alertas automáticos',
      resto: 'de vencimentos e estoque baixo',
    },
    {
      icon: <HelpCircle size={16} className="text-green-500" />,
      texto: 'Clique no ícone',
      destaque: '?',
      resto: 'em qualquer tela para ver um guia passo a passo',
    },
  ]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative mb-4 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Zap size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-2">Dicas rápidas do sistema</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                    <span className="shrink-0 mt-0.5">{tip.icon}</span>
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
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Fechar dicas"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
