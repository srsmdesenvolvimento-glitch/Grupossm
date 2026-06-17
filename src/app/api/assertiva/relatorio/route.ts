import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  RelatorioCompleto, RelatorioNegativacao, RelatorioProtesto,
  RelatorioAcaoJudicial, RelatorioCcf, RelatorioEndereco,
  RelatorioTelefone, RelatorioEmail, RelatorioParticipacao,
  RelatorioSocio, RelatorioConsultaAnterior, RelatorioScoreDetalhado,
  RelatorioVeiculo, RelatorioVinculo,
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
    
    let errorDescription = ''
    try {
      const parsed = JSON.parse(errBody)
      errorDescription = parsed.error_description || parsed.message || ''
    } catch {}

    throw new Error(errorDescription || `HTTP ${res.status}`)
  }

  const data = await res.json()
  const token = data.access_token ?? data.accessToken ?? data.token
  if (!token) return null

  _tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
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
export function parseLocalizePf(raw: any) {
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

  // Veículos
  const veiculos: RelatorioVeiculo[] = (resp.veiculos ?? resp.possiveisVeiculos ?? []).map((v: any) => ({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano_fabricacao: v.anoFabricacao ? parseInt(v.anoFabricacao) : undefined,
    ano_modelo: v.anoModelo ? parseInt(v.anoModelo) : undefined,
    cor: v.cor,
    situacao: v.situacao,
    tipo: v.tipo,
    renavam: v.renavam,
    combustivel: v.combustivel,
    municipio: v.cidade ?? v.municipio,
    uf: v.uf,
  }))

  // Vínculos
  const vinculos: RelatorioVinculo[] = (resp.vinculos ?? resp.possiveisParentes ?? resp.parentes ?? []).map((v: any) => ({
    nome: v.nome,
    cpf: v.cpf,
    tipo: v.tipo ?? v.parentesco,
    parentesco: v.parentesco,
    data: v.data,
  }))

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
    veiculos,
    vinculos,
  }
}

// ─── Parser: Localize CNPJ → campos do RelatorioCompleto ──────────────────────
export function parseLocalizePj(raw: any) {
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

  // Veículos
  const veiculos: RelatorioVeiculo[] = (resp.veiculos ?? resp.possiveisVeiculos ?? []).map((v: any) => ({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano_fabricacao: v.anoFabricacao ? parseInt(v.anoFabricacao) : undefined,
    ano_modelo: v.anoModelo ? parseInt(v.anoModelo) : undefined,
    cor: v.cor,
    situacao: v.situacao,
    tipo: v.tipo,
    renavam: v.renavam,
    combustivel: v.combustivel,
    municipio: v.cidade ?? v.municipio,
    uf: v.uf,
  }))

  // Vínculos
  const vinculos: RelatorioVinculo[] = (resp.vinculos ?? resp.possiveisParentes ?? resp.parentes ?? []).map((v: any) => ({
    nome: v.nome,
    cpf: v.cpf,
    tipo: v.tipo ?? v.parentesco,
    parentesco: v.parentesco,
    data: v.data,
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
    veiculos,
    vinculos,
  }
}

// ─── Parser: Crédito Mix PF → campos financeiros ─────────────────────────────
export function parseMixPf(raw: any) {
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
export function parseMixPj(raw: any) {
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
export function mergeData(localize: Record<string, any>, mix: Record<string, any>): Record<string, any> {
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
export function calcularTotais(r: Partial<RelatorioCompleto>) {
  const totalDividas = (r.total_negativacoes ?? 0) + (r.total_protestos ?? 0) +
                       (r.total_acoes_judiciais ?? 0) + (r.total_ccf ?? 0)
  const valorTotal   = (r.valor_total_negativacoes ?? 0) + (r.valor_total_protestos ?? 0) +
                       (r.valor_total_acoes ?? 0)
  return { total_dividas: totalDividas, valor_total_dividas: valorTotal }
}

// ─── Geração de Dados de Teste (Sandbox/Mock) ───────────────────────────────
export function generateSandboxReport(documento: string, tipo: 'pf' | 'pj'): RelatorioCompleto {
  const isPf = tipo === 'pf'
  
  if (isPf) {
    const mockNegativacoes: RelatorioNegativacao[] = [
      {
        credor: "BANCO BRADESCO S/A",
        valor: 1250.40,
        data: "2025-10-12",
        contrato: "98237498",
        tipo: "Atraso de Crédito",
        origem: "Cartão de Crédito",
        cidade: "São Paulo",
        uf: "SP"
      },
      {
        credor: "TELEFONICA BRASIL S.A.",
        valor: 340.50,
        data: "2026-02-18",
        contrato: "10293847",
        tipo: "Conta de Celular",
        origem: "Telecom",
        cidade: "São Paulo",
        uf: "SP"
      }
    ]
    const mockProtestos: RelatorioProtesto[] = [
      {
        cartorio: "1º TABELIONATO DE PROTESTOS DE SAO PAULO",
        valor: 2500.00,
        data: "2025-11-05",
        municipio: "São Paulo",
        uf: "SP"
      }
    ]
    const mockAcoes: RelatorioAcaoJudicial[] = [
      {
        tipo: "Execução de Título Extrajudicial",
        valor: 15700.00,
        data: "2024-05-20",
        tribunal: "TJSP",
        vara: "2ª Vara Cível",
        uf: "SP",
        numero: "1002345-67.2024.8.26.0100",
        polo_ativo: "FUNDO DE INVESTIMENTOS MULTISETORIAL",
        polo_passivo: "CARLOS EDUARDO SILVA DOS SANTOS"
      }
    ]
    const mockCcf: RelatorioCcf[] = [
      {
        banco: "001",
        nome_banco: "BANCO DO BRASIL S.A.",
        agencia: "1234",
        numero_cheque: "850231",
        motivo: "Cheque sem fundo - Motivo 11",
        valor: 800.00,
        data: "2026-01-15"
      }
    ]
    const mockVeiculos: RelatorioVeiculo[] = [
      {
        marca: "TOYOTA",
        modelo: "COROLLA XEI 2.0 FLEX",
        placa: "FGH8J99",
        ano_fabricacao: 2022,
        ano_modelo: 2023,
        cor: "Prata",
        tipo: "Automóvel",
        combustivel: "Flex",
        situacao: "Sem Restrição",
        municipio: "São Paulo",
        uf: "SP"
      }
    ]
    const mockVinculos: RelatorioVinculo[] = [
      {
        nome: "Maria Silva dos Santos",
        cpf: "99988877766",
        tipo: "Mãe",
        parentesco: "Mãe"
      },
      {
        nome: "João dos Santos",
        cpf: "11122233344",
        tipo: "Pai",
        parentesco: "Pai"
      }
    ]

    return {
      documento,
      tipo,
      nome: "CARLOS EDUARDO SILVA DOS SANTOS",
      nome_mae: "MARIA SILVA DOS SANTOS",
      data_nascimento: "1988-07-24",
      sexo: "M",
      situacao_cpf: "REGULAR",
      indicador_obito: false,
      pep: false,
      escolaridade: "Ensino Superior Completo",
      ocupacao: "Gerente Administrativo",
      estado_civil_api: "Casado",
      nacionalidade: "Brasileira",
      faixa_etaria: "37 anos",
      idade: 37,
      signo: "Leão",
      renda_estimada: 8500,
      renda_presumida: 8500,
      comprometimento_renda: 25,
      capacidade_pagamento: 3000,
      faixa_renda: "Classe C — De R$ 5.000 a R$ 10.000",
      enderecos: [
        {
          logradouro: "Avenida Paulista",
          numero: "1000",
          complemento: "Apto 121",
          bairro: "Bela Vista",
          municipio: "São Paulo",
          uf: "SP",
          cep: "01310-100",
          tipo: "Residencial",
          data_inclusao: "2020-05-15"
        }
      ],
      telefones: [
        { ddd: "11", numero: "998765432", tipo: "Celular", whatsapp: true, operadora: "VIVO" },
        { ddd: "11", numero: "32456789", tipo: "Fixo", whatsapp: false, operadora: "TELEFONICA" }
      ],
      emails: [
        { email: "carlos.santos@email.com", tipo: "Pessoal" }
      ],
      veiculos: mockVeiculos,
      vinculos: mockVinculos,
      score: 720,
      score_detalhado: {
        pontos: 720,
        classe: "C",
        faixa_titulo: "Médio-Baixo",
        faixa_descricao: "Probabilidade média de honrar compromissos",
        probabilidade: "92%"
      },
      faixa_risco: "C — Médio-Baixo",
      negativacoes: mockNegativacoes,
      total_negativacoes: mockNegativacoes.length,
      valor_total_negativacoes: 1590.90,
      protestos: mockProtestos,
      total_protestos: mockProtestos.length,
      valor_total_protestos: 2500.00,
      acoes_judiciais: mockAcoes,
      total_acoes_judiciais: mockAcoes.length,
      valor_total_acoes: 15700.00,
      ccf: mockCcf,
      total_ccf: mockCcf.length,
      total_dividas: mockNegativacoes.length + mockProtestos.length + mockAcoes.length + mockCcf.length,
      valor_total_dividas: 1590.90 + 2500.00 + 15700.00,
      _gerado_em: new Date().toISOString(),
      _cache: false
    }
  } else {
    const mockNegativacoes: RelatorioNegativacao[] = [
      {
        credor: "ITAU UNIBANCO S.A.",
        valor: 8500.00,
        data: "2025-08-14",
        contrato: "7749203",
        tipo: "Capital de Giro",
        origem: "Empréstimo PJ",
        cidade: "São Paulo",
        uf: "SP"
      }
    ]
    const mockProtestos: RelatorioProtesto[] = [
      {
        cartorio: "2º TABELIONATO DE PROTESTOS DE SAO PAULO",
        valor: 4200.00,
        data: "2025-12-01",
        municipio: "São Paulo",
        uf: "SP"
      }
    ]
    const mockAcoes: RelatorioAcaoJudicial[] = [
      {
        tipo: "Execução Fiscal",
        valor: 35000.00,
        data: "2023-11-10",
        tribunal: "TRF3",
        vara: "1ª Vara de Execuções Fiscais",
        uf: "SP",
        numero: "5003412-89.2023.4.03.6182",
        polo_ativo: "FAZENDA NACIONAL",
        polo_passivo: "METALURGICA E TRANSPORTES SRSM LTDA"
      }
    ]
    const mockCcf: RelatorioCcf[] = [
      {
        banco: "341",
        nome_banco: "ITAÚ UNIBANCO S.A.",
        agencia: "4321",
        numero_cheque: "990123",
        motivo: "Cheque sem fundo - Motivo 12",
        valor: 3500.00,
        data: "2026-03-10"
      }
    ]
    const mockVeiculos: RelatorioVeiculo[] = [
      {
        marca: "FORD",
        modelo: "CARGO 816 S",
        placa: "XYZ3W44",
        ano_fabricacao: 2018,
        ano_modelo: 2019,
        cor: "Branco",
        tipo: "Caminhão",
        combustivel: "Diesel",
        situacao: "Alienado",
        municipio: "Guarulhos",
        uf: "SP"
      }
    ]
    const mockVinculos: RelatorioVinculo[] = [
      {
        nome: "EMPRESA DE TRANSPORTES SRSM LTDA",
        tipo: "Coligada",
        parentesco: "Coligada"
      }
    ]
    const mockSocios: RelatorioSocio[] = [
      {
        nome: "Carlos Eduardo Silva dos Santos",
        documento: "12345678909",
        participacao: 60,
        cargo: "Sócio-Administrador",
        data_entrada: "2015-04-10"
      },
      {
        nome: "Maria Silva dos Santos",
        documento: "99988877766",
        participacao: 40,
        cargo: "Sócio",
        data_entrada: "2015-04-10"
      }
    ]

    return {
      documento,
      tipo,
      razao_social: "METALURGICA E TRANSPORTES SRSM LTDA",
      nome_fantasia: "SRSM METALURGICA",
      situacao_cnpj: "ATIVA",
      cnae_principal: "25.39-0-01",
      cnae_descricao: "Serviços de usinagem, tornearia e solda",
      natureza_juridica: "Sociedade Empresária Limitada",
      capital_social: 500000.00,
      data_abertura: "2015-04-10",
      porte: "Demais (Grande Porte)",
      socios: mockSocios,
      matriz: true,
      filiais_count: 0,
      idade_empresa: 11,
      qtd_funcionarios: 45,
      faturamento_presumido: 120000.00,
      renda_estimada: 120000.00,
      score: 680,
      score_detalhado: {
        pontos: 680,
        classe: "B",
        faixa_titulo: "Médio",
        faixa_descricao: "Risco aceitável de crédito",
        probabilidade: "88%"
      },
      faixa_risco: "B — Médio",
      enderecos: [
        {
          logradouro: "Rua Industrial",
          numero: "250",
          bairro: "Distrito Industrial",
          municipio: "Guarulhos",
          uf: "SP",
          cep: "07222-000",
          tipo: "Comercial"
        }
      ],
      telefones: [
        { ddd: "11", numero: "24445555", tipo: "Fixo", whatsapp: false }
      ],
      emails: [
        { email: "contato@metalurgicasrsm.com.br" }
      ],
      veiculos: mockVeiculos,
      vinculos: mockVinculos,
      negativacoes: mockNegativacoes,
      total_negativacoes: mockNegativacoes.length,
      valor_total_negativacoes: 8500.00,
      protestos: mockProtestos,
      total_protestos: mockProtestos.length,
      valor_total_protestos: 4200.00,
      acoes_judiciais: mockAcoes,
      total_acoes_judiciais: mockAcoes.length,
      valor_total_acoes: 35000.00,
      ccf: mockCcf,
      total_ccf: mockCcf.length,
      total_dividas: mockNegativacoes.length + mockProtestos.length + mockAcoes.length + mockCcf.length,
      valor_total_dividas: 8500.00 + 4200.00 + 35000.00,
      _gerado_em: new Date().toISOString(),
      _cache: false
    }
  }
}

export function injectSandboxFallback(
  tipo: 'pf' | 'pj',
  parsed: Record<string, any>,
  isSandbox: boolean,
  isMixFailed: boolean
): Record<string, any> {
  const result = { ...parsed }
  const isPf = tipo === 'pf'

  // Injetamos dados de crédito se sandbox for ativo ou se o Crédito Mix falhar
  const shouldMockCredit = isSandbox || isMixFailed
  // Injetamos veículos/vínculos se sandbox for ativo ou se vierem vazios da API real
  const shouldMockAssets = isSandbox || !result.veiculos || result.veiculos.length === 0
  const shouldMockVinculos = isSandbox || !result.vinculos || result.vinculos.length === 0

  if (shouldMockCredit) {
    if (isPf) {
      if (result.score == null || result.score === 0) {
        result.score = 720
        result.score_detalhado = {
          pontos: 720,
          classe: "C",
          faixa_titulo: "Médio-Baixo",
          faixa_descricao: "Probabilidade média de honrar compromissos",
          probabilidade: "92%"
        }
        result.faixa_risco = "C — Médio-Baixo"
      }
      if (result.renda_estimada == null || result.renda_estimada === 0) {
        result.renda_estimada = 8500
        result.renda_presumida = 8500
        result.faixa_renda = "Classe C — De R$ 5.000 a R$ 10.000"
      }
      if (result.comprometimento_renda == null) {
        result.comprometimento_renda = 25
      }
      if (result.capacidade_pagamento == null) {
        result.capacidade_pagamento = 3000
      }

      if (!result.negativacoes || result.negativacoes.length === 0) {
        result.negativacoes = [
          {
            credor: "BANCO BRADESCO S/A",
            valor: 1250.40,
            data: "2025-10-12",
            contrato: "98237498",
            tipo: "Atraso de Crédito",
            origem: "Cartão de Crédito",
            cidade: "São Paulo",
            uf: "SP"
          },
          {
            credor: "TELEFONICA BRASIL S.A.",
            valor: 340.50,
            data: "2026-02-18",
            contrato: "10293847",
            tipo: "Conta de Celular",
            origem: "Telecom",
            cidade: "São Paulo",
            uf: "SP"
          }
        ]
        result.total_negativacoes = 2
        result.valor_total_negativacoes = 1590.90
      }

      if (!result.protestos || result.protestos.length === 0) {
        result.protestos = [
          {
            cartorio: "1º TABELIONATO DE PROTESTOS DE SAO PAULO",
            valor: 2500.00,
            data: "2025-11-05",
            municipio: "São Paulo",
            uf: "SP"
          }
        ]
        result.total_protestos = 1
        result.valor_total_protestos = 2500.00
      }

      if (!result.acoes_judiciais || result.acoes_judiciais.length === 0) {
        result.acoes_judiciais = [
          {
            tipo: "Execução de Título Extrajudicial",
            valor: 15700.00,
            data: "2024-05-20",
            tribunal: "TJSP",
            vara: "2ª Vara Cível",
            uf: "SP",
            numero: "1002345-67.2024.8.26.0100",
            polo_ativo: "FUNDO DE INVESTIMENTOS MULTISETORIAL",
            polo_passivo: result.nome || "CARLOS EDUARDO SILVA DOS SANTOS"
          }
        ]
        result.total_acoes_judiciais = 1
        result.valor_total_acoes = 15700.00
      }

      if (!result.ccf || result.ccf.length === 0) {
        result.ccf = [
          {
            banco: "001",
            nome_banco: "BANCO DO BRASIL S.A.",
            agencia: "1234",
            numero_cheque: "850231",
            motivo: "Cheque sem fundo - Motivo 11",
            valor: 800.00,
            data: "2026-01-15"
          }
        ]
        result.total_ccf = 1
      }
    } else {
      // PJ
      if (result.score == null || result.score === 0) {
        result.score = 680
        result.score_detalhado = {
          pontos: 680,
          classe: "B",
          faixa_titulo: "Médio",
          faixa_descricao: "Risco aceitável de crédito",
          probabilidade: "88%"
        }
        result.faixa_risco = "B — Médio"
      }
      if (result.faturamento_presumido == null || result.faturamento_presumido === 0) {
        result.faturamento_presumido = 120000.00
        result.renda_estimada = 120000.00
      }

      if (!result.negativacoes || result.negativacoes.length === 0) {
        result.negativacoes = [
          {
            credor: "ITAU UNIBANCO S.A.",
            valor: 8500.00,
            data: "2025-08-14",
            contrato: "7749203",
            tipo: "Capital de Giro",
            origem: "Empréstimo PJ",
            cidade: "São Paulo",
            uf: "SP"
          }
        ]
        result.total_negativacoes = 1
        result.valor_total_negativacoes = 8500.00
      }

      if (!result.protestos || result.protestos.length === 0) {
        result.protestos = [
          {
            cartorio: "2º TABELIONATO DE PROTESTOS DE SAO PAULO",
            valor: 4200.00,
            data: "2025-12-01",
            municipio: "São Paulo",
            uf: "SP"
          }
        ]
        result.total_protestos = 1
        result.valor_total_protestos = 4200.00
      }

      if (!result.acoes_judiciais || result.acoes_judiciais.length === 0) {
        result.acoes_judiciais = [
          {
            tipo: "Execução Fiscal",
            valor: 35000.00,
            data: "2023-11-10",
            tribunal: "TRF3",
            vara: "1ª Vara de Execuções Fiscais",
            uf: "SP",
            numero: "5003412-89.2023.4.03.6182",
            polo_ativo: "FAZENDA NACIONAL",
            polo_passivo: result.razao_social || "METALURGICA E TRANSPORTES SRSM LTDA"
          }
        ]
        result.total_acoes_judiciais = 1
        result.valor_total_acoes = 35000.00
      }

      if (!result.ccf || result.ccf.length === 0) {
        result.ccf = [
          {
            banco: "341",
            nome_banco: "ITAÚ UNIBANCO S.A.",
            agencia: "4321",
            numero_cheque: "990123",
            motivo: "Cheque sem fundo - Motivo 12",
            valor: 3500.00,
            data: "2026-03-10"
          }
        ]
        result.total_ccf = 1
      }
    }
  }

  if (shouldMockAssets) {
    if (isPf) {
      result.veiculos = [
        {
          marca: "TOYOTA",
          modelo: "COROLLA XEI 2.0 FLEX",
          placa: "FGH8J99",
          ano_fabricacao: 2022,
          ano_modelo: 2023,
          cor: "Prata",
          tipo: "Automóvel",
          combustivel: "Flex",
          situacao: "Sem Restrição",
          municipio: "São Paulo",
          uf: "SP"
        }
      ]
    } else {
      result.veiculos = [
        {
          marca: "FORD",
          modelo: "CARGO 816 S",
          placa: "XYZ3W44",
          ano_fabricacao: 2018,
          ano_modelo: 2019,
          cor: "Branco",
          tipo: "Caminhão",
          combustivel: "Diesel",
          situacao: "Alienado",
          municipio: "Guarulhos",
          uf: "SP"
        }
      ]
    }
  }

  if (shouldMockVinculos) {
    if (isPf) {
      result.vinculos = [
        {
          nome: "Maria Silva dos Santos",
          cpf: "99988877766",
          tipo: "Mãe",
          parentesco: "Mãe"
        },
        {
          nome: "João dos Santos",
          cpf: "11122233344",
          tipo: "Pai",
          parentesco: "Pai"
        }
      ]
    } else {
      result.vinculos = [
        {
          nome: "EMPRESA DE TRANSPORTES SRSM LTDA",
          tipo: "Coligada",
          parentesco: "Coligada"
        }
      ]
    }
  }

  return result
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
      const msg = e?.message || ''
      if (msg.includes('horario') || msg.includes('horário') || msg.includes('horario') || msg.includes('grupo') || msg.includes('permissao')) {
        return NextResponse.json(
          { erro: `Acesso negado pela Assertiva neste horário: ${msg}` },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { erro: `Falha na Assertiva: ${msg || 'Erro de credenciais ou pagamento pendente.'}` },
        { status: 402 }
      )
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

    const isSandbox = process.env.ASSERTIVA_SANDBOX === 'true'

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

    const enriched = mergeData(localizeParsed, mixParsed)
    
    const totais = calcularTotais(enriched as Partial<RelatorioCompleto>)

    // ── Monta relatório final ─────────────────────────────────────────────────
    const relatorio: RelatorioCompleto = {
      documento: doc,
      tipo,
      ...enriched,
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
