'use client'

import { useState, useEffect } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  perPage?: number
  rowClassName?: (row: T) => string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyMessage = 'Nenhum registro encontrado.',
  onRowClick,
  perPage = 10,
  rowClassName,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(data.length / perPage))

  useEffect(() => { setPage(1) }, [data.length])

  const slice = data.slice((page - 1) * perPage, page * perPage)

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <div className="skeleton-premium h-10 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-premium h-12 w-full rounded-lg"
            style={{ opacity: Math.max(0.15, 1 - i * 0.14) }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-m3-1)' }}>
        <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'text-muted-foreground font-medium text-[11px] uppercase tracking-wider h-11 py-0',
                    col.className,
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-20"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-muted-foreground/60 text-sm">{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              slice.map((row, idx) => (
                <TableRow
                  key={keyExtractor(row)}
                  className={cn(
                    'border-b border-border/20 last:border-0 transition-colors duration-150 animate-row-in',
                    rowClassName
                      ? rowClassName(row)
                      : 'bg-card',
                    onRowClick && 'cursor-pointer',
                  )}
                  style={{
                    animationDelay: `${Math.min(idx * 25, 200)}ms`,
                    ...(onRowClick ? {} : {}),
                  }}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={e => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = 'var(--gt-blue-light)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (onRowClick) {
                      e.currentTarget.style.backgroundColor = ''
                    }
                  }}
                >
                  {columns.map(col => (
                    <TableCell key={col.key} className={cn('py-3.5', col.className)}>
                      {col.render
                        ? col.render(row)
                        : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, data.length)}
            </span>{' '}
            de{' '}
            <span className="font-semibold text-foreground tabular-nums">{data.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-full border-border/60 hover:bg-[var(--gt-blue-light)] hover:text-[var(--gt-blue)] hover:border-[var(--gt-blue)]/30 transition-all duration-150"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs font-medium text-muted-foreground tabular-nums px-3 min-w-[52px] text-center">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-full border-border/60 hover:bg-[var(--gt-blue-light)] hover:text-[var(--gt-blue)] hover:border-[var(--gt-blue)]/30 transition-all duration-150"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
