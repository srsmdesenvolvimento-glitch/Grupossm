'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, User, Banknote } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatarCPF, formatarTelefone, formatarMoeda, formatarData, iniciais } from '@/lib/utils/formatters'
import type { ClienteFactoring, Emprestimo } from '@/lib/types/database'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  analise:      { label: 'Em Análise', color: '#64748b' },
  aprovado:     { label: 'Aprovado',   color: '#D4A528' },
  ativo:        { label: 'Ativo',      color: '#22c55e' },
  quitado:      { label: 'Quitado',   color: '#1E5AA8' },
  inadimplente: { label: 'Inadim.',   color: '#ef4444' },
  cancelado:    { label: 'Cancelado', color: '#94a3b8' },
}

interface ClienteSheetProps {
  clienteId: string
  empresaId: string
  trigger: React.ReactNode
}

export function ClienteSheet({ clienteId, empresaId, trigger }: ClienteSheetProps) {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const { data: cliente, isLoading: loadingCliente } = useQuery<ClienteFactoring | null>({
    queryKey: ['cliente-sheet', clienteId],
    enabled: open && !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes_factoring')
        .select('*')
        .eq('id', clienteId)
        .single()
      return data as ClienteFactoring | null
    },
  })

  const { data: emprestimos } = useQuery<Emprestimo[]>({
    queryKey: ['cliente-emprestimos-sheet', clienteId, empresaId],
    enabled: open && !!clienteId,
    initialData: [],
    queryFn: async () => {
      const { data } = await supabase
        .from('emprestimos')
        .select('id, numero_contrato, valor_principal, status, saldo_devedor, data_liberacao')
        .eq('cliente_id', clienteId)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as Emprestimo[]
    },
  })

  function irParaCliente() {
    setOpen(false)
    router.push(`/factoring/clientes/${clienteId}`)
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="contents cursor-pointer">
        {trigger}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="text-base flex items-center gap-2">
              <User size={16} className="text-muted-foreground" />
              Ficha do Cliente
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loadingCliente ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : cliente ? (
              <div className="space-y-0">
                {/* Avatar + nome */}
                <div className="px-6 py-5 flex items-center gap-4 border-b border-border">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: '#1E5AA8' }}
                  >
                    {iniciais(cliente.nome)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-base">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">{formatarCPF(cliente.cpf ?? '')}</p>
                    <span
                      className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        color: cliente.status === 'ativo' ? '#22c55e' : cliente.status === 'bloqueado' ? '#ef4444' : '#64748b',
                        backgroundColor: cliente.status === 'ativo' ? '#f0fdf4' : cliente.status === 'bloqueado' ? '#fef2f2' : '#f8fafc',
                      }}
                    >
                      {cliente.status === 'ativo' ? 'Ativo' : cliente.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="px-6 py-4 flex justify-center border-b border-border">
                  <ScoreGauge score={cliente.score_interno} size="md" />
                </div>

                {/* Dados pessoais */}
                <div className="px-6 py-4 border-b border-border space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contato</p>
                  {[
                    { l: 'Telefone', v: formatarTelefone(cliente.telefone) },
                    { l: 'E-mail', v: cliente.email },
                    { l: 'Data de nascimento', v: cliente.data_nascimento ? formatarData(cliente.data_nascimento) : null },
                    { l: 'Renda mensal', v: cliente.renda_mensal ? formatarMoeda(cliente.renda_mensal) : null },
                  ].filter(row => !!row.v).map(row => (
                    <div key={row.l} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground shrink-0">{row.l}</span>
                      <span className="font-medium text-foreground text-right">{row.v}</span>
                    </div>
                  ))}
                </div>

                {/* Endereço */}
                {(cliente.endereco || cliente.cidade) && (
                  <div className="px-6 py-4 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Endereço</p>
                    <p className="text-sm text-foreground">
                      {[cliente.endereco, cliente.numero, cliente.complemento].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}

                {/* Dados financeiros */}
                <div className="px-6 py-4 border-b border-border space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financeiro</p>
                  {[
                    { l: 'Limite de crédito', v: formatarMoeda(cliente.limite_credito) },
                    { l: 'Crédito utilizado', v: formatarMoeda(cliente.credito_utilizado) },
                    { l: 'Crédito disponível', v: formatarMoeda(cliente.credito_disponivel) },
                    { l: 'Total emprestado', v: formatarMoeda(cliente.valor_total_emprestado ?? 0) },
                  ].map(row => (
                    <div key={row.l} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground shrink-0">{row.l}</span>
                      <span className="font-medium text-foreground">{row.v}</span>
                    </div>
                  ))}
                </div>

                {/* Observações */}
                {cliente.observacoes && (
                  <div className="px-6 py-4 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Observações</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cliente.observacoes}</p>
                  </div>
                )}

                {/* Empréstimos */}
                <div className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote size={14} className="text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Contratos ({emprestimos.length})
                    </p>
                  </div>
                  {emprestimos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {emprestimos.map(e => {
                        const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.analise
                        return (
                          <button
                            key={e.id}
                            onClick={() => { setOpen(false); router.push(`/factoring/emprestimos/${e.id}`) }}
                            className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-mono font-semibold" style={{ color: '#1E5AA8' }}>{e.numero_contrato}</p>
                              <p className="text-xs text-muted-foreground">{formatarMoeda(e.valor_principal)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</p>
                              <p className="text-xs text-muted-foreground">Saldo: {formatarMoeda(e.saldo_devedor)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Cliente não encontrado.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={irParaCliente} className="w-full gap-2">
              <ExternalLink size={14} />
              Abrir página completa
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
