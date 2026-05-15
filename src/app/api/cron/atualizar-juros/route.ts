import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const hoje = new Date()
  hoje.setUTCHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString().split('T')[0]

  const [{ data: configs }, { data: parcelas, error }] = await Promise.all([
    supabase
      .from('config_factoring')
      .select('empresa_id, multa_atraso, juros_mora_diario'),
    supabase
      .from('parcelas_emprestimo')
      .select('id, empresa_id, valor, status, data_vencimento, multa')
      .in('status', ['pendente', 'atrasado'])
      .lt('data_vencimento', hojeStr),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!parcelas?.length) {
    return NextResponse.json({ ok: true, processadas: 0 })
  }

  const configMap = new Map(
    (configs ?? []).map(c => [
      c.empresa_id,
      {
        multa_atraso: Number(c.multa_atraso),
        juros_mora_diario: Number(c.juros_mora_diario),
      },
    ]),
  )

  const updates = parcelas.map(p => {
    const cfg = configMap.get(p.empresa_id) ?? {
      multa_atraso: 2.0,
      juros_mora_diario: 0.0333,
    }

    const venc = new Date(p.data_vencimento + 'T00:00:00Z')
    const dias = Math.max(
      1,
      Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000),
    )

    // Multa: one-time fee on first day overdue; keep existing for already-atrasado
    const novaMulta =
      p.status === 'pendente'
        ? Number(p.valor) * (cfg.multa_atraso / 100)
        : Number(p.multa)

    // Juros mora: accrues daily on principal
    const novosJuros = Number(p.valor) * (cfg.juros_mora_diario / 100) * dias

    return supabase
      .from('parcelas_emprestimo')
      .update({
        status: 'atrasado',
        multa: Number(novaMulta.toFixed(2)),
        juros_mora: Number(novosJuros.toFixed(2)),
      })
      .eq('id', p.id)
  })

  await Promise.all(updates)

  return NextResponse.json({ ok: true, processadas: parcelas.length })
}
