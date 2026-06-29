import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Render free tier pode demorar 45s+ para acordar — usar 65s como margem
const TIMEOUT_LONGO   = 65_000
const TIMEOUT_RAPIDO  = 20_000

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = TIMEOUT_LONGO): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function evolutionError(err: any, ctx: string): string {
  if (err?.name === 'AbortError') {
    return `Timeout: Evolution API não respondeu em ${Math.round(TIMEOUT_LONGO / 1000)}s. O servidor pode estar iniciando (Render cold start). Aguarde 1 minuto e tente novamente.`
  }
  return `${ctx}: ${err?.message ?? 'Erro desconhecido'}`
}

/** Acorda o servidor Render com uma requisição rápida antes das operações principais */
async function wakeUpServer(apiUrl: string): Promise<void> {
  try {
    await fetchWithTimeout(`${apiUrl}/`, { method: 'GET', cache: 'no-store' }, TIMEOUT_LONGO)
  } catch {
    // Ignora erro — mesmo que falhe, tentamos a operação principal
  }
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
    const baseHeaders  = { apikey: apiKey }
    const jsonHeaders  = { 'Content-Type': 'application/json', apikey: apiKey }

    // ─── AÇÃO: STATUS ──────────────────────────────────────────────────────────
    if (acao === 'status') {
      try {
        const stateRes = await fetchWithTimeout(
          `${apiUrl}/instance/connectionState/${instanceName}`,
          { method: 'GET', headers: baseHeaders, cache: 'no-store' },
          TIMEOUT_LONGO
        )

        if (stateRes.status === 404) {
          // Instância não existe — cria
          const createRes = await fetchWithTimeout(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
          }, TIMEOUT_RAPIDO)

          if (!createRes.ok) {
            const err = await createRes.text()
            return NextResponse.json({ status: 'erro', erro: `Falha ao criar instância: ${err}` })
          }

          return NextResponse.json({ status: 'desconectado', state: 'close' })
        }

        if (!stateRes.ok) {
          const err = await stateRes.text()
          return NextResponse.json({ status: 'erro', erro: `Erro ao obter status: ${err}` })
        }

        const stateData = await stateRes.json()
        const state = stateData.instance?.state || stateData.state || 'close'
        const friendlyStatus =
          state === 'open'       ? 'conectado'    :
          state === 'connecting' ? 'conectando'   : 'desconectado'

        await supabase
          .from('config_whatsapp')
          .update({ status: friendlyStatus, updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ status: friendlyStatus, state })
      } catch (err: any) {
        return NextResponse.json({ status: 'erro', erro: evolutionError(err, 'Status') })
      }
    }

    // ─── AÇÃO: CONECTAR (Obter QR Code) ─────────────────────────────────────────
    if (acao === 'conectar') {
      try {
        // Acorda o servidor antes de tentar operações sensíveis
        await wakeUpServer(apiUrl)

        let connectRes = await fetchWithTimeout(
          `${apiUrl}/instance/connect/${instanceName}`,
          { method: 'GET', headers: baseHeaders, cache: 'no-store' },
          TIMEOUT_RAPIDO
        )

        if (connectRes.status === 404) {
          const createRes = await fetchWithTimeout(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
          }, TIMEOUT_RAPIDO)

          if (!createRes.ok) {
            const err = await createRes.text()
            return NextResponse.json({ erro: `Falha ao criar instância: ${err}` }, { status: 400 })
          }

          connectRes = await fetchWithTimeout(
            `${apiUrl}/instance/connect/${instanceName}`,
            { method: 'GET', headers: baseHeaders, cache: 'no-store' },
            TIMEOUT_RAPIDO
          )
        }

        if (!connectRes.ok) {
          const err = await connectRes.text()
          return NextResponse.json({ erro: `Falha ao gerar QR Code: ${err}` }, { status: 400 })
        }

        let connectData = await connectRes.json()

        // Se não retornou QR, faz logout e tenta de novo para gerar QR limpo
        const temQR = connectData.base64 || connectData.code || connectData.qrcode?.base64 || connectData.qrcode?.code
        if (!temQR) {
          await fetchWithTimeout(
            `${apiUrl}/instance/logout/${instanceName}`,
            { method: 'DELETE', headers: baseHeaders },
            TIMEOUT_RAPIDO
          ).catch(() => null)

          await new Promise(r => setTimeout(r, 1500))

          const retryRes = await fetchWithTimeout(
            `${apiUrl}/instance/connect/${instanceName}`,
            { method: 'GET', headers: baseHeaders, cache: 'no-store' },
            TIMEOUT_RAPIDO
          ).catch(() => null)

          if (retryRes?.ok) {
            connectData = await retryRes.json()
          }
        }

        return NextResponse.json(connectData)
      } catch (err: any) {
        return NextResponse.json({ erro: evolutionError(err, 'QR Code') }, { status: 500 })
      }
    }

    // ─── AÇÃO: DESCONECTAR ───────────────────────────────────────────────────────
    if (acao === 'desconectar') {
      try {
        const logoutRes = await fetchWithTimeout(
          `${apiUrl}/instance/logout/${instanceName}`,
          { method: 'DELETE', headers: baseHeaders },
          TIMEOUT_RAPIDO
        )

        if (!logoutRes.ok) {
          const err = await logoutRes.text()
          return NextResponse.json({ erro: `Falha ao desconectar: ${err}` }, { status: 400 })
        }

        await supabase
          .from('config_whatsapp')
          .update({ status: 'desconectado', updated_at: new Date().toISOString() })
          .eq('id', config.id)

        return NextResponse.json({ sucesso: true })
      } catch (err: any) {
        return NextResponse.json({ erro: evolutionError(err, 'Desconectar') }, { status: 500 })
      }
    }

    return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })
  } catch (err: any) {
    console.error('[WhatsApp Conexao] Erro:', err)
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 })
  }
}
