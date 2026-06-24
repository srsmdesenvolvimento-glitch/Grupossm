import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function evolutionError(err: any, ctx: string): string {
  if (err?.name === 'AbortError') {
    return `Timeout: Evolution API não respondeu em 15s. Verifique se o servidor está online. (${ctx})`
  }
  return `${ctx}: ${err?.message ?? 'Erro desconhecido'}`
}

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
    const baseHeaders = { apikey: apiKey }
    const jsonHeaders = { 'Content-Type': 'application/json', apikey: apiKey }

    // ─── AÇÃO: STATUS ──────────────────────────────────────────────────────────
    if (acao === 'status') {
      try {
        const stateRes = await fetchWithTimeout(`${apiUrl}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: baseHeaders,
          cache: 'no-store',
        })

        if (stateRes.status === 404) {
          const createRes = await fetchWithTimeout(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
          })

          if (!createRes.ok) {
            const err = await createRes.text()
            return NextResponse.json({ status: 'erro', erro: `Falha ao criar instância: ${err}` })
          }

          return NextResponse.json({ status: 'desconectado', state: 'close' })
        }

        if (!stateRes.ok) {
          const err = await stateRes.text()
          return NextResponse.json({ status: 'erro', erro: `Erro ao obter status da Evolution: ${err}` })
        }

        const stateData = await stateRes.json()
        const state = stateData.instance?.state || stateData.state || 'close'
        const friendlyStatus = state === 'open' ? 'conectado' : state === 'connecting' ? 'conectando' : 'desconectado'

        await supabase
          .from('config_whatsapp')
          .update({ status: friendlyStatus, updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ status: friendlyStatus, state })
      } catch (err: any) {
        return NextResponse.json({ status: 'erro', erro: evolutionError(err, 'Falha ao conectar no servidor Evolution') })
      }
    }

    // ─── AÇÃO: CONECTAR (Obter QR Code) ─────────────────────────────────────────
    if (acao === 'conectar') {
      try {
        let connectRes = await fetchWithTimeout(`${apiUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: baseHeaders,
          cache: 'no-store',
        })

        if (connectRes.status === 404) {
          const createRes = await fetchWithTimeout(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
          })

          if (!createRes.ok) {
            const err = await createRes.text()
            return NextResponse.json({ erro: `Falha ao criar instância: ${err}` }, { status: 400 })
          }

          connectRes = await fetchWithTimeout(`${apiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: baseHeaders,
            cache: 'no-store',
          })
        }

        if (!connectRes.ok) {
          const err = await connectRes.text()
          return NextResponse.json({ erro: `Falha ao gerar QR Code: ${err}` }, { status: 400 })
        }

        let connectData = await connectRes.json()

        if (!connectData.base64 && !connectData.code && !connectData.qrcode?.base64 && !connectData.qrcode?.code) {
          console.log('[WhatsApp API] Instância sem QR Code. Tentando logout para resetar...')
          await fetchWithTimeout(`${apiUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: baseHeaders,
          }).catch(() => null)

          connectRes = await fetchWithTimeout(`${apiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: baseHeaders,
            cache: 'no-store',
          })

          if (connectRes.ok) {
            connectData = await connectRes.json()
          }
        }

        return NextResponse.json(connectData)
      } catch (err: any) {
        return NextResponse.json({ erro: evolutionError(err, 'Erro ao requisitar QR Code') }, { status: 500 })
      }
    }

    // ─── AÇÃO: DESCONECTAR (Logout) ─────────────────────────────────────────────
    if (acao === 'desconectar') {
      try {
        const logoutRes = await fetchWithTimeout(`${apiUrl}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: baseHeaders,
        })

        if (!logoutRes.ok) {
          const err = await logoutRes.text()
          return NextResponse.json({ erro: `Falha ao desconectar instância: ${err}` }, { status: 400 })
        }

        await supabase
          .from('config_whatsapp')
          .update({ status: 'desconectado', updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ sucesso: true })
      } catch (err: any) {
        return NextResponse.json({ erro: evolutionError(err, 'Erro ao desconectar instância') }, { status: 500 })
      }
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (err: any) {
    console.error('[WhatsApp API Conexao] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
