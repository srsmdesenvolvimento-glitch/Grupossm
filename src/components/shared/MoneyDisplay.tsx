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
  const tamanhos = { 
    sm: 'text-sm font-semibold', 
    md: 'text-base font-bold', 
    lg: 'text-2xl font-black tracking-tight' 
  }

  return (
    <span className={cn(
      'font-mono tabular-nums tracking-tight transition-colors duration-150',
      tamanhos[tamanho],
      positivo && 'text-[var(--gt-green)] dark:text-green-400',
      negativo && 'text-[var(--gt-red)] dark:text-red-400',
      !positivo && !negativo && 'text-foreground/90 dark:text-foreground/95',
      className
    )}>
      {formatMoeda(valor)}
    </span>
  )
}
