import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Helpers ─────────────────────────────────────────────────────────────────

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

const BLUE: [number, number, number] = [30, 90, 168]
const DARK: [number, number, number] = [15, 23, 42]
const GRAY: [number, number, number] = [100, 116, 139]
const LIGHT: [number, number, number] = [241, 245, 249]
const WHITE: [number, number, number] = [255, 255, 255]

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
    valor_principal: number
    valor_juros: number
  }>
  empresaNome?: string
  empresaCnpj?: string | null
}

export async function gerarContratoPDF(params: ContratoParams): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - M * 2

  const logo = await loadLogo('/logos/factoring.png')

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 40, 'F')

  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 5, 28, 28) } catch { /* ignore */ }
  }

  const tx = logo ? M + 32 : M
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(params.empresaNome ?? 'SRS M Factoring', tx, 16)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('CONTRATO DE EMPRÉSTIMO', tx, 23)
  if (params.empresaCnpj) {
    doc.setFontSize(7.5)
    doc.text(`CNPJ: ${params.empresaCnpj}`, tx, 29)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(params.contrato.numero_contrato, W - M, 17, { align: 'right' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 210, 255)
  if (params.contrato.data_liberacao) {
    doc.text(`Liberado: ${fmtData(params.contrato.data_liberacao)}`, W - M, 24, { align: 'right' })
  }
  doc.text(`Emitido: ${fmtData(new Date().toISOString().split('T')[0])}`, W - M, 30, { align: 'right' })

  let y = 48
  const colW = (CW - 10) / 2

  // ── Partes ───────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('PARTES DO CONTRATO', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 7

  // Credor
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('CREDOR', M, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(params.empresaNome ?? 'SRS M Factoring', M, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Sociedade de Fomento Mercantil', M, y + 10)
  if (params.empresaCnpj) doc.text(`CNPJ: ${params.empresaCnpj}`, M, y + 14.5)

  // Devedor
  const cx = M + colW + 10
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('DEVEDOR (TOMADOR)', cx, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(params.cliente.nome, cx, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`CPF: ${fmtCpf(params.cliente.cpf)}`, cx, y + 10)
  if (params.cliente.telefone) doc.text(`Tel: ${params.cliente.telefone}`, cx, y + 14.5)

  y += 22

  // ── Condições ────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('CONDIÇÕES DO CRÉDITO', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 7

  const rows: [string, string, string, string][] = [
    ['Valor Principal', fmt(params.contrato.valor_principal), 'Taxa de Juros', `${params.contrato.taxa_juros}% a.m.`],
    ['Nº de Parcelas', `${params.contrato.prazo_meses}×`, 'Valor da Parcela', fmt(params.contrato.valor_parcela)],
    ['Total de Juros', fmt(params.contrato.total_juros), 'Total a Pagar', fmt(params.contrato.total_pagar)],
    [
      '1º Vencimento',
      fmtData(params.parcelas[0]?.data_vencimento),
      'Data de Liberação',
      fmtData(params.contrato.data_liberacao),
    ],
  ]

  for (const [l1, v1, l2, v2] of rows) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(l1, M, y)
    doc.text(l2, cx, y)
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(v1, M, y + 5)
    doc.text(v2, cx, y + 5)
    y += 11
  }

  if (params.contrato.garantias) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('Garantias', M, y)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    const gLines = doc.splitTextToSize(params.contrato.garantias, CW) as string[]
    doc.text(gLines, M, y + 5)
    y += 5 + gLines.length * 4.5
  }

  y += 3

  // ── Plano de Pagamento ────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('PLANO DE PAGAMENTO', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 5

  const parcShow = params.parcelas.slice(0, 12)
  autoTable(doc, {
    startY: y,
    head: [['Nº', 'Vencimento', 'Principal', 'Juros', 'Parcela']],
    body: parcShow.map(p => [
      String(p.numero_parcela),
      fmtData(p.data_vencimento),
      fmt(p.valor_principal),
      fmt(p.valor_juros),
      fmt(p.valor),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 2, halign: 'right' as const },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const },
    columnStyles: { 0: { halign: 'center' as const }, 1: { halign: 'center' as const } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  y = lastY(doc) + 5

  if (params.parcelas.length > 12) {
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...GRAY)
    doc.text(`* mais ${params.parcelas.length - 12} parcela(s) não exibida(s)`, M, y)
    y += 5
  }

  // ── Cláusulas ─────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('CLÁUSULAS E CONDIÇÕES', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 7

  const clausulas = [
    '1. O DEVEDOR compromete-se a efetuar o pagamento das parcelas nas datas estipuladas neste instrumento.',
    '2. O atraso sujeita o DEVEDOR à cobrança de multa de 2% sobre o valor e juros de mora de 1% ao mês pro rata die.',
    '3. Após 30 (trinta) dias de inadimplência, o CREDOR poderá protestar os títulos ou acionar o poder judiciário.',
    '4. O DEVEDOR autoriza o CREDOR a consultar o SPC/SERASA e demais cadastros de proteção ao crédito.',
    '5. O presente contrato é regido pelas normas do Código Civil Brasileiro e legislação correlata em vigor.',
  ]

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 75, 95)
  for (const c of clausulas) {
    if (y > 250) break
    const lines = doc.splitTextToSize(c, CW) as string[]
    doc.text(lines, M, y)
    y += lines.length * 4.5 + 2
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  if (y > 252) { doc.addPage(); y = 20 } else { y += 6 }

  const todayFull = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`Local e Data: __________________________________, ${todayFull}`, M, y)
  y += 12

  const sw = 75
  doc.setDrawColor(50, 65, 80)
  doc.setLineWidth(0.3)
  doc.line(M, y, M + sw, y)
  doc.line(W - M - sw, y, W - M, y)

  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(params.empresaNome ?? 'SRS M Factoring', M + sw / 2, y, { align: 'center' })
  doc.text(params.cliente.nome, W - M - sw / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('CREDOR', M + sw / 2, y + 4, { align: 'center' })
  doc.text('DEVEDOR', W - M - sw / 2, y + 4, { align: 'center' })
  if (params.cliente.cpf) {
    doc.text(`CPF: ${fmtCpf(params.cliente.cpf)}`, W - M - sw / 2, y + 8, { align: 'center' })
  }

  // ── Footer ─────────────────────────────────────────────────────────────────────
  doc.setFontSize(6)
  doc.setTextColor(175, 190, 205)
  doc.text(
    `Contrato ${params.contrato.numero_contrato} · Gerado em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, 291, { align: 'center' }
  )

  doc.save(`contrato-${params.contrato.numero_contrato}.pdf`)
}

// ── Recibo ───────────────────────────────────────────────────────────────────

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

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 37, 'F')

  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 4, 27, 27) } catch { /* ignore */ }
  }

  const tx = logo ? M + 31 : M
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(params.empresaNome ?? 'SRS M Factoring', tx, 15)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('RECIBO DE PAGAMENTO', tx, 22)
  if (params.empresaCnpj) {
    doc.setFontSize(7.5)
    doc.text(`CNPJ: ${params.empresaCnpj}`, tx, 28)
  }

  const reciboNum = Date.now().toString().slice(-8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`#${reciboNum}`, W - M, 15, { align: 'right' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 210, 255)
  doc.text(`Data: ${fmtData(params.data)}`, W - M, 22, { align: 'right' })

  let y = 45

  // ── Pagador ───────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('PAGADOR', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 7

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(params.clienteNome, M, y)
  y += 5.5
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  if (params.clienteCpf) doc.text(`CPF: ${fmtCpf(params.clienteCpf)}`, M, y)
  if (params.contratoNumero) doc.text(`Contrato: ${params.contratoNumero}`, M + 75, y)
  y += 10

  // ── Parcelas ─────────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('PARCELAS QUITADAS', M, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.line(M, y + 2, M + CW, y + 2)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Parcela Nº', 'Vencimento', 'Valor']],
    body: params.parcelas.map(p => [String(p.numero), fmtData(p.vencimento), fmt(p.valor)]),
    margin: { left: M, right: M },
    styles: { fontSize: 9.5, cellPadding: 3, halign: 'right' as const },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const },
    columnStyles: { 0: { halign: 'center' as const }, 1: { halign: 'center' as const } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  y = lastY(doc) + 6

  // ── Total box ─────────────────────────────────────────────────────────────────
  const boxH = params.desconto ? 34 : 28
  doc.setFillColor(...LIGHT)
  doc.rect(M, y, CW, boxH, 'F')
  doc.setDrawColor(210, 220, 235)
  doc.setLineWidth(0.2)
  doc.rect(M, y, CW, boxH, 'S')

  const formaLabel: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', transferencia: 'Transferência', boleto: 'Boleto', cheque: 'Cheque',
  }
  y += 7

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Forma de Pagamento:', M + 5, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(formaLabel[params.formaPagamento] ?? params.formaPagamento, M + 58, y)
  y += 7

  if (params.desconto && params.desconto > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('Desconto concedido:', M + 5, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 160, 90)
    doc.text(`- ${fmt(params.desconto)}`, M + 58, y)
    y += 7
  }

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE)
  doc.text('TOTAL RECEBIDO:', M + 5, y)
  doc.text(fmt(params.valorTotal), M + CW - 5, y, { align: 'right' })
  y += 12

  // ── Declaração ───────────────────────────────────────────────────────────────
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(65, 80, 100)
  const decl = `Declaro ter recebido de ${params.clienteNome} a quantia de ${fmt(params.valorTotal)}, referente ao pagamento da(s) parcela(s) discriminadas acima, mediante ${formaLabel[params.formaPagamento] ?? params.formaPagamento}, dando plena quitação para o presente ato.`
  const declLines = doc.splitTextToSize(decl, CW) as string[]
  doc.text(declLines, M, y)
  y += declLines.length * 4.5 + 10

  // ── Assinatura ────────────────────────────────────────────────────────────────
  const sw = 80
  doc.setDrawColor(50, 65, 80)
  doc.setLineWidth(0.3)
  doc.line(W / 2 - sw / 2, y, W / 2 + sw / 2, y)
  y += 4
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(params.empresaNome ?? 'SRS M Factoring', W / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('RECEBEDOR', W / 2, y + 4.5, { align: 'center' })
  doc.text(fmtData(params.data), W / 2, y + 9, { align: 'center' })

  // ── Footer ─────────────────────────────────────────────────────────────────────
  doc.setFontSize(6)
  doc.setTextColor(175, 190, 205)
  doc.text(
    `Recibo #${reciboNum} · Gerado em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, 291, { align: 'center' }
  )

  doc.save(`recibo-${params.clienteNome.replace(/\s+/g, '-').toLowerCase()}-${params.data}.pdf`)
}
