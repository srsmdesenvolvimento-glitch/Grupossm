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
}

export function StatCard({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  tendencia,
  corIcone = '#3B82F6',
  corFundo = '#EFF6FF',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">{titulo}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{valor}</p>
          {subtitulo && (
            <p className="text-xs text-slate-400 mt-1">{subtitulo}</p>
          )}
          {tendencia && (
            <p className={cn(
              'text-xs mt-2 font-medium',
              tendencia.positivo ? 'text-green-600' : 'text-red-600'
            )}>
              {tendencia.positivo ? '↑' : '↓'} {tendencia.valor}
            </p>
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
