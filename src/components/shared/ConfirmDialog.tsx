'use client'

import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={carregando}>
            {labelCancelar}
          </Button>
          <Button
            variant={variante === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirmar}
            disabled={carregando}
          >
            {carregando ? 'Aguarde...' : labelConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
