import type { TipoEmpresa, PapelUsuario } from './database'

export type { TipoEmpresa, PapelUsuario }

export type EmpresaInfo = {
  id: string
  nome: string
  tipo: TipoEmpresa
  logo_url: string | null
  ativo: boolean
}

export type Empresa = TipoEmpresa

export type UsuarioInfo = {
  id: string
  nome: string
  email: string
  telefone: string | null
  avatar_url: string | null
}

export type UsuarioComAcesso = UsuarioInfo & {
  papel: PapelUsuario
  empresa_id: string
}

export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico'

export type ScoreResult = {
  score: number
  nivel: NivelRisco
}

export type PaginacaoParams = {
  pagina: number
  porPagina: number
}

export type PaginacaoResult<T> = {
  dados: T[]
  total: number
  pagina: number
  totalPaginas: number
}

export type FiltroData = {
  de?: string
  ate?: string
}

export type SelectOption = {
  value: string
  label: string
}

export type ApiResponse<T = void> = {
  sucesso: boolean
  dados?: T
  erro?: string
}
