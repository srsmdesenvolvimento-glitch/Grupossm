'use client'

import { Menu, Bell, LogOut, User, ChevronDown, Building2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { TipoEmpresa } from '@/lib/types/database'

interface HeaderProps {
  empresa: TipoEmpresa
  titulo: string
  onMenuClick: () => void
}

const EMPRESA_CONFIG: Record<TipoEmpresa, { primary: string; nome: string; emoji: string }> = {
  emporio:  { primary: '#D4A528', nome: 'Empório dos Móveis', emoji: '🪑' },
  factoring: { primary: '#1E5AA8', nome: 'SRS M Factoring',    emoji: '💰' },
}

const SEGMENT_LABELS: Record<string, string> = {
  emporio: 'Empório', factoring: 'Factoring',
  dashboard: 'Dashboard', clientes: 'Clientes',
  produtos: 'Produtos', vendas: 'Vendas',
  financeiro: 'Financeiro', configuracoes: 'Configurações',
  emprestimos: 'Empréstimos', parcelas: 'Parcelas',
  mensagens: 'Mensagens', nova: 'Nova Venda', novo: 'Novo',
  categorias: 'Categorias', estoque: 'Estoque',
  receber: 'A Receber', pagar: 'A Pagar',
  caixa: 'Fluxo de Caixa', inadimplentes: 'Inadimplentes',
  pagamento: 'Lançar Pagamento', simulador: 'Simulador',
  relatorio: 'Relatório', catalogo: 'Catálogo',
  movimentacoes: 'Movimentações', fila: 'Fila',
  historico: 'Histórico', templates: 'Templates',
  'contas-pagar': 'A Pagar', 'contas-receber': 'A Receber',
  'fluxo-caixa': 'Fluxo de Caixa', 'todos-devem': 'Todos que Devem',
}

function useBreadcrumbs(pathname: string) {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: SEGMENT_LABELS[seg] ?? (seg.length > 20 ? 'Detalhes' : seg),
      href: '/' + arr.slice(0, i + 1).join('/'),
      isLast: i === arr.length - 1,
    }))
}

export function Header({ empresa, titulo, onMenuClick }: HeaderProps) {
  const { user, perfil, signOut } = useAuth()
  const { empresas, empresaAtual, trocarEmpresa } = useEmpresa()
  const router = useRouter()
  const pathname = usePathname()
  const cfg = EMPRESA_CONFIG[empresa]
  const breadcrumbs = useBreadcrumbs(pathname)

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  function handleTrocarEmpresa(id: string) {
    trocarEmpresa(id)
    const outra = empresas.find(e => e.id === id)
    if (outra) {
      router.push(outra.tipo === 'emporio' ? '/emporio/dashboard' : '/factoring/dashboard')
    }
  }

  const initials = perfil?.nome
    ? perfil.nome.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'US'

  const outrasEmpresas = empresas.filter(e => e.id !== empresaAtual?.id)

  return (
    <header
      className="h-16 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0"
      style={{ borderBottom: `2px solid ${cfg.primary}` }}
    >
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Abrir menu"
        >
          <Menu size={20} className="text-slate-600" />
        </button>

        <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-slate-300 select-none">/</span>}
              <span
                className={
                  crumb.isLast
                    ? 'font-semibold text-slate-800 max-w-[160px] truncate'
                    : 'text-slate-400 max-w-[80px] truncate'
                }
                title={crumb.label}
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Right: empresa selector + bell + avatar */}
      <div className="flex items-center gap-1 shrink-0">
        {outrasEmpresas.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-slate-700 hover:bg-accent transition-colors text-xs font-medium">
              <Building2 size={14} className="text-slate-500" />
              <span className="max-w-[110px] truncate">
                {empresaAtual?.nome ?? cfg.nome}
              </span>
              <ChevronDown size={12} className="text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <p className="px-2 py-1.5 text-xs text-slate-500 font-medium">Trocar empresa</p>
              <DropdownMenuSeparator />
              {outrasEmpresas.map(e => (
                <DropdownMenuItem
                  key={e.id}
                  onClick={() => handleTrocarEmpresa(e.id)}
                  className="gap-2"
                >
                  <span>{EMPRESA_CONFIG[e.tipo].emoji}</span>
                  <span className="truncate">{e.nome}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell size={18} className="text-slate-500" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2 rounded-md hover:bg-accent transition-colors outline-none">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback
                className="text-xs text-white font-bold"
                style={{ backgroundColor: cfg.primary }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-sm text-slate-700 max-w-[100px] truncate">
              {perfil?.nome ?? user?.email}
            </span>
            <ChevronDown size={13} className="text-slate-400 hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold text-slate-800 truncate">{perfil?.nome ?? '—'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <User size={15} />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-600"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
