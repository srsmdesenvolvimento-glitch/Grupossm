import { cn } from '@/lib/utils'

type StatusConfig = { label: string; dot: string; bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }

const CRITICAL_STATUSES = new Set(['atrasado', 'inadimplente', 'bloqueado'])

const STATUS_CONFIG: Record<string, StatusConfig> = {
  ativo:        { label: 'Ativo',         dot: '#34A853', bg: '#E6F4EA', text: '#137333', border: '#CEEAD6', darkBg: '#1E3B2C', darkText: '#81C995', darkBorder: '#2D5A3F' },
  quitado:      { label: 'Quitado',       dot: '#1A73E8', bg: '#E8F0FE', text: '#1967D2', border: '#D2E3FC', darkBg: '#1E3A5F', darkText: '#8AB4F8', darkBorder: '#2D5087' },
  inadimplente: { label: 'Inadimplente',  dot: '#EA4335', bg: '#FCE8E6', text: '#C5221F', border: '#F5C6CB', darkBg: '#3B1E1E', darkText: '#F28B82', darkBorder: '#5A2D2D' },
  atrasado:     { label: 'Atrasado',      dot: '#EA4335', bg: '#FCE8E6', text: '#C5221F', border: '#F5C6CB', darkBg: '#3B1E1E', darkText: '#F28B82', darkBorder: '#5A2D2D' },
  cancelado:    { label: 'Cancelado',     dot: '#9AA0A6', bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0', darkBg: '#2A2B2E', darkText: '#9AA0A6', darkBorder: '#3C3D40' },
  pendente:     { label: 'Pendente',      dot: '#FBBC04', bg: '#FEF7E0', text: '#B06000', border: '#FDEDC1', darkBg: '#3B351E', darkText: '#FDD663', darkBorder: '#5A502D' },
  pago:         { label: 'Pago',          dot: '#34A853', bg: '#E6F4EA', text: '#137333', border: '#CEEAD6', darkBg: '#1E3B2C', darkText: '#81C995', darkBorder: '#2D5A3F' },
  vencido:      { label: 'Vencido',       dot: '#EA4335', bg: '#FCE8E6', text: '#C5221F', border: '#F5C6CB', darkBg: '#3B1E1E', darkText: '#F28B82', darkBorder: '#5A2D2D' },
  parcial:      { label: 'Parcial',       dot: '#FA903E', bg: '#FEF0E1', text: '#B06000', border: '#FDDDB3', darkBg: '#3B2A1E', darkText: '#FCAD70', darkBorder: '#5A3F2D' },
  renegociado:  { label: 'Renegociado',   dot: '#A142F4', bg: '#F3E8FD', text: '#8430CE', border: '#E1C8FA', darkBg: '#2E1E4A', darkText: '#C58AF9', darkBorder: '#452D6B' },
  analise:      { label: 'Em Análise',    dot: '#5F6368', bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0', darkBg: '#2A2B2E', darkText: '#9AA0A6', darkBorder: '#3C3D40' },
  aprovado:     { label: 'Aprovado',      dot: '#FBBC04', bg: '#FEF7E0', text: '#B06000', border: '#FDEDC1', darkBg: '#3B351E', darkText: '#FDD663', darkBorder: '#5A502D' },
  confirmada:   { label: 'Confirmada',    dot: '#34A853', bg: '#E6F4EA', text: '#137333', border: '#CEEAD6', darkBg: '#1E3B2C', darkText: '#81C995', darkBorder: '#2D5A3F' },
  entregue:     { label: 'Entregue',      dot: '#1A73E8', bg: '#E8F0FE', text: '#1967D2', border: '#D2E3FC', darkBg: '#1E3A5F', darkText: '#8AB4F8', darkBorder: '#2D5087' },
  sem_estoque:  { label: 'Sem Estoque',   dot: '#EA4335', bg: '#FCE8E6', text: '#C5221F', border: '#F5C6CB', darkBg: '#3B1E1E', darkText: '#F28B82', darkBorder: '#5A2D2D' },
  inativo:      { label: 'Inativo',       dot: '#9AA0A6', bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0', darkBg: '#2A2B2E', darkText: '#9AA0A6', darkBorder: '#3C3D40' },
  bloqueado:    { label: 'Bloqueado',     dot: '#EA4335', bg: '#FCE8E6', text: '#C5221F', border: '#F5C6CB', darkBg: '#3B1E1E', darkText: '#F28B82', darkBorder: '#5A2D2D' },
}

const FALLBACK: StatusConfig = { label: '', dot: '#9AA0A6', bg: '#F1F3F4', text: '#5F6368', border: '#DADCE0', darkBg: '#2A2B2E', darkText: '#9AA0A6', darkBorder: '#3C3D40' }

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK
  const displayLabel = label ?? cfg.label ?? status
  const isCritical = CRITICAL_STATUSES.has(status)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border leading-none whitespace-nowrap',
        'dark:border-opacity-60',
        className,
      )}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        borderColor: cfg.border,
        fontWeight: 600,
      }}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          isCritical && 'animate-status-pulse',
        )}
        style={{ backgroundColor: cfg.dot }}
      />
      {displayLabel}

      {/* Dark mode overrides via a hidden class-driven style element */}
      <style>{`
        .dark ${className ? `.${className.split(' ')[0]}` : ''}[data-status="${status}"] {
          background-color: ${cfg.darkBg} !important;
          color: ${cfg.darkText} !important;
          border-color: ${cfg.darkBorder} !important;
        }
      `}</style>
    </span>
  )
}
