import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface LoadingPageProps {
  cards?: number
  fullscreen?: boolean
  texto?: string
}

export function LoadingPage({ cards = 4, fullscreen = false, texto = 'Carregando...' }: LoadingPageProps) {
  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
        style={{ background: 'radial-gradient(ellipse at top, #1a2040 0%, #0F1225 60%)' }}
      >
        <Loader2 size={36} className="animate-spin text-[#D4A528]" />
        <p className="text-white/50 text-sm font-medium">{texto}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
