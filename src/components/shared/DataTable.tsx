'use client'

import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
  const slice = data.slice((page - 1) * perPage, page * perPage)

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-t-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded"
            style={{ opacity: Math.max(0.15, 1 - i * 0.14) }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 overflow-hidden overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn(
                    'text-muted-foreground font-semibold text-[11px] uppercase tracking-wider h-10 py-0',
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
                  className="text-center text-muted-foreground py-16 text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              slice.map((row, idx) => (
                <TableRow
                  key={keyExtractor(row)}
                  className={cn(
                    'border-b border-border/30 last:border-0 transition-colors duration-100',
                    rowClassName
                      ? rowClassName(row)
                      : idx % 2 === 0
                        ? 'bg-card'
                        : 'bg-muted/[0.03]',
                    onRowClick && 'cursor-pointer hover:bg-accent/50',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <TableCell key={col.key} className={cn('py-3', col.className)}>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, data.length)}
            </span>{' '}
            de{' '}
            <span className="font-medium text-foreground tabular-nums">{data.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-2 min-w-[52px] text-center">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
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
