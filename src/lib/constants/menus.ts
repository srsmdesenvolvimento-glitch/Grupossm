export type MenuItem = {
  label: string
  href: string
  icon: string
  subitems?: MenuItem[]
}

export const MENU_EMPORIO: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/emporio/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Clientes',
    href: '/emporio/clientes',
    icon: 'Users',
  },
  {
    label: 'Produtos',
    href: '/emporio/produtos',
    icon: 'Package',
    subitems: [
      { label: 'Lista de Produtos', href: '/emporio/produtos', icon: 'List' },
      { label: 'Categorias', href: '/emporio/produtos/categorias', icon: 'Tag' },
      { label: 'Estoque', href: '/emporio/produtos/estoque', icon: 'Boxes' },
    ],
  },
  {
    label: 'Catálogo',
    href: '/emporio/catalogo',
    icon: 'Globe',
  },
  {
    label: 'Vendas',
    href: '/emporio/vendas',
    icon: 'ShoppingCart',
    subitems: [
      { label: 'Nova Venda', href: '/emporio/vendas/nova', icon: 'Plus' },
      { label: 'Histórico', href: '/emporio/vendas', icon: 'History' },
    ],
  },
  {
    label: 'Financeiro',
    href: '/emporio/financeiro',
    icon: 'Wallet',
    subitems: [
      { label: 'Contas a Receber', href: '/emporio/financeiro/receber', icon: 'TrendingUp' },
      { label: 'Contas a Pagar', href: '/emporio/financeiro/pagar', icon: 'TrendingDown' },
      { label: 'Fluxo de Caixa', href: '/emporio/financeiro/caixa', icon: 'BarChart3' },
    ],
  },
  {
    label: 'Mensagens',
    href: '/mensagens',
    icon: 'MessageCircle',
    subitems: [
      { label: 'Fila de Envio', href: '/mensagens/fila', icon: 'List' },
      { label: 'Histórico', href: '/mensagens/historico', icon: 'History' },
      { label: 'Templates', href: '/mensagens/templates', icon: 'FileText' },
    ],
  },
  {
    label: 'Configurações',
    href: '/emporio/configuracoes',
    icon: 'Settings',
  },
]

export const MENU_FACTORING: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/factoring/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Clientes',
    href: '/factoring/clientes',
    icon: 'Users',
  },
  {
    label: 'Empréstimos',
    href: '/factoring/emprestimos',
    icon: 'Banknote',
    subitems: [
      { label: 'Novo Empréstimo', href: '/factoring/emprestimos/novo', icon: 'Plus' },
      { label: 'Simulador', href: '/factoring/emprestimos/simulador', icon: 'Calculator' },
      { label: 'Ver Todos', href: '/factoring/emprestimos', icon: 'FileText' },
    ],
  },
  {
    label: 'Parcelas',
    href: '/factoring/parcelas',
    icon: 'CalendarDays',
    subitems: [
      { label: 'Todas as Parcelas', href: '/factoring/parcelas', icon: 'List' },
      { label: 'Inadimplentes', href: '/factoring/parcelas/inadimplentes', icon: 'AlertTriangle' },
      { label: 'Todos Devedores', href: '/factoring/parcelas/todos-devem', icon: 'Users' },
    ],
  },
  {
    label: 'Financeiro',
    href: '/factoring/financeiro',
    icon: 'Wallet',
    subitems: [
      { label: 'Caixa', href: '/factoring/financeiro/caixa', icon: 'Wallet' },
      { label: 'Contas a Receber', href: '/factoring/financeiro/contas-receber', icon: 'TrendingUp' },
      { label: 'Contas a Pagar', href: '/factoring/financeiro/contas-pagar', icon: 'TrendingDown' },
      { label: 'Relatório', href: '/factoring/financeiro/relatorio', icon: 'BarChart3' },
    ],
  },
  {
    label: 'Análise de Crédito',
    href: '/factoring/analise-credito',
    icon: 'ShieldCheck',
  },
  {
    label: 'Mensagens',
    href: '/mensagens',
    icon: 'MessageCircle',
    subitems: [
      { label: 'Fila de Envio', href: '/mensagens/fila', icon: 'List' },
      { label: 'Histórico', href: '/mensagens/historico', icon: 'History' },
      { label: 'Templates', href: '/mensagens/templates', icon: 'FileText' },
    ],
  },
  {
    label: 'Configurações',
    href: '/factoring/configuracoes',
    icon: 'Settings',
  },
]

export const MENU_MENSAGENS: MenuItem[] = [
  { label: 'Todos os Contatos', href: '/mensagens', icon: 'Inbox' },
  { label: 'Clientes Empório', href: '/mensagens/emporio', icon: 'Armchair' },
  { label: 'Clientes Factoring', href: '/mensagens/factoring', icon: 'Banknote' },
]

