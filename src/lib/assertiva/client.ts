import type { RelatorioCompleto } from './types'

export async function buscarRelatorioAssertiva(
  documento: string,
  tipo: 'pf' | 'pj',
): Promise<{ data: RelatorioCompleto | null; erro: string | null }> {
  try {
    const res = await fetch('/api/assertiva/relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento: documento.replace(/\D/g, ''), tipo }),
    })

    const json = await res.json()
    if (!res.ok) return { data: null, erro: json.erro ?? 'Erro ao consultar Assertiva' }
    return { data: json as RelatorioCompleto, erro: null }
  } catch (e) {
    return { data: null, erro: 'Falha de conexão' }
  }
}

export function detectarTipo(doc: string): 'pf' | 'pj' | null {
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) return 'pf'
  if (d.length === 14) return 'pj'
  return null
}

export function scoreLabel(score?: number): string {
  if (score == null) return 'Sem Score'
  if (score >= 800) return 'Excelente'
  if (score >= 650) return 'Bom'
  if (score >= 500) return 'Regular'
  if (score >= 300) return 'Baixo'
  return 'Muito Baixo'
}

export function scoreColor(score?: number): string {
  if (score == null) return '#6B7280'
  if (score >= 800) return '#10b981'
  if (score >= 650) return '#22c55e'
  if (score >= 500) return '#f59e0b'
  if (score >= 300) return '#ef4444'
  return '#dc2626'
}

export function maskDoc(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join('')
    )
  }
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_, a, b, c, e, f) =>
    [a, b && `.${b}`, c && `.${c}`, e && `/${e}`, f && `-${f}`].filter(Boolean).join('')
  )
}

export function formatCpf(s?: string): string {
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  return s
}

export function formatCnpj(s?: string): string {
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  return s
}

export function formatTel(s?: string): string {
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return s
}
