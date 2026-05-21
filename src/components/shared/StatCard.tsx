import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  titulo: string
  valor: string | number
  subtitulo?: string
  icone: LucideIcon
  tendencia?: { valor: string; positivo: boolean }
  corIcone?: string
  corFundo?: string
  onClick?: () => void
  atalho?: string
}

export function StatCard({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  tendencia,
  corIcone = '#3B82F6',
  corFundo = '#EFF6FF',
  onClick,
  atalho,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all',
        onClick && 'cursor-pointer hover:border-muted-foreground/20 active:scale-[0.99]'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{titulo}</p>
          <p className="text-2xl font-bold text-card-foreground mt-1">{valor}</p>
          {subtitulo && (
            <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>
          )}
          {tendencia && (
            <p className={cn(
              'text-xs mt-2 font-medium',
              tendencia.positivo ? 'text-green-600' : 'text-red-600'
            )}>
              {tendencia.positivo ? '↑' : '↓'} {tendencia.valor}
            </p>
          )}
          {atalho && onClick && (
            <p className="text-xs text-muted-foreground/70 mt-2 font-medium">{atalho}</p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: corFundo }}
        >
          <Icone size={22} style={{ color: corIcone }} />
        </div>
      </div>
    </div>
  )
}
