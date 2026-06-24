'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LogOut, Building2, LayoutDashboard, Users, Package, Banknote, ShoppingCart, CalendarDays } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useAuth } from '@/contexts/AuthContext'
import { MENU_EMPORIO, MENU_FACTORING } from '@/lib/constants/menus'

type ResultItem = {
  id: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  href: string
}

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function CommandPalette() {
  const router = useRouter()
  const { empresaAtual } = useEmpresa()
  const { signOut } = useAuth()
  // useMemo garante instância estável (evita recriar em cada render, prevenindo loops no useCallback)
  const supabase = useMemo(() => createClient(), [])

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const buscar = useCallback(async (q: string) => {
    if (!empresaAtual || q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const found: ResultItem[] = []

      if (empresaAtual.tipo === 'emporio') {
        const [{ data: clientes }, { data: produtos }] = await Promise.all([
          supabase.from('clientes_emporio').select('id, nome, telefone').eq('empresa_id', empresaAtual.id).ilike('nome', `%${q}%`).limit(5),
          supabase.from('produtos').select('id, nome, sku').eq('empresa_id', empresaAtual.id).or(`nome.ilike.%${q}%,sku.ilike.%${q}%`).limit(5),
        ])

        for (const c of clientes ?? []) {
          found.push({ id: `cli-${c.id}`, label: c.nome, sublabel: c.telefone ?? undefined, icon: <Users size={14} />, href: `/emporio/clientes/${c.id}` })
        }
        for (const p of produtos ?? []) {
          found.push({ id: `prod-${p.id}`, label: p.nome, sublabel: p.sku ?? undefined, icon: <Package size={14} />, href: `/emporio/produtos/${p.id}` })
        }

        if (/^\d+$/.test(q)) {
          const { data: vendas } = await supabase.from('vendas').select('id, numero_venda').eq('empresa_id', empresaAtual.id).eq('numero_venda', parseInt(q)).limit(5)
          for (const v of vendas ?? []) {
            found.push({ id: `venda-${v.id}`, label: `Venda #${v.numero_venda}`, icon: <ShoppingCart size={14} />, href: `/emporio/vendas/${v.id}` })
          }
        }
      }

      if (empresaAtual.tipo === 'factoring') {
        const [{ data: clientes }, { data: emprestimos }] = await Promise.all([
          supabase.from('clientes_factoring').select('id, nome, cpf').eq('empresa_id', empresaAtual.id).ilike('nome', `%${q}%`).limit(5),
          supabase.from('emprestimos').select('id, numero_contrato').eq('empresa_id', empresaAtual.id).ilike('numero_contrato', `%${q}%`).limit(5),
        ])

        for (const c of clientes ?? []) {
          found.push({ id: `cli-${c.id}`, label: c.nome, sublabel: c.cpf ?? undefined, icon: <Users size={14} />, href: `/factoring/clientes/${c.id}` })
        }
        for (const e of emprestimos ?? []) {
          found.push({ id: `emp-${e.id}`, label: e.numero_contrato, icon: <Banknote size={14} />, href: `/factoring/emprestimos/${e.id}` })
        }
      }

      setResults(found)
    } finally {
      setSearching(false)
    }
  // supabase é estável (useMemo) — não precisa estar nas deps
  }, [empresaAtual, supabase])

  useEffect(() => { buscar(debouncedQuery) }, [debouncedQuery, buscar])

  function navegar(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/login')
  }

  const menu = empresaAtual?.tipo === 'emporio' ? MENU_EMPORIO : MENU_FACTORING
  const linksMenu = menu.flatMap(item =>
    item.subitems
      ? item.subitems.filter(sub => sub.href).map(sub => ({ label: sub.label, href: sub.href! }))
      : item.href ? [{ label: item.label, href: item.href }] : []
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-accent transition-colors text-xs"
        aria-label="Busca global"
      >
        <Search size={12} />
        <span>Buscar...</span>
        <kbd className="ml-1 pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px]">
          <span>⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar clientes, produtos, contratos..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length >= 2 && !searching && results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}

          {results.length > 0 && (
            <CommandGroup heading="Resultados">
              {results.map(item => (
                <CommandItem key={item.id} onSelect={() => navegar(item.href)} className="gap-2">
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.sublabel && <span className="text-xs text-muted-foreground ml-1">{item.sublabel}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {query.length < 2 && (
            <CommandGroup heading="Ir para">
              {linksMenu.map(item => (
                <CommandItem key={item.href} onSelect={() => navegar(item.href)} className="gap-2">
                  <LayoutDashboard size={14} className="text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Ações">
            <CommandItem onSelect={() => navegar('/selecionar-empresa')} className="gap-2">
              <Building2 size={14} className="text-muted-foreground" />
              Trocar empresa
            </CommandItem>
            <CommandItem onSelect={handleSignOut} className="gap-2 text-red-600 aria-selected:text-red-600">
              <LogOut size={14} />
              Sair
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
