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
        'bg-card rounded-2xl border border-border/50 transition-shadow duration-200 hover:shadow-m3-2',
        noBorder && 'border-0 shadow-none hover:shadow-none',
        className,
      )}
      style={noBorder ? undefined : { boxShadow: 'var(--shadow-m3-1)' }}
    >
      {(titulo || acoes) && (
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border/50">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-[15px] font-bold text-foreground leading-snug tracking-tight">
                {titulo}
              </h2>
            )}
            {descricao && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{descricao}</p>
            )}
          </div>
          {acoes && (
            <div className="flex items-center gap-2 shrink-0">{acoes}</div>
          )}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  )
}
