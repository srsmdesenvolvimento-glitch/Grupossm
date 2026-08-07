import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tipo = searchParams.get('tipo') || 'fatura' // 'fatura' | 'comprovante' | 'pre_vencimento' | 'vencimento' | 'atraso'
    const nome = searchParams.get('nome') || 'CLIENTE SRS M FACTORING'
    const contrato = searchParams.get('contrato') || 'FAC-2026-0000'
    const parcela = searchParams.get('parcela') || '1/1'
    const vencimento = searchParams.get('vencimento') || new Date().toLocaleDateString('pt-BR')
    const valor = searchParams.get('valor') || 'R$ 0,00'
    const multa = searchParams.get('multa')
    const juros = searchParams.get('juros')
    const total = searchParams.get('total') || valor
    const diasAtraso = searchParams.get('dias_atraso')
    const pix = searchParams.get('pix') || 'Financeiro SRS M Factoring'
    const dataPagamento = searchParams.get('data_pagamento')
    const formaPagamento = searchParams.get('forma_pagamento')

    const isComprovante = tipo === 'comprovante' || tipo === 'pagamento_confirmado'
    const isAtraso = tipo === 'atraso' || (diasAtraso && parseInt(diasAtraso) > 0)

    const corHeader = isComprovante ? '#10B981' : isAtraso ? '#EF4444' : '#1E5AA8'
    const statusTag = isComprovante ? 'PAGO / CONFIRMADO' : isAtraso ? `EM ATRASO (${diasAtraso}d)` : 'FATURA A VENCER'
    const tituloCard = isComprovante ? 'COMPROVANTE DE RECEBIMENTO' : 'DEMONSTRATIVO DE FATURA'

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${corHeader}" />
          <stop offset="100%" stop-color="#0F2D54" />
        </linearGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.12"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="800" height="520" fill="#F8FAFC"/>

      <!-- Card Container -->
      <g filter="url(#shadow)">
        <rect x="40" y="30" width="720" height="460" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      </g>

      <!-- Header Banner -->
      <rect x="40" y="30" width="720" height="100" rx="20" fill="url(#headerGrad)"/>
      <rect x="40" y="110" width="720" height="20" fill="url(#headerGrad)"/> <!-- fill rounded corner gap -->

      <!-- Branding Text Header -->
      <text x="70" y="72" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="24" fill="#FFFFFF" letter-spacing="1">SRS M FACTORING</text>
      <text x="70" y="96" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="13" fill="#E2E8F0" opacity="0.9">${tituloCard}</text>

      <!-- Status Badge -->
      <rect x="560" y="60" width="170" height="36" rx="18" fill="#FFFFFF" opacity="0.95"/>
      <text x="645" y="83" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="11" fill="${corHeader}" text-anchor="middle">${statusTag}</text>

      <!-- Body Info Grid -->
      <!-- Line 1: Sacado / Cliente -->
      <text x="70" y="160" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" fill="#94A3B8" letter-spacing="0.5">CLIENTE / SACADO</text>
      <text x="70" y="184" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="16" fill="#1E293B">${nome.substring(0, 42).toUpperCase()}</text>

      <!-- Divider -->
      <line x1="70" y1="202" x2="730" y2="202" stroke="#F1F5F9" stroke-width="1.5"/>

      <!-- Grid Columns: Contrato & Parcela & Vencimento -->
      <text x="70" y="228" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" fill="#94A3B8">CONTRATO</text>
      <text x="70" y="250" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="15" fill="#334155">${contrato}</text>

      <text x="320" y="228" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" fill="#94A3B8">PARCELA</text>
      <text x="320" y="250" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="15" fill="#334155">${parcela}</text>

      <text x="540" y="228" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" fill="#94A3B8">${isComprovante ? 'DATA PAGAMENTO' : 'VENCIMENTO'}</text>
      <text x="540" y="250" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="15" fill="${isAtraso ? '#EF4444' : '#334155'}">${dataPagamento || vencimento}</text>

      <!-- Discriminativo de Valores Box -->
      <rect x="70" y="275" width="660" height="140" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>

      <!-- Items Discriminativo -->
      <text x="95" y="306" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="13" fill="#64748B">Valor da Parcela (Base)</text>
      <text x="635" y="306" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="13" fill="#1E293B" text-anchor="end">${valor}</text>

      ${multa ? `
      <text x="95" y="330" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="12" fill="#EF4444">Multa por Atraso (+)</text>
      <text x="635" y="330" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="#EF4444" text-anchor="end">${multa}</text>
      ` : ''}

      ${juros ? `
      <text x="95" y="352" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="12" fill="#EF4444">Juros Diários Acumulados (+)</text>
      <text x="635" y="352" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="#EF4444" text-anchor="end">${juros}</text>
      ` : ''}

      ${formaPagamento ? `
      <text x="95" y="340" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="12" fill="#10B981">Forma de Pagamento</text>
      <text x="635" y="340" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="#10B981" text-anchor="end">${formaPagamento.toUpperCase()}</text>
      ` : ''}

      <!-- Line Total -->
      <line x1="95" y1="368" x2="705" y2="368" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4"/>

      <text x="95" y="396" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="16" fill="#0F172A">${isComprovante ? 'TOTAL QUITADO:' : 'TOTAL A PAGAR:'}</text>
      <text x="635" y="396" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="${corHeader}" text-anchor="end">${total}</text>

      <!-- Footer Info -->
      <text x="70" y="445" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="11" fill="#475569">CHAVE PIX PARA REGULARIZAÇÃO:</text>
      <text x="70" y="465" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="13" fill="#1E5AA8">${pix.substring(0, 50)}</text>
      <text x="730" y="465" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="10" fill="#94A3B8" text-anchor="end">SRS M FACTORING CRÉDITO & SERVIÇOS LTDA</text>
    </svg>
    `.trim()

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err: any) {
    console.error('[Fatura Imagem API] Erro:', err)
    return new NextResponse('Erro ao gerar imagem', { status: 500 })
  }
}
