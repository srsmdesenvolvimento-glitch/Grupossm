'use client'

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao?: string
  labelConfirmar?: string
  labelCancelar?: string
  variante?: 'danger' | 'default'
  onConfirmar: () => void | Promise<void>
  carregando?: boolean
}

export function ConfirmDialog({
  open, onOpenChange, titulo, descricao,
  labelConfirmar = 'Confirmar', labelCancelar = 'Cancelar',
  variante = 'default', onConfirmar, carregando,
}: ConfirmDialogProps) {
  const isDanger = variante === 'danger'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-6 border border-border/50 shadow-m3-3 bg-card gap-5">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight leading-snug">
            {titulo}
          </DialogTitle>
          {descricao && (
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {descricao}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-row items-center justify-end gap-2.5 sm:gap-2.5">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={carregando}
            className="h-10 rounded-full border-border hover:bg-muted text-sm font-medium px-5 flex-1 sm:flex-none"
          >
            {labelCancelar}
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={carregando}
            className={cn(
              "h-10 rounded-full text-sm font-medium px-5 flex-1 sm:flex-none text-white border-0 transition-all duration-200 shadow-m3-1",
              isDanger 
                ? "bg-[var(--gt-red)] hover:bg-[var(--gt-red-hover)] shadow-red-500/10 hover:shadow-red-500/20" 
                : "bg-[var(--gt-blue)] hover:bg-[var(--gt-blue-hover)] shadow-blue-500/10 hover:shadow-blue-500/20"
            )}
          >
            {carregando ? 'Aguarde...' : labelConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
