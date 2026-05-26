'use client'

import { useState, useEffect } from 'react'
import { HelpCircle, X, BookOpen, ListChecks, Lightbulb } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface PageHelpProps {
  storageKey: string
  titulo: string
  oQueE: string
  passos: string[]
  dicas?: string[]
}

export function PageHelp({ storageKey, titulo, oQueE, passos, dicas }: PageHelpProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(storageKey) !== '1') {
      setOpen(true)
    }
  }, [storageKey])

  function fechar() {
    localStorage.setItem(storageKey, '1')
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 border border-border/40 bg-card shadow-sm transition-all duration-200 shrink-0"
        aria-label={`Ajuda: ${titulo}`}
        title="Ajuda"
      >
        <HelpCircle size={15} />
      </button>

      <Sheet open={open} onOpenChange={v => { if (!v) fechar() }}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col gap-0 p-0 border-l border-border/50 shadow-m3-3">
          <SheetHeader className="px-6 py-5 border-b border-border/40 bg-muted/10">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
                <div className="w-8 h-8 rounded-full bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/20 flex items-center justify-center">
                  <HelpCircle size={16} className="text-[var(--gt-blue)]" />
                </div>
                {titulo}
              </SheetTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-muted" 
                onClick={fechar}
                aria-label="Fechar ajuda"
              >
                <X size={15} />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* O que é */}
            <section className="bg-muted/20 dark:bg-card/40 border border-border/40 p-4.5 rounded-2xl">
              <div className="flex items-center gap-2.5 mb-2.5">
                <BookOpen size={16} className="text-[var(--gt-blue)]" />
                <h3 className="text-sm font-bold text-foreground tracking-tight">O que é</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{oQueE}</p>
            </section>

            {/* Passo a passo */}
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <ListChecks size={16} className="text-[var(--gt-green)]" />
                <h3 className="text-sm font-bold text-foreground tracking-tight">Como usar</h3>
              </div>
              <ol className="space-y-3.5 pl-0.5">
                {passos.map((passo, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--gt-blue-light)] dark:bg-[var(--gt-blue)]/20 text-[var(--gt-blue)] text-xs font-bold flex items-center justify-center mt-0.5 shadow-sm">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{passo}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Dicas */}
            {dicas && dicas.length > 0 && (
              <section className="border border-[var(--gt-yellow-light)]/60 bg-[var(--gt-yellow-light)]/20 dark:bg-[var(--gt-yellow)]/5 dark:border-[var(--gt-yellow)]/10 p-4.5 rounded-2xl">
                <div className="flex items-center gap-2.5 mb-3">
                  <Lightbulb size={16} className="text-[var(--gt-yellow)]" />
                  <h3 className="text-sm font-bold text-foreground tracking-tight">Dicas Pro</h3>
                </div>
                <ul className="space-y-2.5 pl-0.5">
                  {dicas.map((dica, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="text-[var(--gt-yellow)] font-bold text-lg leading-none mt-0.5">•</span>
                      <span className="leading-relaxed">{dica}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="px-6 py-4.5 border-t border-border/40 bg-muted/10">
            <Button 
              onClick={fechar} 
              className="w-full h-10 bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] text-white font-medium rounded-full shadow-m3-1 hover:shadow-m3-2 border-0 transition-all duration-200" 
              size="default"
            >
              Entendi, vamos lá!
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
