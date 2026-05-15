export function limparDocumento(doc: string): string {
  return doc.replace(/\D/g, '')
}

export function validarCPF(cpf: string): boolean {
  const c = limparDocumento(cpf)
  if (c.length !== 11) return false
  if (/^(\d)\1{10}$/.test(c)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(c[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(c[10])
}

export function validarCNPJ(cnpj: string): boolean {
  const c = limparDocumento(cnpj)
  if (c.length !== 14) return false
  if (/^(\d)\1{13}$/.test(c)) return false

  const calc = (s: string, weights: number[]) => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) sum += parseInt(s[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  return calc(c, w1) === parseInt(c[12]) && calc(c, w2) === parseInt(c[13])
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function validarTelefone(tel: string): boolean {
  const t = limparDocumento(tel)
  return t.length === 10 || t.length === 11
}

export function validarCEP(cep: string): boolean {
  return /^\d{8}$/.test(limparDocumento(cep))
}
