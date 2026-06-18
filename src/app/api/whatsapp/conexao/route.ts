import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { acao, empresa_id } = body as { acao: 'status' | 'conectar' | 'desconectar'; empresa_id: string }

    if (!acao || !empresa_id) {
      return NextResponse.json({ erro: 'Ação e Empresa ID são obrigatórios.' }, { status: 400 })
    }

    // Valida que o usuário tem acesso à empresa
    const { data: access } = await supabase
      .from('usuario_empresa')
      .select('papel')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresa_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!access) {
      return NextResponse.json({ erro: 'Acesso negado para esta empresa.' }, { status: 403 })
    }

    // Carrega credenciais do WhatsApp do banco de dados
    const { data: config, error: configError } = await supabase
      .from('config_whatsapp')
      .select('*')
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (configError) {
      return NextResponse.json({ erro: 'Erro ao carregar configurações de WhatsApp.' }, { status: 500 })
    }

    if (!config || !config.api_url || !config.api_key || !config.instance_name) {
      return NextResponse.json({ status: 'nao_configurado', erro: 'WhatsApp não está configurado para esta empresa.' })
    }

    const { api_url: apiUrl, api_key: apiKey, instance_name: instanceName } = config

    // ─── AÇÃO: STATUS ──────────────────────────────────────────────────────────
    if (acao === 'status') {
      try {
        const stateRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: { apikey: apiKey },
          cache: 'no-store',
        })

        if (stateRes.status === 404) {
          // Instância não existe no servidor Evolution, vamos criá-la!
          const createRes = await fetch(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: apiKey,
            },
            body: JSON.stringify({
              instanceName: instanceName,
              integration: 'WHATSAPP-BAILEYS',
              qrcode: true,
            }),
          })

          if (!createRes.ok) {
            const createErr = await createRes.text()
            return NextResponse.json({ status: 'erro', erro: `Falha ao criar instância: ${createErr}` })
          }

          // Instância criada, retorna estado fechado (pronto para ler QR code)
          return NextResponse.json({ status: 'desconectado', state: 'close' })
        }

        if (!stateRes.ok) {
          const stateErr = await stateRes.text()
          return NextResponse.json({ status: 'erro', erro: `Erro ao obter status da Evolution: ${stateErr}` })
        }

        const stateData = await stateRes.json()
        const state = stateData.instance?.state || stateData.state || 'close'

        // Mapeamento amigável de status
        const friendlyStatus = state === 'open' ? 'conectado' : state === 'connecting' ? 'conectando' : 'desconectado'
        
        // Atualiza status local no Supabase de forma otimista/silenciosa
        await supabase
          .from('config_whatsapp')
          .update({ status: friendlyStatus, updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ status: friendlyStatus, state })
      } catch (err: any) {
        return NextResponse.json({ status: 'erro', erro: `Falha ao conectar no servidor Evolution: ${err.message}` })
      }
    }

    // ─── AÇÃO: CONECTAR (Obter QR Code) ─────────────────────────────────────────
    if (acao === 'conectar') {
      try {
        let connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: { apikey: apiKey },
          cache: 'no-store',
        })

        // Se a instância não existir (404), vamos criá-la e tentar conectar novamente
        if (connectRes.status === 404) {
          const createRes = await fetch(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: apiKey,
            },
            body: JSON.stringify({
              instanceName: instanceName,
              integration: 'WHATSAPP-BAILEYS',
              qrcode: true,
            }),
          })

          if (!createRes.ok) {
            const createErr = await createRes.text()
            return NextResponse.json({ erro: `Falha ao criar instância: ${createErr}` }, { status: 400 })
          }

          // Tenta conectar novamente após criar a instância
          connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { apikey: apiKey },
            cache: 'no-store',
          })
        }

        if (!connectRes.ok) {
          const connectErr = await connectRes.text()
          return NextResponse.json({ erro: `Falha ao gerar QR Code: ${connectErr}` }, { status: 400 })
        }

        let connectData = await connectRes.json()
        
        // Se já estiver conectando, a API pode não retornar o QR code. Forçamos logout para resetar.
        if (!connectData.base64 && !connectData.code && !connectData.qrcode?.base64 && !connectData.qrcode?.code) {
          console.log('[WhatsApp API] Instância parece presa sem QR Code. Tentando logout para resetar...')
          await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: { apikey: apiKey },
          })
          
          // Tenta pegar o QR code mais uma vez
          connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { apikey: apiKey },
            cache: 'no-store',
          })
          
          if (connectRes.ok) {
            connectData = await connectRes.json()
          }
        }
        
        // A Evolution API retorna o QR Code em connectData.base64 ou connectData.code,
        // ou às vezes encapsulado em connectData.qrcode.base64
        return NextResponse.json(connectData)
      } catch (err: any) {
        return NextResponse.json({ erro: `Erro ao requisitar QR Code: ${err.message}` }, { status: 500 })
      }
    }

    // ─── AÇÃO: DESCONECTAR (Logout) ─────────────────────────────────────────────
    if (acao === 'desconectar') {
      try {
        const logoutRes = await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: apiKey },
        })

        if (!logoutRes.ok) {
          const logoutErr = await logoutRes.text()
          return NextResponse.json({ erro: `Falha ao desconectar instância: ${logoutErr}` }, { status: 400 })
        }

        // Atualiza status no banco de dados
        await supabase
          .from('config_whatsapp')
          .update({ status: 'desconectado', updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ sucesso: true })
      } catch (err: any) {
        return NextResponse.json({ erro: `Erro ao desconectar instância: ${err.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (err: any) {
    console.error('[WhatsApp API Conexao] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
