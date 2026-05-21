export type ColExport = { key: string; label: string }

export function exportarCSV(
  filename: string,
  rows: Record<string, unknown>[],
  headers: ColExport[],
): void {
  const BOM = '﻿'
  const header = headers.map(h => `"${h.label}"`).join(';')
  const body = rows.map(row =>
    headers.map(h => {
      const v = row[h.key]
      if (v === null || v === undefined) return '""'
      const s = String(v).replace(/"/g, '""')
      return `"${s}"`
    }).join(';')
  )
  const csv = BOM + [header, ...body].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function imprimirHTML(titulo: string, corpoHtml: string): void {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
        h1 { font-size: 16px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 11px; }
        td { padding: 5px 8px; border: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${titulo}</h1>
      ${corpoHtml}
    </body>
    </html>
  `)
  w.document.close()
  w.focus()
  w.print()
}
