import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/clientes/[id] — apaga um cliente do factoring e todo o
// histórico associado (empréstimos quitados/cancelados, parcelas, referências,
// lembretes, jobs de Análise 360). Regra de negócio: bloqueia se existir
// qualquer empréstimo que não esteja quitado ou cancelado ("contrato em
// aberto") — nesse caso o operador precisa quitar/cancelar antes de excluir.
// Exige que o corpo da requisição repita o nome completo do cliente
// (`nomeConfirmacao`) — a UI já exige isso, mas revalidar aqui evita que uma
// chamada direta à API (sem passar pela tela) apague um cliente sem essa
// confirmação.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const admin = createAdminClient()

    const { data: cliente } = await admin
      .from('clientes_factoring')
      .select('id, nome, empresa_id')
      .eq('id', id)
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
    }

    // Só admin/gerente da empresa do cliente pode excluir — exclusão apaga
    // histórico de empréstimos, é ação de mais alto risco que o CRUD normal
    // de cliente (que qualquer papel com acesso à empresa pode fazer hoje).
    const { data: acesso } = await supabaseAuth
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('empresa_id', cliente.empresa_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!acesso || !['admin', 'gerente'].includes(acesso.papel)) {
      return NextResponse.json({ erro: 'Sem permissão para excluir clientes' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const nomeConfirmacao = String(body.nomeConfirmacao ?? '').trim()
    if (nomeConfirmacao.toLowerCase() !== cliente.nome.trim().toLowerCase()) {
      return NextResponse.json({ erro: 'O nome digitado não confere com o nome do cliente' }, { status: 400 })
    }

    // Checagem de contrato aberto + os dois deletes (emprestimos, depois
    // clientes_factoring) rodam como uma única transação nesta função —
    // evita estado parcial (histórico apagado sem o cliente ir junto) e
    // fecha a janela de corrida entre checar e apagar. Ver
    // excluir_cliente_migration.sql.
    const { data: rpcRes, error: rpcError } = await admin.rpc('excluir_cliente_factoring', {
      p_cliente_id: id,
    })

    if (!rpcError && rpcRes && rpcRes.length > 0) {
      const resultado = rpcRes[0] as { sucesso: boolean; contratos_abertos: { numero: string; status: string }[] | null }
      if (!resultado.sucesso) {
        return NextResponse.json({
          erro: 'Cliente possui contrato em aberto — quite ou cancele antes de excluir.',
          contratos: resultado.contratos_abertos ?? [],
        }, { status: 409 })
      }
      return NextResponse.json({ sucesso: true })
    }

    // Fallback (RPC ainda não criada no Supabase — ver excluir_cliente_migration.sql):
    // mesma lógica, mas em duas chamadas separadas, sem a garantia de atomicidade.
    const { data: emprestimosAbertos, error: errCheck } = await admin
      .from('emprestimos')
      .select('id, numero_contrato, status')
      .eq('cliente_id', id)
      .not('status', 'in', '(quitado,cancelado)')

    if (errCheck) {
      return NextResponse.json({ erro: `Falha ao checar empréstimos: ${errCheck.message}` }, { status: 500 })
    }

    if (emprestimosAbertos && emprestimosAbertos.length > 0) {
      return NextResponse.json({
        erro: 'Cliente possui contrato em aberto — quite ou cancele antes de excluir.',
        contratos: emprestimosAbertos.map(e => ({ numero: e.numero_contrato, status: e.status })),
      }, { status: 409 })
    }

    // `emprestimos.cliente_id` é ON DELETE RESTRICT — mesmo empréstimos já
    // quitados/cancelados impedem apagar o cliente enquanto existirem. Apaga
    // esse histórico primeiro; parcelas/histórico de status/renegociações
    // cascateiam sozinhos (ON DELETE CASCADE a partir de emprestimos.id).
    const { error: errEmprestimos } = await admin
      .from('emprestimos')
      .delete()
      .eq('cliente_id', id)

    if (errEmprestimos) {
      return NextResponse.json({ erro: `Falha ao remover histórico de empréstimos: ${errEmprestimos.message}` }, { status: 500 })
    }

    // Referências, lembretes e jobs de Análise 360 têm ON DELETE CASCADE em
    // clientes_factoring — apagar o cliente já limpa todos eles sozinho.
    const { error: errCliente } = await admin
      .from('clientes_factoring')
      .delete()
      .eq('id', id)

    if (errCliente) {
      return NextResponse.json({ erro: `Falha ao remover cliente: ${errCliente.message}` }, { status: 500 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (err: any) {
    console.error('[Clientes DELETE]', err)
    return NextResponse.json({ erro: 'Erro interno no servidor' }, { status: 500 })
  }
}
