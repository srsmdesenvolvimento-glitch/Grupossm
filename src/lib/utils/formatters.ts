import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '—'
  try {
    const d = typeof data === 'string' ? new Date(data + (data.length === 10 ? 'T00:00:00' : '')) : data
    return format(d, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatarDataHora(data: string | Date | null | undefined): string {
  if (!data) return '—'
  try {
    const d = typeof data === 'string' ? new Date(data) : data
    return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatarDataRelativa(data: string | Date | null | undefined): string {
  if (!data) return '—'
  try {
    const d = typeof data === 'string' ? new Date(data) : data
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 7) return `Há ${diff} dias`
    return format(d, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatarCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11) return cpf
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatarCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatarTelefone(tel: string | null | undefined): string {
  if (!tel) return '—'
  const t = tel.replace(/\D/g, '')
  if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return tel
}

export function formatarPorcentagem(valor: number | null | undefined, casas = 2): string {
  if (valor == null) return '0%'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor) + '%'
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor == null) return '0'
  return new Intl.NumberFormat('pt-BR').format(valor)
}

export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function pluralizar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`
}
