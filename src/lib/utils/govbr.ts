/**
 * Utilitário de Integração com o Assinador Eletrônico GOV.BR (Lei nº 14.063/2020)
 */

export interface GovBrUserInfo {
  cpf: string
  nome: string
  nivelConta: 'Prata' | 'Ouro' | 'Bronze'
  autenticadoEm: string
}

export interface GovBrSignatureResult {
  sucesso: boolean
  hashAssinatura: string
  userInfo: GovBrUserInfo
  provedor: 'GOV.BR'
  mensagem?: string
}

const GOVBR_ENV = process.env.GOVBR_ENV || 'staging'
const GOVBR_CLIENT_ID = process.env.GOVBR_CLIENT_ID || 'demo_client_id'
const GOVBR_CLIENT_SECRET = process.env.GOVBR_CLIENT_SECRET || 'demo_client_secret'
const GOVBR_REDIRECT_URI = process.env.GOVBR_REDIRECT_URI || 'http://localhost:3000/api/auth/govbr/callback'

const SSO_URL = GOVBR_ENV === 'production'
  ? 'https://sso.acesso.gov.br'
  : 'https://sso.staging.acesso.gov.br'

const ASSINADOR_URL = GOVBR_ENV === 'production'
  ? 'https://api.acesso.gov.br/assinador'
  : 'https://api.staging.acesso.gov.br/assinador'

/**
 * Gera a URL de autorização OAuth 2.0 do GOV.BR
 */
export function getGovBrAuthorizationUrl(state: string): string {
  if (isGovBrSimulationMode()) {
    // Modo Simulação: Retorna rota interna que simula a tela do GOV.BR
    return `/assinar/govbr-simulador?state=${encodeURIComponent(state)}`
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GOVBR_CLIENT_ID,
    scope: 'openid assinatura_digital',
    redirect_uri: GOVBR_REDIRECT_URI,
    state,
  })

  return `${SSO_URL}/authorize?${params.toString()}`
}

/**
 * Verifica se a aplicação está em modo de simulação (sem chaves de prod/staging do Gov.br)
 */
export function isGovBrSimulationMode(): boolean {
  return !process.env.GOVBR_CLIENT_ID || process.env.GOVBR_CLIENT_ID === 'demo_client_id'
}

/**
 * Simula uma assinatura GOV.BR bem-sucedida para ambiente de desenvolvimento/testes
 */
export function simularAssinaturaGovBr(clienteNome: string, clienteCpf: string): GovBrSignatureResult {
  const ts = new Date().toISOString()
  const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase()
  
  return {
    sucesso: true,
    hashAssinatura: `GOVBR-ICP-BR-${randomHex}-${Date.now()}`,
    provedor: 'GOV.BR',
    userInfo: {
      cpf: clienteCpf ? clienteCpf.replace(/\D/g, '') : '00000000000',
      nome: clienteNome,
      nivelConta: 'Ouro',
      autenticadoEm: ts,
    },
  }
}
