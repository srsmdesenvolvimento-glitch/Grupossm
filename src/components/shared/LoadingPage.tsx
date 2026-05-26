'use client'

import { cn } from '@/lib/utils'

interface LoadingPageProps {
  cards?: number
  fullscreen?: boolean
  texto?: string
}

export function LoadingPage({ cards = 4, fullscreen = false, texto = 'Carregando' }: LoadingPageProps) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md">
        <div className="flex flex-col items-center gap-5">
          {/* Custom Google-style multi-colored spinner */}
          <div className="relative w-12 h-12">
            <svg className="animate-spin w-full h-full" viewBox="0 0 50 50">
              <circle
                className="path-google-spinner"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="4"
                stroke="var(--gt-blue)"
              />
            </svg>
            <style jsx global>{`
              @keyframes dash {
                0% {
                  stroke-dasharray: 1, 150;
                  stroke-dashoffset: 0;
                  stroke: var(--gt-blue);
                }
                50% {
                  stroke-dasharray: 90, 150;
                  stroke-dashoffset: -35;
                  stroke: var(--gt-red);
                }
                100% {
                  stroke-dasharray: 90, 150;
                  stroke-dashoffset: -124;
                  stroke: var(--gt-green);
                }
              }
              .path-google-spinner {
                stroke-linecap: round;
                animation: dash 1.5s ease-in-out infinite;
              }
            `}</style>
          </div>
          <p className="text-muted-foreground/80 text-xs font-bold tracking-widest uppercase animate-pulse">
            {texto}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-pulse-fast">
      {/* Stat cards skeleton */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: `repeat(${Math.min(cards, 4)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/50 bg-card p-6 flex items-start justify-between gap-3 overflow-hidden shadow-m3-1"
            style={{ opacity: Math.max(0.4, 1 - i * 0.15) }}
          >
            <div className="flex-1 space-y-3.5">
              <div className="skeleton-premium h-3 w-20 rounded-full" />
              <div className="skeleton-premium h-8 w-28 rounded-lg" />
              <div className="skeleton-premium h-2.5 w-14 rounded-full" />
            </div>
            <div className="skeleton-premium w-11 h-11 rounded-xl shrink-0 shadow-sm" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-m3-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-card">
          <div className="skeleton-premium h-9 w-64 rounded-full" />
          <div className="skeleton-premium h-9 w-24 rounded-full" />
        </div>

        {/* Header row */}
        <div className="flex items-center gap-6 px-6 py-4 bg-muted/20 border-b border-border/50">
          {[80, 130, 90, 70, 60].map((w, i) => (
            <div key={i} className="skeleton-premium h-3 rounded-full" style={{ width: w }} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-6 py-4.5 border-b border-border/40 last:border-0 bg-card"
            style={{ opacity: Math.max(0.2, 1 - i * 0.16) }}
          >
            <div className="skeleton-premium h-4 rounded-md" style={{ width: 100 }} />
            <div className="skeleton-premium h-4 rounded-md" style={{ width: 160 }} />
            <div className="skeleton-premium h-4 rounded-md" style={{ width: 80 }} />
            <div className="skeleton-premium h-5.5 w-20 rounded-full" />
            <div className="skeleton-premium h-4 rounded-md ml-auto" style={{ width: 70 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
