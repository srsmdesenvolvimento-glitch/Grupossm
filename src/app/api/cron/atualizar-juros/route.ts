import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarTemplate } from '@/lib/utils/whatsapp'

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

  // Obter hora atual em Brasília (America/Sao_Paulo)
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false
  })
  const horaBrasilia = parseInt(formatter.format(new Date()))

  // Verifica se horário atual está dentro da janela de envio da empresa (±1h de tolerância)
  // Isso garante que o cron funcione mesmo rodando em intervalos de 30-60min
  function dentroJanelaEnvio(horaEnvioNum: number): boolean {
    return Math.abs(horaBrasilia - horaEnvioNum) <= 1
  }

  try {
    // 1. Carregar Configurações de todas as empresas
    const { data: configs, error: cfgError } = await supabase
      .from('config_factoring')
      .select('*')

    if (cfgError) throw cfgError

    const configMap = new Map(
      (configs ?? []).map(c => {
        const settings = c.whatsapp_settings || {}
        const horaEnvioStr = settings.hora_envio || '09:00'
        const horaEnvioNum = parseInt(horaEnvioStr.split(':')[0]) || 9
        return [
          c.empresa_id,
          {
            multa_atraso: Number(c.multa_atraso ?? 2),
            juros_mora_diario: Number(c.juros_mora_diario ?? 0.033),
            whatsapp_padrao: c.whatsapp_padrao ?? 'Financeiro',
            contrato_criado: settings.contrato_criado ?? { ativo: true },
            contrato_assinado: settings.contrato_assinado ?? { ativo: true },
            lembrete_pre_vencimento: settings.lembrete_pre_vencimento ?? { ativo: true, dias_antes: 3 },
            lembrete_vencimento: settings.lembrete_vencimento ?? { ativo: true },
            cobranca_pos_vencimento: settings.cobranca_pos_vencimento ?? { ativo: true },
            hora_envio: horaEnvioStr,
            hora_envio_num: horaEnvioNum,
          }
        ]
      }),
    )

    // 2. Carregar Cache de Idempotência: Notificações de parcelas já criadas/enviadas hoje
    const { data: notificacoesHoje, error: notifErr } = await supabase
      .from('notificacoes_log')
      .select('referencia_id')
      .eq('referencia_tipo', 'parcela')
      .gte('created_at', hojeStr)

    if (notifErr) throw notifErr
    const idsEnviadosHoje = new Set((notificacoesHoje ?? []).map(n => n.referencia_id))

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
          contrato_criado: { ativo: true },
          contrato_assinado: { ativo: true },
          lembrete_pre_vencimento: { ativo: true, dias_antes: 3 },
          lembrete_vencimento: { ativo: true },
          cobranca_pos_vencimento: { ativo: true },
          hora_envio: '09:00',
          hora_envio_num: 9,
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

        // Base de juros = valor original menos o que já foi pago (pagamento parcial)
        const baseJuros = Math.max(0, Number(p.valor) - Number(p.valor_pago ?? 0))
        const novosJuros = baseJuros * (Math.pow(1 + jurosMoraDiario / 100, dias) - 1)
        const valorTotalComEncargos = Number(p.valor) + novaMulta + novosJuros

        // Atualiza a parcela no banco
        const { error: parcelaError } = await supabase
          .from('parcelas_emprestimo')
          .update({
            status: 'atrasado',
            multa: Number(novaMulta.toFixed(2)),
            juros_mora: Number(novosJuros.toFixed(2)),
          })
          .eq('id', p.id)
        if (parcelaError) {
          console.error(`Falha ao atualizar parcela ${p.id}:`, parcelaError.message)
          return
        }

        // Fila de cobrança de atraso via WhatsApp (respeita hora_envio e idempotência)
        const cliente = p.clientes_factoring
        const emprestimo = p.emprestimos
        const cobranca = cfg.cobranca_pos_vencimento

        const deveEnviarMensagem = 
          cobranca.ativo && 
          dentroJanelaEnvio(cfg.hora_envio_num) && 
          !idsEnviadosHoje.has(p.id)

        if (deveEnviarMensagem && cliente && cliente.telefone) {
          const result = await enviarTemplate(
            cliente.telefone,
            'cobranca_pos_vencimento',
            {
              nome: cliente.nome,
              numero_contrato: emprestimo?.numero_contrato ?? '',
              numero_parcela: String(p.numero_parcela),
              total_parcelas: String(p.total_parcelas),
              data_vencimento: formatarDataBR(p.data_vencimento),
              dias_atraso: String(dias),
              valor_total: formatarMoeda(valorTotalComEncargos),
              whatsapp_padrao: cfg.whatsapp_padrao,
            },
            p.empresa_id,
          )
          const { error: notifCobrancaError } = await supabase.from('notificacoes_log').insert({
            empresa_id: p.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Cobrança de Atraso - Contrato ${emprestimo?.numero_contrato ?? ''}`,
            mensagem: `Template srsm2_cobranca_atraso — parcela ${p.numero_parcela}/${p.total_parcelas} em atraso ${dias}d`,
            referencia_tipo: 'parcela',
            referencia_id: p.id,
            status: result.ok ? 'enviado' : 'erro',
            erro: result.ok ? null : (result.erro ?? 'Falha no template'),
            whatsapp_message_id: result.ok ? (result.messageId ?? null) : null,
            enviado_em: result.ok ? new Date().toISOString() : null,
          })
          if (notifCobrancaError) {
            console.error('Falha ao registrar notificação de cobrança:', notifCobrancaError.message)
          } else {
            idsEnviadosHoje.add(p.id)
          }
        }
      })

      const results = await Promise.allSettled(updates)
      jurosProcessados = results.filter(r => r.status === 'fulfilled').length
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
          lembrete_vencimento: { ativo: true },
          hora_envio: '09:00',
          hora_envio_num: 9,
        }

        const cliente = p.clientes_factoring
        const emprestimo = p.emprestimos
        const venc = cfg.lembrete_vencimento

        const deveEnviarMensagem = 
          venc.ativo && 
          dentroJanelaEnvio(cfg.hora_envio_num) && 
          !idsEnviadosHoje.has(p.id)

        if (deveEnviarMensagem && cliente && cliente.telefone) {
          const result = await enviarTemplate(
            cliente.telefone,
            'lembrete_vencimento',
            {
              nome: cliente.nome,
              numero_parcela: String(p.numero_parcela),
              total_parcelas: String(p.total_parcelas),
              numero_contrato: emprestimo?.numero_contrato ?? '',
              valor: formatarMoeda(Number(p.valor)),
              whatsapp_padrao: cfg.whatsapp_padrao,
            },
            p.empresa_id,
          )
          const { error: notifHojeError } = await supabase.from('notificacoes_log').insert({
            empresa_id: p.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Aviso de Vencimento Hoje - Parcela ${p.numero_parcela}`,
            mensagem: `Template srsm2_vencimento_hoje — parcela ${p.numero_parcela}/${p.total_parcelas} vence hoje`,
            referencia_tipo: 'parcela',
            referencia_id: p.id,
            status: result.ok ? 'enviado' : 'erro',
            erro: result.ok ? null : (result.erro ?? 'Falha no template'),
            whatsapp_message_id: result.ok ? (result.messageId ?? null) : null,
            enviado_em: result.ok ? new Date().toISOString() : null,
          })
          if (notifHojeError) {
            console.error('Falha ao registrar notificação de vencimento hoje:', notifHojeError.message)
          } else {
            idsEnviadosHoje.add(p.id)
          }
        }
      })

      await Promise.all(updatesHoje)
      alertasHoje = parcelasHoje.length
    }

    // ── PARTE C: Lembrete de Parcelas Pré-Vencimento (Dias Dinâmicos por Empresa) ──
    const companiesByPreVencDays = new Map<number, string[]>()
    for (const [empresaId, cfg] of configMap.entries()) {
      // Apenas enfileira se o horário atual de Brasília coincidir com a hora configurada para a empresa
      if (cfg.lembrete_pre_vencimento.ativo && dentroJanelaEnvio(cfg.hora_envio_num)) {
        const days = Number(cfg.lembrete_pre_vencimento.dias_antes ?? 3)
        const currentList = companiesByPreVencDays.get(days) || []
        companiesByPreVencDays.set(days, [...currentList, empresaId])
      }
    }

    let alertasTresDias = 0

    for (const [days, companyIds] of companiesByPreVencDays.entries()) {
      const dataTresDias = new Date(hoje.getTime() + days * 86_400_000)
      const dataTresDiasStr = dataTresDias.toISOString().split('T')[0]

      const { data: parcelasPre, error: tdError } = await supabase
        .from('parcelas_emprestimo')
        .select('*, clientes_factoring(*), emprestimos(*)')
        .eq('status', 'pendente')
        .eq('data_vencimento', dataTresDiasStr)
        .in('empresa_id', companyIds)

      if (tdError) throw tdError

      if (parcelasPre && parcelasPre.length > 0) {
        const updatesPre = parcelasPre.map(async p => {
          const cfg = configMap.get(p.empresa_id) ?? {
            whatsapp_padrao: 'Financeiro',
            lembrete_pre_vencimento: { ativo: true, template: '', dias_antes: 3 },
          }

          const cliente = p.clientes_factoring
          const emprestimo = p.emprestimos
          const preVenc = cfg.lembrete_pre_vencimento

          const deveEnviarMensagem = !idsEnviadosHoje.has(p.id)

          if (deveEnviarMensagem && cliente && cliente.telefone) {
            const result = await enviarTemplate(
              cliente.telefone,
              'lembrete_pre_vencimento',
              {
                nome: cliente.nome,
                numero_parcela: String(p.numero_parcela),
                total_parcelas: String(p.total_parcelas),
                numero_contrato: emprestimo?.numero_contrato ?? '',
                dias_antes: String(days),
                data_vencimento: formatarDataBR(p.data_vencimento),
                valor: formatarMoeda(Number(p.valor)),
                whatsapp_padrao: cfg.whatsapp_padrao,
              },
              p.empresa_id,
            )
            const { error: notifTresDiasError } = await supabase.from('notificacoes_log').insert({
              empresa_id: p.empresa_id,
              canal: 'whatsapp',
              destinatario: cliente.telefone,
              assunto: `Aviso de Vencimento em ${days} Dias - Parcela ${p.numero_parcela}`,
              mensagem: `Template srsm2_lembrete_vencimento — parcela ${p.numero_parcela}/${p.total_parcelas} vence em ${days}d`,
              referencia_tipo: 'parcela',
              referencia_id: p.id,
              status: result.ok ? 'enviado' : 'erro',
              erro: result.ok ? null : (result.erro ?? 'Falha no template'),
              whatsapp_message_id: result.ok ? (result.messageId ?? null) : null,
              enviado_em: result.ok ? new Date().toISOString() : null,
            })
            if (notifTresDiasError) {
              console.error('Falha ao registrar notificação de pré-vencimento:', notifTresDiasError.message)
            } else {
              idsEnviadosHoje.add(p.id)
            }
          }
        })

        await Promise.all(updatesPre)
        alertasTresDias += parcelasPre.length
      }
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
