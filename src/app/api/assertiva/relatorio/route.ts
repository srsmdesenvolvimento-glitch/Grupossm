import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseLocalizePf, parseLocalizePj,
  parseScoreCredito,
  parseConexoes, parsePessoasDeReferencia, mesclarVinculos, enriquecerVinculos,
  parseHistoricoVeiculos, mesclarVeiculos,
  mergeData, calcularTotais,
  generateSandboxReport,
} from '@/lib/assertiva/parsers'
import type { RelatorioCompleto, RelatorioVinculo } from '@/lib/assertiva/types'
import {
  getAssertivaToken, callAssertivaApi,
  LOCALIZE_BASE, SCORE_BASE, CONEXOES_BASE, VEICULOS_BASE, ID_FINALIDADE,
  chaveCacheAssertiva,
} from '@/lib/assertiva/server'

const CACHE_TTL_MS       = 30 * 24 * 60 * 60 * 1000 // 30 dias
const MAX_VINCULOS_ENRIQUECER = 15 // teto de consultas extras (endereço) por cadastro

function only(s: string) { return s.replace(/\D/g, '') }

// Busca dados cadastrais básicos (endereço, telefones, email) de uma pessoa/empresa
// vinculada (pai, mãe, cônjuge, sócio, etc.), com o mesmo cache de 30 dias usado
// na consulta principal — a mesma pessoa buscada de novo (direta ou como vínculo
// de outro cadastro) não gera cobrança adicional.
async function buscarPerfilBasico(
  documento: string,
  tipoDoc: 'pf' | 'pj',
  token: string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Record<string, any> | null> {
  const cacheChave = chaveCacheAssertiva(tipoDoc, documento)
  try {
    const { data: cached } = await supabase
      .from('assertiva_cache_factoring')
      .select('resultado')
      .eq('chave', cacheChave)
      .gte('expira_em', new Date().toISOString())
      .maybeSingle()
    if (cached?.resultado) return cached.resultado
  } catch { /* ignora se tabela não existir */ }

  const url = tipoDoc === 'pf'
    ? `${LOCALIZE_BASE}/cpf?cpf=${documento}&idFinalidade=${ID_FINALIDADE}`
    : `${LOCALIZE_BASE}/cnpj?cnpj=${documento}&idFinalidade=${ID_FINALIDADE}`

  const res = await callAssertivaApi(url, token)
  if (!res.ok) return null

  const parsed = tipoDoc === 'pf' ? parseLocalizePf(res.data) : parseLocalizePj(res.data)
  const resultado = {
    documento, tipo: tipoDoc, ...parsed,
    _sandbox: false, _gerado_em: new Date().toISOString(),
  }

  try {
    await supabase.from('assertiva_cache_factoring').upsert(
      {
        chave:         cacheChave,
        resultado,
        consultado_em: new Date().toISOString(),
        expira_em:     new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: 'chave' }
    )
  } catch { /* ignora se tabela não existir */ }

  return resultado
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    // Consulta um documento arbitrário (CPF/CNPJ) — usado tanto no cadastro
    // (antes de o cliente existir) quanto na consulta avulsa, então não dá
    // pra exigir um cliente/empréstimo já vinculado. Mas sem checagem nenhuma,
    // qualquer usuário autenticado de QUALQUER empresa (inclusive do Empório,
    // que não usa Assertiva) conseguia puxar o relatório de crédito completo
    // de qualquer CPF/CNPJ do Brasil. Restringe a usuários de empresas do
    // tipo "factoring" — só esse produto contrata a Assertiva.
    const { data: acessoFactoring } = await supabaseAuth
      .from('usuario_empresa')
      .select('empresa_id, empresas!inner(tipo)')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .eq('empresas.tipo', 'factoring')
      .limit(1)
      .maybeSingle()

    if (!acessoFactoring) {
      return NextResponse.json({ erro: 'Sem acesso à consulta de crédito' }, { status: 403 })
    }

    const body = await request.json()
    const { documento, tipo } = body as { documento: string; tipo: 'pf' | 'pj' }

    if (!documento || !tipo) {
      return NextResponse.json({ erro: 'documento e tipo são obrigatórios' }, { status: 400 })
    }

    const doc = only(documento)
    if ((tipo === 'pf' && doc.length !== 11) || (tipo === 'pj' && doc.length !== 14)) {
      return NextResponse.json({ erro: 'Documento inválido' }, { status: 400 })
    }

    const isSandbox  = process.env.ASSERTIVA_SANDBOX === 'true'
    const supabase   = createAdminClient()
    const cacheChave = chaveCacheAssertiva(tipo, doc)

    // ── Verifica cache ────────────────────────────────────────────────────────
    const { data: cached } = await supabase
      .from('assertiva_cache_factoring')
      .select('resultado')
      .eq('chave', cacheChave)
      .gte('expira_em', new Date().toISOString())
      .maybeSingle()

    if (cached?.resultado) {
      // Só usa cache se a entrada foi explicitamente marcada como produção (_sandbox: false).
      // Entradas sem _sandbox (antigas) ou com _sandbox: true são ignoradas e re-buscadas.
      const isProductionCache = cached.resultado._sandbox === false
      if (isProductionCache || isSandbox) {
        return NextResponse.json({ ...cached.resultado, _cache: true })
      }
    }

    // ── Sem credenciais → sandbox imediato ───────────────────────────────────
    const clientId     = process.env.ASSERTIVA_CLIENT_ID
    const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      if (isSandbox) return NextResponse.json({ ...generateSandboxReport(doc, tipo), _sandbox: true })
      return NextResponse.json({ erro: 'Credenciais Assertiva não configuradas' }, { status: 503 })
    }

    // ── Token OAuth2 ──────────────────────────────────────────────────────────
    let token: string | null = null
    try {
      token = await getAssertivaToken()
    } catch (e: any) {
      const msg = e?.message || 'falha de autenticação'
      console.error('[Assertiva] Auth error:', msg)
      if (isSandbox) return NextResponse.json({ ...generateSandboxReport(doc, tipo), _sandbox: true, _auth_error: msg })
      return NextResponse.json({ erro: `Falha de autenticação Assertiva: ${msg}` }, { status: 502 })
    }

    if (!token) {
      console.error('[Assertiva] Token nulo após autenticação')
      if (isSandbox) return NextResponse.json({ ...generateSandboxReport(doc, tipo), _sandbox: true, _auth_error: 'token_null' })
      return NextResponse.json({ erro: 'Falha de autenticação Assertiva: token nulo' }, { status: 502 })
    }
    const authToken: string = token

    // ── Chamadas paralelas: Localize + Score/Crédito + Conexões + Veículos ──────
    // Score/Crédito (produto "Análise 360" contratado) substitui o Mix — o Mix
    // não está no plano contratado (confirmado por contrato + teste ao vivo,
    // retorna 403). Score/Crédito com acoes=true traz score, negativações,
    // protestos, ações judiciais, cheques e renda/faturamento presumido.
    let localizeRaw: any = null
    let scoreRaw: any    = null
    let conexoesRaw: any = null
    let veiculosRaw: any = null
    let referenciaRaw: any = null // pessoas-de-referencia — só PF, fonte extra de vínculos
    let creditoSemPermissao = false
    const erros: string[]  = []

    let locResData: any = null
    let scoreResData: any = null
    let mensagemErroAssertiva = ''

    if (tipo === 'pf') {
      const [locRes, scoreRes, conRes, veiRes, refRes] = await Promise.allSettled([
        callAssertivaApi(`${LOCALIZE_BASE}/cpf?cpf=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
        callAssertivaApi(`${SCORE_BASE}/pf/credito/${doc}?acoes=true&positivo=true&idFinalidade=${ID_FINALIDADE}`, token),
        callAssertivaApi(`${CONEXOES_BASE}/conexoes?documento=${doc}&tipo=CPF&idFinalidade=${ID_FINALIDADE}&conjuge=true&telefones=true`, token),
        callAssertivaApi(`${VEICULOS_BASE}/historico-veiculos?documento=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
        callAssertivaApi(`${LOCALIZE_BASE}/pessoas-de-referencia?cpf=${doc}&retornarMae=true&idFinalidade=${ID_FINALIDADE}`, token),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const d = locRes.status === 'fulfilled' ? locRes.value.data : null
        if (d?.resposta) mensagemErroAssertiva = String(d.resposta)
        else if (d?.message) mensagemErroAssertiva = String(d.message)
        const detail = d?.resposta || d?.message || (locRes.status === 'rejected' ? String(locRes.reason) : `HTTP ${locRes.status === 'fulfilled' ? locRes.value.status : 0}`)
        erros.push(`Localize CPF: ${detail}`)
        console.error('[Assertiva] Localize CPF error:', detail)
      }

      if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
        scoreRaw = scoreRes.value.data
      } else {
        const d = scoreRes.status === 'fulfilled' ? scoreRes.value.data : null
        if (!mensagemErroAssertiva && d?.resposta) mensagemErroAssertiva = String(d.resposta)
        else if (!mensagemErroAssertiva && d?.message) mensagemErroAssertiva = String(d.message)
        const st = scoreRes.status === 'fulfilled' ? scoreRes.value.status : 0
        if (st === 403) creditoSemPermissao = true
        const detail = d?.resposta || d?.message || (scoreRes.status === 'rejected' ? String(scoreRes.reason) : `HTTP ${st}`)
        erros.push(`Score/Crédito PF: ${detail}`)
        console.warn('[Assertiva] Score/Crédito PF error:', detail)
      }

      if (conRes.status === 'fulfilled' && conRes.value.ok) {
        conexoesRaw = conRes.value.data
      } else {
        const detail = conRes.status === 'rejected' ? String(conRes.reason) : `HTTP ${conRes.value.status}`
        console.warn('[Assertiva] Conexões PF error (não bloqueia):', detail)
      }

      if (veiRes.status === 'fulfilled' && veiRes.value.ok) {
        veiculosRaw = veiRes.value.data
      } else {
        const detail = veiRes.status === 'rejected' ? String(veiRes.reason) : `HTTP ${veiRes.value.status}`
        console.warn('[Assertiva] Histórico de Veículos PF error (não bloqueia):', detail)
      }

      if (refRes.status === 'fulfilled' && refRes.value.ok) {
        referenciaRaw = refRes.value.data
      } else {
        const detail = refRes.status === 'rejected' ? String(refRes.reason) : `HTTP ${refRes.value.status}`
        console.warn('[Assertiva] Pessoas de Referência error (não bloqueia):', detail)
      }
    } else {
      const [locRes, scoreRes, conRes, veiRes] = await Promise.allSettled([
        callAssertivaApi(`${LOCALIZE_BASE}/cnpj?cnpj=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
        callAssertivaApi(`${SCORE_BASE}/pj/credito/${doc}?acoes=true&idFinalidade=${ID_FINALIDADE}`, token),
        callAssertivaApi(`${CONEXOES_BASE}/conexoes?documento=${doc}&tipo=CNPJ&idFinalidade=${ID_FINALIDADE}&telefones=true`, token),
        callAssertivaApi(`${VEICULOS_BASE}/historico-veiculos?documento=${doc}&idFinalidade=${ID_FINALIDADE}`, token),
      ])

      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        localizeRaw = locRes.value.data
      } else {
        const d = locRes.status === 'fulfilled' ? locRes.value.data : null
        if (d?.resposta) mensagemErroAssertiva = String(d.resposta)
        else if (d?.message) mensagemErroAssertiva = String(d.message)
        const detail = d?.resposta || d?.message || (locRes.status === 'rejected' ? String(locRes.reason) : `HTTP ${locRes.status === 'fulfilled' ? locRes.value.status : 0}`)
        erros.push(`Localize CNPJ: ${detail}`)
        console.error('[Assertiva] Localize CNPJ error:', detail)
      }

      if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
        scoreRaw = scoreRes.value.data
      } else {
        const d = scoreRes.status === 'fulfilled' ? scoreRes.value.data : null
        if (!mensagemErroAssertiva && d?.resposta) mensagemErroAssertiva = String(d.resposta)
        else if (!mensagemErroAssertiva && d?.message) mensagemErroAssertiva = String(d.message)
        const st = scoreRes.status === 'fulfilled' ? scoreRes.value.status : 0
        if (st === 403) creditoSemPermissao = true
        const detail = d?.resposta || d?.message || (scoreRes.status === 'rejected' ? String(scoreRes.reason) : `HTTP ${st}`)
        erros.push(`Score/Crédito PJ: ${detail}`)
        console.warn('[Assertiva] Score/Crédito PJ error:', detail)
      }

      if (conRes.status === 'fulfilled' && conRes.value.ok) {
        conexoesRaw = conRes.value.data
      } else {
        const detail = conRes.status === 'rejected' ? String(conRes.reason) : `HTTP ${conRes.value.status}`
        console.warn('[Assertiva] Conexões PJ error (não bloqueia):', detail)
      }

      if (veiRes.status === 'fulfilled' && veiRes.value.ok) {
        veiculosRaw = veiRes.value.data
      } else {
        const detail = veiRes.status === 'rejected' ? String(veiRes.reason) : `HTTP ${veiRes.value.status}`
        console.warn('[Assertiva] Histórico de Veículos PJ error (não bloqueia):', detail)
      }
    }

    // ── Se Localize e Score falharam → exibe erro real da Assertiva ─────────
    if (!localizeRaw && !scoreRaw) {
      if (isSandbox) return NextResponse.json({ ...generateSandboxReport(doc, tipo), _sandbox: true })

      const mensagemFinal = mensagemErroAssertiva || 'Nenhuma resposta válida da Assertiva'

      return NextResponse.json(
        { erro: mensagemFinal, detalhes: erros },
        { status: 502 }
      )
    }

    // ── Parse e merge ─────────────────────────────────────────────────────────
    const localizeParsed = tipo === 'pf' ? parseLocalizePf(localizeRaw) : parseLocalizePj(localizeRaw)
    const scoreParsed    = parseScoreCredito(scoreRaw, tipo)
    const merged         = mergeData(localizeParsed, scoreParsed)

    // ── Veículos: mescla o histórico dedicado (fonte confiável) com o array
    // incidental do Localize (mera inferência) — histórico tem prioridade.
    if (veiculosRaw) {
      merged.veiculos = mesclarVeiculos(merged.veiculos, parseHistoricoVeiculos(veiculosRaw))
    }

    // ── Vínculos e rede de relacionamento (mãe, pai, cônjuge, irmãos, sócios,
    // empregadores, empresas, convívio familiar) via /conexoes. Para cada pessoa
    // com CPF/CNPJ próprio, busca o perfil completo (endereço, telefones, email)
    // com cache — mesma pessoa consultada de novo não gera custo extra.
    let vinculosFinal: RelatorioVinculo[] = mesclarVinculos(
      parseConexoes(conexoesRaw),
      parsePessoasDeReferencia(referenciaRaw),
    )

    if (vinculosFinal.length > 0) {
      const paraEnriquecer = vinculosFinal
        .filter((v): v is RelatorioVinculo & { documento: string } =>
          !!v.documento && (v.documento.length === 11 || v.documento.length === 14))
        .slice(0, MAX_VINCULOS_ENRIQUECER)

      const perfis = new Map<string, Record<string, any>>()
      const resultados = await Promise.allSettled(
        paraEnriquecer.map(v => buscarPerfilBasico(v.documento, v.documento.length === 11 ? 'pf' : 'pj', authToken, supabase))
      )
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) perfis.set(paraEnriquecer[i].documento, r.value)
      })

      vinculosFinal = enriquecerVinculos(vinculosFinal, perfis)
    }

    merged.vinculos = vinculosFinal

    // Nome do pai não é retornado por /cpf (só a Receita registra a mãe) —
    // deriva da rede de conexões, quando um vínculo com relação exata "Pai" existir.
    if (tipo === 'pf' && !merged.nome_pai) {
      const pai = vinculosFinal.find(v => v.parentesco === 'Pai')
      if (pai?.nome) merged.nome_pai = pai.nome
    }

    // Injeta dados sandbox apenas quando explicitamente em modo sandbox.
    // Quando Score/Crédito retorna 403 (sem plano), deixa os campos de crédito
    // vazios — NÃO mostrar dados fake de dívidas em consultas reais.
    const enriched = isSandbox
      ? injectFullSandbox(tipo, merged)
      : merged

    const totais = calcularTotais(enriched as Partial<RelatorioCompleto>)

    const relatorio: RelatorioCompleto = {
      documento: doc,
      tipo,
      ...enriched,
      ...totais,
      _localize:    localizeRaw,
      _credito:     scoreRaw,
      _gerado_em:   new Date().toISOString(),
      _erros:       erros.length ? erros : undefined,
      _credito_403: creditoSemPermissao || undefined,
      _sandbox:     isSandbox,
    } as RelatorioCompleto

    // ── Salva cache ───────────────────────────────────────────────────────────
    try {
      await supabase.from('assertiva_cache_factoring').upsert(
        {
          chave:         cacheChave,
          resultado:     relatorio,
          consultado_em: new Date().toISOString(),
          expira_em:     new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'chave' }
      )
    } catch { /* ignora se tabela não existir */ }

    try {
      await supabase.from('assertiva_log_factoring').insert({
        tipo:       tipo === 'pf' ? 'credito_pf' : 'credito_pj',
        chave:      cacheChave,
        status_http: 200,
        hit_cache:  false,
      })
    } catch { /* ignora se tabela não existir */ }

    return NextResponse.json(relatorio)
  } catch (err: any) {
    console.error('[Assertiva] Erro no relatório:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}

// Injeta valores sandbox apenas em campos que estão vazios (em modo sandbox explícito)
function injectFullSandbox(tipo: 'pf' | 'pj', data: Record<string, any>): Record<string, any> {
  const r = { ...data }
  if (tipo === 'pf') {
    if (r.score == null) { r.score = 720; r.score_detalhado = { pontos: 720, classe: 'C', faixa_titulo: 'Médio-Baixo', probabilidade: '92%' }; r.faixa_risco = 'C — Médio-Baixo' }
    if (!r.renda_estimada) { r.renda_estimada = 8500; r.renda_presumida = 8500; r.faixa_renda = 'Classe C — De R$ 5.000 a R$ 10.000' }
    if (!r.comprometimento_renda) r.comprometimento_renda = 25
    if (!r.capacidade_pagamento) r.capacidade_pagamento = 3000
    if (!r.negativacoes?.length) { r.negativacoes = [{ credor: 'BANCO BRADESCO S/A', valor: 1250.40, data: '2025-10-12', tipo: 'Atraso de Crédito' }]; r.total_negativacoes = 1; r.valor_total_negativacoes = 1250.40 }
    if (!r.protestos?.length) { r.protestos = []; r.total_protestos = 0; r.valor_total_protestos = 0 }
    if (!r.acoes_judiciais?.length) { r.acoes_judiciais = []; r.total_acoes_judiciais = 0; r.valor_total_acoes = 0 }
    if (!r.ccf?.length) { r.ccf = []; r.total_ccf = 0 }
  } else {
    if (r.score == null) { r.score = 680; r.score_detalhado = { pontos: 680, classe: 'B', faixa_titulo: 'Médio', probabilidade: '88%' }; r.faixa_risco = 'B — Médio' }
    if (!r.faturamento_presumido) { r.faturamento_presumido = 120000; r.renda_estimada = 120000 }
    if (!r.negativacoes?.length) { r.negativacoes = []; r.total_negativacoes = 0; r.valor_total_negativacoes = 0 }
    if (!r.protestos?.length) { r.protestos = []; r.total_protestos = 0; r.valor_total_protestos = 0 }
    if (!r.acoes_judiciais?.length) { r.acoes_judiciais = []; r.total_acoes_judiciais = 0; r.valor_total_acoes = 0 }
    if (!r.ccf?.length) { r.ccf = []; r.total_ccf = 0 }
  }
  if (!r.veiculos?.length) r.veiculos = []
  if (!r.vinculos?.length) r.vinculos = []
  return r
}
