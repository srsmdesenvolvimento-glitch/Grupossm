'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', className }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className={cn('relative w-full transition-all duration-200', className)}>
      <Search
        size={17}
        className={cn(
          'absolute left-4.5 top-1/2 -translate-y-1/2 transition-colors duration-250 pointer-events-none',
          isFocused ? 'text-[var(--gt-blue)]' : 'text-muted-foreground/60'
        )}
      />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          'pl-11 pr-10 h-11 w-full rounded-full border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground/50 transition-all duration-250',
          'focus-visible:ring-0 focus-visible:outline-none',
          isFocused 
            ? 'shadow-m3-2 border-[var(--gt-blue)] bg-card ring-1 ring-[var(--gt-blue)]/20' 
            : 'shadow-m3-1 hover:border-border/80 hover:shadow-m3-2'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-4.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-all duration-200"
          aria-label="Limpar busca"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
