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
        'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50',
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <Upload size={24} className="mx-auto text-slate-400 mb-2" />
      <p className="text-sm text-slate-500">
        Arraste arquivos ou <span className="text-blue-600 underline">clique para selecionar</span>
      </p>
      <p className="text-xs text-slate-400 mt-1">Máximo {maxSizeMB}MB</p>
    </div>
  )
}
