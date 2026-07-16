import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarContratoComAssinaturaPDF } from '@/lib/utils/documentos'
import { enviarTemplate } from '@/lib/utils/whatsapp'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { token, selfie, documento, assinatura, geolocation } = body

    if (!selfie || !documento || !assinatura) {
      return NextResponse.json(
        { erro: 'Todos os campos de identificação (Selfie, Documento e Assinatura) são obrigatórios.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Fetch loan + installments in parallel (both only need `id`)
    const [
      { data: emprestimo, error: empError },
      { data: parcelas, error: parcError },
    ] = await Promise.all([
      supabase.from('emprestimos').select('*').eq('id', id).single(),
      supabase.from('parcelas_emprestimo').select('*').eq('emprestimo_id', id).order('numero_parcela', { ascending: true }),
    ])

    if (empError || !emprestimo) {
      return NextResponse.json({ erro: 'Contrato não localizado.' }, { status: 404 })
    }

    // Sem isso, qualquer pessoa com o UUID do empréstimo (não é segredo —
    // aparece em URLs internas do sistema) conseguiria assinar o contrato no
    // lugar do cliente de verdade, enviando selfie/documento/assinatura
    // forjados. O token só é conhecido por quem recebeu o link de assinatura.
    if (!token || token !== emprestimo.assinatura_token) {
      return NextResponse.json({ erro: 'Link de assinatura inválido ou expirado.' }, { status: 403 })
    }

    if (parcError || !parcelas) {
      return NextResponse.json({ erro: 'Parcelas do contrato não localizadas.' }, { status: 500 })
    }

    if (emprestimo.assinado_em) {
      return NextResponse.json({ erro: 'Este contrato já foi assinado anteriormente.' }, { status: 409 })
    }

    if (emprestimo.status === 'cancelado') {
      return NextResponse.json({ erro: 'Não é possível assinar um contrato cancelado.' }, { status: 409 })
    }

    // 2. Fetch customer (needs cliente_id from loan)
    const { data: cliente, error: cliError } = await supabase
      .from('clientes_factoring')
      .select('*')
      .eq('id', emprestimo.cliente_id)
      .single()

    if (cliError || !cliente) {
      return NextResponse.json({ erro: 'Cliente associado ao contrato não localizado.' }, { status: 404 })
    }

    // 4. Capture Request Metadata
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Dispositivo Desconhecido'
    const signedAt = new Date().toISOString()

    // 5. Convert base64 data to Buffers
    const selfieBuffer = Buffer.from(selfie.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const docBuffer = Buffer.from(documento.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const sigBuffer = Buffer.from(assinatura.replace(/^data:image\/\w+;base64,/, ''), 'base64')

    // 6. Upload evidence + prefetch WhatsApp config in parallel
    const ts = Date.now()
    const selfiePath = `signatures/${id}/selfie_${ts}.jpg`
    const docPath = `signatures/${id}/documento_${ts}.jpg`
    const sigPath = `signatures/${id}/assinatura_${ts}.png`

    const [selfieUpload, docUpload, sigUpload, configFact] = await Promise.all([
      supabase.storage.from('documentos-clientes').upload(selfiePath, selfieBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(docPath, docBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(sigPath, sigBuffer, { contentType: 'image/png', upsert: true }),
      supabase.from('config_factoring').select('whatsapp_settings').eq('empresa_id', emprestimo.empresa_id).maybeSingle(),
    ])

    if (selfieUpload.error || docUpload.error || sigUpload.error) {
      console.error('Erro no upload de evidências:', { selfie: selfieUpload.error, doc: docUpload.error, sig: sigUpload.error })
      return NextResponse.json({ erro: 'Falha ao salvar arquivos de evidências no armazenamento de segurança.' }, { status: 500 })
    }

    // 7. Signed URLs para evidências (1 ano — uso interno pelo admin)
    const YEAR = 31_536_000
    const [selfieSign, docSign, sigSign] = await Promise.all([
      supabase.storage.from('documentos-clientes').createSignedUrl(selfiePath, YEAR),
      supabase.storage.from('documentos-clientes').createSignedUrl(docPath, YEAR),
      supabase.storage.from('documentos-clientes').createSignedUrl(sigPath, YEAR),
    ])
    const selfieUrl = selfieSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(selfiePath).data.publicUrl
    const docUrl = docSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(docPath).data.publicUrl
    const sigUrl = sigSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(sigPath).data.publicUrl

    // 8. Generate PDF — pass base64 directly to skip re-downloading from storage
    const assinaturaEvidencia = {
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
      selfie_url: selfieUrl,
      doc_url: docUrl,
      selfie_base64: selfie,
      doc_base64: documento,
      signature_base64: assinatura,
      geolocation,
    }

    const pdfBlob = await gerarContratoComAssinaturaPDF({
      contrato: emprestimo,
      cliente,
      parcelas,
      assinatura: assinaturaEvidencia,
    }, { output: 'blob' })

    if (!(pdfBlob instanceof Blob)) {
      return NextResponse.json({ erro: 'Falha ao gerar o PDF final do contrato assinado.' }, { status: 500 })
    }

    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // 9. Upload Final Signed PDF Contract to Storage
    const finalContractPath = `contratos/${id}/contrato_assinado_${emprestimo.numero_contrato}.pdf`
    const pdfUpload = await supabase.storage
      .from('documentos-clientes')
      .upload(finalContractPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (pdfUpload.error) {
      console.error('Erro no upload do contrato assinado:', pdfUpload.error)
      return NextResponse.json({ erro: 'Falha ao salvar o PDF final assinado.' }, { status: 500 })
    }

    // URL assinada com validade de 10 anos — acessível sem autenticação (cliente recebe via WhatsApp)
    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from('documentos-clientes')
      .createSignedUrl(finalContractPath, 315_360_000)

    if (signedUrlError || !signedData?.signedUrl) {
      console.error('Erro ao gerar URL assinada do contrato:', signedUrlError)
      return NextResponse.json({ erro: 'Falha ao gerar link de acesso ao contrato.' }, { status: 500 })
    }

    const finalPdfUrl = signedData.signedUrl

    // 10. Update Loan Record Documents List
    const existingDocs = Array.isArray(emprestimo.documentos) ? emprestimo.documentos : []
    const updatedDocs = [
      ...existingDocs.filter((d: any) => d.tipo !== 'assinatura_digital'),
      {
        name: `Contrato Assinado - ${emprestimo.numero_contrato}.pdf`,
        url: finalPdfUrl,
        tipo: 'assinatura_digital',
        metadata: {
          signed_at: signedAt,
          ip,
          user_agent: userAgent,
          selfie_url: selfieUrl,
          doc_url: docUrl,
          geolocation: geolocation || 'Não fornecida',
        },
      },
    ]

    const { error: updateError } = await supabase
      .from('emprestimos')
      .update({
        documentos: updatedDocs,
        observacoes: `${emprestimo.observacoes || ''}\n[Assinado Digitalmente via IP: ${ip} em ${signedAt.split('T')[0]}]`.trim(),
        assinado_em: signedAt,
        assinado_ip: ip,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar contrato com assinatura:', updateError)
      return NextResponse.json({ erro: 'Falha ao registrar a assinatura digital no banco de dados.' }, { status: 500 })
    }

    // 10.5 + 11. Update client record + WhatsApp — fire-and-forget (don't block response)
    void (async () => {
      try {
        const existingClientDocs = Array.isArray(cliente.documentos) ? cliente.documentos : []
        await supabase.from('clientes_factoring').update({
          documentos: [
            ...existingClientDocs.filter((d: any) => d.path !== finalContractPath && d.path !== selfiePath && d.path !== docPath),
            { id: `doc_selfie_${id}`, categoria: 'foto', label: `Selfie de Confirmação (Contrato ${emprestimo.numero_contrato})`, nome_original: `selfie_${id}.jpg`, path: selfiePath, url: selfieUrl, tipo_mime: 'image/jpeg', tamanho: selfieBuffer.length, criado_em: signedAt },
            { id: `doc_idcard_${id}`, categoria: 'rg_cnh', label: `Documento de Identidade (Contrato ${emprestimo.numero_contrato})`, nome_original: `documento_${id}.jpg`, path: docPath, url: docUrl, tipo_mime: 'image/jpeg', tamanho: docBuffer.length, criado_em: signedAt },
            { id: `doc_contract_${id}`, categoria: 'contrato_assinado', label: `Contrato Assinado - ${emprestimo.numero_contrato}`, nome_original: `contrato_assinado_${emprestimo.numero_contrato}.pdf`, path: finalContractPath, url: finalPdfUrl, tipo_mime: 'application/pdf', tamanho: pdfBuffer.length, criado_em: signedAt },
          ],
        }).eq('id', emprestimo.cliente_id)
      } catch (err) {
        console.error('Erro ao atualizar cliente com documentos da assinatura:', err)
      }

      try {
        const wSettings = configFact.data?.whatsapp_settings as any
        const ativo = wSettings?.contrato_assinado?.ativo ?? true
        if (ativo && cliente.telefone) {
          const result = await enviarTemplate(
            cliente.telefone,
            'contrato_assinado',
            {
              nome: cliente.nome,
              numero_contrato: emprestimo.numero_contrato,
              link_contrato: finalPdfUrl,
            },
            emprestimo.empresa_id,
          )
          const msgLog = `Contrato ${emprestimo.numero_contrato} assinado — template srsm2_contrato_assinado`
          await supabase.from('notificacoes_log').insert({
            empresa_id: emprestimo.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Contrato ${emprestimo.numero_contrato} Assinado Digitalmente`,
            mensagem: msgLog,
            referencia_tipo: 'emprestimo',
            referencia_id: id,
            status: result.ok ? 'enviado' : 'erro',
            erro: result.ok ? null : (result.erro || 'Falha ao enviar template pós-assinatura.'),
            whatsapp_message_id: result.ok ? (result.messageId || null) : null,
            enviado_em: result.ok ? new Date().toISOString() : null,
          })
        }
      } catch (err) {
        console.error('Erro ao enviar notificação WhatsApp pós-assinatura:', err)
      }
    })()

    return NextResponse.json({
      sucesso: true,
      url: finalPdfUrl,
      signed_at: signedAt,
    })
  } catch (err: any) {
    console.error('Erro na API de assinatura:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor ao processar a assinatura.' }, { status: 500 })
  }
}
