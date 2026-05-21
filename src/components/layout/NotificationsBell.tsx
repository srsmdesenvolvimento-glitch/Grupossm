'use client'

import { Bell, AlertTriangle, Clock, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatarData, formatarMoeda } from '@/lib/utils/formatters'

type Alerta = {
  id: string
  tom: 'danger' | 'warn'
  icone: React.ReactNode
  titulo: string
  subtitulo: string
  href: string
}

function hoje() {
  return new Date().toISOString().split('T')[0]
}

function emDias(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function NotificationsBell() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const { data: alertas = [] } = useQuery<Alerta[]>({
    queryKey: ['notificacoes', empresaAtual?.id],
    enabled: !!empresaAtual,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!empresaAtual) return []
      const limite = emDias(7)
      const hj = hoje()
      const resultado: Alerta[] = []

      // Contas a pagar (ambas as empresas)
      const { data: contas } = await supabase
        .from('contas_pagar')
        .select('id, descricao, valor, data_vencimento')
        .eq('empresa_id', empresaAtual.id)
        .neq('status', 'pago')
        .lte('data_vencimento', limite)
        .order('data_vencimento')
        .limit(20)

      for (const c of contas ?? []) {
        const vencida = c.data_vencimento < hj
        resultado.push({
          id: `conta-${c.id}`,
          tom: vencida ? 'danger' : 'warn',
          icone: vencida
            ? <AlertTriangle size={14} className="text-red-500" />
            : <Clock size={14} className="text-yellow-500" />,
          titulo: vencida ? `Conta vencida: ${c.descricao}` : `Conta vence em breve: ${c.descricao}`,
          subtitulo: `${formatarMoeda(c.valor)} · venc. ${formatarData(c.data_vencimento)}`,
          href: empresaAtual.tipo === 'emporio'
            ? '/emporio/financeiro/pagar'
            : '/factoring/financeiro/pagar',
        })
      }

      if (empresaAtual.tipo === 'emporio') {
        // Parcelas a receber (empório) — tabela pode não existir; ignoramos erro
        const { data: parcelas } = await supabase
          .from('parcelas_receber' as string)
          .select('id, descricao, valor, data_vencimento')
          .eq('empresa_id', empresaAtual.id)
          .neq('status', 'pago')
          .lte('data_vencimento', limite)
          .order('data_vencimento')
          .limit(20)

        for (const p of parcelas ?? []) {
          const vencida = p.data_vencimento < hj
          resultado.push({
            id: `parcela-receber-${p.id}`,
            tom: vencida ? 'danger' : 'warn',
            icone: vencida
              ? <AlertTriangle size={14} className="text-red-500" />
              : <Clock size={14} className="text-yellow-500" />,
            titulo: vencida ? `Recebível vencido: ${p.descricao}` : `Recebível vence em breve: ${p.descricao}`,
            subtitulo: `${formatarMoeda(p.valor)} · venc. ${formatarData(p.data_vencimento)}`,
            href: '/emporio/financeiro/receber',
          })
        }

        // Estoque baixo — busca todos e filtra client-side
        const { data: todosProdutos } = await supabase
          .from('produtos')
          .select('id, nome, estoque, estoque_minimo')
          .eq('empresa_id', empresaAtual.id)
          .not('estoque_minimo', 'is', null)
          .limit(100)

        const baixo = (todosProdutos ?? []).filter(
          p => typeof p.estoque === 'number' && typeof p.estoque_minimo === 'number' && p.estoque <= p.estoque_minimo
        )
        for (const p of baixo.slice(0, 10)) {
          resultado.push({
            id: `estoque-${p.id}`,
            tom: 'warn',
            icone: <Package size={14} className="text-orange-500" />,
            titulo: `Estoque baixo: ${p.nome}`,
            subtitulo: `Atual: ${p.estoque} · Mínimo: ${p.estoque_minimo}`,
            href: '/emporio/produtos',
          })
        }
      }

      if (empresaAtual.tipo === 'factoring') {
        // Parcelas de empréstimo vencendo
        const { data: parcelas } = await supabase
          .from('parcelas_emprestimo')
          .select('id, valor, data_vencimento, emprestimo_id')
          .eq('empresa_id', empresaAtual.id)
          .neq('status', 'pago')
          .neq('status', 'cancelado')
          .lte('data_vencimento', limite)
          .order('data_vencimento')
          .limit(20)

        for (const p of parcelas ?? []) {
          const vencida = p.data_vencimento < hj
          resultado.push({
            id: `parcela-emp-${p.id}`,
            tom: vencida ? 'danger' : 'warn',
            icone: vencida
              ? <AlertTriangle size={14} className="text-red-500" />
              : <Clock size={14} className="text-yellow-500" />,
            titulo: vencida ? 'Parcela de empréstimo vencida' : 'Parcela vence em breve',
            subtitulo: `${formatarMoeda(p.valor)} · venc. ${formatarData(p.data_vencimento)}`,
            href: `/factoring/emprestimos/${p.emprestimo_id}`,
          })
        }
      }

      // Ordena: danger primeiro
      return resultado.sort((a, b) => {
        if (a.tom === b.tom) return 0
        return a.tom === 'danger' ? -1 : 1
      })
    },
  })

  const dangers = alertas.filter(a => a.tom === 'danger').length
  const warns = alertas.filter(a => a.tom === 'warn').length
  const total = alertas.length

  return (
    <Popover>
      <PopoverTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: dangers > 0 ? '#DC2626' : '#3B82F6' }}
          >
            {total > 9 ? '9+' : total}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Alertas</span>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {dangers > 0 && <span className="text-red-600 font-medium">{dangers} urgente{dangers > 1 ? 's' : ''}</span>}
              {dangers > 0 && warns > 0 && <span className="mx-1">·</span>}
              {warns > 0 && <span className="text-yellow-600">{warns} atenção</span>}
            </span>
          )}
        </div>

        {total === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Tudo em dia! Sem pendências nos próximos 7 dias.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {alertas.map(alerta => (
                <button
                  key={alerta.id}
                  onClick={() => router.push(alerta.href)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                >
                  <span className="mt-0.5 shrink-0">{alerta.icone}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${alerta.tom === 'danger' ? 'text-red-700' : 'text-yellow-700'}`}>
                      {alerta.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{alerta.subtitulo}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
