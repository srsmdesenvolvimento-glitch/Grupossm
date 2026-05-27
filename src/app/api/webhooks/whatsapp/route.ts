import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()
    const { error: logError } = await supabase.from('webhook_logs').insert({
      tipo: 'whatsapp',
      payload: body,
      created_at: new Date().toISOString(),
    })
    if (logError) console.error('Falha ao gravar webhook log:', logError.message)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook' })
}
