import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarContratoComAssinaturaPDF } from '@/lib/utils/documentos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { selfie, documento, assinatura, geolocation } = body

    if (!selfie || !documento || !assinatura) {
      return NextResponse.json(
        { erro: 'Todos os campos de identificação (Selfie, Documento e Assinatura) são obrigatórios.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Fetch Loan Details
    const { data: emprestimo, error: empError } = await supabase
      .from('emprestimos')
      .select('*')
      .eq('id', id)
      .single()

    if (empError || !emprestimo) {
      return NextResponse.json({ erro: 'Contrato não localizado.' }, { status: 404 })
    }

    // 2. Fetch Customer Details
    const { data: cliente, error: cliError } = await supabase
      .from('clientes_factoring')
      .select('*')
      .eq('id', emprestimo.cliente_id)
      .single()

    if (cliError || !cliente) {
      return NextResponse.json({ erro: 'Cliente associado ao contrato não localizado.' }, { status: 404 })
    }

    // 3. Fetch Installments List
    const { data: parcelas, error: parcError } = await supabase
      .from('parcelas_emprestimo')
      .select('*')
      .eq('emprestimo_id', id)
      .order('numero_parcela', { ascending: true })

    if (parcError || !parcelas) {
      return NextResponse.json({ erro: 'Parcelas do contrato não localizadas.' }, { status: 500 })
    }

    // 4. Capture Request Metadata
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Dispositivo Desconhecido'
    const signedAt = new Date().toISOString()

    // 5. Convert base64 data to Buffers
    const selfieBuffer = Buffer.from(selfie.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const docBuffer = Buffer.from(documento.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const sigBuffer = Buffer.from(assinatura.replace(/^data:image\/\w+;base64,/, ''), 'base64')

    // 6. Upload Evidence to Supabase Storage
    const selfiePath = `signatures/${id}/selfie_${Date.now()}.jpg`
    const docPath = `signatures/${id}/documento_${Date.now()}.jpg`
    const sigPath = `signatures/${id}/assinatura_${Date.now()}.png`

    const [selfieUpload, docUpload, sigUpload] = await Promise.all([
      supabase.storage.from('documentos-clientes').upload(selfiePath, selfieBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(docPath, docBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(sigPath, sigBuffer, { contentType: 'image/png', upsert: true }),
    ])

    if (selfieUpload.error || docUpload.error || sigUpload.error) {
      console.error('Erro no upload de evidências:', { selfie: selfieUpload.error, doc: docUpload.error, sig: sigUpload.error })
      return NextResponse.json({ erro: 'Falha ao salvar arquivos de evidências no armazenamento de segurança.' }, { status: 500 })
    }

    // 7. Retrieve Public URLs
    const selfieUrl = supabase.storage.from('documentos-clientes').getPublicUrl(selfiePath).data.publicUrl
    const docUrl = supabase.storage.from('documentos-clientes').getPublicUrl(docPath).data.publicUrl
    const sigUrl = supabase.storage.from('documentos-clientes').getPublicUrl(sigPath).data.publicUrl

    // 8. Generate Signed PDF Contract combining original pages and electronic signature page
    const assinaturaEvidencia = {
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
      selfie_url: selfieUrl,
      doc_url: docUrl,
      signature_base64: assinatura, // Base64 needed directly inside jsPDF.addImage
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

    const finalPdfUrl = supabase.storage.from('documentos-clientes').getPublicUrl(finalContractPath).data.publicUrl

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
      })
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar contrato com assinatura:', updateError)
      return NextResponse.json({ erro: 'Falha ao registrar a assinatura digital no banco de dados.' }, { status: 500 })
    }

    // 10.5 Update Client Record Documents List
    const existingClientDocs = Array.isArray(cliente.documentos) ? cliente.documentos : []
    const updatedClientDocs = [
      ...existingClientDocs.filter((d: any) => d.path !== finalContractPath && d.path !== selfiePath && d.path !== docPath),
      {
        id: `doc_selfie_${id}`,
        categoria: 'foto',
        label: `Selfie de Confirmação (Contrato ${emprestimo.numero_contrato})`,
        nome_original: `selfie_${id}.jpg`,
        path: selfiePath,
        url: selfieUrl,
        tipo_mime: 'image/jpeg',
        tamanho: selfieBuffer.length,
        criado_em: signedAt,
      },
      {
        id: `doc_idcard_${id}`,
        categoria: 'rg_cnh',
        label: `Documento de Identidade (Contrato ${emprestimo.numero_contrato})`,
        nome_original: `documento_${id}.jpg`,
        path: docPath,
        url: docUrl,
        tipo_mime: 'image/jpeg',
        tamanho: docBuffer.length,
        criado_em: signedAt,
      },
      {
        id: `doc_contract_${id}`,
        categoria: 'contrato_assinado',
        label: `Contrato Assinado - ${emprestimo.numero_contrato}`,
        nome_original: `contrato_assinado_${emprestimo.numero_contrato}.pdf`,
        path: finalContractPath,
        url: finalPdfUrl,
        tipo_mime: 'application/pdf',
        tamanho: pdfBuffer.length,
        criado_em: signedAt,
      }
    ]

    const { error: clientUpdateError } = await supabase
      .from('clientes_factoring')
      .update({
        documentos: updatedClientDocs,
      })
      .eq('id', emprestimo.cliente_id)

    if (clientUpdateError) {
      console.error('Erro ao atualizar cliente com documentos da assinatura:', clientUpdateError)
    }

    // 11. Enqueue WhatsApp Notification
    try {
      const msgTexto = `Parabéns, ${cliente.nome}! O seu contrato de empréstimo ${emprestimo.numero_contrato} foi assinado digitalmente com sucesso!\n\nVocê pode baixar a sua via oficial com o registro de autenticidade (selfie, documento e assinatura) no link abaixo:\n\n${finalPdfUrl}`
      
      const { error: notifError } = await supabase.from('notificacoes_log').insert({
        empresa_id: emprestimo.empresa_id,
        canal: 'whatsapp',
        destinatario: cliente.telefone,
        assunto: `Contrato ${emprestimo.numero_contrato} Assinado Digitalmente`,
        mensagem: msgTexto,
        referencia_tipo: 'emprestimo',
        referencia_id: id,
        status: 'pendente',
      })

      if (notifError) console.error('Erro ao enfileirar notificação de assinatura:', notifError.message)
    } catch (notifErr) {
      console.error('Erro ao criar notificação:', notifErr)
    }

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
