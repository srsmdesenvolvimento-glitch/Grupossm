import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  ativo: 'bg-blue-100 text-blue-800 border-blue-200',
  quitado: 'bg-green-100 text-green-800 border-green-200',
  inadimplente: 'bg-red-100 text-red-800 border-red-200',
  atrasado: 'bg-red-100 text-red-800 border-red-200',
  cancelado: 'bg-gray-100 text-gray-600 border-gray-200',
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pago: 'bg-green-100 text-green-800 border-green-200',
  vencido: 'bg-red-100 text-red-800 border-red-200',
  parcial: 'bg-orange-100 text-orange-800 border-orange-200',
  renegociado: 'bg-purple-100 text-purple-800 border-purple-200',
  confirmada: 'bg-green-100 text-green-800 border-green-200',
  entregue: 'bg-blue-100 text-blue-800 border-blue-200',
  sem_estoque: 'bg-red-100 text-red-800 border-red-200',
  inativo: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', quitado: 'Quitado', inadimplente: 'Inadimplente',
  atrasado: 'Atrasado', cancelado: 'Cancelado', pendente: 'Pendente',
  pago: 'Pago', vencido: 'Vencido', parcial: 'Parcial',
  renegociado: 'Renegociado', confirmada: 'Confirmada',
  entregue: 'Entregue', sem_estoque: 'Sem Estoque', inativo: 'Inativo',
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600', className)}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
