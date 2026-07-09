'use client'

import { AlertTriangle, ShieldOff } from 'lucide-react'
import type { ClienteFactoring } from '@/lib/types/database'

type Restricoes = {
  negativacoes: number
  protestos: number
  acoes: number
  ccf: number
  pep: boolean
  obito: boolean
}

export function getRestricoes(c: Pick<ClienteFactoring,
  'total_negativacoes_assertiva' | 'total_protestos_assertiva' |
  'total_acoes_judiciais_assertiva' | 'total_ccf_assertiva' |
  'pep_assertiva' | 'indicador_obito_assertiva'
>): Restricoes {
  return {
    negativacoes: c.total_negativacoes_assertiva ?? 0,
    protestos:    c.total_protestos_assertiva    ?? 0,
    acoes:        c.total_acoes_judiciais_assertiva ?? 0,
    ccf:          c.total_ccf_assertiva          ?? 0,
    pep:          c.pep_assertiva                ?? false,
    obito:        c.indicador_obito_assertiva    ?? false,
  }
}

export function temRestricoes(c: Parameters<typeof getRestricoes>[0]): boolean {
  const r = getRestricoes(c)
  return r.negativacoes > 0 || r.protestos > 0 || r.acoes > 0 || r.ccf > 0 || r.pep || r.obito
}

// Badge compacto para uso na tabela de clientes
export function RestricoesBadgeCompacto({ cliente }: { cliente: Parameters<typeof getRestricoes>[0] }) {
  const r = getRestricoes(cliente)
  const total = r.negativacoes + r.protestos + r.acoes + r.ccf

  if (!temRestricoes(cliente)) return null

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
      style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}
      title={`Restrições: ${[
        r.negativacoes > 0 && `${r.negativacoes} negativaç${r.negativacoes > 1 ? 'ões' : 'ão'}`,
        r.protestos > 0    && `${r.protestos} protesto${r.protestos > 1 ? 's' : ''}`,
        r.acoes > 0        && `${r.acoes} ação${r.acoes > 1 ? 'ões' : ''} judicial`,
        r.ccf > 0          && `${r.ccf} CCF`,
        r.pep              && 'PEP',
        r.obito            && 'Óbito',
      ].filter(Boolean).join(', ')}`}
    >
      <AlertTriangle size={9} />
      {r.obito ? 'Óbito' : r.pep ? 'PEP' : `${total} restr.`}
    </span>
  )
}

// Alerta expandido para sheet e perfil
export function RestricoesAlerta({ cliente }: { cliente: Parameters<typeof getRestricoes>[0] }) {
  const r = getRestricoes(cliente)
  if (!temRestricoes(cliente)) return null

  const itens: { label: string; valor: string | number; grave?: boolean }[] = []
  if (r.obito)           itens.push({ label: 'Óbito registrado', valor: 'CRÍTICO', grave: true })
  if (r.pep)             itens.push({ label: 'Pessoa Politicamente Exposta (PEP)', valor: 'SIM', grave: true })
  if (r.negativacoes > 0) itens.push({ label: 'Negativações', valor: r.negativacoes })
  if (r.protestos > 0)   itens.push({ label: 'Protestos em cartório', valor: r.protestos })
  if (r.acoes > 0)       itens.push({ label: 'Ações judiciais', valor: r.acoes })
  if (r.ccf > 0)         itens.push({ label: 'Cheques sem fundo (CCF)', valor: r.ccf })

  const ehGrave = r.obito || r.pep
  const bg      = ehGrave ? '#FEF2F2' : '#FFF7ED'
  const border  = ehGrave ? '#FECACA' : '#FED7AA'
  const cor     = ehGrave ? '#991B1B' : '#9A3412'
  const corSub  = ehGrave ? '#B91C1C' : '#C2410C'

  return (
    <div
      className="rounded-xl px-4 py-3 flex gap-3 items-start"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <ShieldOff size={16} style={{ color: cor, flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: cor }}>
          {ehGrave ? 'ATENÇÃO — Restrição grave no cadastro' : 'Cliente com restrições no nome'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {itens.map(item => (
            <span key={item.label} className="text-xs font-semibold" style={{ color: corSub }}>
              {item.label}:
              <span className="font-extrabold ml-1">{item.valor}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
