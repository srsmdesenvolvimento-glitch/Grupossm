export function parseBRL(value: string): number {
  if (!value) return 0
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

const _U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const _D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const _C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function _cent(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100), r = n % 100
  if (r === 0) return _C[c]
  if (c === 0) {
    if (r < 20) return _U[r]
    const d = Math.floor(r / 10), u = r % 10
    return u === 0 ? _D[d] : `${_D[d]} e ${_U[u]}`
  }
  return `${_C[c]} e ${_cent(r)}`
}

function _mil(n: number): string {
  if (n < 1000) return _cent(n)
  const m = Math.floor(n / 1000), r = n % 1000
  const ms = m === 1 ? 'mil' : `${_cent(m)} mil`
  return r === 0 ? ms : `${ms} e ${_cent(r)}`
}

function _mi(n: number): string {
  if (n < 1_000_000) return _mil(n)
  const mi = Math.floor(n / 1_000_000), r = n % 1_000_000
  const ms = mi === 1 ? 'um milhão' : `${_cent(mi)} milhões`
  return r === 0 ? ms : `${ms} e ${_mil(r)}`
}

export function valorPorExtenso(valor: number): string {
  const n = Math.round(valor * 100)
  const reais = Math.floor(n / 100)
  const centavos = n % 100
  if (n === 0) return 'zero reais'
  const partes: string[] = []
  if (reais > 0) partes.push(`${_mi(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (centavos > 0) partes.push(`${_cent(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ')
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
