'use client'

import type { TipoEmpresa } from '@/lib/types/database'

interface AnimatedBackgroundProps {
  empresa?: TipoEmpresa
}

export function AnimatedBackground({ empresa = 'factoring' }: AnimatedBackgroundProps) {
  const isFactoring = empresa === 'factoring'

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {/* Grid texture */}
      <div className="absolute inset-0 bg-grid-ambient opacity-30" />

      {/* Primary blob — top left */}
      <div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-[120px] animate-glow-breathe"
        style={{
          background: isFactoring
            ? 'radial-gradient(circle, rgba(26,115,232,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,165,40,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Secondary blob — bottom right */}
      <div
        className="absolute -bottom-40 -right-40 w-[480px] h-[480px] rounded-full blur-[120px] animate-glow-breathe"
        style={{
          animationDelay: '2s',
          background: isFactoring
            ? 'radial-gradient(circle, rgba(138,180,248,0.04) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(30,90,168,0.04) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}
