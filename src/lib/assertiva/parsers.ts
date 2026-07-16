import type {
  RelatorioCompleto, RelatorioNegativacao, RelatorioProtesto,
  RelatorioAcaoJudicial, RelatorioCcf, RelatorioEndereco,
  RelatorioTelefone, RelatorioEmail, RelatorioParticipacao,
  RelatorioSocio, RelatorioConsultaAnterior, RelatorioScoreDetalhado,
  RelatorioVeiculo, RelatorioVinculo,
  RelatorioRedeSocial, RelatorioRegistroProfissional, RelatorioSegmentoConsulta,
  RelatorioHistoricoProfissional,
  Analise360ResultadoPJ, Analise360ResultadoPF, Analise360Imovel,
  Analise360Reputacao, Analise360Movimentacao, Analise360Concorrencia,
} from './types'

// Telefones/endereços/emails "adicionados" vêm de um mecanismo à parte da Assertiva
// (anotados via /meu-portal, não localizados automaticamente) — hoje sempre vazios
// pra nós porque nunca usamos aqueles endpoints, mas são contatos válidos assim que
// passarmos a preencher o Meu Portal, então já mesclamos por precaução.
function extrairTelefones(rawTels: any, rawAdicionados: any): RelatorioTelefone[] {
  const tels: RelatorioTelefone[] = []
  for (const t of (rawTels?.moveis ?? [])) {
    tels.push({ ddd: t.ddd ?? '', numero: t.numero ?? '', tipo: 'Celular', whatsapp: t.aplicativos?.whatsApp ?? false, operadora: t.operadora })
  }
  for (const t of (rawTels?.fixos ?? [])) {
    tels.push({ ddd: t.ddd ?? '', numero: t.numero ?? '', tipo: 'Fixo', whatsapp: t.aplicativos?.whatsAppBusiness ?? false, operadora: t.operadora })
  }
  for (const t of (rawAdicionados?.moveis ?? [])) {
    tels.push({ numero: t.numero ?? '', tipo: 'Celular (adicionado)', whatsapp: t.aplicativos?.whatsApp ?? false })
  }
  for (const t of (rawAdicionados?.fixos ?? [])) {
    tels.push({ numero: t.numero ?? '', tipo: 'Fixo (adicionado)', whatsapp: false })
  }
  return tels
}

function extrairRedesSociais(raw: any): RelatorioRedeSocial[] {
  return (raw ?? []).map((r: any) => ({ nome: r.nome, url: r.url }))
}

function extrairRegistrosProfissionais(raw: any): RelatorioRegistroProfissional[] {
  return (raw ?? []).map((r: any) => ({
    profissao: r.profissao,
    sigla: r.sigla,
    situacao: r.situacao,
    uf: r.uf,
    numero_inscricao: r.numeroInscricao,
    data_inscricao: formatarDataParaIso(r.dataInscricao),
    faixa_salarial: r.faixaSalarial,
  }))
}

function extrairSegmentosConsulta(historico: any): { total?: number; segmentos: RelatorioSegmentoConsulta[] } {
  return {
    total: historico?.quantidadeTotal,
    segmentos: (historico?.segmentos ?? []).map((s: any) => ({ segmento: s.segmento, quantidade: s.quantidade })),
  }
}

export function formatarDataParaIso(dataStr?: string): string | undefined {
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

// ─── Parser: Localize CPF → campos do RelatorioCompleto ──────────────────────
export function parseLocalizePf(raw: any) {
  if (!raw) return {}
  const resp = raw.resposta ?? raw
  const cad  = resp.dadosCadastrais ?? resp.cadastro ?? resp

  const tels = extrairTelefones(resp.telefones ?? cad.telefones, resp.telefonesAdicionados)

  const ends: RelatorioEndereco[] = [...(resp.enderecos ?? []), ...(resp.enderecosAdicionados ?? [])].map((e: any) => ({
    logradouro: [e.tipoLogradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero?.toString(),
    complemento: e.complemento,
    bairro: e.bairro,
    municipio: e.cidade,
    uf: e.uf,
    cep: e.cep,
    tipo: e.tipo ?? e.tipoEndereco ?? e.classificacao,
    data_inclusao: formatarDataParaIso(e.dataInclusao ?? e.dataAtualizacao),
  }))

  const emails: RelatorioEmail[] = [...(resp.emails ?? []), ...(resp.emailsAdicionados ?? [])].map((e: any) => ({
    email: e.email,
    tipo: e.tipo,
    score: e.score,
  }))

  const parts: RelatorioParticipacao[] = (resp.participacoesEmpresas ?? []).map((p: any) => ({
    cnpj: p.cnpj,
    razao_social: p.razaoSocial,
    data_entrada: p.dataEntrada,
    cargo: p.cargo,
    participacao: p.participacao,
    situacao: p.situacao,
  }))

  const historicoProfissional: RelatorioHistoricoProfissional[] = (resp.possivelHistoricoProfissional ?? []).map((h: any) => ({
    empresa: h.razaoSocial,
    cnpj: h.cnpj,
    cargo: h.cboDescricao,
    setor: h.setor,
    data_registro: formatarDataParaIso(h.dataRegistro),
    renda_estimada: h.rendaEstimada ? parseFloat(h.rendaEstimada) : undefined,
    faixa_salarial: h.faixaSalarial,
  }))
  const histProf = resp.possivelHistoricoProfissional?.[0] ?? {}
  const ocupacao = cad.ocupacao ?? cad.profissao ?? histProf.cboDescricao
  const rendaEstimada = histProf.rendaEstimada ? parseFloat(histProf.rendaEstimada) : undefined

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

  const segmentos = extrairSegmentosConsulta(resp.historicoConsultasPorSegmento)

  return {
    nome: cad.nome,
    nome_mae: cad.maeNome ?? cad.mae ?? cad.nomeMae,
    mae_cpf: cad.maeCpf,
    mae_data_nascimento: formatarDataParaIso(cad.maeDataNascimento),
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
    redes_sociais: extrairRedesSociais(resp.redesSociais),
    registros_profissionais: extrairRegistrosProfissionais(resp.registrosProfissionais),
    historico_profissional: historicoProfissional,
    total_consultas_mercado: segmentos.total,
    segmentos_consulta: segmentos.segmentos,
    participacoes_societarias: parts,
    veiculos,
  }
}

// ─── Parser: Localize CNPJ → campos do RelatorioCompleto ─────────────────────
export function parseLocalizePj(raw: any) {
  if (!raw) return {}
  const resp = raw.resposta ?? raw
  const cad  = resp.dadosCadastrais ?? resp.cadastro ?? resp

  const tels = extrairTelefones(resp.telefones ?? cad.telefones, resp.telefonesAdicionados)

  const ends: RelatorioEndereco[] = [...(resp.enderecos ?? []), ...(resp.enderecosAdicionados ?? [])].map((e: any) => ({
    logradouro: [e.tipoLogradouro, e.logradouro].filter(Boolean).join(' '),
    numero: e.numero?.toString(),
    complemento: e.complemento,
    bairro: e.bairro,
    municipio: e.cidade,
    uf: e.uf,
    cep: e.cep,
    tipo: e.tipo ?? e.tipoEndereco ?? e.classificacao,
    data_inclusao: formatarDataParaIso(e.dataInclusao ?? e.dataAtualizacao),
  }))

  const emails: RelatorioEmail[] = [...(resp.emails ?? []), ...(resp.emailsAdicionados ?? [])].map((e: any) => ({
    email: e.email,
    tipo: e.tipo,
    score: e.score,
  }))

  const socios: RelatorioSocio[] = (resp.socios ?? resp.participacoesEmpresas ?? []).map((s: any) => ({
    nome: s.nome ?? s.razaoSocial ?? s.nomeOuRazaoSocial,
    documento: s.documento ?? s.cpf ?? s.cnpj,
    participacao: s.participacao,
    cargo: s.cargo ?? s.qualificacao,
    data_entrada: s.dataEntrada,
    qualificacao: s.qualificacao ?? s.qualificacaoSocio,
  }))

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

  const segmentos = extrairSegmentosConsulta(resp.historicoConsultasPorSegmento)

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
    redes_sociais: extrairRedesSociais(resp.redesSociais),
    total_consultas_mercado: segmentos.total,
    segmentos_consulta: segmentos.segmentos,
    veiculos,
  }
}

// ─── Parser: Score/Crédito (Análise 360) → score, negativações, protestos, ──
// ações, cheques, renda/faturamento presumido. Confirmado por contrato + teste
// ao vivo em 2026-07-14: este é o produto REALMENTE contratado para dados
// financeiros — NÃO é o Mix (que retorna 403, fora do plano). Endpoints:
// GET /score/v3/pf/credito/{cpf}?acoes=true&positivo=true&idFinalidade=2
// GET /score/v3/pj/credito/{cnpj}?acoes=true&idFinalidade=2
function extrairListaComTotais(bloco: any): { list: any[]; qtd?: number; valorTotal?: number } {
  if (!bloco || Array.isArray(bloco)) return { list: Array.isArray(bloco) ? bloco : [] }
  return {
    list: bloco.list ?? [],
    qtd: bloco.qtdDebitos ?? bloco.qtdProtestos ?? bloco.qtdAcoes ?? bloco.qtdCheques ?? bloco.list?.length,
    valorTotal: typeof bloco.valorTotal === 'number' ? bloco.valorTotal : undefined,
  }
}

export function parseScoreCredito(raw: any, tipo: 'pf' | 'pj'): Partial<RelatorioCompleto> {
  if (!raw) return {}
  const resp = raw.resposta ?? {}
  const scoreRaw = resp.score ?? {}

  const scoreDetalhado: RelatorioScoreDetalhado = {
    pontos: scoreRaw.pontos,
    classe: scoreRaw.classe,
    faixa_titulo: scoreRaw.faixa?.titulo,
    faixa_descricao: scoreRaw.faixa?.descricao,
    cadastro_positivo: scoreRaw.cadastroPositivo ? {
      suspenso: scoreRaw.cadastroPositivo.suspenso,
      atrasoConsumo: scoreRaw.cadastroPositivo.atrasoConsumo,
      atrasoRecente: scoreRaw.cadastroPositivo.atrasoRecente,
      relacionamentoCC: scoreRaw.cadastroPositivo.relacionamentoCC,
      comprometimentoRenda: scoreRaw.cadastroPositivo.comprometimentoRenda,
    } : undefined,
  }

  const debitos = extrairListaComTotais(resp.registrosDebitos)
  const negativacoes: RelatorioNegativacao[] = debitos.list.map((d: any) => ({
    credor: d.credor,
    valor: d.valor,
    data: formatarDataParaIso(d.dataInclusao ?? d.dataVencimento),
    contrato: d.contrato?.toString(),
    tipo: d.tipoDebito,
    origem: d.tipoDevedor?.titulo,
    cidade: d.cidade,
    uf: d.uf,
  }))

  const protestosRaw = extrairListaComTotais(resp.protestosPublicos)
  const protestos: RelatorioProtesto[] = protestosRaw.list.map((p: any) => ({
    cartorio: p.cartorio?.toString(),
    valor: p.valor,
    data: formatarDataParaIso(p.data),
    municipio: p.cidade,
    uf: p.uf,
  }))

  // `acoes` vem como irmão de `resposta` (não dentro dela) quando acoes=true é passado
  const acoesRaw = extrairListaComTotais(raw.acoes)
  const acoesJudiciais: RelatorioAcaoJudicial[] = acoesRaw.list.map((a: any) => ({
    tipo: a.tipo?.titulo ?? a.tipo,
    descricao: a.tipo?.descricao,
    valor: a.valor,
    data: formatarDataParaIso(a.data),
    vara: a.vara?.toString(),
    tribunal: a.forum,
    cidade: a.cidade,
    uf: a.uf,
  }))

  const chequesRaw = extrairListaComTotais(resp.cheques)
  const ccf: RelatorioCcf[] = chequesRaw.list.map((c: any) => ({
    banco: c.banco,
    nome_banco: c.nomeBanco,
    agencia: c.agencia,
    numero_cheque: c.numeroCheque,
    data: formatarDataParaIso(c.data),
    motivo: c.motivoDescricao ?? c.motivo,
    valor: c.valor,
  }))

  const consultasRaw = extrairListaComTotais(resp.ultimasConsultas)
  const consultas: RelatorioConsultaAnterior[] = consultasRaw.list.map((c: any) => ({
    consultante: c.consultante,
    data: formatarDataParaIso(c.dataOcorrencia),
  }))

  const rendaOuFaturamento = tipo === 'pf' ? resp.rendaPresumida?.valor : resp.faturamentoEstimado?.valor

  return {
    score: scoreDetalhado.pontos,
    score_detalhado: scoreDetalhado,
    faixa_risco: scoreDetalhado.classe ? `${scoreDetalhado.classe} — ${scoreDetalhado.faixa_titulo ?? ''}` : scoreDetalhado.faixa_titulo,
    renda_estimada: tipo === 'pf' ? rendaOuFaturamento : undefined,
    renda_presumida: tipo === 'pf' ? rendaOuFaturamento : undefined,
    faturamento_presumido: tipo === 'pj' ? rendaOuFaturamento : undefined,

    negativacoes,
    total_negativacoes: debitos.qtd ?? negativacoes.length,
    valor_total_negativacoes: debitos.valorTotal ?? 0,

    protestos,
    total_protestos: protestosRaw.qtd ?? protestos.length,
    valor_total_protestos: (typeof protestosRaw.valorTotal === 'number' ? protestosRaw.valorTotal : 0),

    acoes_judiciais: acoesJudiciais,
    total_acoes_judiciais: acoesRaw.qtd ?? acoesJudiciais.length,
    valor_total_acoes: acoesRaw.valorTotal ?? 0,

    ccf,
    total_ccf: chequesRaw.qtd ?? ccf.length,

    consultas_anteriores: consultas,
    total_consultas_anteriores: consultasRaw.qtd ?? consultas.length,
  }
}

// ─── Parser: Histórico de Veículos (produto Veículos) → bens do titular ──────
// Endpoint /veiculos/v3/historico-veiculos?documento=CPF|CNPJ — fonte dedicada e
// confiável de veículos no nome da pessoa/empresa (diferente do array incidental
// `possiveisVeiculos` do Localize, que é apenas uma inferência).
function limparSufixo(s?: string): string | undefined {
  if (!s) return undefined
  return s.replace(/[,\s]+$/, '').trim() || undefined
}

export function parseHistoricoVeiculos(raw: any): RelatorioVeiculo[] {
  if (!raw) return []
  const resp = raw.resposta ?? raw
  const lista = resp.historicoVeiculos ?? []
  return lista.map((v: any): RelatorioVeiculo => {
    const marcaModelo = limparSufixo(v.marcaModelo) ?? ''
    const [marca, ...resto] = marcaModelo.split('/')
    return {
      placa: limparSufixo(v.placa),
      marca: marca?.trim() || undefined,
      modelo: resto.join('/').trim() || undefined,
      ano_fabricacao: v.anoFabricacao != null ? parseInt(v.anoFabricacao, 10) : undefined,
      ano_modelo: v.anoModelo != null ? parseInt(v.anoModelo, 10) : undefined,
      cor: limparSufixo(v.cor),
      tipo: limparSufixo(v.especie),
      renavam: v.renavam?.toString(),
      combustivel: limparSufixo(v.combustivel),
      municipio: limparSufixo(v.cidade),
      uf: limparSufixo(v.uf),
    }
  })
}

// ─── Mescla veículos do histórico dedicado com os incidentais do Localize ────
export function mesclarVeiculos(localizeVeiculos: RelatorioVeiculo[] = [], historico: RelatorioVeiculo[] = []): RelatorioVeiculo[] {
  const porPlaca = new Map<string, RelatorioVeiculo>()
  for (const v of localizeVeiculos) {
    const chave = v.placa || JSON.stringify(v)
    porPlaca.set(chave, v)
  }
  for (const v of historico) {
    const chave = v.placa || JSON.stringify(v)
    porPlaca.set(chave, { ...porPlaca.get(chave), ...v })
  }
  return Array.from(porPlaca.values())
}

// ─── Parser: Conexões (base-cadastral) → rede de relacionamento ──────────────
// Endpoint /localize-api/v1/base-cadastral/conexoes. Diferente de /cpf e /cnpj,
// que NÃO retornam parentes/sócios — essa é a única fonte real de "vínculos"
// (mãe, pai, cônjuge, irmãos, sócios, empregadores, empresas, convívio familiar).
// A doc oficial (swagger) sugere resposta agrupada por categoria com um array
// `conexoes` em cada uma — mas a API real devolve `resposta` como uma LISTA PLANA
// de conexões (confirmado em teste ao vivo em 2026-07-14). Mantemos as duas formas
// por segurança, priorizando a real.
const CATEGORIAS_CONEXOES = [
  'parentes', 'convivioFamiliar', 'socios', 'empregadores', 'empresas',
  'decisores', 'socio', 'empresasParticipacao',
] as const

function mapearConexao(c: any, categoria?: string): RelatorioVinculo {
  const doc = (c.documento ?? c.cpf ?? c.cnpj ?? '').toString().replace(/\D/g, '')
  return {
    nome: c.nomeOuRazaoSocial ?? c.nome,
    cpf: c.tipoDocumento === 'PF' ? doc : undefined,
    documento: doc || undefined,
    documento_tipo: c.tipoDocumento === 'PJ' ? 'PJ' : 'PF',
    tipo: c.tipoRelacao ?? categoria,
    parentesco: c.relacao ?? c.cargo,
    data: c.dataEntrada ?? c.dataAbertura,
    data_nascimento: formatarDataParaIso(c.dataNascimento),
    telefone: c.telefone,
    whatsapp: c.whatsapp,
  }
}

export function parseConexoes(raw: any): RelatorioVinculo[] {
  if (!raw) return []
  const resp = raw.resposta ?? raw
  const vinculos: RelatorioVinculo[] = []

  if (Array.isArray(resp)) {
    for (const c of resp) vinculos.push(mapearConexao(c))
  } else {
    for (const categoria of CATEGORIAS_CONEXOES) {
      const bloco = resp[categoria]
      const lista = Array.isArray(bloco) ? bloco : (bloco?.conexoes ?? [])
      for (const c of lista) vinculos.push(mapearConexao(c, categoria))
    }
  }

  // Dedup por documento (mesma pessoa pode aparecer em mais de uma categoria)
  const vistos = new Set<string>()
  return vinculos.filter(v => {
    const chave = v.documento || v.nome
    if (!chave) return true
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

// ─── Parser: Pessoas de Referência (só PF) → fonte extra de vínculos ─────────
// Endpoint /localize/v3/pessoas-de-referencia — algoritmo diferente do de
// conexões, então pode achar gente que o outro não achou (ex: empregador).
// Não traz telefone, só nome/documento/relação/data — por isso é somado ao que
// já veio de conexões, não substitui.
export function parsePessoasDeReferencia(raw: any): RelatorioVinculo[] {
  if (!raw) return []
  const lista = raw?.resposta?.pessoasDeReferencia ?? []
  return lista.map((p: any): RelatorioVinculo => {
    const doc = (p.documento ?? '').toString().replace(/\D/g, '')
    const ehPj = doc.length === 14
    return {
      nome: p.nomeOuRazaoSocial,
      cpf: ehPj ? undefined : (doc || undefined),
      documento: doc || undefined,
      documento_tipo: ehPj ? 'PJ' : 'PF',
      tipo: p.relacao,
      parentesco: p.relacao,
      data_nascimento: ehPj ? undefined : formatarDataParaIso(p.dataNascimentoOuAbertura),
      data: ehPj ? p.dataNascimentoOuAbertura : undefined,
    }
  })
}

// ─── Mescla vínculos de conexões (fonte principal, mais rica) com os de ─────
// pessoas-de-referência (fonte extra) — mesma pessoa não aparece duas vezes.
export function mesclarVinculos(principal: RelatorioVinculo[] = [], extra: RelatorioVinculo[] = []): RelatorioVinculo[] {
  const vistos = new Set(principal.map(v => v.documento || v.nome).filter(Boolean))
  const adicionais = extra.filter(v => {
    const chave = v.documento || v.nome
    if (!chave || vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
  return [...principal, ...adicionais]
}

// ─── Enriquece vínculos com endereço/email de uma consulta secundária ────────
// perfis: mapa documento (só dígitos) → dados já parseados (parseLocalizePf/Pj)
export function enriquecerVinculos(
  vinculos: RelatorioVinculo[],
  perfis: Map<string, Record<string, any>>,
): RelatorioVinculo[] {
  return vinculos.map(v => {
    if (!v.documento) return v
    const perfil = perfis.get(v.documento)
    if (!perfil) return v
    return {
      ...v,
      nome: v.nome || perfil.nome,
      telefone: v.telefone || formatarTelefoneVinculo(perfil.telefones?.[0]),
      email: perfil.emails?.[0]?.email,
      endereco: perfil.enderecos?.[0],
      data_nascimento: v.data_nascimento || perfil.data_nascimento,
      _enriquecido: true,
    }
  })
}

function formatarTelefoneVinculo(t?: { ddd?: string; numero?: string }): string | undefined {
  if (!t?.numero) return undefined
  return `${t.ddd ?? ''}${t.numero}`
}

// ─── Parser: Crédito Mix PF → campos financeiros ─────────────────────────────
export function parseMixPf(raw: any) {
  if (!raw) return {}
  const resp    = raw.resposta ?? raw
  const resumos = resp.resumos ?? {}
  const ocorrs  = resp.ocorrencias ?? {}
  const cad     = ocorrs.cadastro ?? {}
  const scoreRaw = ocorrs.score?.score ?? ocorrs.score ?? {}

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

  const protestos: RelatorioProtesto[] = (ocorrs.protestos ?? []).map((p: any) => ({
    cartorio: p.cartorio?.toString(),
    valor: p.valor,
    data: p.data,
    municipio: p.cidade,
    uf: p.uf,
  }))

  const acoes: RelatorioAcaoJudicial[] = (ocorrs.acoes ?? []).map((a: any) => {
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

  const ccf: RelatorioCcf[] = (ocorrs.cheques ?? []).map((c: any) => ({
    banco: c.banco,
    nome_banco: c.nomeBanco,
    agencia: c.agencia,
    numero_cheque: c.numeroCheque,
    data: c.data ?? c.ultimoCheque,
    motivo: c.motivoDescricao ?? c.motivo,
    valor: c.valor,
  }))

  const consultas: RelatorioConsultaAnterior[] = (ocorrs.consultasAnteriores ?? []).map((c: any) => ({
    data: c.dataOcorrencia,
    consultante: c.consultante,
  }))

  const participacoes: RelatorioParticipacao[] = (ocorrs.participacoesEmpresas ?? []).map((p: any) => ({
    cnpj: p.cnpj,
    razao_social: p.razaoSocial,
    data_entrada: p.dataEntrada,
  }))

  const comprRenda = scoreRaw.cadastroPositivo?.comprometimentoRenda?.valor
  const rendaPresumida = resumos.rendaPresumida

  const operacoes = (ocorrs.operacoesCredito ?? ocorrs.operacoes ?? []).map((op: any) => ({
    modalidade: op.modalidade ?? op.tipo ?? op.submodalidade,
    contratante: op.contratante ?? op.instituicao,
    valor: op.valor ?? op.valorContratado,
    data: formatarDataParaIso(op.data ?? op.dataContratacao),
    situacao: op.situacao,
    parcelas: op.parcelas ?? op.quantidadeParcelas,
  }))

  const capacidadePagamento = resumos.capacidadePagamento ?? resumos.capacidade ?? resumos.limiteSugerido

  return {
    nome: cad.nome,
    nome_mae: cad.maeNome ?? cad.nomeMae,
    nome_pai: cad.paiNome ?? cad.nomePai,
    data_nascimento: formatarDataParaIso(cad.dataNascimento),
    sexo: cad.sexo,
    situacao_cpf: cad.situacaoCadastral,
    indicador_obito: cad.obitoProvavel ?? false,
    idade: cad.idade,
    signo: cad.signo,

    score: scoreDetalhado.pontos,
    score_detalhado: scoreDetalhado,
    faixa_risco: scoreDetalhado.classe
      ? `${scoreDetalhado.classe} — ${scoreDetalhado.faixa_titulo ?? ''}`
      : scoreDetalhado.faixa_titulo,

    renda_estimada: typeof rendaPresumida === 'number' ? rendaPresumida : undefined,
    renda_presumida: typeof rendaPresumida === 'number' ? rendaPresumida : undefined,
    comprometimento_renda: typeof comprRenda === 'number' ? comprRenda : undefined,
    capacidade_pagamento: typeof capacidadePagamento === 'number' ? capacidadePagamento : undefined,

    negativacoes,
    total_negativacoes: resumos.debitos?.sumQuantidade ?? negativacoes.length,
    valor_total_negativacoes: resumos.debitos?.sumValorTotal ?? 0,

    protestos,
    total_protestos: resumos.protestos?.sumQuantidade ?? protestos.length,
    valor_total_protestos: resumos.protestos?.sumValorTotal ?? 0,

    acoes_judiciais: acoes,
    total_acoes_judiciais: resumos.acoes?.sumQuantidade ?? acoes.length,
    valor_total_acoes: resumos.acoes?.sumValorTotal ?? 0,

    ccf,
    total_ccf: resumos.cheques?.sumQuantidade ?? ccf.length,

    operacoes_credito: operacoes.length > 0 ? operacoes : undefined,
    total_operacoes_credito: resumos.operacoesCredito?.sumQuantidade ?? operacoes.length,

    participacoes_societarias: participacoes.length > 0 ? participacoes : undefined,

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

  const scoreDetalhado: RelatorioScoreDetalhado = {
    pontos: scoreRaw.pontos,
    classe: scoreRaw.classe,
    faixa_titulo: scoreRaw.faixa?.titulo,
    faixa_descricao: scoreRaw.faixa?.descricao,
    probabilidade: scoreRaw.probabilidade,
  }

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

  const protestos: RelatorioProtesto[] = (ocorrs.protestos ?? []).map((p: any) => ({
    cartorio: p.cartorio?.toString(),
    valor: p.valor,
    data: p.data,
    municipio: p.cidade,
    uf: p.uf,
  }))

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

  const ccf: RelatorioCcf[] = (ocorrs.cheques ?? []).map((c: any) => ({
    banco: c.banco,
    nome_banco: c.nomeBanco,
    agencia: c.agencia,
    numero_cheque: c.numeroCheque,
    data: c.data ?? c.ultimoCheque,
    motivo: c.motivoDescricao ?? c.motivo,
    valor: c.valor,
  }))

  const consultas: RelatorioConsultaAnterior[] = (ocorrs.consultasAnteriores ?? []).map((c: any) => ({
    data: c.dataOcorrencia,
    consultante: c.consultante,
  }))

  const socios: RelatorioSocio[] = (ocorrs.participacoesEmpresas ?? ocorrs.socios ?? []).map((s: any) => ({
    nome: s.nome ?? s.razaoSocial,
    documento: s.cnpj ?? s.cpf,
    data_entrada: s.dataEntrada,
    cargo: s.cargo,
    participacao: s.participacao,
  }))

  const fatPresumido = resumos.faturamentoPresumido

  const operacoes = (ocorrs.operacoesCredito ?? ocorrs.operacoes ?? []).map((op: any) => ({
    modalidade: op.modalidade ?? op.tipo ?? op.submodalidade,
    contratante: op.contratante ?? op.instituicao,
    valor: op.valor ?? op.valorContratado,
    data: formatarDataParaIso(op.data ?? op.dataContratacao),
    situacao: op.situacao,
    parcelas: op.parcelas ?? op.quantidadeParcelas,
  }))

  return {
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

    score: scoreDetalhado.pontos,
    score_detalhado: scoreDetalhado,
    faixa_risco: scoreDetalhado.classe
      ? `${scoreDetalhado.classe} — ${scoreDetalhado.faixa_titulo ?? ''}`
      : scoreDetalhado.faixa_titulo,

    renda_estimada: typeof fatPresumido === 'number' ? fatPresumido : undefined,

    socios: socios.length > 0 ? socios : undefined,

    negativacoes,
    total_negativacoes: resumos.debitos?.sumQuantidade ?? negativacoes.length,
    valor_total_negativacoes: resumos.debitos?.sumValorTotal ?? 0,

    protestos,
    total_protestos: resumos.protestos?.sumQuantidade ?? protestos.length,
    valor_total_protestos: resumos.protestos?.sumValorTotal ?? 0,

    acoes_judiciais: acoes,
    total_acoes_judiciais: resumos.acoes?.sumQuantidade ?? acoes.length,
    valor_total_acoes: resumos.acoes?.sumValorTotal ?? 0,

    ccf,
    total_ccf: resumos.cheques?.sumQuantidade ?? ccf.length,

    operacoes_credito: operacoes.length > 0 ? operacoes : undefined,
    total_operacoes_credito: resumos.operacoesCredito?.sumQuantidade ?? operacoes.length,

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

// ─── Geração de Dados de Teste (Sandbox/Mock) ─────────────────────────────────
export function generateSandboxReport(documento: string, tipo: 'pf' | 'pj'): RelatorioCompleto {
  const isPf = tipo === 'pf'

  if (isPf) {
    const mockNegativacoes: RelatorioNegativacao[] = [
      { credor: 'BANCO BRADESCO S/A', valor: 1250.40, data: '2025-10-12', contrato: '98237498', tipo: 'Atraso de Crédito', origem: 'Cartão de Crédito', cidade: 'São Paulo', uf: 'SP' },
      { credor: 'TELEFONICA BRASIL S.A.', valor: 340.50, data: '2026-02-18', contrato: '10293847', tipo: 'Conta de Celular', origem: 'Telecom', cidade: 'São Paulo', uf: 'SP' },
    ]
    const mockProtestos: RelatorioProtesto[] = [
      { cartorio: '1º TABELIONATO DE PROTESTOS DE SAO PAULO', valor: 2500.00, data: '2025-11-05', municipio: 'São Paulo', uf: 'SP' },
    ]
    const mockAcoes: RelatorioAcaoJudicial[] = [
      { tipo: 'Execução de Título Extrajudicial', valor: 15700.00, data: '2024-05-20', tribunal: 'TJSP', vara: '2ª Vara Cível', uf: 'SP', numero: '1002345-67.2024.8.26.0100', polo_ativo: 'FUNDO DE INVESTIMENTOS MULTISETORIAL', polo_passivo: 'CARLOS EDUARDO SILVA DOS SANTOS' },
    ]
    const mockCcf: RelatorioCcf[] = [
      { banco: '001', nome_banco: 'BANCO DO BRASIL S.A.', agencia: '1234', numero_cheque: '850231', motivo: 'Cheque sem fundo - Motivo 11', valor: 800.00, data: '2026-01-15' },
    ]
    const mockVeiculos: RelatorioVeiculo[] = [
      { marca: 'TOYOTA', modelo: 'COROLLA XEI 2.0 FLEX', placa: 'FGH8J99', ano_fabricacao: 2022, ano_modelo: 2023, cor: 'Prata', tipo: 'Automóvel', combustivel: 'Flex', situacao: 'Sem Restrição', municipio: 'São Paulo', uf: 'SP' },
    ]
    const mockVinculos: RelatorioVinculo[] = [
      { nome: 'Maria Silva dos Santos', cpf: '99988877766', tipo: 'Mãe', parentesco: 'Mãe' },
      { nome: 'João dos Santos', cpf: '11122233344', tipo: 'Pai', parentesco: 'Pai' },
    ]

    return {
      documento, tipo,
      nome: 'CARLOS EDUARDO SILVA DOS SANTOS', nome_mae: 'MARIA SILVA DOS SANTOS',
      data_nascimento: '1988-07-24', sexo: 'M', situacao_cpf: 'REGULAR',
      indicador_obito: false, pep: false, escolaridade: 'Ensino Superior Completo',
      ocupacao: 'Gerente Administrativo', estado_civil_api: 'Casado', nacionalidade: 'Brasileira',
      faixa_etaria: '37 anos', idade: 37, signo: 'Leão',
      renda_estimada: 8500, renda_presumida: 8500, comprometimento_renda: 25, capacidade_pagamento: 3000,
      faixa_renda: 'Classe C — De R$ 5.000 a R$ 10.000',
      enderecos: [{ logradouro: 'Avenida Paulista', numero: '1000', complemento: 'Apto 121', bairro: 'Bela Vista', municipio: 'São Paulo', uf: 'SP', cep: '01310-100', tipo: 'Residencial', data_inclusao: '2020-05-15' }],
      telefones: [
        { ddd: '11', numero: '998765432', tipo: 'Celular', whatsapp: true, operadora: 'VIVO' },
        { ddd: '11', numero: '32456789', tipo: 'Fixo', whatsapp: false, operadora: 'TELEFONICA' },
      ],
      emails: [{ email: 'carlos.santos@email.com', tipo: 'Pessoal' }],
      veiculos: mockVeiculos, vinculos: mockVinculos,
      score: 720, score_detalhado: { pontos: 720, classe: 'C', faixa_titulo: 'Médio-Baixo', faixa_descricao: 'Probabilidade média de honrar compromissos', probabilidade: '92%' },
      faixa_risco: 'C — Médio-Baixo',
      negativacoes: mockNegativacoes, total_negativacoes: mockNegativacoes.length, valor_total_negativacoes: 1590.90,
      protestos: mockProtestos, total_protestos: mockProtestos.length, valor_total_protestos: 2500.00,
      acoes_judiciais: mockAcoes, total_acoes_judiciais: mockAcoes.length, valor_total_acoes: 15700.00,
      ccf: mockCcf, total_ccf: mockCcf.length,
      total_dividas: mockNegativacoes.length + mockProtestos.length + mockAcoes.length + mockCcf.length,
      valor_total_dividas: 1590.90 + 2500.00 + 15700.00,
      _gerado_em: new Date().toISOString(), _cache: false,
    }
  } else {
    const mockNegativacoes: RelatorioNegativacao[] = [
      { credor: 'ITAU UNIBANCO S.A.', valor: 8500.00, data: '2025-08-14', contrato: '7749203', tipo: 'Capital de Giro', origem: 'Empréstimo PJ', cidade: 'São Paulo', uf: 'SP' },
    ]
    const mockProtestos: RelatorioProtesto[] = [
      { cartorio: '2º TABELIONATO DE PROTESTOS DE SAO PAULO', valor: 4200.00, data: '2025-12-01', municipio: 'São Paulo', uf: 'SP' },
    ]
    const mockAcoes: RelatorioAcaoJudicial[] = [
      { tipo: 'Execução Fiscal', valor: 35000.00, data: '2023-11-10', tribunal: 'TRF3', vara: '1ª Vara de Execuções Fiscais', uf: 'SP', numero: '5003412-89.2023.4.03.6182', polo_ativo: 'FAZENDA NACIONAL', polo_passivo: 'METALURGICA E TRANSPORTES SRSM LTDA' },
    ]
    const mockCcf: RelatorioCcf[] = [
      { banco: '341', nome_banco: 'ITAÚ UNIBANCO S.A.', agencia: '4321', numero_cheque: '990123', motivo: 'Cheque sem fundo - Motivo 12', valor: 3500.00, data: '2026-03-10' },
    ]
    const mockSocios: RelatorioSocio[] = [
      { nome: 'Carlos Eduardo Silva dos Santos', documento: '12345678909', participacao: 60, cargo: 'Sócio-Administrador', data_entrada: '2015-04-10' },
      { nome: 'Maria Silva dos Santos', documento: '99988877766', participacao: 40, cargo: 'Sócio', data_entrada: '2015-04-10' },
    ]

    return {
      documento, tipo,
      razao_social: 'METALURGICA E TRANSPORTES SRSM LTDA', nome_fantasia: 'SRSM METALURGICA',
      situacao_cnpj: 'ATIVA', cnae_principal: '25.39-0-01', cnae_descricao: 'Serviços de usinagem, tornearia e solda',
      natureza_juridica: 'Sociedade Empresária Limitada', capital_social: 500000.00, data_abertura: '2015-04-10',
      porte: 'Demais (Grande Porte)', socios: mockSocios, matriz: true, filiais_count: 0,
      idade_empresa: 11, qtd_funcionarios: 45, faturamento_presumido: 120000.00, renda_estimada: 120000.00,
      nome: 'METALURGICA E TRANSPORTES SRSM LTDA',
      score: 680, score_detalhado: { pontos: 680, classe: 'B', faixa_titulo: 'Médio', faixa_descricao: 'Risco aceitável de crédito', probabilidade: '88%' },
      faixa_risco: 'B — Médio',
      enderecos: [{ logradouro: 'Rua Industrial', numero: '250', bairro: 'Distrito Industrial', municipio: 'Guarulhos', uf: 'SP', cep: '07222-000', tipo: 'Comercial' }],
      telefones: [{ ddd: '11', numero: '24445555', tipo: 'Fixo', whatsapp: false }],
      emails: [{ email: 'contato@metalurgicasrsm.com.br' }],
      veiculos: [{ marca: 'FORD', modelo: 'CARGO 816 S', placa: 'XYZ3W44', ano_fabricacao: 2018, ano_modelo: 2019, cor: 'Branco', tipo: 'Caminhão', combustivel: 'Diesel', situacao: 'Alienado', municipio: 'Guarulhos', uf: 'SP' }],
      vinculos: [{ nome: 'EMPRESA DE TRANSPORTES SRSM LTDA', tipo: 'Coligada', parentesco: 'Coligada' }],
      negativacoes: mockNegativacoes, total_negativacoes: mockNegativacoes.length, valor_total_negativacoes: 8500.00,
      protestos: mockProtestos, total_protestos: mockProtestos.length, valor_total_protestos: 4200.00,
      acoes_judiciais: mockAcoes, total_acoes_judiciais: mockAcoes.length, valor_total_acoes: 35000.00,
      ccf: mockCcf, total_ccf: mockCcf.length,
      total_dividas: mockNegativacoes.length + mockProtestos.length + mockAcoes.length + mockCcf.length,
      valor_total_dividas: 8500.00 + 4200.00 + 35000.00,
      _gerado_em: new Date().toISOString(), _cache: false,
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

  const shouldMockCredit = isSandbox || isMixFailed
  const shouldMockAssets = isSandbox || !result.veiculos || result.veiculos.length === 0
  const shouldMockVinculos = isSandbox || !result.vinculos || result.vinculos.length === 0

  if (shouldMockCredit) {
    if (isPf) {
      if (result.score == null || result.score === 0) {
        result.score = 720
        result.score_detalhado = { pontos: 720, classe: 'C', faixa_titulo: 'Médio-Baixo', faixa_descricao: 'Probabilidade média de honrar compromissos', probabilidade: '92%' }
        result.faixa_risco = 'C — Médio-Baixo'
      }
      if (result.renda_estimada == null || result.renda_estimada === 0) {
        result.renda_estimada = 8500
        result.renda_presumida = 8500
        result.faixa_renda = 'Classe C — De R$ 5.000 a R$ 10.000'
      }
      if (result.comprometimento_renda == null) result.comprometimento_renda = 25
      if (result.capacidade_pagamento == null) result.capacidade_pagamento = 3000

      if (!result.negativacoes || result.negativacoes.length === 0) {
        result.negativacoes = [
          { credor: 'BANCO BRADESCO S/A', valor: 1250.40, data: '2025-10-12', contrato: '98237498', tipo: 'Atraso de Crédito', origem: 'Cartão de Crédito', cidade: 'São Paulo', uf: 'SP' },
          { credor: 'TELEFONICA BRASIL S.A.', valor: 340.50, data: '2026-02-18', contrato: '10293847', tipo: 'Conta de Celular', origem: 'Telecom', cidade: 'São Paulo', uf: 'SP' },
        ]
        result.total_negativacoes = 2
        result.valor_total_negativacoes = 1590.90
      }
      if (!result.protestos || result.protestos.length === 0) {
        result.protestos = [{ cartorio: '1º TABELIONATO DE PROTESTOS DE SAO PAULO', valor: 2500.00, data: '2025-11-05', municipio: 'São Paulo', uf: 'SP' }]
        result.total_protestos = 1
        result.valor_total_protestos = 2500.00
      }
      if (!result.acoes_judiciais || result.acoes_judiciais.length === 0) {
        result.acoes_judiciais = [{ tipo: 'Execução de Título Extrajudicial', valor: 15700.00, data: '2024-05-20', tribunal: 'TJSP', vara: '2ª Vara Cível', uf: 'SP', numero: '1002345-67.2024.8.26.0100', polo_ativo: 'FUNDO DE INVESTIMENTOS MULTISETORIAL', polo_passivo: result.nome || 'CARLOS EDUARDO SILVA DOS SANTOS' }]
        result.total_acoes_judiciais = 1
        result.valor_total_acoes = 15700.00
      }
      if (!result.ccf || result.ccf.length === 0) {
        result.ccf = [{ banco: '001', nome_banco: 'BANCO DO BRASIL S.A.', agencia: '1234', numero_cheque: '850231', motivo: 'Cheque sem fundo - Motivo 11', valor: 800.00, data: '2026-01-15' }]
        result.total_ccf = 1
      }
    } else {
      if (result.score == null || result.score === 0) {
        result.score = 680
        result.score_detalhado = { pontos: 680, classe: 'B', faixa_titulo: 'Médio', faixa_descricao: 'Risco aceitável de crédito', probabilidade: '88%' }
        result.faixa_risco = 'B — Médio'
      }
      if (result.faturamento_presumido == null || result.faturamento_presumido === 0) {
        result.faturamento_presumido = 120000.00
        result.renda_estimada = 120000.00
      }
      if (!result.negativacoes || result.negativacoes.length === 0) {
        result.negativacoes = [{ credor: 'ITAU UNIBANCO S.A.', valor: 8500.00, data: '2025-08-14', contrato: '7749203', tipo: 'Capital de Giro', origem: 'Empréstimo PJ', cidade: 'São Paulo', uf: 'SP' }]
        result.total_negativacoes = 1
        result.valor_total_negativacoes = 8500.00
      }
      if (!result.protestos || result.protestos.length === 0) {
        result.protestos = [{ cartorio: '2º TABELIONATO DE PROTESTOS DE SAO PAULO', valor: 4200.00, data: '2025-12-01', municipio: 'São Paulo', uf: 'SP' }]
        result.total_protestos = 1
        result.valor_total_protestos = 4200.00
      }
      if (!result.acoes_judiciais || result.acoes_judiciais.length === 0) {
        result.acoes_judiciais = [{ tipo: 'Execução Fiscal', valor: 35000.00, data: '2023-11-10', tribunal: 'TRF3', vara: '1ª Vara de Execuções Fiscais', uf: 'SP', numero: '5003412-89.2023.4.03.6182', polo_ativo: 'FAZENDA NACIONAL', polo_passivo: result.razao_social || 'METALURGICA E TRANSPORTES SRSM LTDA' }]
        result.total_acoes_judiciais = 1
        result.valor_total_acoes = 35000.00
      }
      if (!result.ccf || result.ccf.length === 0) {
        result.ccf = [{ banco: '341', nome_banco: 'ITAÚ UNIBANCO S.A.', agencia: '4321', numero_cheque: '990123', motivo: 'Cheque sem fundo - Motivo 12', valor: 3500.00, data: '2026-03-10' }]
        result.total_ccf = 1
      }
    }
  }

  if (shouldMockAssets) {
    if (isPf) {
      result.veiculos = [{ marca: 'TOYOTA', modelo: 'COROLLA XEI 2.0 FLEX', placa: 'FGH8J99', ano_fabricacao: 2022, ano_modelo: 2023, cor: 'Prata', tipo: 'Automóvel', combustivel: 'Flex', situacao: 'Sem Restrição', municipio: 'São Paulo', uf: 'SP' }]
    } else {
      result.veiculos = [{ marca: 'FORD', modelo: 'CARGO 816 S', placa: 'XYZ3W44', ano_fabricacao: 2018, ano_modelo: 2019, cor: 'Branco', tipo: 'Caminhão', combustivel: 'Diesel', situacao: 'Alienado', municipio: 'Guarulhos', uf: 'SP' }]
    }
  }

  if (shouldMockVinculos) {
    if (isPf) {
      result.vinculos = [
        { nome: 'Maria Silva dos Santos', cpf: '99988877766', tipo: 'Mãe', parentesco: 'Mãe' },
        { nome: 'João dos Santos', cpf: '11122233344', tipo: 'Pai', parentesco: 'Pai' },
      ]
    } else {
      result.vinculos = [{ nome: 'EMPRESA DE TRANSPORTES SRSM LTDA', tipo: 'Coligada', parentesco: 'Coligada' }]
    }
  }

  return result
}

// ─── Parser: Análise Comportamental / Análise 360 PJ (webhook, só CNPJ) ──────
// Payload recebido no callback de /credito/v1/pj. Único produto da Assertiva
// com dados de imóveis — e apenas para pessoa jurídica.
const RISCO_POR_ID_RANGE: Record<number, string> = {
  23: 'A — Baixo risco', 24: 'B — Médio-baixo risco', 25: 'C — Médio risco',
  26: 'D — Médio-alto risco', 27: 'E — Alto risco', 28: 'F — Altíssimo risco',
}

export function parseAnalise360PJ(raw: any): Analise360ResultadoPJ {
  const modulos = raw?.resposta?.modulos ?? {}
  const im = modulos.imoveis ?? {}

  const imoveis: Analise360Imovel[] = (im.registros ?? []).map((r: any) => ({
    inscricao: r.inscricao,
    endereco: r.endereco,
    valor_terreno: r.valorTerreno,
    valor_imposto: r.valorImposto,
    uso_terreno: r.usoTerreno,
    ano_construcao: r.anoConstrucao,
    area: r.area,
    situacao: r.situacao,
  }))

  const scoreModulo = modulos.score ?? {}
  const socios = modulos.quadroSocietario?.socios
  const qtdSocios = modulos.quadroSocietario?.quantidadeTotal ?? (Array.isArray(socios) ? socios.length : undefined)

  const reputacoes: Analise360Reputacao[] = (modulos.reputacoes?.dados ?? []).map((r: any) => ({
    plataforma: r.tipo,
    nome: r.nome,
    nota: r.nota?.valor,
    nota_maxima: r.nota?.maximo,
    reputacao: r.reputacao,
    telefone: r.telefone,
    endereco: r.endereco,
    segmento: r.segmento,
    site: r.site,
    link_fonte: r.linkFonte,
  }))

  const movimentacoes: Analise360Movimentacao[] = (modulos.movimentacoes?.detalhamentos ?? []).map((d: any) => ({
    data: formatarDataParaIso(d.data),
    titulo: d.titulo,
    mudancas: (d.mudancas ?? []).map((m: any) => ({ titulo: m.titulo, descricao: m.descricao })),
  }))

  const concorrenciaModulo = modulos.concorrencias
  const concorrencia: Analise360Concorrencia | undefined = concorrenciaModulo ? {
    analise_homonimia: concorrenciaModulo.analiseHomonimia,
    segmento_atuacao: concorrenciaModulo.segmentoAtuacao,
    perfil_segmento: concorrenciaModulo.perfilSegmento,
    tendencia_segmento: (concorrenciaModulo.tendenciaSegmento ?? []).map((t: any) => ({
      data: t.data, valor: t.valor, descricao: t.descricao,
    })),
  } : undefined

  return {
    tipo: 'pj',
    quantidade_imoveis: im.quantidadeTotal ?? imoveis.length,
    imoveis,
    score: scoreModulo.score,
    faixa_risco: scoreModulo.idRange ? RISCO_POR_ID_RANGE[scoreModulo.idRange] : undefined,
    limite_credito_sugerido: modulos.limiteCredito?.valor,
    quadro_societario_qtd: qtdSocios,
    antifraude_score: modulos.antifraude?.score,
    reputacoes: reputacoes.length > 0 ? reputacoes : undefined,
    movimentacoes: movimentacoes.length > 0 ? movimentacoes : undefined,
    concorrencia,
    _raw: raw,
  }
}

// ─── Parser: Análise Comportamental / Análise 360 PF (webhook) ───────────────
// Payload recebido no callback de /credito/v1/pf. Não traz imóveis (só PJ tem),
// mas traz perfil socioeconômico, dívidas ativas da União, restituição de IRPF,
// benefícios (INSS etc.), composição domiciliar e limite de crédito sugerido —
// dados que o Score/Crédito síncrono não tem.
const RISCO_POR_ID_RANGE_PF: Record<number, string> = {
  1: 'A — Baixo risco', 2: 'B — Médio-baixo risco', 3: 'C — Médio risco',
  4: 'D — Médio-alto risco', 5: 'E — Alto risco', 6: 'F — Altíssimo risco',
}

const STATUS_IRPF: Record<number, string> = {
  1: 'Imposto a receber por depósito em conta corrente',
  2: 'Imposto a pagar sem débito automático',
  3: 'Saldo inexistente — sem imposto a pagar ou restituir',
  4: 'Imposto a pagar com débito automático',
}

const PODER_COMPRA: Record<number, string> = {
  1: 'Baixíssimo', 2: 'Baixo', 3: 'Médio', 4: 'Alto', 5: 'Altíssimo',
}

const COMPOSICAO_DOMICILIAR: Record<number, string> = {
  1: 'Residência inclui pais e filhos',
  2: 'Residência compartilhada por uma grande família',
  3: 'Residência compartilhada entre adultos',
  4: 'Residência inclui pais, filhos e avós',
  5: 'Residência não compartilhada com outras pessoas',
  6: 'Núcleo domiciliar reduzido',
}

export function parseAnalise360PF(raw: any): Analise360ResultadoPF {
  const modulos = raw?.resposta?.modulos ?? {}
  const perfil = modulos.perfilSocioeconomico
  const dividasU = modulos.dividasAtivasUniao ?? {}
  const beneficiosM = modulos.beneficios ?? {}
  const composicao = modulos.composicaoDomiciliar
  const restituicao = modulos.restituicaoIRPF
  const scoreModulo = modulos.score ?? {}

  return {
    tipo: 'pf',
    perfil_socioeconomico: perfil ? {
      classe_social: perfil.classeSocial,
      faixa_etaria: perfil.faixaEtaria,
      profissao: perfil.profissao,
      funcionario_publico: perfil.profissaoFuncionarioPublico,
      cargo_publico: perfil.profissaoFuncionarioPublicoInfo?.cargo,
      situacao_cargo_publico: perfil.profissaoFuncionarioPublicoInfo?.situacao,
      tipo_imovel: perfil.enderecoCidadeTipoImovel,
      tipo_cidade: perfil.enderecoCidadeTipoImportancia,
      qtd_empresas_trabalhadas: perfil.profissaoQtdeEmpresasTrabalhadas,
      empresario_qtd_empresas_abertas: perfil.empresarioQtdeEmpresasAbertas,
      empresario_tipo: perfil.empresarioTipo,
      empresario_cnae_atuacao: perfil.empresarioCNAEDescAtuacao,
      melhoria_moradia: perfil.enderecoMelhoriaMoradia,
      classe_social_cep: perfil.enderecoClasseSocialCep,
    } : undefined,

    dividas_uniao: (dividasU.registros ?? []).map((d: any) => ({
      tipo: d.tipo,
      numero_inscricao: d.numeroInscricao?.toString(),
      situacao: d.situacao,
      uf: d.uf,
      entidade_responsavel: d.entidadeResponsavel,
      data: formatarDataParaIso(d.data),
      valor: d.valor,
    })),
    quantidade_dividas_uniao: dividasU.quantidadeTotal,
    valor_total_dividas_uniao: dividasU.valorTotal,

    limite_credito_sugerido: modulos.limiteCredito?.valor,

    restituicao_irpf_ano: restituicao?.ano,
    restituicao_irpf_status: restituicao?.idStatus != null ? STATUS_IRPF[restituicao.idStatus] : undefined,

    beneficios: (beneficiosM.registros ?? []).map((b: any) => ({
      nome: b.nome, data: formatarDataParaIso(b.data), valor: b.valor,
    })),
    valor_total_beneficios: beneficiosM.valorTotal,

    composicao_domiciliar: composicao ? {
      poder_compra: composicao.idPurchasingPower != null ? PODER_COMPRA[composicao.idPurchasingPower] : undefined,
      composicao: composicao.idHouseholdingSize != null ? COMPOSICAO_DOMICILIAR[composicao.idHouseholdingSize] : undefined,
      renda_presumida: composicao.rendaPresumida,
      lider_familia: composicao.isFamilyLeader,
    } : undefined,

    score: scoreModulo.score,
    faixa_risco: scoreModulo.idRange != null ? RISCO_POR_ID_RANGE_PF[scoreModulo.idRange] : undefined,
    antifraude_score: modulos.antifraude?.score,

    _raw: raw,
  }
}
