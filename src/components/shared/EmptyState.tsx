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
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icone size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{titulo}</h3>
      {descricao && <p className="text-sm text-slate-400 max-w-xs mb-6">{descricao}</p>}
      {acao && (
        <Button onClick={acao.onClick} size="sm">
          {acao.label}
        </Button>
      )}
    </div>
  )
}
