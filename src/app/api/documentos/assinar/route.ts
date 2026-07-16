import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET } from '@/lib/utils/storage'

const URL_TTL_SEGUNDOS = 300 // 5 min — suficiente pra abrir/baixar, sem deixar link "vivo" por muito tempo

// Bucket de documentos de cliente (RG, CNH, comprovante de renda etc.) é
// privado — esta rota é o único jeito de conseguir uma URL utilizável, e só
// assina depois de confirmar que o usuário logado tem acesso à empresa dona
// do documento (primeiro segmento do path é sempre o empresa_id).
export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const path = request.nextUrl.searchParams.get('path')
    if (!path) return NextResponse.json({ erro: 'path é obrigatório' }, { status: 400 })

    const empresaId = path.split('/')[0]
    if (!empresaId) return NextResponse.json({ erro: 'path inválido' }, { status: 400 })

    const { data: acesso } = await supabaseAuth
      .from('usuario_empresa')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .maybeSingle()
    if (!acesso) return NextResponse.json({ erro: 'Sem acesso a este documento' }, { status: 403 })

    const supabase = createAdminClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SEGUNDOS)
    if (error || !data) {
      return NextResponse.json({ erro: error?.message ?? 'Falha ao gerar link' }, { status: 502 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    console.error('[Documentos] Erro ao assinar URL:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}
