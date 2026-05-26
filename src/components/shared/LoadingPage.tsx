import { Skeleton } from '@/components/ui/skeleton'

interface LoadingPageProps {
  cards?: number
  fullscreen?: boolean
  texto?: string
}

export function LoadingPage({ cards = 4, fullscreen = false }: LoadingPageProps) {
  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at top, #1a2040 0%, #0F1225 60%)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 rounded-full border-2 border-white/10 border-t-[#D4A528] animate-spin" />
          <p className="text-white/30 text-xs font-medium tracking-widest uppercase">
            Carregando
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stat cards skeleton */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(cards, 4)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-2xl border border-border/60 p-5 flex items-start justify-between gap-3"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-7 w-24 rounded" />
              <Skeleton className="h-2 w-14 rounded" />
            </div>
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3 bg-muted/30 border-b border-border/40">
          {[60, 100, 80, 80, 60].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w > 80 ? 24 : w > 60 ? 20 : 16} rounded`} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3.5 border-b border-border/30 last:border-0"
            style={{ opacity: Math.max(0.2, 1 - i * 0.14) }}
          >
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-16 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
