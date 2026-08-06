import { formatarTelefone } from './formatters'
import { formatBRL } from './currency'
import type { RelatorioCompleto } from '@/lib/assertiva/types'

// Extrai, de um RelatorioCompleto da Assertiva, os valores exatamente no
// mesmo formato usado nos campos do formulário de cliente (mesma lógica de
// preenchimento automático do cadastro) — usado tanto no cadastro quanto no
// perfil (perfil deriva isso de `cliente.dados_assertiva`, o snapshot salvo
// na hora da consulta) pra comparar com o valor atual e saber o que mudou.
export function extrairValoresParaOrigem(data: RelatorioCompleto | null | undefined): Record<string, string> {
  const v: Record<string, string> = {}
  if (!data) return v

  if (data.nome) v.nome = data.nome

  if (data.data_nascimento) {
    let dt = data.data_nascimento
    if (dt.includes('T')) dt = dt.split('T')[0]
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dt)) {
      const [d, m, y] = dt.split('/')
      dt = `${y}-${m}-${d}`
    }
    v.data_nascimento = dt
  }

  if (data.renda_estimada) {
    v.renda_mensal = formatBRL(data.renda_estimada)
  } else if (data.faturamento_presumido && typeof data.faturamento_presumido === 'number') {
    v.renda_mensal = formatBRL(data.faturamento_presumido)
  }

  if (data.estado_civil_api) {
    const ec = data.estado_civil_api.toLowerCase()
    if (ec.includes('solteir')) v.estado_civil = 'solteiro'
    else if (ec.includes('casad')) v.estado_civil = 'casado'
    else if (ec.includes('divorciad')) v.estado_civil = 'divorciado'
    else if (ec.includes('viuv')) v.estado_civil = 'viuvo'
    else if (ec.includes('separad')) v.estado_civil = 'separado'
    else if (ec.includes('uniao') || ec.includes('união') || ec.includes('estavel') || ec.includes('estável')) v.estado_civil = 'uniao_estavel'
  }

  if (data.ocupacao) v.profissao = data.ocupacao
  else if (data.cnae_descricao) v.profissao = data.cnae_descricao

  if (data.telefones?.length) {
    const t = (data.telefones.find((x: any) => x.tipo?.toLowerCase() === 'celular' || x.whatsapp) ?? data.telefones[0]) as any
    const num = (t.ddd ?? '') + (t.numero ?? '')
    const cleanNum = num.replace(/\D/g, '')
    if (cleanNum.length >= 10) v.telefone = formatarTelefone(cleanNum)
  }

  if (data.emails?.length) {
    const sorted = [...data.emails].sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
    if (sorted[0]?.email) v.email = sorted[0].email
  }

  if (data.enderecos?.length) {
    const end = data.enderecos[0]
    if (end.cep) {
      const c = end.cep.replace(/\D/g, '')
      v.cep = c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5, 8)}` : c
    }
    if (end.logradouro) v.endereco = end.logradouro
    if (end.numero) v.numero = end.numero
    if (end.complemento) v.complemento = end.complemento
    if (end.bairro) v.bairro = end.bairro
    if (end.municipio) v.cidade = end.municipio
    if (end.uf) v.estado = end.uf
  }

  return v
}

// Rastreio de origem dos dados do cadastro — Assertiva x manual.
//
// Estratégia: no momento em que a Assertiva preenche um campo, guardamos o
// valor exato que ela mandou (já formatado, mesmo formato que vai pro campo
// do formulário). Na hora de salvar, comparamos o valor atual do campo com
// esse snapshot — se for igual, o campo continua "como veio da Assertiva";
// se for diferente (o usuário digitou outra coisa, ou preencheu um campo que
// a Assertiva deixou vazio), o campo entra na lista de origem manual.
//
// Comparar strings já formatadas (em vez de reformatar na hora da comparação)
// evita falso positivo por causa só de máscara/formatação — os dois lados já
// passaram pela mesma função de formatação no momento em que foram escritos.
export function calcularCamposOrigemManual(
  valoresAtuais: Record<string, string | null | undefined>,
  valoresOrigemAssertiva: Record<string, string | null | undefined>,
): string[] {
  const manuais: string[] = []
  for (const campo of Object.keys(valoresAtuais)) {
    const atual = (valoresAtuais[campo] ?? '').toString().trim()
    if (!atual) continue // campo vazio não é "editado", é só não preenchido
    const daApi = (valoresOrigemAssertiva[campo] ?? '').toString().trim()
    if (atual !== daApi) manuais.push(campo)
  }
  return manuais
}
