import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarContratoComAssinaturaPDF } from '@/lib/utils/documentos'
import { enviarTemplate } from '@/lib/utils/whatsapp'
import { simularAssinaturaGovBr } from '@/lib/utils/govbr'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { token, selfie, documento, documento_frente, documento_verso, geolocation } = body

    const docFrente = documento_frente || documento
    const docVerso = documento_verso || documento

    if (!selfie || !docFrente) {
      return NextResponse.json(
        { erro: 'As evidências de identificação (Selfie e Documento Frente/Verso) são obrigatórias antes da assinatura GOV.BR.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Carregar Empréstimo e Parcelas
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

    // 2. Carregar Cliente
    const { data: cliente, error: cliError } = await supabase
      .from('clientes_factoring')
      .select('*')
      .eq('id', emprestimo.cliente_id)
      .single()

    if (cliError || !cliente) {
      return NextResponse.json({ erro: 'Cliente associado ao contrato não localizado.' }, { status: 404 })
    }

    // 3. Metadados do Acesso
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Dispositivo Desconhecido'
    const signedAt = new Date().toISOString()

    // 4. Processar Assinatura GOV.BR (Oficial / Simulação)
    const govBrResult = simularAssinaturaGovBr(cliente.nome, cliente.cpf)

    // 5. Upload de Evidências (Selfie e RG) para o Supabase Storage
    const selfieBuffer = Buffer.from(selfie.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const docFrenteBuffer = Buffer.from(docFrente.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const docVersoBuffer = Buffer.from((docVerso || docFrente).replace(/^data:image\/\w+;base64,/, ''), 'base64')

    const ts = Date.now()
    const selfiePath = `signatures/${id}/selfie_${ts}.jpg`
    const docFrentePath = `signatures/${id}/documento_frente_${ts}.jpg`
    const docVersoPath = `signatures/${id}/documento_verso_${ts}.jpg`

    const [selfieUpload, docFrenteUpload, docVersoUpload, configFact] = await Promise.all([
      supabase.storage.from('documentos-clientes').upload(selfiePath, selfieBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(docFrentePath, docFrenteBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.storage.from('documentos-clientes').upload(docVersoPath, docVersoBuffer, { contentType: 'image/jpeg', upsert: true }),
      supabase.from('config_factoring').select('whatsapp_settings').eq('empresa_id', emprestimo.empresa_id).maybeSingle(),
    ])

    if (selfieUpload.error || docFrenteUpload.error || docVersoUpload.error) {
      console.error('Erro no upload de evidências GOV.BR:', { selfie: selfieUpload.error, frente: docFrenteUpload.error, verso: docVersoUpload.error })
      return NextResponse.json({ erro: 'Falha ao salvar arquivos de evidências no armazenamento.' }, { status: 500 })
    }

    const YEAR = 31_536_000
    const [selfieSign, docFrenteSign, docVersoSign] = await Promise.all([
      supabase.storage.from('documentos-clientes').createSignedUrl(selfiePath, YEAR),
      supabase.storage.from('documentos-clientes').createSignedUrl(docFrentePath, YEAR),
      supabase.storage.from('documentos-clientes').createSignedUrl(docVersoPath, YEAR),
    ])
    const selfieUrl = selfieSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(selfiePath).data.publicUrl
    const docFrenteUrl = docFrenteSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(docFrentePath).data.publicUrl
    const docVersoUrl = docVersoSign.data?.signedUrl ?? supabase.storage.from('documentos-clientes').getPublicUrl(docVersoPath).data.publicUrl

    // 6. Estrutura de Evidências da Assinatura GOV.BR
    const assinaturaEvidencia = {
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
      selfie_url: selfieUrl,
      doc_url: docFrenteUrl,
      doc_frente_url: docFrenteUrl,
      doc_verso_url: docVersoUrl,
      selfie_base64: selfie,
      doc_base64: docFrente,
      doc_frente_base64: docFrente,
      doc_verso_base64: docVerso,
      geolocation,
      provedor: 'GOV.BR',
      hash_govbr: govBrResult.hashAssinatura,
      nivel_conta_govbr: govBrResult.userInfo.nivelConta,
      cpf_govbr: govBrResult.userInfo.cpf,
    }

    // 7. Gerar PDF Final com Chancela GOV.BR
    const pdfBlob = await gerarContratoComAssinaturaPDF({
      contrato: emprestimo,
      cliente,
      parcelas,
      assinatura: assinaturaEvidencia,
    }, { output: 'blob' })

    if (!(pdfBlob instanceof Blob)) {
      return NextResponse.json({ erro: 'Falha ao gerar o PDF final assinado via GOV.BR.' }, { status: 500 })
    }

    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // 8. Salvar PDF no Storage
    const finalContractPath = `contratos/${id}/contrato_assinado_govbr_${emprestimo.numero_contrato}.pdf`
    const pdfUpload = await supabase.storage
      .from('documentos-clientes')
      .upload(finalContractPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (pdfUpload.error) {
      console.error('Erro no upload do contrato GOV.BR:', pdfUpload.error)
      return NextResponse.json({ erro: 'Falha ao salvar o PDF final do contrato assinado.' }, { status: 500 })
    }

    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from('documentos-clientes')
      .createSignedUrl(finalContractPath, 315_360_000)

    if (signedUrlError || !signedData?.signedUrl) {
      console.error('Erro ao gerar URL assinada do contrato GOV.BR:', signedUrlError)
      return NextResponse.json({ erro: 'Falha ao gerar link de acesso ao contrato.' }, { status: 500 })
    }

    const finalPdfUrl = signedData.signedUrl

    // 9. Atualizar Registro do Empréstimo
    const existingDocs = Array.isArray(emprestimo.documentos) ? emprestimo.documentos : []
    const updatedDocs = [
      ...existingDocs.filter((d: any) => d.tipo !== 'assinatura_digital'),
      {
        name: `Contrato Assinado (GOV.BR) - ${emprestimo.numero_contrato}.pdf`,
        url: finalPdfUrl,
        tipo: 'assinatura_digital',
        provedor: 'GOV.BR',
        metadata: {
          signed_at: signedAt,
          ip,
          user_agent: userAgent,
          selfie_url: selfieUrl,
          doc_frente_url: docFrenteUrl,
          doc_verso_url: docVersoUrl,
          geolocation: geolocation || 'Não fornecida',
          hash_govbr: govBrResult.hashAssinatura,
          nivel_conta_govbr: govBrResult.userInfo.nivelConta,
        },
      },
    ]

    const { error: updateError } = await supabase
      .from('emprestimos')
      .update({
        documentos: updatedDocs,
        observacoes: `${emprestimo.observacoes || ''}\n[Assinado Eletronicamente via GOV.BR (${govBrResult.userInfo.nivelConta}) IP: ${ip} em ${signedAt.split('T')[0]}]`.trim(),
        assinado_em: signedAt,
        assinado_ip: ip,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar banco de dados:', updateError)
      return NextResponse.json({ erro: 'Falha ao registrar assinatura no banco de dados.' }, { status: 500 })
    }

    // 10. Atualização do Cliente + Disparo WhatsApp em segundo plano
    void (async () => {
      try {
        const existingClientDocs = Array.isArray(cliente.documentos) ? cliente.documentos : []
        await supabase.from('clientes_factoring').update({
          documentos: [
            ...existingClientDocs.filter((d: any) => d.path !== finalContractPath && d.path !== selfiePath && d.path !== docFrentePath && d.path !== docVersoPath),
            { id: `doc_selfie_${id}`, categoria: 'foto', label: `Selfie (Contrato GOV.BR ${emprestimo.numero_contrato})`, nome_original: `selfie_${id}.jpg`, path: selfiePath, url: selfieUrl, tipo_mime: 'image/jpeg', tamanho: selfieBuffer.length, criado_em: signedAt },
            { id: `doc_idcard_frente_${id}`, categoria: 'rg_cnh', label: `Documento Frente (Contrato GOV.BR ${emprestimo.numero_contrato})`, nome_original: `documento_frente_${id}.jpg`, path: docFrentePath, url: docFrenteUrl, tipo_mime: 'image/jpeg', tamanho: docFrenteBuffer.length, criado_em: signedAt },
            { id: `doc_idcard_verso_${id}`, categoria: 'rg_cnh', label: `Documento Verso (Contrato GOV.BR ${emprestimo.numero_contrato})`, nome_original: `documento_verso_${id}.jpg`, path: docVersoPath, url: docVersoUrl, tipo_mime: 'image/jpeg', tamanho: docVersoBuffer.length, criado_em: signedAt },
            { id: `doc_contract_${id}`, categoria: 'contrato_assinado', label: `Contrato Assinado GOV.BR - ${emprestimo.numero_contrato}`, nome_original: `contrato_assinado_govbr_${emprestimo.numero_contrato}.pdf`, path: finalContractPath, url: finalPdfUrl, tipo_mime: 'application/pdf', tamanho: pdfBuffer.length, criado_em: signedAt },
          ],
        }).eq('id', emprestimo.cliente_id)
      } catch (err) {
        console.error('Erro ao atualizar documentos do cliente:', err)
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
          await supabase.from('notificacoes_log').insert({
            empresa_id: emprestimo.empresa_id,
            canal: 'whatsapp',
            destinatario: cliente.telefone,
            assunto: `Contrato ${emprestimo.numero_contrato} Assinado via GOV.BR`,
            mensagem: `Contrato ${emprestimo.numero_contrato} assinado via GOV.BR`,
            referencia_tipo: 'emprestimo',
            referencia_id: id,
            status: result.ok ? 'enviado' : 'erro',
            erro: result.ok ? null : (result.erro || 'Falha ao enviar template pós-assinatura GOV.BR.'),
            whatsapp_message_id: result.ok ? (result.messageId || null) : null,
            enviado_em: result.ok ? new Date().toISOString() : null,
          })
        }
      } catch (err) {
        console.error('Erro no envio de WhatsApp:', err)
      }
    })()

    return NextResponse.json({
      sucesso: true,
      url: finalPdfUrl,
      signed_at: signedAt,
      provedor: 'GOV.BR',
      hash_govbr: govBrResult.hashAssinatura,
    })
  } catch (err: any) {
    console.error('Erro na API de assinatura GOV.BR:', err)
    return NextResponse.json({ erro: 'Erro interno no servidor ao processar a assinatura GOV.BR.' }, { status: 500 })
  }
}
