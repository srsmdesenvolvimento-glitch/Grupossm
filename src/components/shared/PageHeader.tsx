import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
  icone?: LucideIcon
  corIcone?: string
  className?: string
}

export function PageHeader({
  titulo,
  descricao,
  acoes,
  icone: Icone,
  corIcone = '#1E5AA8',
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icone && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `${corIcone}15` }}
          >
            <Icone size={18} style={{ color: corIcone }} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground leading-tight truncate">{titulo}</h1>
          {descricao && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{descricao}</p>
          )}
        </div>
      </div>
      {acoes && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{acoes}</div>
      )}
    </div>
  )
}
