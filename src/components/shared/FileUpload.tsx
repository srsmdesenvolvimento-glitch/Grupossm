'use client'

import { useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onUpload: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSizeMB?: number
  className?: string
}

export function FileUpload({
  onUpload, accept = 'image/*', multiple = false,
  maxSizeMB = 5, className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const valid = Array.from(files).filter(f => f.size <= maxSizeMB * 1024 * 1024)
    if (valid.length) onUpload(valid)
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 bg-muted/20 dark:bg-card/30 flex flex-col items-center justify-center gap-3',
        dragOver 
          ? 'border-[var(--gt-blue)] bg-[var(--gt-blue-light)]/30 dark:bg-[var(--gt-blue)]/5 scale-[1.01]' 
          : 'border-border/60 hover:border-[var(--gt-blue)]/50 hover:bg-muted/40 dark:hover:bg-card/60',
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      role="presentation"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 shadow-sm border border-border/40',
        dragOver ? 'bg-[var(--gt-blue)] text-white' : 'bg-card text-muted-foreground/60'
      )}>
        <Upload size={20} className={dragOver ? 'animate-bounce' : ''} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Arraste seus arquivos aqui ou <span className="text-[var(--gt-blue)] hover:underline">clique para buscar</span>
        </p>
        <p className="text-xs text-muted-foreground/80">
          Aceita arquivos {accept.replace('/*', '').toUpperCase()} até {maxSizeMB}MB
        </p>
      </div>
    </div>
  )
}
