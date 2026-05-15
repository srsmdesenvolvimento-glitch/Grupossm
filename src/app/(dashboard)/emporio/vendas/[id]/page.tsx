'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { toast } from 'sonner'
import { formatarData, formatarMoeda } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ChevronLeft,
  Printer,
  X,
  Users,
  FileText,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface Venda {
  id: string
  numero_venda: number
  cliente_id: string | null
  usuario_id: string | null
  subtotal: number
  desconto: number
  total: number
  tipo_pagamento: string | null
  parcelas: number
  valor_entrada: number
  observacoes: string | null
  data_entrega: string | null
  status: 'orcamento' | 'aprovada' | 'entregue' | 'cancelada'
  created_at: string
  clientes_emporio: {
    nome: string
    cpf: string | null
    telefone: string | null
  } | null
}

interface ItemVenda {
  id: string
  nome_produto: string
  sku_produto: string | null
  quantidade: number
  preco_unitario: number
  desconto: number
  total: number
}

interface ParcelaReceber {
  id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_pagamento: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacoes: string | null
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cheque: 'Cheque',
}

const STATUS_PARCELA_ICONS = {
  pago: CheckCircle,
  pendente: Clock,
  atrasado: AlertTriangle,
  cancelado: X,
}

export default function VendaDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()
  const { empresaAtual } = useEmpresa()

  const [venda, setVenda] = useState<Venda | null>(null)
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelarDialog, setCancelarDialog] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [receberParcelaId, setReceberParcelaId] = useState<string | null>(null)
  const [marcandoPago, setMarcandoPago] = useState(false)

  const carregarDados = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: vendaData }, { data: itensData }, { data: parcelasData }] = await Promise.all([
        supabase
          .from('vendas')
          .select('*, clientes_emporio(nome, cpf, telefone)')
          .eq('id', id)
          .single(),
        supabase
          .from('itens_venda')
          .select('*')
          .eq('venda_id', id)
          .order('id'),
        supabase
          .from('parcelas_receber')
          .select('*')
          .eq('venda_id', id)
          .order('numero_parcela'),
      ])

      if (vendaData) setVenda(vendaData as Venda)
      if (itensData) setItens(itensData as ItemVenda[])
      if (parcelasData) setParcelas(parcelasData as ParcelaReceber[])
    } catch (e) {
      toast.error('Erro ao carregar detalhes da venda')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const cancelarVenda = async () => {
    if (!venda) return
    setCancelando(true)
    try {
      const { error } = await supabase
        .from('vendas')
        .update({ status: 'cancelada' })
        .eq('id', venda.id)

      if (error) throw error

      await supabase
        .from('parcelas_receber')
        .update({ status: 'cancelado' })
        .eq('venda_id', venda.id)

      toast.success('Venda cancelada com sucesso')
      setCancelarDialog(false)
      carregarDados()
    } catch (e) {
      toast.error('Erro ao cancelar venda')
      console.error(e)
    } finally {
      setCancelando(false)
    }
  }

  const marcarParcelaPaga = async (parcelaId: string) => {
    setMarcandoPago(true)
    try {
      const { error } = await supabase
        .from('parcelas_receber')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString().split('T')[0],
          valor_pago: parcelas.find((p) => p.id === parcelaId)?.valor ?? 0,
        })
        .eq('id', parcelaId)

      if (error) throw error

      toast.success('Parcela marcada como paga')
      setReceberParcelaId(null)
      carregarDados()
    } catch (e) {
      toast.error('Erro ao registrar pagamento')
      console.error(e)
    } finally {
      setMarcandoPago(false)
    }
  }

  if (loading) return <LoadingPage />
  if (!venda) {
    return (
      <AppShell empresa="emporio" titulo="Venda não encontrada">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <FileText className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500">Venda não encontrada</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/emporio/vendas')}
          >
            Voltar para Vendas
          </Button>
        </div>
      </AppShell>
    )
  }

  const totalParcelasValor = parcelas.reduce((s, p) => s + Number(p.valor), 0)
  const totalRecebido = parcelas
    .filter((p) => p.status === 'pago')
    .reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0)

  return (
    <AppShell empresa="emporio" titulo={`Venda #${venda.numero_venda}`}>
      {/* Back & Actions */}
      <div className="flex items-center justify-between mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/emporio/vendas')}
          className="text-slate-500 hover:text-slate-800 -ml-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Vendas
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-slate-600"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimir
          </Button>
          {venda.status !== 'cancelada' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelarDialog(true)}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancelar Venda
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Header cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Venda info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Venda #{venda.numero_venda}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{formatarData(venda.created_at)}</p>
              </div>
              <StatusBadge status={venda.status} />
            </div>
            <div className="space-y-2 text-sm">
              {venda.tipo_pagamento && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagamento</span>
                  <span className="font-medium text-slate-800">
                    {PAYMENT_LABELS[venda.tipo_pagamento] ?? venda.tipo_pagamento}
                    {venda.parcelas > 1 && (
                      <span className="text-slate-400 ml-1">({venda.parcelas}x)</span>
                    )}
                  </span>
                </div>
              )}
              {venda.valor_entrada > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Entrada</span>
                  <span className="font-medium text-slate-800">{formatarMoeda(venda.valor_entrada)}</span>
                </div>
              )}
              {venda.data_entrega && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Data de entrega</span>
                  <span className="font-medium text-slate-800">{formatarData(venda.data_entrega)}</span>
                </div>
              )}
            </div>
            {venda.observacoes && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Observações</p>
                <p className="text-sm text-slate-700">{venda.observacoes}</p>
              </div>
            )}
          </div>

          {/* Cliente info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <h3 className="font-semibold text-slate-800">Cliente</h3>
            </div>

            {venda.clientes_emporio ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800 text-base">{venda.clientes_emporio.nome}</p>
                {venda.clientes_emporio.telefone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telefone</span>
                    <span className="text-slate-800">{venda.clientes_emporio.telefone}</span>
                  </div>
                )}
                {venda.clientes_emporio.cpf && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">CPF</span>
                    <span className="text-slate-800 font-mono">{venda.clientes_emporio.cpf}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <p className="text-sm italic">Venda de balcão (sem cliente cadastrado)</p>
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Itens da Venda</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-5 py-3">
                    Produto
                  </th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-20">
                    Qtd
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                    Preço Unit.
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-24">
                    Desconto
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-5 py-3 w-28">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {itens.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-800">{item.nome_produto}</p>
                      {item.sku_produto && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">SKU: {item.sku_produto}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">
                        {item.quantidade}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm text-slate-600 tabular-nums">
                        {formatarMoeda(Number(item.preco_unitario))}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm text-slate-600 tabular-nums">
                        {Number(item.desconto) > 0 ? (
                          <span className="text-emerald-600">- {formatarMoeda(Number(item.desconto))}</span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <MoneyDisplay valor={Number(item.total)} tamanho="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-800">{formatarMoeda(Number(venda.subtotal))}</span>
              </div>
              {Number(venda.desconto) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Desconto</span>
                  <span className="text-emerald-600 font-medium">- {formatarMoeda(Number(venda.desconto))}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-2xl font-bold text-[#D4A528]">
                  {formatarMoeda(Number(venda.total))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Parcelas */}
        {parcelas.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <h3 className="font-semibold text-slate-800">Parcelas do Crediário</h3>
              </div>
              <div className="text-sm text-slate-500">
                Recebido: <span className="font-semibold text-emerald-600">{formatarMoeda(totalRecebido)}</span>
                {' / '}
                <span className="text-slate-700">{formatarMoeda(totalParcelasValor)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-5 py-3 w-24">
                      Parcela
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                      Valor
                    </th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                      Vencimento
                    </th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-28">
                      Pagamento
                    </th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide px-3 py-3 w-24">
                      Status
                    </th>
                    <th className="px-5 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parcelas.map((parcela) => {
                    const Icon = STATUS_PARCELA_ICONS[parcela.status] ?? Clock
                    const isAtrasada =
                      parcela.status === 'atrasado' ||
                      (parcela.status === 'pendente' &&
                        parcela.data_vencimento < new Date().toISOString().split('T')[0])

                    return (
                      <tr
                        key={parcela.id}
                        className={cn(
                          'hover:bg-slate-50/50 transition-colors',
                          isAtrasada && 'bg-red-50/30',
                        )}
                      >
                        <td className="px-5 py-3">
                          <span className="text-sm font-medium text-slate-700 tabular-nums">
                            {parcela.numero_parcela}/{parcela.total_parcelas}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <MoneyDisplay valor={Number(parcela.valor)} tamanho="sm" />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            'text-sm tabular-nums',
                            isAtrasada ? 'text-red-600 font-medium' : 'text-slate-600',
                          )}>
                            {formatarData(parcela.data_vencimento)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-slate-600 tabular-nums">
                            {parcela.data_pagamento ? formatarData(parcela.data_pagamento) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <StatusBadge status={parcela.status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          {(parcela.status === 'pendente' || parcela.status === 'atrasado') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-[#D4A528] text-[#D4A528] hover:bg-[#FEF9E7]"
                              onClick={() => setReceberParcelaId(parcela.id)}
                            >
                              Receber
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Venda Dialog */}
      <ConfirmDialog
        open={cancelarDialog}
        onOpenChange={(open) => !cancelando && setCancelarDialog(open)}
        titulo="Cancelar Venda"
        descricao={`Tem certeza que deseja cancelar a venda #${venda.numero_venda}? Esta ação cancelará também todas as parcelas pendentes.`}
        labelConfirmar="Cancelar Venda"
        onConfirmar={cancelarVenda}
        carregando={cancelando}
        variante="danger"
      />

      {/* Receive Parcela Dialog */}
      <ConfirmDialog
        open={!!receberParcelaId}
        onOpenChange={(open) => !marcandoPago && !open && setReceberParcelaId(null)}
        titulo="Confirmar Recebimento"
        descricao="Confirma o recebimento desta parcela? A parcela será marcada como paga com a data de hoje."
        labelConfirmar="Confirmar Recebimento"
        onConfirmar={() => { if (receberParcelaId) marcarParcelaPaga(receberParcelaId) }}
        carregando={marcandoPago}
      />
    </AppShell>
  )
}
