'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MENU_EMPORIO, MENU_FACTORING } from '@/lib/constants/menus'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { TipoEmpresa } from '@/lib/types/database'

interface AppShellProps {
  children: React.ReactNode
  empresa?: TipoEmpresa
  titulo: string
}

export function AppShell({ children, empresa: empresaProp, titulo }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { empresaAtual } = useEmpresa()
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()

  const tipo: TipoEmpresa = empresaProp ?? empresaAtual?.tipo ?? 'emporio'
  const menu = tipo === 'emporio' ? MENU_EMPORIO : MENU_FACTORING

  const pageVariants = {
    initial: shouldReduceMotion ? {} : { opacity: 0, y: 10 },
    animate: shouldReduceMotion ? {} : { opacity: 1, y: 0 },
    exit:    shouldReduceMotion ? {} : { opacity: 0, y: -6 },
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="mobile-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
          >
            <Sidebar empresa={tipo} menu={menu} onClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar empresa={tipo} menu={menu} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header empresa={tipo} titulo={titulo} onMenuClick={() => setSidebarOpen(true)} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 overflow-y-auto p-4 lg:p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}
