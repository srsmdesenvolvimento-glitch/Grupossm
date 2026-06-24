'use client'

import { useState } from 'react'
import {
  AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight,
  MapPin, Phone, Mail, Car, Building2, Users, Scale, CreditCard,
  TrendingDown, TrendingUp, Banknote, ShieldAlert, Briefcase,
  Heart, Globe, Baby, GraduationCap, Activity, BarChart3,
  Receipt, FileWarning, Landmark, BadgeAlert, History as HistoryIcon,
} from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { ScoreGauge } from './ScoreGauge'
import type { RelatorioCompleto, RelatorioEndereco, RelatorioTelefone } from '@/lib/assertiva/types'
import { formatCpf, formatCnpj, formatTel } from '@/lib/assertiva/client'
import { formatarMoeda, formatarData } from '@/lib/utils/formatters'

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, count, severity, defaultOpen = false, children,
}: {
  title: string
  icon: React.ElementType
  count?: number
  severity?: 'ok' | 'warn' | 'danger' | 'info'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const colors = {
    ok:     'text-emerald-600 bg-emerald-500/8 border-emerald-500/25',
    warn:   'text-yellow-600 bg-yellow-500/8 border-yellow-500/25',
    danger: 'text-red-600 bg-red-500/8 border-red-500/25',
    info:   'text-blue-600 bg-blue-500/8 border-blue-500/25',
  }
  const cls = severity ? colors[severity] : 'text-muted-foreground bg-muted/50 border-border'
  return (
    <div className={`rounded-xl border ${cls} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2.5">
          <Icon size={15} />
          <span className="text-sm font-semibold">{title}</span>
          {count !== undefined && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-current/10">{count}</span>
          )}
        </div>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-1.5 border-t border-current/10">{children}</div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }: {
  label: string
  value?: string | number | boolean | null
  highlight?: 'red' | 'green' | 'blue' | 'orange'
}) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') value = value ? 'Sim' : 'Não'
  const colors = {
    red:    'text-red-600 font-bold',
    green:  'text-emerald-600 font-bold',
    blue:   'text-blue-600 font-bold',
    orange: 'text-orange-600 font-bold',
  }
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${highlight ? colors[highlight] : ''}`}>{String(value)}</span>
    </div>
  )
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${color}`}>
      {children}
    </span>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function RelatorioView({ relatorio }: { relatorio: RelatorioCompleto }) {
  const isPf  = relatorio.tipo === 'pf'
  const doc   = isPf ? formatCpf(relatorio.documento) : formatCnpj(relatorio.documento)
  const mix403 = (relatorio as any)._mix_403 === true

  const temNeg   = (relatorio.total_negativacoes ?? 0) > 0
  const temProt  = (relatorio.total_protestos ?? 0) > 0
  const temAcoes = (relatorio.total_acoes_judiciais ?? 0) > 0
  const temCcf   = (relatorio.total_ccf ?? 0) > 0
  const limpo    = !temNeg && !temProt && !temAcoes && !temCcf

  return (
    <div className="space-y-4">

      {/* ── Aviso: plano sem crédito Mix ──────────────────────────────────── */}
      {mix403 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Dados de crédito (score, negativações) não disponíveis</p>
            <p className="text-amber-700 mt-0.5">Seu plano Assertiva não inclui o produto Crédito Mix. Os dados de localização (endereço, telefone, e-mail) estão disponíveis normalmente.</p>
          </div>
        </div>
      )}

      {/* ── Score Header ──────────────────────────────────────────────────── */}
      <SectionCard>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreGauge score={relatorio.score} size={180} />

          <div className="flex-1 space-y-3 w-full">
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {relatorio.nome ?? relatorio.razao_social ?? 'Nome não encontrado'}
              </h2>
              {relatorio.nome_fantasia && (
                <p className="text-sm text-muted-foreground">{relatorio.nome_fantasia}</p>
              )}
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{doc}</p>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {relatorio.situacao_cpf && (
                  <Chip color="bg-muted text-muted-foreground">CPF: {relatorio.situacao_cpf}</Chip>
                )}
                {relatorio.situacao_cnpj && (
                  <Chip color="bg-muted text-muted-foreground">Situação: {relatorio.situacao_cnpj}</Chip>
                )}
                {relatorio.indicador_obito && (
                  <Chip color="bg-red-100 text-red-700"><AlertTriangle size={10} /> Óbito registrado</Chip>
                )}
                {relatorio.pep && (
                  <Chip color="bg-orange-100 text-orange-700"><BadgeAlert size={10} /> PEP</Chip>
                )}
                {relatorio.faixa_etaria && (
                  <Chip color="bg-blue-100 text-blue-700">{relatorio.faixa_etaria}</Chip>
                )}
                {relatorio.faixa_renda && (
                  <Chip color="bg-purple-100 text-purple-700">Renda: {relatorio.faixa_renda}</Chip>
                )}
              </div>
            </div>

            {/* Métricas financeiras */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {relatorio.renda_estimada != null && (
                <div className="bg-emerald-500/8 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Renda Estimada</p>
                  <p className="text-sm font-bold text-emerald-600">{formatarMoeda(relatorio.renda_estimada)}</p>
                </div>
              )}
              {relatorio.renda_presumida != null && relatorio.renda_presumida !== relatorio.renda_estimada && (
                <div className="bg-emerald-500/5 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Renda Presumida</p>
                  <p className="text-sm font-bold text-emerald-700">{formatarMoeda(relatorio.renda_presumida)}</p>
                </div>
              )}
              {relatorio.capacidade_pagamento != null && (
                <div className="bg-blue-500/8 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Cap. Pagamento</p>
                  <p className="text-sm font-bold text-blue-600">{formatarMoeda(relatorio.capacidade_pagamento)}</p>
                </div>
              )}
              {relatorio.comprometimento_renda != null && (
                <div className="bg-orange-500/8 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Comp. Renda</p>
                  <p className="text-sm font-bold text-orange-600">{relatorio.comprometimento_renda}%</p>
                </div>
              )}
              {(relatorio.total_dividas ?? 0) > 0 && (
                <div className="bg-red-500/8 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Total Dívidas</p>
                  <p className="text-sm font-bold text-red-600">{formatarMoeda(relatorio.total_dividas!)}</p>
                </div>
              )}
              {relatorio.valor_total_dividas != null && relatorio.valor_total_dividas > 0 && (
                <div className="bg-red-500/8 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Val. Total Dívidas</p>
                  <p className="text-sm font-bold text-red-700">{formatarMoeda(relatorio.valor_total_dividas)}</p>
                </div>
              )}
              {(relatorio.valor_total_negativacoes ?? 0) > 0 && (
                <div className="bg-red-500/5 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground">Val. Negativações</p>
                  <p className="text-sm font-bold text-red-600">{formatarMoeda(relatorio.valor_total_negativacoes!)}</p>
                </div>
              )}
            </div>

            {/* Status geral */}
            {limpo ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-700 rounded-xl px-3 py-2">
                <CheckCircle size={16} />
                <span className="text-xs font-semibold">Sem restrições encontradas</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {temNeg   && <Chip color="bg-red-500/10 text-red-600"><XCircle size={11} />{relatorio.total_negativacoes} negativações</Chip>}
                {temProt  && <Chip color="bg-orange-500/10 text-orange-600"><AlertTriangle size={11} />{relatorio.total_protestos} protestos</Chip>}
                {temAcoes && <Chip color="bg-red-600/10 text-red-700"><Scale size={11} />{relatorio.total_acoes_judiciais} ações jud.</Chip>}
                {temCcf   && <Chip color="bg-yellow-500/10 text-yellow-600"><CreditCard size={11} />{relatorio.total_ccf} CCF</Chip>}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Seções de Dados ───────────────────────────────────────────────── */}
      <div className="space-y-2">

        {/* Dados Pessoais */}
        {isPf && (relatorio.data_nascimento || relatorio.nome_mae || relatorio.ocupacao) && (
          <Section title="Dados Pessoais" icon={Activity} severity="info" defaultOpen>
            <Row label="Data de Nascimento" value={formatarData(relatorio.data_nascimento)} />
            <Row label="Idade" value={relatorio.idade ? `${relatorio.idade} anos` : null} />
            <Row label="Signo" value={relatorio.signo} />
            <Row label="Sexo" value={relatorio.sexo} />
            <Row label="Estado Civil" value={relatorio.estado_civil_api} />
            <Row label="Ocupação / Profissão" value={relatorio.ocupacao} />
            <Row label="Escolaridade" value={relatorio.escolaridade} />
            <Row label="Faixa Etária" value={relatorio.faixa_etaria} />
            <Row label="Faixa de Renda" value={relatorio.faixa_renda} />
            <Row label="Nacionalidade" value={relatorio.nacionalidade} />
            <Row label="Nome da Mãe" value={relatorio.nome_mae} />
            <Row label="Nome do Pai" value={relatorio.nome_pai} />
            <Row label="PEP" value={relatorio.pep ? 'Sim — Pessoa Politicamente Exposta' : null} highlight={relatorio.pep ? 'orange' : undefined} />
            <Row label="Indicador de Óbito" value={relatorio.indicador_obito ? 'Sim' : null} highlight={relatorio.indicador_obito ? 'red' : undefined} />
          </Section>
        )}

        {/* Dados da Empresa (PJ) */}
        {!isPf && (
          <Section title="Dados da Empresa" icon={Building2} severity="info" defaultOpen>
            <Row label="Razão Social" value={relatorio.razao_social} />
            <Row label="Nome Fantasia" value={relatorio.nome_fantasia} />
            <Row label="CNPJ" value={formatCnpj(relatorio.documento)} />
            <Row label="Situação" value={relatorio.situacao_cnpj} />
            <Row label="CNAE Principal" value={relatorio.cnae_principal} />
            <Row label="Descrição CNAE" value={relatorio.cnae_descricao} />
            <Row label="Natureza Jurídica" value={relatorio.natureza_juridica} />
            <Row label="Capital Social" value={relatorio.capital_social != null ? formatarMoeda(relatorio.capital_social) : null} />
            <Row label="Porte" value={relatorio.porte} />
            <Row label="Data de Abertura" value={formatarData(relatorio.data_abertura)} />
            <Row label="Idade da Empresa" value={relatorio.idade_empresa ? `${relatorio.idade_empresa} anos` : null} />
            <Row label="Qtd. Funcionários" value={relatorio.qtd_funcionarios} />
            <Row label="Faturamento Presumido" value={relatorio.faturamento_presumido != null ? (typeof relatorio.faturamento_presumido === 'number' ? formatarMoeda(relatorio.faturamento_presumido) : relatorio.faturamento_presumido) : null} />
            <Row label="Matriz" value={relatorio.matriz !== undefined ? (relatorio.matriz ? 'Sim' : 'Filial') : null} />
            <Row label="Qtd. Filiais" value={relatorio.filiais_count} />
          </Section>
        )}

        {/* Endereços */}
        {(relatorio.enderecos?.length ?? 0) > 0 && (
          <Section title="Endereços" icon={MapPin} count={relatorio.enderecos!.length} severity="ok" defaultOpen>
            {relatorio.enderecos!.map((e: RelatorioEndereco, i: number) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                {e.tipo && <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{e.tipo}</p>}
                <p className="font-medium">{[e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ')}</p>
                <p className="text-muted-foreground">{[e.bairro, e.municipio, e.uf].filter(Boolean).join(' · ')}</p>
                {e.cep && <p className="text-muted-foreground font-mono">CEP {e.cep}</p>}
                {e.data_inclusao && <p className="text-muted-foreground text-[10px]">Desde {formatarData(e.data_inclusao)}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Telefones */}
        {(relatorio.telefones?.length ?? 0) > 0 && (
          <Section title="Telefones" icon={Phone} count={relatorio.telefones!.length} severity="ok" defaultOpen>
            {relatorio.telefones!.map((t: RelatorioTelefone, i: number) => {
              const num = t.numero ? ((t.ddd ?? '') + t.numero) : ''
              return (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{num ? formatTel(num) : '—'}</span>
                    {t.whatsapp && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600">WhatsApp</span>}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {t.tipo && <span>{t.tipo}</span>}
                    {t.operadora && <span>· {t.operadora}</span>}
                    {t.score != null && <span className="text-[10px] font-mono">⭐ {t.score}</span>}
                  </div>
                </div>
              )
            })}
          </Section>
        )}

        {/* E-mails */}
        {(relatorio.emails?.length ?? 0) > 0 && (
          <Section title="E-mails" icon={Mail} count={relatorio.emails!.length} severity="ok">
            {relatorio.emails!.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="font-medium">{e.email}</span>
                <div className="flex gap-2 text-muted-foreground">
                  {e.tipo && <span>{e.tipo}</span>}
                  {e.score != null && <span className="text-[10px] font-mono">⭐ {e.score}</span>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Negativações */}
        {temNeg && (
          <Section title="Negativações" icon={TrendingDown} count={relatorio.total_negativacoes} severity="danger" defaultOpen>
            {(relatorio.valor_total_negativacoes ?? 0) > 0 && (
              <div className="bg-red-500/10 rounded-lg px-3 py-2 mb-2">
                <span className="text-xs font-bold text-red-600">Total: {formatarMoeda(relatorio.valor_total_negativacoes!)}</span>
              </div>
            )}
            {relatorio.negativacoes!.map((n, i) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{n.credor ?? 'Credor desconhecido'}</span>
                  <span className="font-bold text-red-600 shrink-0">{n.valor != null ? formatarMoeda(n.valor) : '—'}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {[n.tipo, n.natureza, n.origem, formatarData(n.data)].filter(Boolean).join(' · ')}
                </p>
                {(n.cidade || n.uf) && <p className="text-muted-foreground text-[10px]">{[n.cidade, n.uf].filter(Boolean).join(' / ')}</p>}
                {n.contrato && <p className="text-muted-foreground text-[10px] font-mono">Contrato: {n.contrato}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Protestos */}
        {temProt && (
          <Section title="Protestos Cartoriais" icon={AlertTriangle} count={relatorio.total_protestos} severity="warn" defaultOpen>
            {(relatorio.valor_total_protestos ?? 0) > 0 && (
              <div className="bg-orange-500/10 rounded-lg px-3 py-2 mb-2">
                <span className="text-xs font-bold text-orange-600">Total: {formatarMoeda(relatorio.valor_total_protestos!)}</span>
              </div>
            )}
            {relatorio.protestos!.map((p, i) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{p.cartorio ?? 'Cartório não informado'}</span>
                  <span className="font-bold text-orange-600 shrink-0">{p.valor != null ? formatarMoeda(p.valor) : '—'}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {[p.tipo, p.municipio, p.uf, formatarData(p.data)].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </Section>
        )}

        {/* Ações Judiciais */}
        {temAcoes && (
          <Section title="Ações Judiciais" icon={Scale} count={relatorio.total_acoes_judiciais} severity="danger" defaultOpen>
            {(relatorio.valor_total_acoes ?? 0) > 0 && (
              <div className="bg-red-500/10 rounded-lg px-3 py-2 mb-2">
                <span className="text-xs font-bold text-red-600">Total: {formatarMoeda(relatorio.valor_total_acoes!)}</span>
              </div>
            )}
            {relatorio.acoes_judiciais!.map((a, i) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{a.tipo ?? 'Tipo desconhecido'}</span>
                  <span className="font-bold text-red-700 shrink-0">{a.valor != null ? formatarMoeda(a.valor) : '—'}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {[a.tribunal, a.vara, a.uf, formatarData(a.data)].filter(Boolean).join(' · ')}
                </p>
                {a.numero && <p className="text-muted-foreground text-[10px] font-mono">Processo: {a.numero}</p>}
                {(a.polo_ativo || a.polo_passivo) && (
                  <p className="text-muted-foreground text-[10px]">
                    {a.polo_ativo && `Ativo: ${a.polo_ativo}`}
                    {a.polo_passivo && ` · Passivo: ${a.polo_passivo}`}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* CCF */}
        {temCcf && (
          <Section title="CCF — Cheques sem Fundo" icon={FileWarning} count={relatorio.total_ccf} severity="warn">
            {relatorio.ccf!.map((c: any, i: number) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <Row label="Banco" value={c.banco ?? c.nome_banco} />
                <Row label="Agência" value={c.agencia} />
                <Row label="Cheque nº" value={c.numero_cheque ?? c.cheque} />
                <Row label="Motivo" value={c.motivo} />
                <Row label="Valor" value={c.valor != null ? formatarMoeda(c.valor) : null} />
                <Row label="Data" value={formatarData(c.data)} />
              </div>
            ))}
          </Section>
        )}

        {/* Veículos */}
        {(relatorio.veiculos?.length ?? 0) > 0 && (
          <Section title="Veículos" icon={Car} count={relatorio.veiculos!.length} severity="ok">
            {relatorio.veiculos!.map((v: any, i: number) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}</span>
                  <span className="font-mono text-muted-foreground">{v.placa}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {[v.ano_fabricacao && `${v.ano_fabricacao}/${v.ano_modelo ?? v.ano_fabricacao}`, v.cor, v.tipo, v.combustivel].filter(Boolean).join(' · ')}
                </p>
                {v.situacao && <p className="text-[10px] text-muted-foreground">{v.situacao}</p>}
                {(v.municipio || v.uf) && <p className="text-[10px] text-muted-foreground">{[v.municipio, v.uf].filter(Boolean).join(' / ')}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Operações de Crédito */}
        {(relatorio.operacoes_credito?.length ?? 0) > 0 && (
          <Section title="Operações de Crédito" icon={BarChart3} count={relatorio.total_operacoes_credito} severity="info">
            {relatorio.operacoes_credito!.map((op: any, i: number) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{op.modalidade ?? op.tipo ?? 'Operação'}</span>
                  <span className="font-bold text-blue-600 shrink-0">{op.valor != null ? formatarMoeda(op.valor) : '—'}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {[op.contratante, op.situacao, formatarData(op.data)].filter(Boolean).join(' · ')}
                </p>
                {op.parcelas && <p className="text-muted-foreground text-[10px]">{op.parcelas} parcelas</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Vínculos */}
        {(relatorio.vinculos?.length ?? 0) > 0 && (
          <Section title="Vínculos e Relacionamentos" icon={Heart} count={relatorio.vinculos!.length} severity="ok">
            {relatorio.vinculos!.map((v: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-border/30 last:border-0">
                <div>
                  <span className="font-medium">{v.nome}</span>
                  {v.cpf && <span className="text-muted-foreground font-mono text-[10px] ml-2">{formatCpf(v.cpf)}</span>}
                </div>
                <span className="text-muted-foreground shrink-0 ml-2">{v.tipo ?? v.parentesco}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Participações Societárias */}
        {(relatorio.participacoes_societarias?.length ?? 0) > 0 && (
          <Section title="Participações Societárias" icon={Briefcase} count={relatorio.participacoes_societarias!.length} severity="ok">
            {relatorio.participacoes_societarias!.map((p, i) => (
              <div key={i} className="text-xs py-2 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{p.razao_social ?? formatCnpj(p.cnpj)}</span>
                  <span className="text-muted-foreground shrink-0">{p.participacao != null ? `${p.participacao}%` : p.cargo}</span>
                </div>
                {p.cnpj && p.razao_social && <p className="text-muted-foreground font-mono text-[10px]">{formatCnpj(p.cnpj)}</p>}
                {(p.situacao || p.data_entrada || p.uf) && (
                  <p className="text-muted-foreground text-[10px]">
                    {[p.situacao, p.data_entrada && `Desde ${formatarData(p.data_entrada)}`, p.uf].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Quadro Societário (PJ) */}
        {(relatorio.socios?.length ?? 0) > 0 && (
          <Section title="Quadro Societário" icon={Users} count={relatorio.socios!.length} severity="ok">
            {relatorio.socios!.map((s, i) => (
              <div key={i} className="text-xs py-1.5 border-b border-border/30 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{s.nome}</span>
                  <span className="text-muted-foreground shrink-0">
                    {s.cargo ?? (s.participacao != null ? `${s.participacao}%` : '')}
                  </span>
                </div>
                {s.documento && <p className="text-muted-foreground font-mono text-[10px]">{formatCpf(s.documento)}</p>}
                {s.data_entrada && <p className="text-muted-foreground text-[10px]">Desde {formatarData(s.data_entrada)}</p>}
                {s.qualificacao && <p className="text-muted-foreground text-[10px]">{s.qualificacao}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Score Detalhado & Cadastro Positivo */}
        {relatorio.score_detalhado && (
          <Section title="Score Detalhado & Cadastro Positivo" icon={ShieldAlert} severity="info">
            <Row label="Classe de Risco" value={relatorio.score_detalhado.classe} />
            <Row label="Faixa de Risco" value={relatorio.score_detalhado.faixa_titulo} />
            <Row label="Descrição da Faixa" value={relatorio.score_detalhado.faixa_descricao} />
            <Row label="Probabilidade" value={relatorio.score_detalhado.probabilidade} />
            {relatorio.score_detalhado.cadastro_positivo && (
              <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cadastro Positivo</h4>
                <Row label="Suspenso" value={relatorio.score_detalhado.cadastro_positivo.suspenso ? 'Sim' : 'Não'} highlight={relatorio.score_detalhado.cadastro_positivo.suspenso ? 'orange' : undefined} />
                {relatorio.score_detalhado.cadastro_positivo.atrasoConsumo && (
                  <Row label="Atraso Consumo" value={`${relatorio.score_detalhado.cadastro_positivo.atrasoConsumo.descricao ?? ''} ${relatorio.score_detalhado.cadastro_positivo.atrasoConsumo.valor != null ? `(R$ ${relatorio.score_detalhado.cadastro_positivo.atrasoConsumo.valor})` : ''} - Risco: ${relatorio.score_detalhado.cadastro_positivo.atrasoConsumo.risco ?? 'N/A'}`} />
                )}
                {relatorio.score_detalhado.cadastro_positivo.atrasoRecente && (
                  <Row label="Atraso Recente" value={`${relatorio.score_detalhado.cadastro_positivo.atrasoRecente.descricao ?? ''} ${relatorio.score_detalhado.cadastro_positivo.atrasoRecente.valor != null ? `(R$ ${relatorio.score_detalhado.cadastro_positivo.atrasoRecente.valor})` : ''} - Risco: ${relatorio.score_detalhado.cadastro_positivo.atrasoRecente.risco ?? 'N/A'}`} />
                )}
                {relatorio.score_detalhado.cadastro_positivo.relacionamentoCC && (
                  <Row label="Relacionamento CC" value={`${relatorio.score_detalhado.cadastro_positivo.relacionamentoCC.descricao ?? ''} - Risco: ${relatorio.score_detalhado.cadastro_positivo.relacionamentoCC.risco ?? 'N/A'}`} />
                )}
                {relatorio.score_detalhado.cadastro_positivo.comprometimentoRenda && (
                  <Row label="Comprometimento de Renda" value={`${relatorio.score_detalhado.cadastro_positivo.comprometimentoRenda.descricao ?? ''} ${relatorio.score_detalhado.cadastro_positivo.comprometimentoRenda.valor != null ? `(${relatorio.score_detalhado.cadastro_positivo.comprometimentoRenda.valor}%)` : ''} - Risco: ${relatorio.score_detalhado.cadastro_positivo.comprometimentoRenda.risco ?? 'N/A'}`} />
                )}
              </div>
            )}
          </Section>
        )}

        {/* Consultas Anteriores */}
        {((relatorio.consultas_anteriores?.length ?? 0) > 0 || (relatorio.total_consultas_anteriores ?? 0) > 0) && (
          <Section title="Consultas Anteriores" icon={HistoryIcon} count={relatorio.total_consultas_anteriores ?? relatorio.consultas_anteriores?.length} severity="info">
            {relatorio.consultas_anteriores?.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="font-medium">{c.consultante ?? 'Consultante Não Informado'}</span>
                <span className="text-muted-foreground shrink-0">{c.data ? formatarData(c.data) : '—'}</span>
              </div>
            ))}
          </Section>
        )}

      </div>

      {/* Cache indicator */}
      {relatorio._cache && (
        <p className="text-center text-[10px] text-muted-foreground">
          Dados em cache · gerado em {relatorio._gerado_em ? new Date(relatorio._gerado_em).toLocaleString('pt-BR') : ''}
        </p>
      )}

      {/* Erros não críticos */}
      {(relatorio._erros?.length ?? 0) > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
          <p className="text-xs font-semibold text-yellow-700 mb-1">Dados parciais</p>
          {relatorio._erros!.map((e, i) => (
            <p key={i} className="text-xs text-yellow-600">{e}</p>
          ))}
        </div>
      )}
    </div>
  )
}
