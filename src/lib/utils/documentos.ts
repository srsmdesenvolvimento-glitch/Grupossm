import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Helpers & Formatting ───────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(s: string | null | undefined): string {
  if (!s) return '—'
  const d = s.split('T')[0].split('-')
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s
}

function fmtCpf(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const c = cpf.replace(/\D/g, '')
  return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf
}

async function loadLogo(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const blob = await res.blob()
    return new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function lastY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? 0
}

// ── Cores Modernas Google (Material Design 3) ──────────────────────────────

const BLUE: [number, number, number] = [26, 115, 232]    // #1A73E8 (Google Blue)
const DARK: [number, number, number] = [32, 33, 36]      // #202124 (Google Dark Slate)
const GRAY: [number, number, number] = [95, 99, 104]     // #5F6368 (Google Slate Gray)
const LIGHT: [number, number, number] = [248, 249, 250]  // #F8F9FA (Google Off-White)
const WHITE: [number, number, number] = [255, 255, 255]
const GREEN: [number, number, number] = [52, 168, 83]    // #34A853 (Google Green)
const RED: [number, number, number] = [234, 67, 53]      // #EA4335 (Google Red)
const ORANGE: [number, number, number] = [250, 144, 62]  // #FA903E (Google Orange)
const BORDER_COLOR: [number, number, number] = [224, 224, 230]

// Header Helper to unify layouts with a sleek premium bar
function drawPremiumHeader(doc: jsPDF, title: string, subtitle: string, logo: string, params: { code: string; dateLabel: string; dateVal: string; subVal?: string }, W: number, M: number) {
  // Top thin accent bar (3mm)
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2])
  doc.rect(0, 0, W, 3, 'F')

  // Logo
  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 6, 28, 28) } catch { /* ignore */ }
  }

  const tx = logo ? M + 32 : M
  
  // Left Company Brand Details
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(title, tx, 15)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(subtitle, tx, 21)
  
  if (params.subVal) {
    doc.setFontSize(7.5)
    doc.text(params.subVal, tx, 26)
  }

  // Right Side Details (Badge style)
  doc.setFillColor(232, 240, 254) // Very soft blue pill bg
  doc.roundedRect(W - M - 60, 10, 60, 16, 1.5, 1.5, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2])
  doc.text(params.code, W - M - 5, 16, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`${params.dateLabel}: ${fmtData(params.dateVal)}`, W - M - 5, 22, { align: 'right' })
}

// Section Header Helper for Material Card look
function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2])
  doc.rect(x, y - 3.5, 3, 5.5, 'F') // Vertical blue block
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(title, x + 5, y)
}

// ── Contrato ─────────────────────────────────────────────────────────────────

export interface ContratoParams {
  contrato: {
    numero_contrato: string
    valor_principal: number
    taxa_juros: number
    prazo_meses: number
    valor_parcela: number
    total_pagar: number
    total_juros: number
    data_liberacao: string | null
    garantias?: string | null
    observacoes?: string | null
  }
  cliente: {
    nome: string
    cpf: string | null
    telefone: string | null
  }
  parcelas: Array<{
    numero_parcela: number
    data_vencimento: string
    valor: number
    valor_principal: number | null
    valor_juros: number | null
  }>
  empresaNome?: string
  empresaCnpj?: string | null
}

export async function gerarContratoPDF(params: ContratoParams): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - M * 2

  const logo = await loadLogo('/logos/factoring.png')

  // Header Premium
  drawPremiumHeader(
    doc,
    params.empresaNome ?? 'SRS M Factoring',
    'CONTRATO DE EMPRÉSTIMO COM GARANTIAS',
    logo,
    {
      code: `CONTRATO: ${params.contrato.numero_contrato}`,
      dateLabel: 'Emissão',
      dateVal: new Date().toISOString().split('T')[0],
      subVal: params.empresaCnpj ? `CNPJ: ${params.empresaCnpj} · Fomento Mercantil` : 'Fomento Mercantil'
    },
    W, M
  )

  let y = 43
  const colW = (CW - 8) / 2

  // ── Partes do Contrato (Card Estilizado) ──────────────────────────────────
  drawSectionHeader(doc, 'PARTES DO CONTRATO', M, y)
  y += 3

  // Card Background & Border
  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.15)
  doc.roundedRect(M, y, CW, 24, 2, 2, 'FD')

  // Credor Column
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('CREDOR', M + 4, y + 5)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.empresaNome ?? 'SRS M Factoring', M + 4, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(params.empresaCnpj ? `CNPJ: ${params.empresaCnpj}` : 'Fomento Mercantil', M + 4, y + 15)

  // Devedor Column
  const cx = M + colW + 8
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('DEVEDOR (TOMADOR)', cx, y + 5)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.cliente.nome, cx, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`CPF: ${fmtCpf(params.cliente.cpf)} ${params.cliente.telefone ? ` · Tel: ${params.cliente.telefone}` : ''}`, cx, y + 15)

  y += 31

  // ── Condições do Crédito (Card Estilizado) ──────────────────────────────
  drawSectionHeader(doc, 'CONDIÇÕES DO CRÉDITO', M, y)
  y += 3

  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2])
  doc.roundedRect(M, y, CW, 45, 2, 2, 'FD')

  const rows: [string, string, string, string][] = [
    ['Valor Principal', fmt(params.contrato.valor_principal), 'Taxa de Juros', `${params.contrato.taxa_juros}% a.m.`],
    ['Prazo Total', `${params.contrato.prazo_meses} parcelas`, 'Valor da Parcela', fmt(params.contrato.valor_parcela)],
    ['Total de Juros cobrados', fmt(params.contrato.total_juros), 'Total Geral a Pagar', fmt(params.contrato.total_pagar)],
    [
      'Primeiro Vencimento',
      fmtData(params.parcelas[0]?.data_vencimento),
      'Data de Liberação',
      fmtData(params.contrato.data_liberacao),
    ],
  ]

  let rowY = y + 5.5
  for (const [l1, v1, l2, v2] of rows) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(l1, M + 4, rowY)
    doc.text(l2, cx, rowY)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(v1, M + 4, rowY + 4.5)
    
    // Highlight Total a Pagar in Blue
    if (l2 === 'Total Geral a Pagar') {
      doc.setTextColor(BLUE[0], BLUE[1], BLUE[2])
    }
    doc.text(v2, cx, rowY + 4.5)
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    
    rowY += 9.5
  }

  y += 51

  // Garantias (se houver)
  if (params.contrato.garantias) {
    drawSectionHeader(doc, 'GARANTIAS CONTRATUAIS', M, y)
    y += 3
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2])
    const gLines = doc.splitTextToSize(params.contrato.garantias, CW - 8) as string[]
    const cardH = Math.max(14, gLines.length * 4.5 + 6)
    doc.roundedRect(M, y, CW, cardH, 2, 2, 'FD')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(gLines, M + 4, y + 5)
    y += cardH + 6
  } else {
    y += 1
  }

  // ── Plano de Pagamento ──────────────────────────────────────────────────
  drawSectionHeader(doc, 'CRONOGRAMA DE AMORTIZAÇÃO E PAGAMENTO', M, y)
  y += 3

  const parcShow = params.parcelas.slice(0, 12)
  autoTable(doc, {
    startY: y,
    head: [['Parcela Nº', 'Vencimento', 'Principal (Amortização)', 'Juros (Encargos)', 'Valor da Parcela']],
    body: parcShow.map(p => [
      `${String(p.numero_parcela)}ª Parcela`,
      fmtData(p.data_vencimento),
      fmt(p.valor_principal ?? 0),
      fmt(p.valor_juros ?? 0),
      fmt(p.valor),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2.2, halign: 'right' as const, font: 'helvetica' },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const, fontSize: 8 },
    columnStyles: { 0: { halign: 'center' as const }, 1: { halign: 'center' as const } },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    tableLineColor: BORDER_COLOR,
    tableLineWidth: 0.1,
  })

  y = lastY(doc) + 5

  if (params.parcelas.length > 12) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(`* Observação: Cronograma resumido. Mais ${params.parcelas.length - 12} parcela(s) não exibidas neste termo.`, M, y)
    y += 5
  }

  // ── Assinaturas ─────────────────────────────────────────────────────────
  if (y > 248) { doc.addPage(); y = 25 } else { y += 6 }

  const todayFull = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`Emitido em comum acordo em: __________________________, ${todayFull}`, M, y)
  y += 14

  const sw = 75
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2])
  doc.setLineWidth(0.15)
  doc.line(M, y, M + sw, y)
  doc.line(W - M - sw, y, W - M, y)

  y += 4
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.empresaNome ?? 'SRS M Factoring', M + sw / 2, y, { align: 'center' })
  doc.text(params.cliente.nome, W - M - sw / 2, y, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('CREDOR (ASSINATURA DIGITAL)', M + sw / 2, y + 4.2, { align: 'center' })
  doc.text('DEVEDOR / TOMADOR', W - M - sw / 2, y + 4.2, { align: 'center' })
  if (params.cliente.cpf) {
    doc.text(`CPF: ${fmtCpf(params.cliente.cpf)}`, W - M - sw / 2, y + 8.2, { align: 'center' })
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(
    `SRS M Factoring · Contrato nº ${params.contrato.numero_contrato} · Gerado digitalmente em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, 290, { align: 'center' }
  )

  doc.save(`contrato-${params.contrato.numero_contrato}.pdf`)
}

// ── Recibo Geral (Multi-parcelas) ───────────────────────────────────────────

export interface ReciboParams {
  clienteNome: string
  clienteCpf: string | null
  contratoNumero?: string
  parcelas: Array<{ numero: number; valor: number; vencimento: string }>
  valorTotal: number
  desconto?: number
  formaPagamento: string
  data: string
  empresaNome?: string
  empresaCnpj?: string | null
}

export async function gerarReciboPDF(params: ReciboParams): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - M * 2

  const logo = await loadLogo('/logos/factoring.png')

  // Header Premium
  const rcNum = Date.now().toString().slice(-6)
  drawPremiumHeader(
    doc,
    params.empresaNome ?? 'SRS M Factoring',
    'RECIBO GERAL DE QUITAÇÃO',
    logo,
    {
      code: `RECIBO: #${rcNum}`,
      dateLabel: 'Data',
      dateVal: params.data,
      subVal: params.empresaCnpj ? `CNPJ: ${params.empresaCnpj}` : 'Sociedade de Fomento'
    },
    W, M
  )

  let y = 43

  // ── Pagador ─────────────────────────────────────────────────────────────
  drawSectionHeader(doc, 'PAGADOR / TOMADOR', M, y)
  y += 3

  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.15)
  doc.roundedRect(M, y, CW, 15, 2, 2, 'FD')

  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.clienteNome, M + 4, y + 6)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(
    `CPF: ${fmtCpf(params.clienteCpf)} ${params.contratoNumero ? ` · Referente ao Contrato nº: ${params.contratoNumero}` : ''}`,
    M + 4, y + 11
  )

  y += 22

  // ── Parcelas Quitadas ───────────────────────────────────────────────────
  drawSectionHeader(doc, 'PARCELAS E TÍTULOS QUITADOS NESTE ATO', M, y)
  y += 3

  autoTable(doc, {
    startY: y,
    head: [['Parcela Nº', 'Vencimento Original', 'Valor da Parcela']],
    body: params.parcelas.map(p => [
      `${p.numero}ª Parcela`,
      fmtData(p.vencimento),
      fmt(p.valor)
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 2.8, halign: 'right' as const },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const },
    columnStyles: { 0: { halign: 'center' as const }, 1: { halign: 'center' as const } },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    tableLineColor: BORDER_COLOR,
    tableLineWidth: 0.1,
  })

  y = lastY(doc) + 6

  // ── Totais e Resumos ────────────────────────────────────────────────────
  const hasDesc = !!(params.desconto && params.desconto > 0)
  const boxH = hasDesc ? 28 : 20
  
  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.roundedRect(M, y, CW, boxH, 2, 2, 'FD')

  const formaLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque',
  }
  const formaText = formaLabel[params.formaPagamento] ?? params.formaPagamento

  y += 5.5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('Forma de Recebimento:', M + 4, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(formaText, M + 40, y)

  if (hasDesc) {
    y += 7.5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text('Descontos Concedidos:', M + 4, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
    doc.text(`- ${fmt(params.desconto ?? 0)}`, M + 40, y)
  }

  y += 7.5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2])
  doc.text('VALOR TOTAL RECEBIDO:', M + 4, y)
  doc.text(fmt(params.valorTotal), M + CW - 4, y, { align: 'right' })

  y += boxH - (hasDesc ? 13 : 5.5) + 6

  // ── Declaração ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  const decl = `SRS M Factoring declara ter recebido de ${params.clienteNome} a quantia líquida de ${fmt(params.valorTotal)} via ${formaText}, dando-lhe plena quitação para as obrigações e parcelas detalhadas neste documento.`
  const declLines = doc.splitTextToSize(decl, CW) as string[]
  doc.text(declLines, M, y)
  y += declLines.length * 4.5 + 12

  // ── Assinatura ─────────────────────────────────────────────────────────
  const sw = 80
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2])
  doc.setLineWidth(0.15)
  doc.line(W / 2 - sw / 2, y, W / 2 + sw / 2, y)
  y += 4
  
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.empresaNome ?? 'SRS M Factoring', W / 2, y, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('RECEBEDOR AUTORIZADO', W / 2, y + 4, { align: 'center' })
  doc.text(`Data da baixa: ${fmtData(params.data)}`, W / 2, y + 8, { align: 'center' })

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`Recibo #${rcNum} · Emitido por SRS M Factoring · Página 1 de 1`, W / 2, 290, { align: 'center' })

  doc.save(`recibo-${params.clienteNome.replace(/\s+/g, '-').toLowerCase()}-${params.data}.pdf`)
}

// ── Recibo Individual por Parcela (Completíssimo) ───────────────────────────

export interface ReciboParcela {
  parcela: {
    numero_parcela: number
    total_parcelas: number
    data_vencimento: string
    data_pagamento: string
    valor: number
    valor_pago: number
    tipo_pagamento: string
    multa?: number
    juros_mora?: number
    dias_atraso?: number
    saldo_devedor_parcela?: number
    saldo_devedor_total?: number
    total_parcelas_pagas?: number
    total_parcelas_restantes?: number
  }
  cliente: { nome: string; cpf: string | null; telefone?: string | null }
  contrato: { numero_contrato: string }
  empresaNome?: string
  empresaCnpj?: string | null
}

export async function gerarReciboParcela(p: ReciboParcela): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - M * 2
  const logo = await loadLogo('/logos/factoring.png')

  const rcId = `${p.contrato.numero_contrato}-P${String(p.parcela.numero_parcela).padStart(2, '0')}`
  const formaLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque',
  }
  const formaText = formaLabel[p.parcela.tipo_pagamento] ?? p.parcela.tipo_pagamento

  // Header Premium
  drawPremiumHeader(
    doc,
    p.empresaNome ?? 'SRS M Factoring',
    'COMPROVANTE DE PAGAMENTO DE TÍTULO',
    logo,
    {
      code: `COMPROVANTE: ${rcId}`,
      dateLabel: 'Baixa',
      dateVal: p.parcela.data_pagamento,
      subVal: p.empresaCnpj ? `CNPJ: ${p.empresaCnpj}` : 'Sociedade de Fomento'
    },
    W, M
  )

  let y = 43

  // ── Status Badge / Alerta de Atraso ─────────────────────────────────────
  const atraso = p.parcela.dias_atraso ?? 0
  const badgeW = 90, badgeH = 12
  
  if (atraso > 0) {
    doc.setFillColor(254, 237, 222) // Google Warning Soft Orange/Red background
    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(W / 2 - badgeW / 2, y, badgeW, badgeH, 1.5, 1.5, 'FD')
    
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2])
    doc.text(`PAGO COM ATRASO DE ${atraso} DIAS`, W / 2, y + 7.5, { align: 'center' })
  } else {
    doc.setFillColor(230, 244, 234) // Google Success Soft Green background
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(W / 2 - badgeW / 2, y, badgeW, badgeH, 1.5, 1.5, 'FD')
    
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2])
    doc.text('PAGO E LIQUIDADO NO VENCIMENTO', W / 2, y + 7.5, { align: 'center' })
  }

  y += badgeH + 7

  // ── Pagador ─────────────────────────────────────────────────────────────
  drawSectionHeader(doc, 'TOMADOR / PAGADOR', M, y)
  y += 3

  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.15)
  doc.roundedRect(M, y, CW, 18, 2, 2, 'FD')

  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(p.cliente.nome, M + 4, y + 6)

  const telFormat = p.cliente.telefone ? ` · Tel: ${p.cliente.telefone}` : ''
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`CPF: ${fmtCpf(p.cliente.cpf)}${telFormat} · Contrato Base: ${p.contrato.numero_contrato}`, M + 4, y + 11.5)

  y += 25

  // ── Detalhes e Valores em Grid ──────────────────────────────────────────
  drawSectionHeader(doc, 'DETALHAMENTO FINANCEIRO DA PARCELA', M, y)
  y += 3

  // Grid Box Outer Border
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2])
  doc.roundedRect(M, y, CW, 50, 2, 2, 'FD')

  // Column dividing line
  const half = CW / 2
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.15)
  doc.line(M + half, y, M + half, y + 50)

  // Horizontal separating lines
  doc.line(M, y + 12.5, M + CW, y + 12.5)
  doc.line(M, y + 25, M + CW, y + 25)
  doc.line(M, y + 37.5, M + CW, y + 37.5)

  const cells: { l: string; v: string; color?: [number, number, number] }[] = [
    // Line 1
    { l: 'Identificação da Parcela', v: `Parcela ${p.parcela.numero_parcela} de ${p.parcela.total_parcelas}` },
    { l: 'Vencimento Original', v: fmtData(p.parcela.data_vencimento) },
    
    // Line 2
    { l: 'Forma de Liquidação', v: formaText },
    { l: 'Valor Nominal da Parcela', v: fmt(p.parcela.valor) },
    
    // Line 3
    { l: 'Acréscimos (Multa e Juros cobrados)', v: fmt((p.parcela.multa ?? 0) + (p.parcela.juros_mora ?? 0)), color: (p.parcela.multa ?? 0) + (p.parcela.juros_mora ?? 0) > 0 ? RED : DARK },
    { l: 'Valor Líquido Pago', v: fmt(p.parcela.valor_pago), color: GREEN },
    
    // Line 4
    { l: 'Saldo Restante desta Parcela', v: fmt(p.parcela.saldo_devedor_parcela ?? 0), color: (p.parcela.saldo_devedor_parcela ?? 0) > 0.01 ? ORANGE : DARK },
    { l: 'Saldo Devedor Total do Contrato', v: fmt(p.parcela.saldo_devedor_total ?? 0), color: BLUE }
  ]

  let idx = 0
  for (let row = 0; row < 4; row++) {
    const cy = y + (row * 12.5)
    
    // Cell Left
    const c1 = cells[idx++]
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(c1.l, M + 3, cy + 4)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(c1.color ? c1.color[0] : DARK[0], c1.color ? c1.color[1] : DARK[1], c1.color ? c1.color[2] : DARK[2])
    doc.text(c1.v, M + 3, cy + 9.5)

    // Cell Right
    const c2 = cells[idx++]
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(c2.l, M + half + 3, cy + 4)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(c2.color ? c2.color[0] : DARK[0], c2.color ? c2.color[1] : DARK[1], c2.color ? c2.color[2] : DARK[2])
    doc.text(c2.v, M + half + 3, cy + 9.5)
  }

  y += 56

  // ── Highlight Box (VALOR LIQUIDADO) ─────────────────────────────────────
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2])
  doc.roundedRect(M, y, CW, 20, 2, 2, 'F')
  
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 220, 255)
  doc.text('RECURSO TOTAL AMORTIZADO E DEPOSITADO', M + CW / 2, y + 5.5, { align: 'center' })
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
  doc.text(fmt(p.parcela.valor_pago), M + CW / 2, y + 14.5, { align: 'center' })

  y += 26

  // ── Declaração ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  
  // Status textual
  const pagasCount = p.parcela.total_parcelas_pagas ?? p.parcela.numero_parcela
  const restCount = p.parcela.total_parcelas_restantes ?? Math.max(0, p.parcela.total_parcelas - pagasCount)
  const statsString = `[Estatísticas deste empréstimo: ${pagasCount} parcelas pagas · ${restCount} parcelas em aberto].`
  
  const decl = `Confirmamos por este termo o recebimento da quantia de ${fmt(p.parcela.valor_pago)} da parcela ${p.parcela.numero_parcela}/${p.parcela.total_parcelas} correspondente ao contrato ${p.contrato.numero_contrato}, efetuado em ${fmtData(p.parcela.data_pagamento)}. ${statsString} Damos plena quitação para este pagamento.`
  const declLines = doc.splitTextToSize(decl, CW) as string[]
  doc.text(declLines, M, y)
  y += declLines.length * 4.5 + 12

  // ── Assinatura ─────────────────────────────────────────────────────────
  const sw = 80
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2])
  doc.setLineWidth(0.15)
  doc.line(W / 2 - sw / 2, y, W / 2 + sw / 2, y)
  
  y += 4
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(p.empresaNome ?? 'SRS M Factoring', W / 2, y, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('RECEBEDOR AUTORIZADO', W / 2, y + 4, { align: 'center' })
  doc.text(fmtData(p.parcela.data_pagamento), W / 2, y + 8, { align: 'center' })

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`SRS M Factoring · Comprovante digital ${rcId} · Gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, 290, { align: 'center' })

  doc.save(`recibo-${rcId}.pdf`)
}

// ── Termo de Quitação Integral do Empréstimo ─────────────────────────────────

export interface QuitacaoParams {
  contrato: {
    numero_contrato: string
    valor_principal: number
    taxa_juros: number
    prazo_meses: number
    data_liberacao: string | null
    data_quitacao: string | null
  }
  cliente: { nome: string; cpf: string | null; telefone?: string | null }
  parcelas: Array<{
    numero_parcela: number
    data_vencimento: string
    data_pagamento: string | null
    valor: number
    valor_pago: number | null
    tipo_pagamento: string | null
    status: string
  }>
  empresaNome?: string
  empresaCnpj?: string | null
}

export async function gerarQuitacaoPDF(params: QuitacaoParams): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - M * 2
  const logo = await loadLogo('/logos/factoring.png')

  // Header Premium
  drawPremiumHeader(
    doc,
    params.empresaNome ?? 'SRS M Factoring',
    'TERMO DE QUITAÇÃO INTEGRAL E DEVOLUÇÃO',
    logo,
    {
      code: `LIQUIDAÇÃO: ${params.contrato.numero_contrato}`,
      dateLabel: 'Liquidado',
      dateVal: params.contrato.data_quitacao ?? new Date().toISOString().split('T')[0],
      subVal: params.empresaCnpj ? `CNPJ: ${params.empresaCnpj}` : 'Sociedade de Fomento'
    },
    W, M
  )

  let y = 43
  const colW = (CW - 8) / 2
  const cx = M + colW + 8

  // ── Partes do Acordo ────────────────────────────────────────────────────
  drawSectionHeader(doc, 'PARTES INTERESSADAS', M, y)
  y += 3

  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2])
  doc.setLineWidth(0.15)
  doc.roundedRect(M, y, CW, 24, 2, 2, 'FD')

  // Credor Column
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('CREDOR', M + 4, y + 5)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.empresaNome ?? 'SRS M Factoring', M + 4, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(params.empresaCnpj ? `CNPJ: ${params.empresaCnpj}` : 'Fomento Mercantil', M + 4, y + 15)

  // Devedor Column
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('DEVEDOR (TOMADOR)', cx, y + 5)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.cliente.nome, cx, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`CPF: ${fmtCpf(params.cliente.cpf)} ${params.cliente.telefone ? ` · Tel: ${params.cliente.telefone}` : ''}`, cx, y + 15)

  y += 31

  // ── Condições Contratuais ───────────────────────────────────────────────
  drawSectionHeader(doc, 'DADOS DO TÍTULO ORIGINAL', M, y)
  y += 3

  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2])
  doc.roundedRect(M, y, CW, 35, 2, 2, 'FD')

  const condRows: [string, string, string, string][] = [
    ['Contrato Referência', params.contrato.numero_contrato, 'Valor Principal Liberado', fmt(params.contrato.valor_principal)],
    ['Taxa de Juros Combinada', `${params.contrato.taxa_juros}% a.m.`, 'Prazo Pactuado', `${params.contrato.prazo_meses} meses`],
    ['Data de Liberação do Crédito', fmtData(params.contrato.data_liberacao), 'Data de Quitação Final', fmtData(params.contrato.data_quitacao)],
  ]
  
  let rowY = y + 5.5
  for (const [l1, v1, l2, v2] of condRows) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(l1, M + 4, rowY)
    doc.text(l2, cx, rowY)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(v1, M + 4, rowY + 4.2)
    doc.text(v2, cx, rowY + 4.2)
    rowY += 9.5
  }

  y += 42

  // ── Histórico de Amortização ─────────────────────────────────────────────
  drawSectionHeader(doc, 'HISTÓRICO COMPLETO DOS LANÇAMENTOS DE BAIXA', M, y)
  y += 3

  const formaLabel: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque' }
  autoTable(doc, {
    startY: y,
    head: [['Parcela', 'Vencimento', 'Baixado em', 'Valor Nominal', 'Total Pago', 'Canal']],
    body: params.parcelas.map(p => [
      `${p.numero_parcela}ª`,
      fmtData(p.data_vencimento),
      fmtData(p.data_pagamento),
      fmt(p.valor),
      fmt(p.valor_pago ?? 0),
      formaLabel[p.tipo_pagamento ?? ''] ?? (p.tipo_pagamento ?? '—'),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 2, halign: 'right' as const },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const, fontSize: 7.5 },
    columnStyles: {
      0: { halign: 'center' as const }, 1: { halign: 'center' as const },
      2: { halign: 'center' as const }, 5: { halign: 'center' as const },
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    tableLineColor: BORDER_COLOR,
    tableLineWidth: 0.1,
  })

  y = lastY(doc) + 6

  const totalPago = params.parcelas.reduce((s, p) => s + (p.valor_pago ?? 0), 0)

  // Total Quitado Highlight Card
  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2])
  doc.roundedRect(M, y, CW, 14, 2, 2, 'FD')
  
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2])
  doc.text('TOTAL AMORTIZADO LIQUIDADO:', M + 4, y + 8.5)
  doc.text(fmt(totalPago), W - M - 4, y + 8.5, { align: 'right' })
  y += 19

  if (y > 238) { doc.addPage(); y = 20 }
  
  // ── Declaração ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  const decl = `A sociedade de fomento mercantil ${params.empresaNome ?? 'SRS M Factoring'} declara e certifica, por este termo de quitação integral, que o Tomador de Crédito ${params.cliente.nome}${params.cliente.cpf ? ` (portador do CPF: ${fmtCpf(params.cliente.cpf)})` : ''} adimpliu de forma irrevogável todas as parcelas e encargos de juros referentes ao contrato de mútuo financeiro nº ${params.contrato.numero_contrato}. Não restando qualquer saldo residual ou obrigação pendente, damos plena e geral quitação de débito.`
  const declLines = doc.splitTextToSize(decl, CW) as string[]
  doc.text(declLines, M, y)
  y += declLines.length * 4.5 + 12

  if (y > 250) { doc.addPage(); y = 25 } else { y += 4 }
  
  const todayFull = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(8)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`Acordo encerrado e assinado em: __________________________, ${todayFull}`, M, y)
  y += 14

  const sw = 75
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2])
  doc.setLineWidth(0.15)
  doc.line(M, y, M + sw, y)
  doc.line(W - M - sw, y, W - M, y)
  
  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.text(params.empresaNome ?? 'SRS M Factoring', M + sw / 2, y, { align: 'center' })
  doc.text(params.cliente.nome, W - M - sw / 2, y, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text('CREDOR (ASSINATURA ELETRÔNICA)', M + sw / 2, y + 4, { align: 'center' })
  doc.text('DEVEDOR (QUITADO)', W - M - sw / 2, y + 4, { align: 'center' })
  if (params.cliente.cpf) {
    doc.text(`CPF: ${fmtCpf(params.cliente.cpf)}`, W - M - sw / 2, y + 8, { align: 'center' })
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
  doc.text(`SRS M Factoring · Termo de Quitação Contrato ${params.contrato.numero_contrato} · Gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, 290, { align: 'center' })

  doc.save(`quitacao-${params.contrato.numero_contrato}.pdf`)
}
