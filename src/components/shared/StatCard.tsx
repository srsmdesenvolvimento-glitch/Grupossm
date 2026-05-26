import { cn } from '@/lib/utils'
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

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
  ativo?: boolean
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
  ativo,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative bg-card rounded-2xl border p-5 transition-all duration-200 overflow-hidden',
        onClick && 'cursor-pointer select-none',
        ativo
          ? 'border-2 shadow-md'
          : 'border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]',
        onClick && !ativo &&
          'hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-border hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm',
      )}
      style={ativo ? { borderColor: corIcone } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => { if (e.key === 'Enter' || e.key === ' ') onClick() }
          : undefined
      }
    >
      {/* Overlay sutil quando ativo */}
      {ativo && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: corIcone, opacity: 0.04 }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {titulo}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1.5 leading-none tabular-nums">
            {valor}
          </p>
          {subtitulo && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{subtitulo}</p>
          )}
          {tendencia && (
            <div
              className={cn(
                'inline-flex items-center gap-1 mt-2.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
                tendencia.positivo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
              )}
            >
              {tendencia.positivo ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {tendencia.valor}
            </div>
          )}
          {atalho && onClick && (
            <p className="text-[10px] text-muted-foreground/40 mt-2 font-mono tracking-wide">
              {atalho}
            </p>
          )}
        </div>

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: corFundo }}
        >
          <Icone size={20} style={{ color: corIcone }} />
        </div>
      </div>
    </div>
  )
}
