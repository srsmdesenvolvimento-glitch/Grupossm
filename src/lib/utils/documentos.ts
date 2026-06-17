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

function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const c = cnpj.replace(/\D/g, '')
  return c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : cnpj
}

function formatCep(cep: string | null | undefined): string {
  if (!cep) return '—'
  const c = cep.replace(/\D/g, '')
  return c.length === 8 ? c.replace(/(\d{5})(\d{3})/, '$1-$2') : cep
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const c = phone.replace(/\D/g, '')
  if (c.length === 11) {
    return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else if (c.length === 10) {
    return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

async function loadLogo(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    if (typeof window === 'undefined') {
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      return `data:${contentType};base64,${buffer.toString('base64')}`
    } else {
      const blob = await res.blob()
      return new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => resolve('')
        reader.readAsDataURL(blob)
      })
    }
  } catch (err) {
    console.error('Erro ao carregar imagem no loadLogo:', err)
    return ''
  }
}


// ── Company Details Type & Helper ──────────────────────────────────────────

interface CompanyDetails {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  endereco: string
  cep: string
  cidade: string
  estado: string
  telefone: string
}

function getCompanyDetails(params: {
  empresaNome?: string
  empresaCnpj?: string | null
  empresaTelefone?: string | null
  empresaEmail?: string | null
  empresaEndereco?: string | null
  empresaCidade?: string | null
  empresaEstado?: string | null
  empresaCep?: string | null
}): CompanyDetails {
  return {
    razaoSocial: 'JOSE ANTONIO SILVA MADEIRA 57166544520',
    nomeFantasia: params.empresaNome ?? 'SRS M FACTORING',
    cnpj: params.empresaCnpj ? params.empresaCnpj.replace(/\D/g, '') : '21707455000111',
    endereco: params.empresaEndereco ?? 'Rua Três Marias, Quadra 10, Lote 02',
    cep: params.empresaCep ? params.empresaCep.replace(/\D/g, '') : '74465445',
    cidade: params.empresaCidade ?? 'Goiânia',
    estado: params.empresaEstado ?? 'GO',
    telefone: params.empresaTelefone ? params.empresaTelefone.replace(/\D/g, '') : '62985606974'
  }
}

// ── MarketUP Grid Box-style PDF layout engine ──────────────────────────────

function drawSectionHeaderBox(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setFillColor(240, 240, 240)
  doc.rect(x, y - 4, w, 5, 'F')
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.rect(x, y - 4, w, 5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(title, x + 2, y - 0.5)
}

function drawMarketUpHeader(
  doc: jsPDF,
  title: string,
  docNumber: string,
  operador: string,
  company: CompanyDetails,
  cliente: {
    nome: string
    cpf: string | null
    telefone?: string | null
    endereco?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
  },
  dates: { criacao: string; emissao: string; vencimento: string },
  startY: number
): number {
  doc.setFont('helvetica', 'normal')
  
  // Page Border Box
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.25)
  doc.rect(10, startY, 190, 277)
  
  // Header Box
  doc.rect(10, startY, 190, 28)
  // Vertical line separating brand and company details
  doc.line(95, startY, 95, startY + 28)
  
  // Left side Brand
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(company.nomeFantasia.toUpperCase(), 12, startY + 8)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 100, 100)
  doc.text('EMISSOR SRS M · SISTEMA DE GESTÃO FINANCEIRA', 12, startY + 12)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(title, 12, startY + 22)
  
  // Right side Company Info
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text(company.razaoSocial, 97, startY + 5)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(50, 50, 50)
  doc.text(`CNPJ: ${formatCnpj(company.cnpj)}`, 97, startY + 9)
  doc.text(`${company.endereco}`, 97, startY + 13)
  doc.text(`${formatCep(company.cep)} - ${company.cidade} - ${company.estado}`, 97, startY + 17)
  doc.text(`Telefone: ${formatPhone(company.telefone)}`, 97, startY + 21)
  
  let y = startY + 28
  
  // Document Details Box
  doc.rect(10, y, 190, 20)
  // Vertical line separating document number and operator
  doc.line(95, y, 95, y + 10)
  // Horizontal line separating first row of details from client row
  doc.line(10, y + 10, 200, y + 10)
  
  // Row 1 details
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('Identificação do Documento', 12, y + 3.5)
  doc.text('Operador / Registrador', 97, y + 3.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(docNumber, 12, y + 8)
  doc.text(operador, 97, y + 8)
  
  // Row 2 details (Client)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('Cliente / Tomador', 12, y + 13.5)
  doc.text('CPF/CNPJ do Tomador', 97, y + 13.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(cliente.nome.toUpperCase(), 12, y + 18)
  doc.text(fmtCpf(cliente.cpf), 97, y + 18)
  
  y += 20
  
  // Dates Box
  doc.rect(10, y, 190, 10)
  // Vertical dividers
  doc.line(70, y, 70, y + 10)
  doc.line(135, y, 135, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Data de liberação', 12, y + 3.5)
  doc.text('Data de emissão', 72, y + 3.5)
  doc.text('Data de vencimento/entrega', 137, y + 3.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(fmtData(dates.criacao), 12, y + 8)
  doc.text(fmtData(dates.emissao), 72, y + 8)
  doc.text(fmtData(dates.vencimento), 137, y + 8)
  
  y += 10
  
  // Endereço Box
  drawSectionHeaderBox(doc, 'ENDEREÇO DE COBRANÇA / TOMADOR', 10, y + 5, 190)
  y += 5
  
  doc.rect(10, y, 190, 10)
  // Vertical dividers
  doc.line(115, y, 115, y + 10)
  doc.line(155, y, 155, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Endereço', 12, y + 3.5)
  doc.text('CEP', 117, y + 3.5)
  doc.text('Cidade/UF', 157, y + 3.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  
  const endFormat = cliente.endereco ? `${cliente.endereco}, ${cliente.numero || 'S/N'}${cliente.bairro ? ` - ${cliente.bairro}` : ''}` : 'Rua Gentil Pinto, S/N - Vila Rosa'
  const cepFormat = cliente.cep ? formatCep(cliente.cep) : '74345-230'
  const cidadeFormat = cliente.cidade ? `${cliente.cidade} - ${cliente.estado || 'GO'}` : 'Goiânia - GO'
  
  doc.text(endFormat.toUpperCase(), 12, y + 8)
  doc.text(cepFormat, 117, y + 8)
  doc.text(cidadeFormat.toUpperCase(), 157, y + 8)
  
  y += 10
  return y
}

function drawMarketUpItens(
  doc: jsPDF,
  itens: Array<{ ref: string; desc: string; qtd: string; valor: number; total: number }>,
  startY: number
): number {
  drawSectionHeaderBox(doc, 'DETALHAMENTO DO TÍTULO / ITENS DO CRÉDITO', 10, startY + 5, 190)
  let y = startY + 5
  
  // Outer Box for Table
  const rowH = 6
  const boxH = (itens.length + 1) * rowH
  doc.rect(10, y, 190, boxH)
  
  // Dividers
  doc.line(10, y + rowH, 200, y + rowH) // Separator for headers
  
  // Vertical column dividers
  doc.line(35, y, 35, y + boxH)   // Ref
  doc.line(115, y, 115, y + boxH) // Desc
  doc.line(130, y, 130, y + boxH) // Qtd
  doc.line(155, y, 155, y + boxH) // Unitário
  doc.line(175, y, 175, y + boxH) // Desconto
  
  // Write Headers
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  doc.text('Referência', 12, y + 4.2)
  doc.text('Descrição', 37, y + 4.2)
  doc.text('Qtd', 117, y + 4.2)
  doc.text('Unitário', 132, y + 4.2)
  doc.text('Desconto', 157, y + 4.2)
  doc.text('Total', 177, y + 4.2)
  
  y += rowH
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(50, 50, 50)
  
  for (const item of itens) {
    doc.text(item.ref, 12, y + 4.2)
    
    // Auto wrap description to avoid overflow
    const descLines = doc.splitTextToSize(item.desc.toUpperCase(), 76) as string[]
    doc.text(descLines[0], 37, y + 4.2)
    
    doc.text(item.qtd, 117, y + 4.2)
    doc.text(fmt(item.valor), 132, y + 4.2)
    doc.text(fmt(0), 157, y + 4.2)
    doc.text(fmt(item.total), 177, y + 4.2)
    
    y += rowH
  }
  
  return y
}

function drawMarketUpTotals(
  doc: jsPDF,
  totais: { itens: number; desconto: number; frete: number; outros: number; total: number },
  startY: number
): number {
  drawSectionHeaderBox(doc, 'VALOR TOTAL DE LANÇAMENTO', 10, startY + 5, 190)
  let y = startY + 5
  
  doc.rect(10, y, 190, 10)
  
  // Dividers
  doc.line(48, y, 48, y + 10)
  doc.line(86, y, 86, y + 10)
  doc.line(124, y, 124, y + 10)
  doc.line(162, y, 162, y + 10)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Total dos Itens', 12, y + 3.5)
  doc.text('Desconto', 50, y + 3.5)
  doc.text('Taxa Operacional', 88, y + 3.5)
  doc.text('Encargos/Outros', 126, y + 3.5)
  doc.text('Valor Total', 164, y + 3.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(fmt(totais.itens), 12, y + 8)
  doc.text(fmt(totais.desconto), 50, y + 8)
  doc.text(fmt(totais.frete), 88, y + 8)
  doc.text(fmt(totais.outros), 126, y + 8)
  
  doc.setFontSize(8)
  doc.setTextColor(26, 115, 232)
  doc.text(fmt(totais.total), 164, y + 8)
  
  y += 10
  return y
}

function drawMarketUpCondicoes(
  doc: jsPDF,
  condicoes: Array<{ desc: string; vencimento: string; pagamento: string; valor: number; saldo: number; observacao: string }>,
  startY: number
): number {
  drawSectionHeaderBox(doc, 'FORMA / CONDIÇÕES DE PAGAMENTO', 10, startY + 5, 190)
  let y = startY + 5
  
  const rowH = 5.5
  const boxH = (condicoes.length + 1) * rowH
  
  doc.rect(10, y, 190, boxH)
  doc.line(10, y + rowH, 200, y + rowH) // Separator for headers
  
  // Column dividers
  doc.line(80, y, 80, y + boxH)
  doc.line(105, y, 105, y + boxH)
  doc.line(130, y, 130, y + boxH)
  doc.line(152, y, 152, y + boxH)
  doc.line(174, y, 174, y + boxH)
  
  // Headers
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  doc.text('Descrição', 12, y + 4)
  doc.text('Vencimento', 82, y + 4)
  doc.text('Pagamento', 107, y + 4)
  doc.text('Valor', 132, y + 4)
  doc.text('Saldo', 154, y + 4)
  doc.text('Observação', 176, y + 4)
  
  y += rowH
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(50, 50, 50)
  
  for (const item of condicoes) {
    doc.text(item.desc.toUpperCase(), 12, y + 3.8)
    doc.text(fmtData(item.vencimento), 82, y + 3.8)
    doc.text(item.pagamento ? fmtData(item.pagamento) : '—', 107, y + 3.8)
    doc.text(fmt(item.valor), 132, y + 3.8)
    doc.text(fmt(item.saldo), 154, y + 3.8)
    
    // Highlight observacao color if paid vs late
    if (item.observacao.toLowerCase().includes('pago') || item.observacao.toLowerCase().includes('liquidado')) {
      doc.setTextColor(52, 168, 83) // Green
    } else if (item.observacao.toLowerCase().includes('atraso') || item.observacao.toLowerCase().includes('aberto')) {
      doc.setTextColor(234, 67, 53) // Red
    }
    doc.text(item.observacao.toUpperCase(), 176, y + 3.8)
    doc.setTextColor(50, 50, 50) // Reset
    
    y += rowH
  }
  
  return y
}

function drawMarketUpFooterAndSignatures(
  doc: jsPDF,
  company: CompanyDetails,
  clienteName: string,
  obsText: string,
  startY: number,
  W: number,
  signatureBase64?: string
) {
  let y = startY
  
  // Observações box
  if (obsText) {
    drawSectionHeaderBox(doc, 'OBSERVAÇÕES', 10, y + 5, 190)
    y += 5
    
    const obsLines = doc.splitTextToSize(obsText.toUpperCase(), 182) as string[]
    const boxH = Math.max(12, obsLines.length * 4 + 6)
    doc.rect(10, y, 190, boxH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(80, 80, 80)
    doc.text(obsLines, 12, y + 5)
    y += boxH
  }
  
  // Signatures Area
  if (y > 230) {
    doc.addPage()
    doc.rect(10, 10, 190, 277)
    y = 25
  } else {
    y += 10
  }
  
  // Draw signature fields
  const sw = 75
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.line(20, y + 16, 20 + sw, y + 16)
  doc.line(W - 20 - sw, y + 16, W - 20, y + 16)
  
  // Render signature image above the tomador line if present
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, 'PNG', W - 20 - sw + 12.5, y + 3, 50, 12)
    } catch (err) {
      console.error('Erro ao renderizar assinatura na folha de contrato:', err)
    }
  }
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(company.nomeFantasia.toUpperCase(), 20 + sw / 2, y + 20, { align: 'center' })
  doc.text(clienteName.toUpperCase(), W - 20 - sw / 2, y + 20, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 100, 100)
  doc.text('ASSINATURA DO CREDOR / EMITENTE', 20 + sw / 2, y + 24, { align: 'center' })
  doc.text('ASSINATURA DO DEVEDOR / TOMADOR', W - 20 - sw / 2, y + 24, { align: 'center' })

  
  // Bottom Watermark
  doc.setFontSize(6.5)
  doc.setTextColor(180, 180, 180)
  doc.text('DOCUMENTO GERADO PELO SISTEMA SRS M · EMISSOR PARCEIRO SRS M', W / 2, 282, { align: 'center' })
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
    telefone?: string | null
    endereco?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
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
  empresaTelefone?: string | null
  empresaEmail?: string | null
  empresaEndereco?: string | null
  empresaCidade?: string | null
  empresaEstado?: string | null
  empresaCep?: string | null
}

export async function gerarContratoPDF(params: ContratoParams, options?: { output?: 'save' | 'blob' }): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 10

  const company = getCompanyDetails(params)
  
  let y = drawMarketUpHeader(
    doc,
    'CONTRATO DE EMPRÉSTIMO COM GARANTIAS',
    `CONTRATO: ${params.contrato.numero_contrato}`,
    'SRS M FACTORING',
    company,
    params.cliente,
    {
      criacao: params.contrato.data_liberacao || new Date().toISOString().split('T')[0],
      emissao: new Date().toISOString().split('T')[0],
      vencimento: params.parcelas[0]?.data_vencimento || new Date().toISOString().split('T')[0]
    },
    M
  )

  const itens = [
    {
      ref: 'MÚTUO-PRIN',
      desc: `PRINCIPAL LIBERADO REFERENTE AO CONTRATO ${params.contrato.numero_contrato}`,
      qtd: '1,000',
      valor: params.contrato.valor_principal,
      total: params.contrato.valor_principal
    },
    {
      ref: 'MÚTUO-JURM',
      desc: `ENCARGOS FINANCEIROS SOBRE O MÚTUO PACTUADO (${params.contrato.taxa_juros}% A.M.)`,
      qtd: '1,000',
      valor: params.contrato.total_juros,
      total: params.contrato.total_juros
    }
  ]

  y = drawMarketUpItens(doc, itens, y)
  
  const totais = {
    itens: params.contrato.valor_principal,
    desconto: 0,
    frete: 0,
    outros: params.contrato.total_juros,
    total: params.contrato.total_pagar
  }

  y = drawMarketUpTotals(doc, totais, y)

  const condicoes = params.parcelas.slice(0, 10).map(p => ({
    desc: `PROMESSORIA (PARCELA ${String(p.numero_parcela).padStart(2, '0')}/${String(params.contrato.prazo_meses).padStart(2, '0')})`,
    vencimento: p.data_vencimento,
    pagamento: '',
    valor: p.valor,
    saldo: p.valor,
    observacao: 'EM ABERTO'
  }))

  y = drawMarketUpCondicoes(doc, condicoes, y)

  const obsText = params.contrato.observacoes ?? ''
  const matchMora = obsText.match(/\[Mora:\s*([\d.]+)%\s*ao\s*dia\]/)
  const jurosMoraDiario = matchMora ? parseFloat(matchMora[1]) : 0.033
  const obsLimpa = obsText.replace(/\[Mora:\s*[\d.]+%\s*ao\s*dia\]/, '').trim()

  const obs = `GARANTIAS APRESENTADAS: ${params.contrato.garantias || 'NÃO ESPECIFICADAS'}. JUROS DE MORA POR ATRASO PACTUADO: ${jurosMoraDiario}% AO DIA. OBSERVACÕES GERAIS: ${obsLimpa || 'SEM OBSERVAÇÕES ADICIONAIS'}. ESTE CONTRATO SERVE COMO TÍTULO EXECUTIVO EXTRAJUDICIAL CONFORME LEGISLAÇÃO VIGENTE.`
  
  drawMarketUpFooterAndSignatures(doc, company, params.cliente.nome, obs, y, W)

  if (options?.output === 'blob') {
    return doc.output('blob')
  }
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
  cliente?: {
    nome: string
    cpf: string | null
    telefone?: string | null
    endereco?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
  }
  empresaNome?: string
  empresaCnpj?: string | null
  empresaTelefone?: string | null
  empresaEmail?: string | null
  empresaEndereco?: string | null
  empresaCidade?: string | null
  empresaEstado?: string | null
  empresaCep?: string | null
}

export async function gerarReciboPDF(params: ReciboParams, options?: { output?: 'save' | 'blob' }): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 10

  const company = getCompanyDetails(params)
  const rcNum = Date.now().toString().slice(-6)
  
  const clienteObj = params.cliente ?? {
    nome: params.clienteNome,
    cpf: params.clienteCpf,
    telefone: ''
  }

  let y = drawMarketUpHeader(
    doc,
    'RECIBO GERAL DE QUITAÇÃO PARCIAL',
    `RECIBO: #${rcNum}`,
    'SRS M FACTORING',
    company,
    clienteObj,
    {
      criacao: params.data,
      emissao: params.data,
      vencimento: params.parcelas[0]?.vencimento || params.data
    },
    M
  )

  const itens = params.parcelas.map(p => ({
    ref: `LANC-P${String(p.numero).padStart(2, '0')}`,
    desc: `PAGAMENTO PARCELA ${p.numero} DO CONTRATO REFERENCIA ${params.contratoNumero || '—'}`,
    qtd: '1,000',
    valor: p.valor,
    total: p.valor
  }))

  y = drawMarketUpItens(doc, itens, y)
  
  const totais = {
    itens: params.valorTotal + (params.desconto ?? 0),
    desconto: params.desconto ?? 0,
    frete: 0,
    outros: 0,
    total: params.valorTotal
  }

  y = drawMarketUpTotals(doc, totais, y)

  const condicoes = params.parcelas.map(p => ({
    desc: `PROMESSORIA (PARCELA ${String(p.numero).padStart(2, '0')})`,
    vencimento: p.vencimento,
    pagamento: params.data,
    valor: p.valor,
    saldo: 0,
    observacao: 'LIQUIDADO'
  }))

  y = drawMarketUpCondicoes(doc, condicoes, y)

  const obs = `O TOMADOR DEVEDOR RECEBE QUITAÇÃO EFETIVA PARA AS PARCELAS DISCRIMINADAS NESTE TERMO DE RECEBIMENTO. FORMA DE PAGAMENTO ADOTADA: ${params.formaPagamento.toUpperCase()}.`
  
  drawMarketUpFooterAndSignatures(doc, company, params.clienteNome, obs, y, W)

  if (options?.output === 'blob') {
    return doc.output('blob')
  }
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
  cliente: {
    nome: string
    cpf: string | null
    telefone?: string | null
    endereco?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
  }
  contrato: { numero_contrato: string }
  empresaNome?: string
  empresaCnpj?: string | null
  empresaTelefone?: string | null
  empresaEmail?: string | null
  empresaEndereco?: string | null
  empresaCidade?: string | null
  empresaEstado?: string | null
  empresaCep?: string | null
}

export async function gerarReciboParcela(p: ReciboParcela, options?: { output?: 'save' | 'blob' }): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 10

  const company = getCompanyDetails(p)
  const rcId = `${p.contrato.numero_contrato}-P${String(p.parcela.numero_parcela).padStart(2, '0')}`

  let y = drawMarketUpHeader(
    doc,
    'COMPROVANTE DE PAGAMENTO DE TÍTULO',
    `COMPROVANTE: ${rcId}`,
    'SRS M FACTORING',
    company,
    p.cliente,
    {
      criacao: p.parcela.data_vencimento,
      emissao: p.parcela.data_pagamento,
      vencimento: p.parcela.data_pagamento
    },
    M
  )

  const itens = [
    {
      ref: `PARC-N${String(p.parcela.numero_parcela).padStart(2, '0')}`,
      desc: `AMORTIZAÇÃO E PAGAMENTO DA PARCELA ${p.parcela.numero_parcela} DE ${p.parcela.total_parcelas} - CONTRATO ${p.contrato.numero_contrato}`,
      qtd: '1,000',
      valor: p.parcela.valor,
      total: p.parcela.valor
    }
  ]

  const acrescimos = (p.parcela.multa ?? 0) + (p.parcela.juros_mora ?? 0)
  if (acrescimos > 0) {
    itens.push({
      ref: 'ENCAR-ATR',
      desc: `ENCARGOS MORATÓRIOS APLICADOS (MULTA/JUROS) POR ATRASO DE ${p.parcela.dias_atraso ?? 0} DIAS`,
      qtd: '1,000',
      valor: acrescimos,
      total: acrescimos
    })
  }

  y = drawMarketUpItens(doc, itens, y)
  
  const totais = {
    itens: p.parcela.valor,
    desconto: 0,
    frete: 0,
    outros: acrescimos,
    total: p.parcela.valor_pago
  }

  y = drawMarketUpTotals(doc, totais, y)

  const condicoes = [
    {
      desc: `PROMESSORIA (PARCELA ${String(p.parcela.numero_parcela).padStart(2, '0')}/${String(p.parcela.total_parcelas).padStart(2, '0')})`,
      vencimento: p.parcela.data_vencimento,
      pagamento: p.parcela.data_pagamento,
      valor: p.parcela.valor_pago,
      saldo: p.parcela.saldo_devedor_parcela ?? 0,
      observacao: (p.parcela.saldo_devedor_parcela ?? 0) > 0.01 ? 'QUITAÇÃO PARCIAL' : 'LIQUIDADO'
    }
  ]

  y = drawMarketUpCondicoes(doc, condicoes, y)

  const statusText = (p.parcela.dias_atraso ?? 0) > 0 
    ? `PAGAMENTO RECEBIDO COM ATRASO DE ${p.parcela.dias_atraso} DIAS (ENCARGOS APLICADOS).` 
    : 'PAGAMENTO RECEBIDO DENTRO DO VENCIMENTO CONTRATUAL COM PLENA LIQUIDAÇÃO.'

  const obs = `${statusText} ESTATÍSTICA DO CRÉDITO: ${p.parcela.total_parcelas_pagas ?? p.parcela.numero_parcela} PARCELAS PAGAS · ${p.parcela.total_parcelas_restantes ?? 0} PARCELAS RESTANTES. SALDO DEVEDOR RESIDUAL DO CONTRATO: ${fmt(p.parcela.saldo_devedor_total ?? 0)}.`
  
  drawMarketUpFooterAndSignatures(doc, company, p.cliente.nome, obs, y, W)

  if (options?.output === 'blob') {
    return doc.output('blob')
  }
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
  cliente: {
    nome: string
    cpf: string | null
    telefone?: string | null
    endereco?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    cep?: string | null
  }
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
  empresaTelefone?: string | null
  empresaEmail?: string | null
  empresaEndereco?: string | null
  empresaCidade?: string | null
  empresaEstado?: string | null
  empresaCep?: string | null
}

export async function gerarQuitacaoPDF(params: QuitacaoParams, options?: { output?: 'save' | 'blob' }): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 10

  const company = getCompanyDetails(params)
  
  let y = drawMarketUpHeader(
    doc,
    'TERMO DE QUITAÇÃO INTEGRAL E LIQUIDAÇÃO',
    `LIQUIDAÇÃO: ${params.contrato.numero_contrato}`,
    'SRS M FACTORING',
    company,
    params.cliente,
    {
      criacao: params.contrato.data_liberacao || new Date().toISOString().split('T')[0],
      emissao: params.contrato.data_quitacao || new Date().toISOString().split('T')[0],
      vencimento: params.contrato.data_quitacao || new Date().toISOString().split('T')[0]
    },
    M
  )

  const totalPago = params.parcelas.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const totalJuros = Math.round(Math.max(0, totalPago - params.contrato.valor_principal) * 100) / 100

  const itens = [
    {
      ref: 'MÚTUO-PRINC',
      desc: `PRINCIPAL AMORTIZADO E DEVOLVIDO DO CONTRATO REFERENCIA ${params.contrato.numero_contrato}`,
      qtd: '1,000',
      valor: params.contrato.valor_principal,
      total: params.contrato.valor_principal
    },
    {
      ref: 'MÚTUO-JURO',
      desc: `TOTAL DE ENCARGOS FINANCEIROS E MORATÓRIOS AMORTIZADOS NESTE ACORDO`,
      qtd: '1,000',
      valor: totalJuros,
      total: totalJuros
    }
  ]

  y = drawMarketUpItens(doc, itens, y)
  
  const totais = {
    itens: params.contrato.valor_principal,
    desconto: 0,
    frete: 0,
    outros: totalJuros,
    total: totalPago
  }

  y = drawMarketUpTotals(doc, totais, y)

  const condicoes = params.parcelas.slice(0, 10).map(p => ({
    desc: `PROMESSORIA (PARCELA ${String(p.numero_parcela).padStart(2, '0')}/${String(params.contrato.prazo_meses).padStart(2, '0')})`,
    vencimento: p.data_vencimento,
    pagamento: p.data_pagamento || params.contrato.data_quitacao || '',
    valor: p.valor_pago ?? p.valor,
    saldo: 0,
    observacao: 'PAGO/LIQUIDADO'
  }))

  y = drawMarketUpCondicoes(doc, condicoes, y)

  const obs = `DECLARAMOS E CERTIFICAMOS QUE O TOMADOR DEVEDOR ADIMPLIU DE FORMA INTEGRAL E IRREVOGÁVEL TODOS OS VALORES DO MÚTUO REFERIDO. O CONTRATO ENCONTRA-SE 100% QUITADO E ARQUIVADO, NÃO RESTANDO SALDOS RESIDUAIS OU OBRIGAÇÕES DE QUALQUER NATUREZA ENTRE AS PARTES.`
  
  drawMarketUpFooterAndSignatures(doc, company, params.cliente.nome, obs, y, W)

  if (options?.output === 'blob') {
    return doc.output('blob')
  }
  doc.save(`quitacao-${params.contrato.numero_contrato}.pdf`)
}

// ── Assinatura Eletrônica & Comprovante de Autenticidade Digital ───────────

export interface AssinaturaEvidencia {
  signed_at: string
  ip: string
  user_agent: string
  selfie_url?: string
  doc_url?: string
  signature_base64?: string
  geolocation?: string
}

export async function gerarContratoComAssinaturaPDF(
  params: ContratoParams & { assinatura: AssinaturaEvidencia },
  options?: { output?: 'save' | 'blob' }
): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 10

  const company = getCompanyDetails(params)
  
  // ── PÁGINA 1: O CONTRATO ORIGINAL ──
  let y = drawMarketUpHeader(
    doc,
    'CONTRATO DE EMPRÉSTIMO COM GARANTIAS',
    `CONTRATO: ${params.contrato.numero_contrato}`,
    'SRS M FACTORING',
    company,
    params.cliente,
    {
      criacao: params.contrato.data_liberacao || new Date().toISOString().split('T')[0],
      emissao: new Date().toISOString().split('T')[0],
      vencimento: params.parcelas[0]?.data_vencimento || new Date().toISOString().split('T')[0]
    },
    M
  )

  const itens = [
    {
      ref: 'MÚTUO-PRIN',
      desc: `PRINCIPAL LIBERADO REFERENTE AO CONTRATO ${params.contrato.numero_contrato}`,
      qtd: '1,000',
      valor: params.contrato.valor_principal,
      total: params.contrato.valor_principal
    },
    {
      ref: 'MÚTUO-JURM',
      desc: `ENCARGOS FINANCEIROS SOBRE O MÚTUO PACTUADO (${params.contrato.taxa_juros}% A.M.)`,
      qtd: '1,000',
      valor: params.contrato.total_juros,
      total: params.contrato.total_juros
    }
  ]

  y = drawMarketUpItens(doc, itens, y)
  
  const totais = {
    itens: params.contrato.valor_principal,
    desconto: 0,
    frete: 0,
    outros: params.contrato.total_juros,
    total: params.contrato.total_pagar
  }

  y = drawMarketUpTotals(doc, totais, y)

  const condicoes = params.parcelas.slice(0, 10).map(p => ({
    desc: `PROMESSORIA (PARCELA ${String(p.numero_parcela).padStart(2, '0')}/${String(params.contrato.prazo_meses).padStart(2, '0')})`,
    vencimento: p.data_vencimento,
    pagamento: '',
    valor: p.valor,
    saldo: p.valor,
    observacao: 'EM ABERTO'
  }))

  y = drawMarketUpCondicoes(doc, condicoes, y)

  const obsText = params.contrato.observacoes ?? ''
  const matchMora = obsText.match(/\[Mora:\s*([\d.]+)%\s*ao\s*dia\]/)
  const jurosMoraDiario = matchMora ? parseFloat(matchMora[1]) : 0.033
  const obsLimpa = obsText.replace(/\[Mora:\s*[\d.]+%\s*ao\s*dia\]/, '').trim()

  const obs = `GARANTIAS APRESENTADAS: ${params.contrato.garantias || 'NÃO ESPECIFICADAS'}. JUROS DE MORA POR ATRASO PACTUADO: ${jurosMoraDiario}% AO DIA. OBSERVACÕES GERAIS: ${obsLimpa || 'SEM OBSERVACÕES ADICIONAIS'}. ESTE CONTRATO SERVE COMO TÍTULO EXECUTIVO EXTRAJUDICIAL CONFORME LEGISLAÇÃO VIGENTE.`
  
  drawMarketUpFooterAndSignatures(doc, company, params.cliente.nome, obs, y, W, params.assinatura.signature_base64)


  // ── PÁGINA 2: COMPROVANTE DE AUTENTICIDADE DIGITAL ──
  doc.addPage()
  
  // Page Border Box
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.25)
  doc.rect(10, 10, 190, 277)
  
  // Header
  doc.setFillColor(240, 240, 240)
  doc.rect(10, 10, 190, 15, 'F')
  doc.rect(10, 10, 190, 15)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text('COMPROVANTE DE ASSINATURA ELETRÔNICA & AUTENTICIDADE DIGITAL', 15, 19)
  
  // Contrato Info Row
  doc.rect(10, 25, 190, 12)
  doc.line(75, 25, 75, 37)
  doc.line(135, 25, 135, 37)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Identificação do Contrato', 12, 28.5)
  doc.text('Nome do Tomador / Devedor', 77, 28.5)
  doc.text('CPF do Tomador', 137, 28.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(params.contrato.numero_contrato, 12, 33)
  doc.text(params.cliente.nome.toUpperCase(), 77, 33)
  doc.text(fmtCpf(params.cliente.cpf), 137, 33)
  
  // Signature Metadata Box
  doc.rect(10, 37, 190, 20)
  doc.line(100, 37, 100, 57)
  doc.line(10, 47, 200, 47)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text('Data/Hora de Assinatura (Brasília)', 12, 40.5)
  doc.text('IP do Dispositivo', 102, 40.5)
  doc.text('Navegador / User Agent', 12, 50.5)
  doc.text('Geolocalização / Coordenadas', 102, 50.5)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(fmtData(params.assinatura.signed_at.split('T')[0]) + ' ' + (params.assinatura.signed_at.split('T')[1] ? params.assinatura.signed_at.split('T')[1].substring(0, 8) : ''), 12, 44.5)
  doc.text(params.assinatura.ip || 'Não detectado', 102, 44.5)
  
  const uaLines = doc.splitTextToSize(params.assinatura.user_agent || 'Não detectado', 84)
  doc.text(uaLines, 12, 53.5)
  doc.text(params.assinatura.geolocation || 'Não fornecida pelo dispositivo', 102, 54.5)
  
  // Section: Evidências Visuais
  drawSectionHeaderBox(doc, 'EVIDÊNCIAS DE IDENTIFICAÇÃO E COMPROVAÇÃO DE ESTATUTO', 10, 62, 190)
  
  // 1. Selfie Box (Foto de Rosto)
  doc.rect(10, 62, 90, 95)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(120, 120, 120)
  doc.text('FOTO DO ROSTO (SELFIE)', 15, 66.5)
  
  // 2. Documento Box
  doc.rect(100, 62, 100, 95)
  doc.text('DOCUMENTO DE IDENTIDADE (COMPROVANTE)', 105, 66.5)
  
  // Carregar e desenhar Selfie e Documento
  let selfieLoaded = false
  let docLoaded = false
  
  if (params.assinatura.selfie_url) {
    const selfieBase64 = await loadLogo(params.assinatura.selfie_url)
    if (selfieBase64) {
      try {
        doc.addImage(selfieBase64, 'JPEG', 15, 70, 80, 80)
        selfieLoaded = true
      } catch (err) {
        console.error('Erro ao renderizar selfie no PDF:', err)
      }
    }
  }
  
  if (params.assinatura.doc_url) {
    const docBase64 = await loadLogo(params.assinatura.doc_url)
    if (docBase64) {
      try {
        doc.addImage(docBase64, 'JPEG', 105, 70, 90, 80)
        docLoaded = true
      } catch (err) {
        console.error('Erro ao renderizar documento no PDF:', err)
      }
    }
  }
  
  if (!selfieLoaded) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('[Selfie do rosto não disponível]', 55, 110, { align: 'center' })
  }
  if (!docLoaded) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('[Foto do documento não disponível]', 150, 110, { align: 'center' })
  }
  
  // Section: Assinatura Manuscrita
  drawSectionHeaderBox(doc, 'ASSINATURA DIGITAL DO TOMADOR', 10, 162, 190)
  
  doc.rect(10, 162, 190, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(120, 120, 120)
  doc.text('RUBRICA / ASSINATURA DESENHADA DIGITALMENTE', 15, 166.5)
  
  let signatureLoaded = false
  if (params.assinatura.signature_base64) {
    try {
      doc.addImage(params.assinatura.signature_base64, 'PNG', 35, 170, 140, 36)
      signatureLoaded = true
    } catch (err) {
      console.error('Erro ao renderizar assinatura manuscrita no PDF:', err)
    }
  }
  
  if (!signatureLoaded) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('[Assinatura manuscrita digital não disponível]', 105, 190, { align: 'center' })
  }
  
  // Legal Compliance Text Box
  drawSectionHeaderBox(doc, 'VALIDADE OPERACIONAL E RESPALDO OPERATIVO', 10, 217, 190)
  
  const complianceText = 'DECLARAMOS PARA TODOS OS FINS DE DIREITO QUE A ASSINATURA ELETRÔNICA E OS DADOS OPERACIONAIS ACIMA COLETADOS CONSTITUEM MANIFESTAÇÃO DE VONTADE INEQUÍVOCA E PERFEITA, TENDO A PARTE CONCORDADO EXPLICITAMENTE EM REALIZAR A ASSINATURA ELETRÔNICA DO CONTRATO POR ESTE MEIO, DANDO INTEGRAL VALIDADE E RECONHECIMENTO AO TÍTULO FINANCEIRO EXECUTIVO GERADO NESTE MEIO, NOS TERMOS DO ARTIGO 10, § 2º DA MEDIDA PROVISÓRIA Nº 2.200-2/2001 E DO CÓDIGO CIVIL BRASILEIRO. ESTE REGISTRO FICA VINCULADO E A ANEXO AO CONTRATO ORIGINAL PARA PLENA AUDITORIA E APRESENTAÇÃO OPERACIONAL.'
  
  const compLines = doc.splitTextToSize(complianceText, 182) as string[]
  const compH = compLines.length * 4 + 4
  doc.rect(10, 217, 190, compH)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text(compLines, 12, 222)
  
  // Signatures of Auditory and Verification
  const sw = 75
  const sigY = 217 + compH + 10
  
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.line(20, sigY + 12, 20 + sw, sigY + 12)
  doc.line(W - 20 - sw, sigY + 12, W - 20, sigY + 12)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text('EVIDÊNCIA CRIPTOGRÁFICA REGISTRADA', 20 + sw / 2, sigY + 16, { align: 'center' })
  doc.text(params.cliente.nome.toUpperCase(), W - 20 - sw / 2, sigY + 16, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  doc.text('SISTEMA AUTOMÁTICO DE VERIFICAÇÃO', 20 + sw / 2, sigY + 19.5, { align: 'center' })
  doc.text(`TOMADOR / ASSINANTE — CPF: ${fmtCpf(params.cliente.cpf)}`, W - 20 - sw / 2, sigY + 19.5, { align: 'center' })
  
  // Bottom Watermark
  doc.setFontSize(6.5)
  doc.setTextColor(180, 180, 180)
  doc.text('CERTIFICADO DE ASSINATURA DIGITAL E INTEGRIDADE OPERACIONAL SRS M FACTORING', W / 2, 282, { align: 'center' })

  // ── PÁGINA 3: AVALIAÇÃO DE CRÉDITO E ANÁLISE DE RISCO (BACK-OFFICE) ──
  // Somente se houver dados da Assertiva para resguardo
  const cli = params.cliente as any
  if (cli && (cli.assertiva_consultado_em || cli.score_assertiva != null)) {
    doc.addPage()
    // Page Border Box
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.25)
    doc.rect(10, 10, 190, 277)
    
    // Header
    doc.setFillColor(240, 240, 240)
    doc.rect(10, 10, 190, 15, 'F')
    doc.rect(10, 10, 190, 15)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text('ANEXO: FICHA DE ANÁLISE DE CRÉDITO E RISCO OPERACIONAL', 15, 19)
    
    // Description text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text('Dados de consulta cadastral e restrições financeiras vinculadas ao CPF/CNPJ do tomador.', 12, 30)
    
    // Score & Risk Table
    doc.rect(10, 34, 190, 25)
    doc.line(70, 34, 70, 59)
    doc.line(130, 34, 130, 59)
    doc.line(10, 46.5, 200, 46.5)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Score Assertiva', 12, 38)
    doc.text('Score Interno', 72, 38)
    doc.text('Faixa de Risco', 132, 38)
    doc.text('Pessoa Politicamente Exposta (PEP)', 12, 50.5)
    doc.text('Provável Óbito', 72, 50.5)
    doc.text('Data de Consulta', 132, 50.5)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(String(cli.score_assertiva ?? 'N/A'), 12, 43)
    doc.text(String(cli.score_interno ?? '50'), 72, 43)
    doc.text(String(cli.faixa_risco_assertiva || 'Risco Não Avaliado'), 132, 43)
    doc.text(cli.pep_assertiva ? 'SIM' : 'NÃO', 12, 55.5)
    doc.text(cli.indicador_obito_assertiva ? 'SIM (CRÍTICO)' : 'NÃO', 72, 55.5)
    doc.text(cli.assertiva_consultado_em ? fmtData(cli.assertiva_consultado_em.split('T')[0]) : 'Não consultado', 132, 55.5)
    
    // Debts & Protestos Section
    drawSectionHeaderBox(doc, 'RESTRIÇÕES FINANCEIRAS COLETADAS (ASSERTIVA)', 10, 66, 190)
    
    doc.rect(10, 66, 190, 45)
    doc.line(10, 81, 200, 81)
    doc.line(10, 96, 200, 96)
    doc.line(75, 66, 75, 111)
    doc.line(135, 66, 135, 111)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text('Quantidade de Negativações', 12, 70.5)
    doc.text('Valor Total Negativado', 77, 70.5)
    doc.text('Quantidade de Protestos', 137, 70.5)
    
    doc.text('Valor Total Protestado', 12, 85.5)
    doc.text('Ações Judiciais', 77, 85.5)
    doc.text('Valor Total em Ações', 137, 85.5)
    
    doc.text('Cheques Sem Fundo (CCF)', 12, 100.5)
    doc.text('Total Consolidado de Restrições', 77, 100.5)
    doc.text('Valor Consolidado das Restrições', 137, 100.5)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text(String(cli.total_negativacoes_assertiva ?? 0), 12, 76.5)
    doc.text(fmt(cli.valor_total_negativacoes_assertiva ?? 0), 77, 76.5)
    doc.text(String(cli.total_protestos_assertiva ?? 0), 137, 76.5)
    
    doc.text(fmt(cli.valor_total_protestos_assertiva ?? 0), 12, 91.5)
    doc.text(String(cli.total_acoes_judiciais_assertiva ?? 0), 77, 91.5)
    doc.text(fmt(cli.valor_total_acoes_assertiva ?? 0), 137, 91.5)
    
    doc.text(String(cli.total_ccf_assertiva ?? 0), 12, 106.5)
    doc.text(String(cli.total_dividas_assertiva ?? 0), 77, 106.5)
    doc.text(fmt(cli.valor_total_dividas_assertiva ?? 0), 137, 106.5)

    // Detailed lists of negative items if they exist
    let currentY = 118
    const r = cli.dados_assertiva as any
    if (r && (r.negativacoes?.length || r.protestos?.length || r.acoes_judiciais?.length)) {
      drawSectionHeaderBox(doc, 'DETALHAMENTO DE DÉBITOS E ANOTAÇÕES', 10, currentY, 190)
      currentY += 8
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      
      let linesPrinted = 0
      const limitLines = 10
      
      if (r.negativacoes?.length) {
        doc.setFont('helvetica', 'bold')
        doc.text('NEGATIVACÕES / DÉBITOS ATIVOS:', 12, currentY)
        doc.setFont('helvetica', 'normal')
        currentY += 4
        for (const n of r.negativacoes) {
          if (linesPrinted >= limitLines) break
          doc.text(`* Credor: ${n.credor} - Valor: ${fmt(n.valor)} - Data: ${n.data ? fmtData(n.data) : 'N/A'}`, 14, currentY)
          currentY += 3.5
          linesPrinted++
        }
      }
      
      if (r.protestos?.length && linesPrinted < limitLines) {
        doc.setFont('helvetica', 'bold')
        if (linesPrinted > 0) currentY += 2
        doc.text('PROTESTOS REGISTRADOS:', 12, currentY)
        doc.setFont('helvetica', 'normal')
        currentY += 4
        for (const p of r.protestos) {
          if (linesPrinted >= limitLines) break
          doc.text(`* Cartório: ${p.cartorio} - Valor: ${fmt(p.valor)} - Data: ${p.data ? fmtData(p.data) : 'N/A'}`, 14, currentY)
          currentY += 3.5
          linesPrinted++
        }
      }
      
      if (r.acoes_judiciais?.length && linesPrinted < limitLines) {
        doc.setFont('helvetica', 'bold')
        if (linesPrinted > 0) currentY += 2
        doc.text('AÇÕES JUDICIAIS ATIVAS:', 12, currentY)
        doc.setFont('helvetica', 'normal')
        currentY += 4
        for (const a of r.acoes_judiciais) {
          if (linesPrinted >= limitLines) break
          doc.text(`* Vara/Fórum: ${a.vara || 'N/A'} / ${a.tribunal || 'N/A'} - Valor: ${fmt(a.valor)} - Tipo: ${a.tipo || 'N/A'}`, 14, currentY)
          currentY += 3.5
          linesPrinted++
        }
      }
      
      if (linesPrinted >= limitLines) {
        doc.setFont('helvetica', 'italic')
        doc.text('[...] Histórico resumido devido ao limite de linhas do anexo.', 12, currentY)
      }
    }
    
    // Footer watermark
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(180, 180, 180)
    doc.text('ANEXO DE RESGUARDO OPERACIONAL — CONFIDENCIAL E EXCLUSIVO DO CREDOR SRS M FACTORING', W / 2, 282, { align: 'center' })
  }

  if (options?.output === 'blob') {
    return doc.output('blob')
  }
  doc.save(`contrato-assinado-${params.contrato.numero_contrato}.pdf`)
}

