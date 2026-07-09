import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/limpar-dados
// Remove todos os dados transacionais mantendo usuários, empresas e configurações.
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { data: adminCheck } = await supabase
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('papel', 'admin')
      .eq('ativo', true)
      .limit(1)

    if (!adminCheck || adminCheck.length === 0) {
      return NextResponse.json({ erro: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Tabelas para limpar (ordem importa — FK constraints)
    const tabelas = [
      'notificacoes_log',
      'assertiva_log_factoring',
      'assertiva_cache_factoring',
      'referencias_cliente_factoring',
      'movimentacoes_caixa',
      'parcelas_emprestimo',
      'emprestimos',
      'clientes_factoring',
      // Empório
      'itens_venda',
      'vendas',
      'movimentacao_estoque',
      'clientes_emporio',
    ]

    const erros: string[] = []
    const limpos: string[] = []

    for (const tabela of tabelas) {
      try {
        const { error } = await admin.from(tabela as any).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) {
          if (error.message.includes('does not exist') || error.message.includes('relation')) {
            // tabela não existe — ignora
          } else {
            erros.push(`${tabela}: ${error.message}`)
          }
        } else {
          limpos.push(tabela)
        }
      } catch {
        // ignora tabelas que não existem
      }
    }

    return NextResponse.json({
      sucesso: true,
      limpos,
      erros: erros.length ? erros : undefined,
    })
  } catch (err: any) {
    console.error('[LimparDados]', err)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
