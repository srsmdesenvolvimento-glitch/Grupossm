import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icone: LucideIcon
  titulo: string
  descricao?: string
  acao?: { label: string; onClick: () => void }
}

export function EmptyState({ icone: Icone, titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icone size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{titulo}</h3>
      {descricao && <p className="text-sm text-muted-foreground max-w-xs mb-6">{descricao}</p>}
      {acao && (
        <Button onClick={acao.onClick}>
          {acao.label}
        </Button>
      )}
    </div>
  )
}
