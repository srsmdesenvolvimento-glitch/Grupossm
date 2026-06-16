import { createClient } from '@/lib/supabase/client'
import { calcularScore, REGRAS_SCORE_PADRAO, FAIXAS_RISCO_PADRAO } from './calculos'

type SupabaseClient = ReturnType<typeof createClient>

/**
 * Recalcula o score_interno de um cliente com base em:
 * - Score da Assertiva (base normalizada 0-100)
 * - Comportamento de pagamentos no sistema
 *
 * Atualiza score_interno no banco e retorna o novo valor.
 */
export async function recalcularScoreCliente(
  clienteId: string,
  empresaId: string,
  supabase: SupabaseClient,
): Promise<number> {
  try {
    // Busca dados do cliente com todas as colunas da Assertiva necessárias para o score
    const { data: cliente } = await supabase
      .from('clientes_factoring')
      .select('score_assertiva, status, cpf, telefone, endereco, renda_mensal, limite_credito, dados_assertiva, renda_estimada_assertiva')
      .eq('id', clienteId)
      .eq('empresa_id', empresaId)
      .single()

    // Busca histórico de parcelas
    const { data: parcelas } = await supabase
      .from('parcelas_emprestimo')
      .select('status, dias_atraso, valor_pago, valor')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', empresaId)

    // Busca empréstimos quitados
    const { data: emprestimos } = await supabase
      .from('emprestimos')
      .select('status')
      .eq('cliente_id', clienteId)
      .eq('empresa_id', empresaId)

    // Busca parametrização do score para a empresa
    const { data: config } = await supabase
      .from('config_factoring')
      .select('regras_score, faixas_risco')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    const ps = parcelas ?? []
    const es = emprestimos ?? []

    const totalPago = ps
      .filter(p => p.status === 'pago')
      .reduce((s: number, p: any) => s + (p.valor_pago ?? p.valor ?? 0), 0)

    const dadosScore = {
      total_parcelas:            ps.length,
      pagas_pontualmente:        ps.filter((p: any) => p.status === 'pago' && (p.dias_atraso ?? 0) <= 0).length,
      pagas_antecipado:          ps.filter((p: any) => p.status === 'pago' && (p.dias_atraso ?? 0) < -5).length,
      emprestimos_quitados:      es.filter((e: any) => e.status === 'quitado').length,
      parcelas_atrasadas_atuais: ps.filter((p: any) => p.status === 'atrasado').length,
      max_dias_atraso:           Math.max(0, ...ps.map((p: any) => p.dias_atraso ?? 0)),
      cliente_bloqueado:         cliente?.status === 'bloqueado',
      cadastro_completo:         !!(cliente?.cpf && cliente?.telefone && cliente?.endereco && cliente?.renda_mensal),
      volume_total_pago:         totalPago,
      assertiva_score:           cliente?.score_assertiva ?? null,
      assertiva_negativacoes:    (cliente?.dados_assertiva as any)?.total_negativacoes ?? 0,
      assertiva_protestos:       (cliente?.dados_assertiva as any)?.total_protestos ?? 0,
      assertiva_ccf:             (cliente?.dados_assertiva as any)?.total_ccf ?? 0,
      assertiva_acoes_judiciais: (cliente?.dados_assertiva as any)?.total_acoes_judiciais ?? 0,
      assertiva_pep:             (cliente?.dados_assertiva as any)?.pep ?? false,
      assertiva_obito:           (cliente?.dados_assertiva as any)?.indicador_obito ?? false,
      assertiva_renda_estimada:  cliente?.renda_estimada_assertiva ?? null,
    }

    const resultado = calcularScore(
      dadosScore,
      config?.regras_score ?? REGRAS_SCORE_PADRAO,
      config?.faixas_risco ?? FAIXAS_RISCO_PADRAO,
      cliente?.limite_credito ?? undefined,
    )

    // Persiste o novo score no banco
    await supabase
      .from('clientes_factoring')
      .update({ score_interno: resultado.score })
      .eq('id', clienteId)
      .eq('empresa_id', empresaId)

    return resultado.score
  } catch (err) {
    console.error('Erro em recalcularScoreCliente:', err)
    return 50
  }
}
