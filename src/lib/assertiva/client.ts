import type { RelatorioCompleto } from './types'

// Campos que só existem porque o Score/Crédito foi chamado. Uma consulta
// 'basico' nunca chama esse endpoint — mas o servidor pode devolver um cache
// 'completo' já existente pra responder um pedido 'basico' sem gastar de novo
// (ver docs/politica-cache.md). Isso significa que o objeto pode vir com
// esses campos preenchidos mesmo quando NINGUÉM pediu score nessa chamada.
// Removidos aqui, na fronteira de entrada dos dados — assim NENHUMA tela,
// atual ou futura, que só renderiza `relatorio.<campo>` corre o risco de
// mostrar score/dívida sem ter sido pedido (regra 2 da política de cache).
const CAMPOS_SO_COMPLETO = [
  'score', 'score_detalhado', 'faixa_risco',
  'renda_estimada', 'renda_presumida', 'capacidade_pagamento', 'faixa_renda', 'comprometimento_renda',
  'negativacoes', 'total_negativacoes', 'valor_total_negativacoes',
  'protestos', 'total_protestos', 'valor_total_protestos',
  'acoes_judiciais', 'total_acoes_judiciais', 'valor_total_acoes',
  'ccf', 'total_ccf',
  'operacoes_credito', 'total_operacoes_credito',
  'consultas_anteriores', 'total_consultas_anteriores',
  'total_dividas', 'valor_total_dividas',
  'faturamento_presumido',
  '_credito', '_credito_403',
] as const

export function sanitizarParaBasico(data: RelatorioCompleto): RelatorioCompleto {
  const limpo: Record<string, unknown> = { ...data }
  for (const campo of CAMPOS_SO_COMPLETO) delete limpo[campo]
  // Força a verdade sobre o que ESTA chamada pediu, mesmo que o objeto tenha
  // vindo de um cache 'completo' reaproveitado — quem consome (ex.: a
  // gravação no perfil do cliente) decide o que persistir com base nisso.
  limpo._nivel = 'basico'
  return limpo as unknown as RelatorioCompleto
}

export async function buscarRelatorioAssertiva(
  documento: string,
  tipo: 'pf' | 'pj',
  // 'basico' = identificação + conexões + veículos (achar/contatar a pessoa e
  // ver o que ela possui, sem gastar em score de crédito). 'completo' (default,
  // igual ao comportamento de sempre) soma score/negativações/protestos/cheques.
  nivel: 'basico' | 'completo' = 'completo',
): Promise<{ data: RelatorioCompleto | null; erro: string | null }> {
  try {
    const res = await fetch('/api/assertiva/relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento: documento.replace(/\D/g, ''), tipo, nivel }),
    })

    const json = await res.json()
    if (!res.ok) return { data: null, erro: json.erro ?? 'Erro ao consultar Assertiva' }
    const data = json as RelatorioCompleto
    return { data: nivel === 'basico' ? sanitizarParaBasico(data) : data, erro: null }
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

const COR_POR_CLASSE: Record<string, string> = {
  A: '#10b981', B: '#22c55e', C: '#f59e0b', D: '#f97316', E: '#ef4444', F: '#dc2626',
}

function classeDeFaixaRisco(faixaRisco?: string): string | undefined {
  const classe = faixaRisco?.trim().charAt(0).toUpperCase()
  return classe && COR_POR_CLASSE[classe] ? classe : undefined
}

// Rótulo de risco preciso — usa a classificação que a própria Assertiva calculou
// (`faixa_risco`, ex: "F — Altíssimo risco") em vez de recalcular por faixa
// numérica genérica. Só cai no `scoreLabel` aproximado se não tiver o dado.
export function faixaRiscoLabel(faixaRisco?: string, score?: number): string {
  return faixaRisco?.trim() || scoreLabel(score)
}

export function faixaRiscoColor(faixaRisco?: string, score?: number): string {
  const classe = classeDeFaixaRisco(faixaRisco)
  return classe ? COR_POR_CLASSE[classe] : scoreColor(score)
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
