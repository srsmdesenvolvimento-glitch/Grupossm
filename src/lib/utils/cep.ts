export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoCep> {
  const c = cep.replace(/\D/g, '')
  if (c.length !== 8) throw new Error('CEP deve ter 8 dígitos')

  // BrasilAPI — primário (mais estável, melhor CORS)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${c}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as Record<string, string>
      return {
        logradouro: data.street ?? '',
        bairro:     data.neighborhood ?? '',
        cidade:     data.city ?? '',
        estado:     data.state ?? '',
      }
    }
  } catch {
    // fallback para ViaCEP
  }

  // ViaCEP — fallback
  const res2 = await fetch(`https://viacep.com.br/ws/${c}/json/`, {
    signal: AbortSignal.timeout(6000),
  })
  if (!res2.ok) throw new Error('CEP não encontrado')
  const data2 = await res2.json() as Record<string, string | boolean>
  if (data2.erro) throw new Error('CEP não encontrado')
  return {
    logradouro: (data2.logradouro as string) ?? '',
    bairro:     (data2.bairro     as string) ?? '',
    cidade:     (data2.localidade as string) ?? '',
    estado:     (data2.uf         as string) ?? '',
  }
}
