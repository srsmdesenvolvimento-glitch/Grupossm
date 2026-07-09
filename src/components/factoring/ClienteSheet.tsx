'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, User, Banknote } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScoreGauge } from '@/components/factoring/ScoreGauge'
import { RestricoesAlerta } from '@/components/factoring/RestricoesBadge'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { formatarCPF, formatarTelefone, formatarMoeda, formatarData, iniciais } from '@/lib/utils/formatters'
import type { ClienteFactoring, Emprestimo } from '@/lib/types/database'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  analise:      { label: 'Em Análise', color: '#5F6368', bg: '#F1F3F4' },
  aprovado:     { label: 'Aprovado',   color: '#FBBC04', bg: '#FEF7E0' },
  ativo:        { label: 'Ativo',      color: '#34A853', bg: '#E6F4EA' },
  quitado:      { label: 'Quitado',    color: '#1A73E8', bg: '#E8F0FE' },
  inadimplente: { label: 'Inadim.',    color: '#EA4335', bg: '#FCE8E6' },
  cancelado:    { label: 'Cancelado',  color: '#9AA0A6', bg: '#F1F3F4' },
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
        .eq('empresa_id', empresaId)
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
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0 border-l border-border">
          <SheetHeader className="px-6 pt-6 pb-5 border-b border-border shrink-0">
            <SheetTitle className="text-base font-semibold flex items-center gap-2.5 text-foreground">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gt-blue-light)' }}>
                <User size={16} style={{ color: 'var(--gt-blue)' }} />
              </div>
              Ficha do Cliente
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loadingCliente ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: 'var(--gt-blue)', borderRightColor: 'var(--gt-blue)' }} />
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : cliente ? (
              <div className="space-y-0">
                {/* Avatar + nome */}
                <div className="px-6 py-6 flex items-center gap-4 border-b border-border" style={{ background: 'linear-gradient(180deg, var(--gt-blue-light) 0%, var(--card) 100%)' }}>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-m3-2"
                    style={{ backgroundColor: '#1A73E8' }}
                  >
                    {iniciais(cliente.nome)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-lg leading-tight truncate">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatarCPF(cliente.cpf ?? '')}</p>
                    <span
                      className="inline-flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-full font-semibold border"
                      style={{
                        color: cliente.status === 'ativo' ? '#34A853' : cliente.status === 'bloqueado' ? '#EA4335' : '#5F6368',
                        backgroundColor: cliente.status === 'ativo' ? '#E6F4EA' : cliente.status === 'bloqueado' ? '#FCE8E6' : '#F1F3F4',
                        borderColor: cliente.status === 'ativo' ? '#34A85320' : cliente.status === 'bloqueado' ? '#EA433520' : '#5F636820',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: cliente.status === 'ativo' ? '#34A853' : cliente.status === 'bloqueado' ? '#EA4335' : '#5F6368' }}
                      />
                      {cliente.status === 'ativo' ? 'Ativo' : cliente.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {/* Restrições — alerta crítico */}
                <div className="px-5 pt-4">
                  <RestricoesAlerta cliente={cliente} />
                </div>

                {/* Score */}
                <div className="px-6 py-5 flex justify-center border-b border-border bg-card">
                  <ScoreGauge score={cliente.score_interno} size="md" />
                </div>

                {/* Dados pessoais */}
                <div className="px-6 py-5 border-b border-border space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--gt-blue)' }}>Contato</p>
                  {[
                    { l: 'Telefone', v: formatarTelefone(cliente.telefone) },
                    { l: 'E-mail', v: cliente.email },
                    { l: 'Data de nascimento', v: cliente.data_nascimento ? formatarData(cliente.data_nascimento) : null },
                    { l: 'Renda mensal', v: cliente.renda_mensal ? formatarMoeda(cliente.renda_mensal) : null },
                  ].filter(row => !!row.v).map(row => (
                    <div key={row.l} className="flex items-center justify-between gap-4 text-sm py-1.5">
                      <span className="text-muted-foreground">{row.l}</span>
                      <span className="font-medium text-foreground text-right tabular-nums">{row.v}</span>
                    </div>
                  ))}
                </div>

                {/* Endereço */}
                {(cliente.endereco || cliente.cidade) && (
                  <div className="px-6 py-5 border-b border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--gt-blue)' }}>Endereço</p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {[cliente.endereco, cliente.numero, cliente.complemento].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {[cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}

                {/* Dados financeiros */}
                <div className="px-6 py-5 border-b border-border space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--gt-blue)' }}>Financeiro</p>
                  {[
                    { l: 'Limite de crédito', v: formatarMoeda(cliente.limite_credito) },
                    { l: 'Crédito utilizado', v: formatarMoeda(cliente.credito_utilizado) },
                    { l: 'Crédito disponível', v: formatarMoeda(cliente.credito_disponivel) },
                    { l: 'Total emprestado', v: formatarMoeda(cliente.valor_total_emprestado ?? 0) },
                  ].map(row => (
                    <div key={row.l} className="flex items-center justify-between gap-4 text-sm py-1.5">
                      <span className="text-muted-foreground">{row.l}</span>
                      <span className="font-semibold text-foreground tabular-nums">{row.v}</span>
                    </div>
                  ))}
                </div>

                {/* Observações */}
                {cliente.observacoes && (
                  <div className="px-6 py-5 border-b border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--gt-blue)' }}>Observações</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{cliente.observacoes}</p>
                  </div>
                )}

                {/* Empréstimos */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--gt-blue-light)' }}>
                      <Banknote size={13} style={{ color: 'var(--gt-blue)' }} />
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gt-blue)' }}>
                      Contratos ({emprestimos.length})
                    </p>
                  </div>
                  {emprestimos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum contrato encontrado.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {emprestimos.map(e => {
                        const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.analise
                        return (
                          <button
                            key={e.id}
                            onClick={() => { setOpen(false); router.push(`/factoring/emprestimos/${e.id}`) }}
                            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:shadow-m3-2 transition-all duration-200 text-left group"
                          >
                            <div>
                              <p className="text-sm font-mono font-bold" style={{ color: 'var(--gt-blue)' }}>{e.numero_contrato}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{formatarMoeda(e.valor_principal)}</p>
                            </div>
                            <div className="text-right">
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ color: s.color, backgroundColor: s.bg }}
                              >
                                {s.label}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">Saldo: {formatarMoeda(e.saldo_devedor)}</p>
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

          <div className="px-6 py-5 border-t border-border shrink-0 bg-card">
            <Button
              onClick={irParaCliente}
              className="w-full gap-2 h-11 text-sm font-semibold rounded-xl"
              style={{ backgroundColor: 'var(--gt-blue)', color: '#fff' }}
            >
              <ExternalLink size={15} />
              Abrir página completa
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
