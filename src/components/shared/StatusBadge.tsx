import { cn } from '@/lib/utils'

type StatusConfig = { label: string; dot: string; bg: string; text: string; border: string }

const STATUS_CONFIG: Record<string, StatusConfig> = {
  ativo:        { label: 'Ativo',         dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  quitado:      { label: 'Quitado',       dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  inadimplente: { label: 'Inadimplente',  dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  atrasado:     { label: 'Atrasado',      dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  cancelado:    { label: 'Cancelado',     dot: '#9ca3af', bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
  pendente:     { label: 'Pendente',      dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  pago:         { label: 'Pago',          dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  vencido:      { label: 'Vencido',       dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  parcial:      { label: 'Parcial',       dot: '#f97316', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  renegociado:  { label: 'Renegociado',   dot: '#8b5cf6', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  analise:      { label: 'Em Análise',    dot: '#6b7280', bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
  aprovado:     { label: 'Aprovado',      dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  confirmada:   { label: 'Confirmada',    dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  entregue:     { label: 'Entregue',      dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  sem_estoque:  { label: 'Sem Estoque',   dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  inativo:      { label: 'Inativo',       dot: '#9ca3af', bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
  bloqueado:    { label: 'Bloqueado',     dot: '#ef4444', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
}

const FALLBACK: StatusConfig = { label: '', dot: '#9ca3af', bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' }

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK
  const displayLabel = label ?? cfg.label ?? status

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border leading-none whitespace-nowrap',
        className,
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: cfg.dot }}
      />
      {displayLabel}
    </span>
  )
}
