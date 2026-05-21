'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Tooltip>
      <TooltipTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Alternar tema claro/escuro"
      >
        <Sun size={18} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon size={18} className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Tema claro / escuro</p>
      </TooltipContent>
    </Tooltip>
  )
}
