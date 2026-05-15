import { cn } from '@/lib/utils'
import { formatarMoeda as formatMoeda } from '@/lib/utils/formatters'

interface MoneyDisplayProps {
  valor: number
  className?: string
  positivo?: boolean
  negativo?: boolean
  tamanho?: 'sm' | 'md' | 'lg'
}

export function MoneyDisplay({ valor, className, positivo, negativo, tamanho = 'md' }: MoneyDisplayProps) {
  const tamanhos = { sm: 'text-sm', md: 'text-base', lg: 'text-xl font-bold' }

  return (
    <span className={cn(
      'font-mono tabular-nums',
      tamanhos[tamanho],
      positivo && 'text-green-600',
      negativo && 'text-red-600',
      !positivo && !negativo && 'text-slate-800',
      className
    )}>
      {formatMoeda(valor)}
    </span>
  )
}
