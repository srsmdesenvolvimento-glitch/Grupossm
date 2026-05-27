import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function formatarMoeda(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarDataBR(dataStr: string): string {
  if (!dataStr) return '—'
  const partes = dataStr.split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : dataStr
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString().split('T')[0]

  // Cálculo da data para lembrete de 3 dias
  const dataTresDias = new Date(hoje.getTime() + 3 * 86_400_000)
  const dataTresDiasStr = dataTresDias.toISOString().split('T')[0]

  try {
    // 1. Carregar Configurações de todas as empresas
    const { data: configs, error: cfgError } = await supabase
      .from('config_factoring')
      .select('*')

    if (cfgError) throw cfgError

    const configMap = new Map(
      (configs ?? []).map(c => [
        c.empresa_id,
        {
          multa_atraso: Number(c.multa_atraso ?? 2),
          juros_mora_diario: Number(c.juros_mora_diario ?? 0.033),
          whatsapp_padrao: c.whatsapp_padrao ?? 'Financeiro',
          msg_vencimento: c.msg_vencimento,
          msg_cobranca: c.msg_cobranca,
        },
      ]),
    )

    // ── PARTE A: Atualização de Parcelas Atrasadas (Juros e Multa Diários) ──
    const { data: parcelasAtrasadas, error: pError } = await supabase
      .from('parcelas_emprestimo')
      .select('*, clientes_factoring(*), emprestimos(*)')
      .in('status', ['pendente', 'atrasado'])
      .lt('data_vencimento', hojeStr)

    if (pError) throw pError

    let jurosProcessados = 0

    if (parcelasAtrasadas && parcelasAtrasadas.length > 0) {
      const updates = parcelasAtrasadas.map(async p => {
        const cfg = configMap.get(p.empresa_id) ?? {
          multa_atraso: 2.0,
          juros_mora_diario: 0.033,
          whatsapp_padrao: 'Financeiro',
          msg_vencimento: null,
          msg_cobranca: null,
        }

        const venc = new Date(p.data_vencimento + 'T00:00:00Z')
        const dias = Math.max(
          1,
          Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000),
        )

        const novaMulta =
          p.status === 'pendente'
            ? Number(p.valor) * (cfg.multa_atraso / 100)
            : Number(p.multa ?? 0)

        const obsText = p.emprestimos?.observacoes ?? ''
        const matchMora = obsText.match(/\[Mora:\s*([\d.]+)%\s*ao\s*dia\]/)
        const jurosMoraDiario = matchMora ? parseFloat(matchMora[1]) : cfg.juros_mora_diario

        const novosJuros = Number(p.valor) * (jurosMoraDiario / 100) * dias
        const valorTotalComEncargos = Number(p.valor) + novaMulta + novosJuros

        // Atualiza a parcela no banco
        await supabase
          .from('parcelas_emprestimo')
          .update({
            status: 'atrasado',
            multa: Number(novaMulta.toFixed(2)),
            juros_mora: Number(novosJuros.toFixed(2)),
          })
          .eq('id', p.id)

        // Fila de cobrança de atraso via WhatsApp
        const cliente = p.clientes_factoring
        const emprestimo = p.emprestimos

        if (cliente && cliente.telefone) {
          const defaultCobranca = `Prezado(a) {{nome}}, consta em nosso sistema que a sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} está em atraso há {{dias_atraso}} dias. O valor original de {{valor}} foi atualizado para {{valor_total}} (com acréscimo de multa de {{multa}} e juros de mora acumulados de {{juros_mora}}). Solicitamos a regularização via Chave PIX: {{whatsapp_padrao}}.`
          const template = cfg.msg_cobranca || defaultCobranca
          
          const msgTexto = template
            .replace(/\{\{nome\}\}/g, cliente.nome)
            .replace(/\{\{numero_parcela\}\}/g, String(p.numero_parcela))
            .replace(/\{\{total_parcelas\}\}/g, String(p.total_parcelas))
            .replace(/\{\{numero_contrato\}\}/g, emprestimo?.numero_contrato ?? '')
            .replace(/\{\{dias_atraso\}\}/g, String(dias))
            .replace(/\{\{valor\}\}/g, formatarMoeda(Number(p.valor)))
            .replace(/\{\{multa\}\}/g, formatarMoeda(novaMulta))
            .replace(/\{\{juros_mora\}\}/g, formatarMoeda(novosJuros))
            .replace(/\{\{valor_total\}\}/g, formatarMoeda(valorTotalComEncargos))
            .replace(/\{\{whatsapp_padrao\}\}/g, cfg.whatsapp_padrao)

          await supabase.from('notificacoes_log').insert({
            empresa_id: p.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Cobrança de Atraso - Contrato ${emprestimo?.numero_contrato ?? ''}`,
            mensagem: msgTexto,
            referencia_tipo: 'emprestimo',
            referencia_id: p.emprestimo_id,
            status: 'pendente',
          })
        }
      })

      await Promise.all(updates)
      jurosProcessados = parcelasAtrasadas.length
    }

    // ── PARTE B: Lembrete de Parcelas com Vencimento Hoje ──
    const { data: parcelasHoje, error: hojeError } = await supabase
      .from('parcelas_emprestimo')
      .select('*, clientes_factoring(*), emprestimos(*)')
      .eq('status', 'pendente')
      .eq('data_vencimento', hojeStr)

    if (hojeError) throw hojeError

    let alertasHoje = 0

    if (parcelasHoje && parcelasHoje.length > 0) {
      const updatesHoje = parcelasHoje.map(async p => {
        const cfg = configMap.get(p.empresa_id) ?? {
          whatsapp_padrao: 'Financeiro',
          msg_vencimento: null,
        }

        const cliente = p.clientes_factoring
        const emprestimo = p.emprestimos

        if (cliente && cliente.telefone) {
          const defaultVencHoje = `Atenção, {{nome}}! Lembramos que sua parcela {{numero_parcela}}/{{total_parcelas}} do contrato {{numero_contrato}} vence HOJE ({{data_vencimento}}) no valor de {{valor}}. Chave PIX de pagamento: {{whatsapp_padrao}}. Favor desconsiderar caso já tenha efetuado a liquidação.`
          const template = cfg.msg_vencimento || defaultVencHoje

          const msgTexto = template
            .replace(/\{\{nome\}\}/g, cliente.nome)
            .replace(/\{\{numero_parcela\}\}/g, String(p.numero_parcela))
            .replace(/\{\{total_parcelas\}\}/g, String(p.total_parcelas))
            .replace(/\{\{numero_contrato\}\}/g, emprestimo?.numero_contrato ?? '')
            .replace(/\{\{data_vencimento\}\}/g, formatarDataBR(p.data_vencimento))
            .replace(/\{\{valor\}\}/g, formatarMoeda(Number(p.valor)))
            .replace(/\{\{whatsapp_padrao\}\}/g, cfg.whatsapp_padrao)

          await supabase.from('notificacoes_log').insert({
            empresa_id: p.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Aviso de Vencimento Hoje - Parcela ${p.numero_parcela}`,
            mensagem: msgTexto,
            referencia_tipo: 'emprestimo',
            referencia_id: p.emprestimo_id,
            status: 'pendente',
          })
        }
      })

      await Promise.all(updatesHoje)
      alertasHoje = parcelasHoje.length
    }

    // ── PARTE C: Lembrete de Parcelas com Vencimento em 3 Dias ──
    const { data: parcelasTresDias, error: tdError } = await supabase
      .from('parcelas_emprestimo')
      .select('*, clientes_factoring(*), emprestimos(*)')
      .eq('status', 'pendente')
      .eq('data_vencimento', dataTresDiasStr)

    if (tdError) throw tdError

    let alertasTresDias = 0

    if (parcelasTresDias && parcelasTresDias.length > 0) {
      const updatesTresDias = parcelasTresDias.map(async p => {
        const cfg = configMap.get(p.empresa_id) ?? {
          whatsapp_padrao: 'Financeiro',
        }

        const cliente = p.clientes_factoring
        const emprestimo = p.emprestimos

        if (cliente && cliente.telefone) {
          const msgTexto = `Olá, ${cliente.nome}! Passando para lembrar que sua parcela ${p.numero_parcela}/${p.total_parcelas} do contrato ${emprestimo?.numero_contrato ?? ''} vence em 3 dias (${formatarDataBR(p.data_vencimento)}) no valor de ${formatarMoeda(Number(p.valor))}. Evite multas pagando em dia! Chave PIX: ${cfg.whatsapp_padrao}.`

          await supabase.from('notificacoes_log').insert({
            empresa_id: p.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Aviso de Vencimento em 3 Dias - Parcela ${p.numero_parcela}`,
            mensagem: msgTexto,
            referencia_tipo: 'emprestimo',
            referencia_id: p.emprestimo_id,
            status: 'pendente',
          })
        }
      })

      await Promise.all(updatesTresDias)
      alertasTresDias = parcelasTresDias.length
    }

    return NextResponse.json({
      ok: true,
      jurosProcessados,
      alertasHoje,
      alertasTresDias,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
