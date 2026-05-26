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
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6',
        'border-b border-border/40',
        className,
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        {Icone && (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-m3-1"
            style={{ backgroundColor: corIcone, color: '#FFFFFF' }}
          >
            <Icone size={20} color="#FFFFFF" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight truncate">
            {titulo}
          </h1>
          {descricao && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {descricao}
            </p>
          )}
        </div>
      </div>
      {acoes && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{acoes}</div>
      )}
    </div>
  )
}
