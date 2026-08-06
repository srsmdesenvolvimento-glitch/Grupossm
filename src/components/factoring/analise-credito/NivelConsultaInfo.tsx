'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

// Botão (ⓘ) reutilizado nas 3 telas que oferecem o seletor Simples/Completa —
// mostra exatamente o que cada nível traz, pra ninguém escolher no escuro.
export function NivelConsultaInfo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="O que cada nível de consulta traz"
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Comparativo dos níveis de consulta"
          className="absolute z-20 top-6 left-1/2 -translate-x-1/2 w-72 bg-card border border-border rounded-xl shadow-lg p-3 text-left"
        >
          <div className="mb-2.5 pb-2.5 border-b border-border/50">
            <p className="text-[11px] font-bold text-blue-600 mb-1">Simples</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Nome, telefone, endereço e dados cadastrais da pessoa. Pessoas próximas
              (nome, telefone, parentesco e endereço quando disponível). Veículos.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-foreground mb-1">Completa</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tudo do Simples, mais: score de crédito, negativações, protestos,
              ações judiciais, cheques sem fundo e renda presumida.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
