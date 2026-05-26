import { cn } from '@/lib/utils'

interface SectionCardProps {
  titulo?: string
  descricao?: string
  acoes?: React.ReactNode
  children: React.ReactNode
  padding?: boolean
  className?: string
  noBorder?: boolean
}

export function SectionCard({
  titulo,
  descricao,
  acoes,
  children,
  padding = true,
  className,
  noBorder = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        noBorder && 'border-0 shadow-none',
        className,
      )}
    >
      {(titulo || acoes) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-sm font-semibold text-foreground leading-snug">{titulo}</h2>
            )}
            {descricao && (
              <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
            )}
          </div>
          {acoes && (
            <div className="flex items-center gap-2 shrink-0">{acoes}</div>
          )}
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  )
}
