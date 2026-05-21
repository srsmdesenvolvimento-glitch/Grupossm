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
        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        aria-label={`Ajuda: ${titulo}`}
        title="Ajuda"
      >
        <HelpCircle size={15} />
      </button>

      <Sheet open={open} onOpenChange={v => { if (!v) fechar() }}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                <HelpCircle size={16} className="text-muted-foreground" />
                {titulo}
              </SheetTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fechar}>
                <X size={14} />
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* O que é */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">O que é</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{oQueE}</p>
            </section>

            {/* Passo a passo */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ListChecks size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Como usar</h3>
              </div>
              <ol className="space-y-2.5">
                {passos.map((passo, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{passo}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Dicas */}
            {dicas && dicas.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-yellow-500" />
                  <h3 className="text-sm font-semibold text-foreground">Dicas</h3>
                </div>
                <ul className="space-y-2">
                  {dicas.map((dica, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span className="leading-relaxed">{dica}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border">
            <Button onClick={fechar} className="w-full" size="sm">
              Entendi, vamos lá!
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
