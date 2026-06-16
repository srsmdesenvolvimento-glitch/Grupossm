import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  RelatorioCompleto, RelatorioNegativacao, RelatorioProtesto,
  RelatorioAcaoJudicial, RelatorioCcf, RelatorioEndereco,
  RelatorioTelefone, RelatorioEmail, RelatorioParticipacao,
  RelatorioSocio, RelatorioConsultaAnterior, RelatorioScoreDetalhado,
} from '@/lib/assertiva/types'

// ─── URLs corretas conforme documentação oficial ──────────────────────────────
const API_BASE      = 'https://api.assertivasolucoes.com.br'
const AUTH_URL      = `${API_BASE}/oauth2/v3/token`
const LOCALIZE_BASE = `${API_BASE}/localize/v3`
const MIX_BASE      = `${API_BASE}/mix-v3`

const CACHE_TTL_MS  = 24 * 60 * 60 * 1000   // 24h para relatório
const TOKEN_TTL_MS  = 28 * 60 * 1000         // 28 min (token expira em 30 min)

// Finalidade LGPD: 2 = Ciclo de crédito (obrigatório para empréstimos financeiros)
const ID_FINALIDADE = 2

// ─── Cache de token em memória ────────────────────────────────────────────────
let _tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string | null> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const clientId = process.env.ASSERTIVA_CLIENT_ID
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[Assertiva] Auth failed:', res.status, errBody)
      if (res.status === 403) {
        throw new Error('PAGAMENTO_PENDENTE')
      }
      return null
    }

    const data = await res.json()
    const token = data.access_token ?? data.accessToken ?? data.token
    if (!token) return null

    _tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
    return token
  } catch (e: any) {
    if (e?.message === 'PAGAMENTO_PENDENTE') throw e
    console.error('[Assertiva] Auth error:', e)
    return null
  }
}

// ─── Chamada genérica à API ───────────────────────────────────────────────────
async function callApi(url: string, auth: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${auth}`,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  return { ok: res.status === 200, status: res.status, data }
}

function only(s: string) { return s.replace(/\D/g, '') }

function formatarDataParaIso(dataStr?: string): string | undefined {
  if (!dataStr) return undefined
  const limpa = dataStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpa)) return limpa
  if (limpa.includes('T')) return limpa.split('T')[0]
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpa)) {
    const [d, m, y] = limpa.split('/')
    return `${y}-${m}-${d}`
  }
  return limpa
}

// ─── Parser: Localize CPF → campos do RelatorioCompleto ───────────────────────
function parseLocalizePf(raw: any) {
  if (!raw) return {}
  // Localize retorna: { cabecalho, resposta: { dadosCadastrais, cadastro, enderecos, telefones, emails, ... } }
  const resp = raw.resposta ?? raw
  const cad  = resp.dadosCadastrais ?? resp.cadastro ?? resp

  // Telefones: { fixos: [...], moveis: [...] }
  const tels: RelatorioTelefone[] = []
  const rawTels = resp.telefones ?? cad.telefones
  if (rawTels) {
    for (const t of (rawTels.moveis ?? [])) {
      tels.push({
        ddd: '', numero: t.numero ?? '',
        tipo: 'Celular',
        whatsapp: t.aplicativos?.whatsApp ?? false,
        operadora: t.operadora,
      })
    }
    for (const t of (rawTels.fixos ?? [])) {
      tels.push({
        ddd: '', numero: t.numero ?? '',
        tipo: 'Fixo',
        whatsapp: t.aplicativos?.whatsAppBusiness ?? false,
        operadora: t.operadora,
      })
    }
  }

  // Endereços
  const ends: RelatorioEndereco[] = (resp.enderecos ?? []).map((e: any) => ({
    logradouro: [e.tipoLogradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero?.toString(),
    complemento: e.complemento,
    bairro: e.bairro,
    municipio: e.cidade,
    uf: e.uf,
    cep: e.cep,
  }))

  // Emails
  const emails: RelatorioEmail[] = (resp.emails ?? []).map((e: any) => ({
    email: e.email,
    tipo: e.tipo,
    score: e.score,
  }))

  // Participações em empresas
  const parts: RelatorioParticipacao[] = (resp.participacoesEmpresas ?? []).map((p: any) => ({
    cnpj: p.cnpj,
    razao_social: p.razaoSocial,
    data_entrada: p.dataEntrada,
    cargo: p.cargo,
    participacao: p.participacao,
    situacao: p.situacao,
  }))

  // Extrair ocupação e renda do histórico profissional se cadastro não tiver
  const histProf = resp.possivelHistoricoProfissional?.[0] ?? {}
  const ocupacao = cad.ocupacao ?? cad.profissao ?? histProf.cboDescricao
  const rendaEstimada = histProf.rendaEstimada ? parseFloat(histProf.rendaEstimada) : undefined

  return {
    nome: cad.nome,
    nome_mae: cad.maeNome ?? cad.mae,
    data_nascimento: formatarDataParaIso(cad.dataNascimento),
    sexo: cad.sexo,
    situacao_cpf: cad.situacaoCadastral,
    indicador_obito: cad.obitoProvavel ?? false,
    idade: cad.idade,
    signo: cad.signo,
    pep: cad.ppe ?? cad.pep ?? false,
    escolaridade: cad.escolaridade,
    ocupacao: ocupacao,
    estado_civil_api: cad.estadoCivil,
    nacionalidade: cad.nacionalidade,
    faixa_etaria: cad.faixaEtaria ?? (cad.idade ? `${cad.idade} anos` : undefined),
    renda_estimada: rendaEstimada,
    enderecos: ends,
    telefones: tels,
    emails,
    participacoes_societarias: parts,
  }
}

// ─── Parser: Localize CNPJ → campos do RelatorioCompleto ──────────────────────
function parseLocalizePj(raw: any) {
  if (!raw) return {}
  const resp = raw.resposta ?? raw
  const cad  = resp.dadosCadastrais ?? resp.cadastro ?? resp

  // Telefones
  const tels: RelatorioTelefone[] = []
  const rawTels = resp.telefones ?? cad.telefones
  if (rawTels) {
    for (const t of (rawTels.moveis ?? [])) {
      tels.push({
        ddd: '', numero: t.numero ?? '',
        tipo: 'Celular',
        whatsapp: t.aplicativos?.whatsApp ?? false,
      })
    }
    for (const t of (rawTels.fixos ?? [])) {
      tels.push({
        ddd: '', numero: t.numero ?? '',
        tipo: 'Fixo',
        whatsapp: t.aplicativos?.whatsAppBusiness ?? false,
      })
    }
  }

  // Endereços
  const ends: RelatorioEndereco[] = (resp.enderecos ?? []).map((e: any) => ({
    logradouro: [e.tipoLogradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero?.toString(),
    complemento: e.complemento,
    bairro: e.bairro,
    municipio: e.cidade,
    uf: e.uf,
    cep: e.cep,
  }))

  // Emails
  const emails: RelatorioEmail[] = (resp.emails ?? []).map((e: any) => ({
    email: e.email,
  }))

  // Sócios
  const socios: RelatorioSocio[] = (resp.socios ?? resp.participacoesEmpresas ?? []).map((s: any) => ({
    nome: s.nome ?? s.razaoSocial,
    documento: s.cpf ?? s.cnpj,
    participacao: s.participacao,
    cargo: s.cargo ?? s.qualificacao,
    data_entrada: s.dataEntrada,
  }))

  return {
    razao_social: cad.razaoSocial,
    nome_fantasia: cad.nomeFantasia,
    situacao_cnpj: cad.situacaoCadastral,
    cnae_principal: cad.cnae?.toString(),
    cnae_descricao: cad.cnaeDescricao,
    natureza_juridica: cad.naturezaJuridica,
    capital_social: cad.capitalSocial,
    data_abertura: formatarDataParaIso(cad.dataAbertura),
    porte: cad.porteEmpresa,
    nome: cad.razaoSocial,
    idade_empresa: cad.idadeEmpresa,
    qtd_funcionarios: cad.quantidadeFuncionarios,
    socios,
    enderecos: ends,
    telefones: tels,
    emails,
  }
}

// ─── Parser: Crédito Mix PF → campos financeiros ─────────────────────────────
function parseMixPf(raw: any) {
  if (!raw) return {}
  const resp    = raw.resposta ?? raw
  const resumos = resp.resumos ?? {}
  const ocorrs  = resp.ocorrencias ?? {}
  const cad     = ocorrs.cadastro ?? {}
  const scoreRaw = ocorrs.score?.score ?? ocorrs.score ?? {}

  // Score detalhado
  const scoreDetalhado: RelatorioScoreDetalhado = {
    pontos: scoreRaw.pontos,
    classe: scoreRaw.classe,
    faixa_titulo: scoreRaw.faixa?.titulo,
    faixa_descricao: scoreRaw.faixa?.descricao,
    probabilidade: scoreRaw.probabilidade,
    cadastro_positivo: scoreRaw.cadastroPositivo ? {
      suspenso: scoreRaw.cadastroPositivo.suspenso,
      atrasoConsumo: scoreRaw.cadastroPositivo.atrasoConsumo,
      atrasoRecente: scoreRaw.cadastroPositivo.atrasoRecente,
      relacionamentoCC: scoreRaw.cadastroPositivo.relacionamentoCC,
      comprometimentoRenda: scoreRaw.cadastroPositivo.comprometimentoRenda,
    } : undefined,
  }

  // Negativações (débitos)
  const negativacoes: RelatorioNegativacao[] = (ocorrs.debitos ?? []).map((d: any) => ({
    credor: d.credor,
    valor: d.valor,
    data: d.dataOcorrencia ?? d.dataInclusao,
    contrato: d.contratoFatura?.toString(),
    tipo: d.tipo === 'B' ? 'Débito' : d.tipo,
    origem: d.tipoDevedor,
    cidade: d.cidade,
    uf: d.uf,
  }))

  // Protestos
  const protestos: RelatorioProtesto[] = (ocorrs.protestos ?? []).map((p: any) => ({
    cartorio: p.cartorio?.toString(),
    valor: p.valor,
    data: p.data,
    municipio: p.cidade,
    uf: p.uf,
  }))

  // Ações Judiciais
  const acoes: RelatorioAcaoJudicial[] = (ocorrs.acoes ?? []).map((a: any) => {
    // Pode vir como { forum: { ... } } ou diretamente
    const obj = a.forum ?? a
    return {
      tipo: obj.tipo ?? a.tipo,
      valor: obj.valor ?? a.valor,
      data: obj.data ?? a.data,
      vara: obj.vara?.toString(),
      tribunal: obj.forum ?? a.forum,
      uf: obj.uf ?? a.uf,
    }
  })

  // Cheques sem fundo (CCF)
  const ccf: RelatorioCcf[] = (ocorrs.cheques ?? []).map((c: any) => ({
    banco: c.banco,
    nome_banco: c.nomeBanco,
    agencia: c.agencia,
    numero_cheque: c.numeroCheque,
    data: c.data ?? c.ultimoCheque,
    motivo: c.motivoDescricao ?? c.motivo,
    valor: c.valor,
  }))

  // Consultas anteriores
  const consultas: RelatorioConsultaAnterior[] = (ocorrs.consultasAnteriores ?? []).map((c: any) => ({
    data: c.dataOcorrencia,
    consultante: c.consultante,
  }))

  // Participações
  const participacoes: RelatorioParticipacao[] = (ocorrs.participacoesEmpresas ?? []).map((p: any) => ({
    cnpj: p.cnpj,
    razao_social: p.razaoSocial,
    data_entrada: p.dataEntrada,
  }))

  // Computa comprometimento de renda do cadastro positivo
  const comprRenda = scoreRaw.cadastroPositivo?.comprometimentoRenda?.valor
  const rendaPresumida = resumos.rendaPresumida

  return {
    // Dados cadastrais do Mix (complementam/sobrescrevem Localize)
    nome: cad.nome,
    nome_mae: cad.maeNome,
    data_nascimento: formatarDataParaIso(cad.dataNascimento),
    sexo: cad.sexo,
    situacao_cpf: cad.situacaoCadastral,
    indicador_obito: cad.obitoProvavel ?? false,
    idade: cad.idade,
    signo: cad.signo,

    // Score
    score: scoreDetalhado.pontos,
    score_detalhado: scoreDetalhado,
    faixa_risco: scoreDetalhado.classe
      ? `${scoreDetalhado.classe} — ${scoreDetalhado.faixa_titulo ?? ''}`
      : scoreDetalhado.faixa_titulo,

    // Renda
    renda_estimada: typeof rendaPresumida === 'number' ? rendaPresumida : undefined,
    renda_presumida: typeof rendaPresumida === 'number' ? rendaPresumida : undefined,
    comprometimento_renda: typeof comprRenda === 'number' ? comprRenda : undefined,

    // Negativações
    negativacoes,
    total_negativacoes: resumos.debitos?.sumQuantidade ?? negativacoes.length,
    valor_total_negativacoes: resumos.debitos?.sumValorTotal ?? 0,

    // Protestos
    protestos,
    total_protestos: resumos.protestos?.sumQuantidade ?? protestos.length,
    valor_total_protestos: resumos.protestos?.sumValorTotal ?? 0,

    // Ações
    acoes_judiciais: acoes,
    total_acoes_judiciais: resumos.acoes?.sumQuantidade ?? acoes.length,
    valor_total_acoes: resumos.acoes?.sumValorTotal ?? 0,

    // CCF
    ccf,
    total_ccf: resumos.cheques?.sumQuantidade ?? ccf.length,

    // Participações
    participacoes_societarias: participacoes.length > 0 ? participacoes : undefined,

    // Consultas anteriores
    consultas_anteriores: consultas,
    total_consultas_anteriores: resumos.consultasAnteriores?.sumQuantidade ?? consultas.length,
  }
}

// ─── Parser: Crédito Mix PJ → campos financeiros ─────────────────────────────
function parseMixPj(raw: any) {
  if (!raw) return {}
  const resp    = raw.resposta ?? raw
  const resumos = resp.resumos ?? {}
  const ocorrs  = resp.ocorrencias ?? {}
  const cad     = ocorrs.cadastro ?? {}
  const scoreRaw = ocorrs.score?.score ?? ocorrs.score ?? {}

  // Score detalhado
  const scoreDetalhado: RelatorioScoreDetalhado = {
    pontos: scoreRaw.pontos,
    classe: scoreRaw.classe,
    faixa_titulo: scoreRaw.faixa?.titulo,
    faixa_descricao: scoreRaw.faixa?.descricao,
    probabilidade: scoreRaw.probabilidade,
  }

  // Negativações
  const negativacoes: RelatorioNegativacao[] = (ocorrs.debitos ?? []).map((d: any) => ({
    credor: d.credor,
    valor: d.valor,
    data: d.dataOcorrencia ?? d.dataInclusao,
    contrato: d.contratoFatura?.toString(),
    tipo: d.tipo === 'B' ? 'Débito' : d.tipo,
    origem: d.tipoDevedor,
    cidade: d.cidade,
    uf: d.uf,
  }))

  // Protestos
  const protestos: RelatorioProtesto[] = (ocorrs.protestos ?? []).map((p: any) => ({
    cartorio: p.cartorio?.toString(),
    valor: p.valor,
    data: p.data,
    municipio: p.cidade,
    uf: p.uf,
  }))

  // Ações Judiciais — PJ pode vir como { forum: { ... } }
  const acoes: RelatorioAcaoJudicial[] = (ocorrs.acoes ?? []).map((a: any) => {
    const obj = a.forum ?? a
    return {
      tipo: obj.tipo ?? a.tipo,
      valor: obj.valor ?? a.valor,
      data: obj.data ?? a.data,
      vara: obj.vara?.toString(),
      tribunal: typeof a.forum === 'string' ? a.forum : undefined,
      uf: obj.uf ?? a.uf,
    }
  })

  // CCF
  const ccf: RelatorioCcf[] = (ocorrs.cheques ?? []).map((c: any) => ({
    banco: c.banco,
    nome_banco: c.nomeBanco,
    agencia: c.agencia,
    numero_cheque: c.numeroCheque,
    data: c.data ?? c.ultimoCheque,
    motivo: c.motivoDescricao ?? c.motivo,
    valor: c.valor,
  }))

  // Consultas anteriores
  const consultas: RelatorioConsultaAnterior[] = (ocorrs.consultasAnteriores ?? []).map((c: any) => ({
    data: c.dataOcorrencia,
    consultante: c.consultante,
  }))

  // Sócios do Mix
  const socios: RelatorioSocio[] = (ocorrs.participacoesEmpresas ?? ocorrs.socios ?? []).map((s: any) => ({
    nome: s.nome ?? s.razaoSocial,
    documento: s.cnpj ?? s.cpf,
    data_entrada: s.dataEntrada,
    cargo: s.cargo,
    participacao: s.participacao,
  }))

  const fatPresumido = resumos.faturamentoPresumido

  return {
    // Dados cadastrais do Mix PJ
    razao_social: cad.razaoSocial,
    nome_fantasia: cad.nomeFantasia,
    nome: cad.razaoSocial,
    situacao_cnpj: cad.situacaoCadastral,
    cnae_principal: cad.cnae?.toString(),
    cnae_descricao: cad.cnaeDescricao ?? cad.cnaeGrupo,
    natureza_juridica: cad.naturezaJuridica,
    data_abertura: formatarDataParaIso(cad.dataAbertura),
    porte: cad.porteEmpresa,
    idade_empresa: cad.idadeEmpresa,
    qtd_funcionarios: cad.quantidadeFuncionarios,
    faturamento_presumido: fatPresumido !== 'Não consta' ? fatPresumido : undefined,

    // Score
    score: scoreDetalhado.pontos,
    score_detalhado: scoreDetalhado,
    faixa_risco: scoreDetalhado.classe
      ? `${scoreDetalhado.classe} — ${scoreDetalhado.faixa_titulo ?? ''}`
      : scoreDetalhado.faixa_titulo,

    // Renda / Faturamento para PJ usa o faturamento estimado
    renda_estimada: typeof fatPresumido === 'number' ? fatPresumido : undefined,

    // Sócios (do mix, complementa localize)
    socios: socios.length > 0 ? socios : undefined,

    // Negativações
    negativacoes,
    total_negativacoes: resumos.debitos?.sumQuantidade ?? negativacoes.length,
    valor_total_negativacoes: resumos.debitos?.sumValorTotal ?? 0,

    // Protestos
    protestos,
    total_protestos: resumos.protestos?.sumQuantidade ?? protestos.length,
    valor_total_protestos: resumos.protestos?.sumValorTotal ?? 0,

    // Ações
    acoes_judiciais: acoes,
    total_acoes_judiciais: resumos.acoes?.sumQuantidade ?? acoes.length,
    valor_total_acoes: resumos.acoes?.sumValorTotal ?? 0,

    // CCF
    ccf,
    total_ccf: resumos.cheques?.sumQuantidade ?? ccf.length,

    // Consultas
    consultas_anteriores: consultas,
    total_consultas_anteriores: resumos.consultasAnteriores?.sumQuantidade ?? consultas.length,
  }
}

// ─── Merge: combina dados de Localize + Mix (Mix tem prioridade) ──────────────
function mergeData(localize: Record<string, any>, mix: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  const allKeys = new Set([...Object.keys(localize), ...Object.keys(mix)])
  for (const key of allKeys) {
    const mixVal = mix[key]
    const locVal = localize[key]
    // Mix tem prioridade, exceto para arrays — faz merge inteligente
    if (Array.isArray(mixVal) && Array.isArray(locVal) && mixVal.length === 0 && locVal.length > 0) {
      result[key] = locVal
    } else if (mixVal !== undefined && mixVal !== null && mixVal !== '') {
      result[key] = mixVal
    } else if (locVal !== undefined && locVal !== null && locVal !== '') {
      result[key] = locVal
    }
  }
  return result
}

// ─── Calcula totais gerais ────────────────────────────────────────────────────
function calcularTotais(r: Partial<RelatorioCompleto>) {
  const totalDividas = (r.total_negativacoes ?? 0) + (r.total_protestos ?? 0) +
                       (r.total_acoes_judiciais ?? 0) + (r.total_ccf ?? 0)
  const valorTotal   = (r.valor_total_negativacoes ?? 0) + (r.valor_total_protestos ?? 0) +
                       (r.valor_total_acoes ?? 0)
  return { total_dividas: totalDividas, valor_total_dividas: valorTotal }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT POST — Consulta completa Assertiva
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documento, tipo } = body as { documento: string; tipo: 'pf' | 'pj' }

    if (!documento || !tipo) {
      return NextResponse.json({ erro: 'documento e tipo são obrigatórios' }, { status: 400 })
    }

    const doc = only(documento)
    if ((tipo === 'pf' && doc.length !== 11) || (tipo === 'pj' && doc.length !== 14)) {
      return NextResponse.json({ erro: 'Documento inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const cacheChave = `${tipo}:${doc}`

    // ── Verifica cache no DB ──────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('assertiva_cache_factoring')
      .select('resultado')
      .eq('chave', cacheChave)
      .gte('expira_em', new Date().toISOString())
      .maybeSingle()

    if (cached?.resultado) {
      return NextResponse.json({ ...cached.resultado, _cache: true })
    }

    // ── Obtém token OAuth2 ────────────────────────────────────────────────────
    let token: string | null = null
    try {
      token = await getToken()
    } catch (e: any) {
      if (e?.message === 'PAGAMENTO_PENDENTE') {
        return NextResponse.json(
          { erro: 'Conta Assertiva bloqueada — pagamento pendente. Acesse o portal Assertiva e regularize o boleto.' },
          { status: 402 }
        )
      }
    }
    if (!token) {
      return NextResponse.json(
        { erro: 'Não foi possível autenticar com a Assertiva. Verifique as credenciais.' },
        { status: 502 }
      )
    }

    // ── Chamadas paralelas: Localize + Crédito Mix ────────────────────────────
    let localizeRaw: any = null
    let mixRaw: any = null
    const erros: string[] = []

    if (tipo === 'pf') {
      // PF: Localize CPF + Crédito Mix PF com flags ACOES,POSITIVO
      const [locRes, mixRes] = await Promise.allSettled([
        callApi(
          `${LOCALIZE_BASE}/cpf?cpf=${doc}&idFinalidade=${ID_FINALIDADE}`,
          token
        ),
        callApi(
          `${MIX_BASE}/pf/${doc}?idFinalidade=${ID_FINALIDADE}&opcoes=ACOES,POSITIVO`,
          token
        ),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const detail = locRes.status === 'rejected'
          ? String(locRes.reason)
          : `HTTP ${locRes.value.status} — ${JSON.stringify(locRes.value.data?.message ?? '')}`
        erros.push(`Localize CPF: ${detail}`)
        console.error('[Assertiva] Localize CPF error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const detail = mixRes.status === 'rejected'
          ? String(mixRes.reason)
          : `HTTP ${mixRes.value.status} — ${JSON.stringify(mixRes.value.data?.message ?? '')}`
        erros.push(`Crédito Mix PF: ${detail}`)
        console.error('[Assertiva] Mix PF error:', detail)
      }
    } else {
      // PJ: Localize CNPJ + Crédito Mix PJ com flags ACOES,PARTICIPACOES,FATURAMENTO,SCORE
      const [locRes, mixRes] = await Promise.allSettled([
        callApi(
          `${LOCALIZE_BASE}/cnpj?cnpj=${doc}&idFinalidade=${ID_FINALIDADE}`,
          token
        ),
        callApi(
          `${MIX_BASE}/pj/${doc}?idFinalidade=${ID_FINALIDADE}&opcoes=ACOES,PARTICIPACOES,FATURAMENTO,SCORE`,
          token
        ),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const detail = locRes.status === 'rejected'
          ? String(locRes.reason)
          : `HTTP ${locRes.value.status} — ${JSON.stringify(locRes.value.data?.message ?? '')}`
        erros.push(`Localize CNPJ: ${detail}`)
        console.error('[Assertiva] Localize CNPJ error:', detail)
      }

      if (mixRes.status === 'fulfilled' && mixRes.value.ok) {
        mixRaw = mixRes.value.data
      } else {
        const detail = mixRes.status === 'rejected'
          ? String(mixRes.reason)
          : `HTTP ${mixRes.value.status} — ${JSON.stringify(mixRes.value.data?.message ?? '')}`
        erros.push(`Crédito Mix PJ: ${detail}`)
        console.error('[Assertiva] Mix PJ error:', detail)
      }
    }

    if (!localizeRaw && !mixRaw) {
      return NextResponse.json(
        { erro: 'Nenhuma resposta válida da Assertiva', detalhes: erros },
        { status: 502 }
      )
    }

    // ── Parse e merge dos dados ───────────────────────────────────────────────
    const localizeParsed = tipo === 'pf'
      ? parseLocalizePf(localizeRaw)
      : parseLocalizePj(localizeRaw)

    const mixParsed = tipo === 'pf'
      ? parseMixPf(mixRaw)
      : parseMixPj(mixRaw)

    const merged = mergeData(localizeParsed, mixParsed)
    const totais = calcularTotais(merged as Partial<RelatorioCompleto>)

    // ── Monta relatório final ─────────────────────────────────────────────────
    const relatorio: RelatorioCompleto = {
      documento: doc,
      tipo,
      ...merged,
      ...totais,
      _localize: localizeRaw,
      _credito: mixRaw,
      _gerado_em: new Date().toISOString(),
      _erros: erros.length ? erros : undefined,
    } as RelatorioCompleto

    // ── Salva no cache DB ─────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_cache_factoring').upsert(
        {
          chave: cacheChave,
          resultado: relatorio,
          consultado_em: new Date().toISOString(),
          expira_em: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'chave' }
      )
    } catch { /* ignora se tabela não existir ainda */ }

    // ── Log da consulta ───────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_log_factoring').insert({
        tipo: tipo === 'pf' ? 'credito_pf' : 'credito_pj',
        chave: cacheChave,
        status_http: 200,
        hit_cache: false,
      })
    } catch { /* ignora se tabela não existir ainda */ }

    return NextResponse.json(relatorio)
  } catch (err: any) {
    console.error('[Assertiva] Erro no relatório:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}
