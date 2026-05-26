import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icone: LucideIcon
  titulo: string
  descricao?: string
  acao?: { label: string; onClick: () => void; icone?: LucideIcon }
  acaoSecundaria?: { label: string; onClick: () => void }
}

export function EmptyState({ icone: Icone, titulo, descricao, acao, acaoSecundaria }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="relative mb-5">
        {/* Anel externo sutil */}
        <div className="absolute inset-0 rounded-2xl border border-border/50 scale-[1.18] opacity-40" />
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Icone size={26} className="text-muted-foreground/50" />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>

      {descricao && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          {descricao}
        </p>
      )}

      {(acao || acaoSecundaria) && (
        <div className="flex items-center gap-2.5 mt-6">
          {acaoSecundaria && (
            <Button variant="outline" size="sm" onClick={acaoSecundaria.onClick}>
              {acaoSecundaria.label}
            </Button>
          )}
          {acao && (
            <Button size="sm" onClick={acao.onClick} className="gap-1.5">
              {acao.icone && <acao.icone size={14} />}
              {acao.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
