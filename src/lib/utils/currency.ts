export function parseBRL(value: string): number {
  if (!value) return 0
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

export function formatBRL(value: number): string {
  if (isNaN(value)) return '0,00'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function handleCurrencyChange(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return '0,00'
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
