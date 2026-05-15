'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/components/shared/LoadingPage'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Copy,
  ExternalLink,
  MessageCircle,
  Loader2,
  BookOpen,
  Globe,
  RefreshCw,
} from 'lucide-react'

interface Cores {
  primary: string
  secondary: string
}

interface ConfigCatalogo {
  id: string
  empresa_id: string
  slug: string
  titulo: string
  descricao: string | null
  whatsapp: string | null
  instagram: string | null
  facebook: string | null
  banner_url: string | null
  cores: Cores
  mostrar_preco: boolean
  mostrar_estoque: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function CatalogoConfigPage() {
  const { empresaAtual } = useEmpresa()
  const supabase = createClient()

  const [config, setConfig] = useState<ConfigCatalogo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)

  // form state
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [mostrarPreco, setMostrarPreco] = useState(true)
  const [mostrarEstoque, setMostrarEstoque] = useState(false)
  const [corPrimaria, setCorPrimaria] = useState('#D4A528')

  const carregarConfig = useCallback(async () => {
    if (!empresaAtual?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('config_catalogo')
      .select('*')
      .eq('empresa_id', empresaAtual.id)
      .single()

    if (data) {
      setConfig(data)
      setTitulo(data.titulo ?? '')
      setDescricao(data.descricao ?? '')
      setWhatsapp(data.whatsapp ?? '')
      setInstagram(data.instagram ?? '')
      setFacebook(data.facebook ?? '')
      setAtivo(data.ativo)
      setMostrarPreco(data.mostrar_preco)
      setMostrarEstoque(data.mostrar_estoque)
      setCorPrimaria(data.cores?.primary ?? '#D4A528')
    }
    setLoading(false)
  }, [empresaAtual?.id, supabase])

  useEffect(() => {
    carregarConfig()
  }, [carregarConfig])

  const handleSave = async () => {
    if (!config) return
    if (!titulo.trim()) return toast.error('Título é obrigatório')

    setSaving(true)
    const { error } = await supabase
      .from('config_catalogo')
      .update({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        ativo,
        mostrar_preco: mostrarPreco,
        mostrar_estoque: mostrarEstoque,
        cores: { primary: corPrimaria, secondary: '#1A1A2E' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id)

    if (error) {
      toast.error('Erro ao salvar configurações')
    } else {
      toast.success('Configurações do catálogo salvas!')
      carregarConfig()
    }
    setSaving(false)
  }

  const handleInitialize = async () => {
    if (!empresaAtual?.id) return
    setInitializing(true)

    const slug = `empresa-${empresaAtual.id.slice(0, 8)}`
    const { error } = await supabase.from('config_catalogo').insert({
      empresa_id: empresaAtual.id,
      slug,
      titulo: empresaAtual.nome ?? 'Catálogo',
      descricao: null,
      whatsapp: null,
      instagram: null,
      facebook: null,
      banner_url: null,
      cores: { primary: '#D4A528', secondary: '#1A1A2E' },
      mostrar_preco: true,
      mostrar_estoque: false,
      ativo: true,
    })

    if (error) {
      toast.error('Erro ao criar catálogo')
    } else {
      toast.success('Catálogo criado com sucesso!')
      carregarConfig()
    }
    setInitializing(false)
  }

  const catalogUrl = config ? `${APP_URL}/catalogo/${config.slug}` : ''

  const copiarLink = () => {
    navigator.clipboard.writeText(catalogUrl)
    toast.success('Link copiado!')
  }

  const compartilharWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent('Confira nosso catálogo: ' + catalogUrl)}`,
      '_blank'
    )
  }

  if (loading) return <LoadingPage />

  if (!config) {
    return (
      <AppShell empresa="emporio" titulo="Configurações do Catálogo">
        <EmptyState
          icone={BookOpen}
          titulo="Catálogo não configurado"
          descricao="Crie o catálogo público para começar a compartilhar seus produtos."
          acao={{ label: initializing ? 'Criando...' : 'Criar Catálogo', onClick: handleInitialize }}
        />
      </AppShell>
    )
  }

  return (
    <AppShell empresa="emporio" titulo="Configurações do Catálogo">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========== Left: Config form ========== */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Informações do Catálogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Slug readonly */}
              <div className="space-y-1.5">
                <Label className="text-slate-700">Slug (URL)</Label>
                <Input
                  value={config.slug}
                  readOnly
                  className="bg-slate-50 text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400">
                  Endereço:{' '}
                  <span className="font-mono text-[#D4A528]">
                    {APP_URL}/catalogo/{config.slug}
                  </span>
                </p>
              </div>

              {/* Titulo */}
              <div className="space-y-1.5">
                <Label className="text-slate-700">Título do catálogo *</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Empório dos Móveis"
                />
              </div>

              {/* Descricao */}
              <div className="space-y-1.5">
                <Label className="text-slate-700">Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva brevemente sua loja ou produtos..."
                  rows={3}
                />
              </div>

              <Separator />

              {/* Contato */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-700">Contato e Redes Sociais</p>

                <div className="space-y-1.5">
                  <Label className="text-slate-700">WhatsApp</Label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(55) 00000-00000"
                  />
                  <p className="text-xs text-slate-400">
                    Inclua o código do país. Ex: 5562999990000
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700">Instagram</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      @
                    </span>
                    <Input
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="seuperfil"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700">Facebook</Label>
                  <Input
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="URL da página ou username"
                  />
                </div>
              </div>

              <Separator />

              {/* Toggles */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-700">Configurações de Exibição</p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Catálogo ativo</p>
                    <p className="text-xs text-slate-400">Quando desativado, o catálogo fica inacessível</p>
                  </div>
                  <Switch checked={ativo} onCheckedChange={setAtivo} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Exibir preços</p>
                    <p className="text-xs text-slate-400">Mostrar o preço dos produtos no catálogo</p>
                  </div>
                  <Switch checked={mostrarPreco} onCheckedChange={setMostrarPreco} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Exibir disponibilidade em estoque</p>
                    <p className="text-xs text-slate-400">Mostrar se o produto está disponível</p>
                  </div>
                  <Switch checked={mostrarEstoque} onCheckedChange={setMostrarEstoque} />
                </div>
              </div>

              <Separator />

              {/* Cor primária */}
              <div className="space-y-1.5">
                <Label className="text-slate-700">Cor primária do catálogo</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <Input
                    value={corPrimaria}
                    onChange={(e) => setCorPrimaria(e.target.value)}
                    placeholder="#D4A528"
                    className="w-32 font-mono text-sm"
                    maxLength={7}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCorPrimaria('#D4A528')}
                    className="text-xs text-slate-400"
                  >
                    <RefreshCw size={12} className="mr-1" />
                    Padrão
                  </Button>
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-[#D4A528] hover:bg-[#B8901E] text-white"
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ========== Right: Share card ========== */}
        <div>
          <div className="sticky top-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Compartilhar Catálogo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Status indicator */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-block w-2.5 h-2.5 rounded-full',
                      config.ativo ? 'bg-emerald-500' : 'bg-red-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      config.ativo ? 'text-emerald-700' : 'text-red-600'
                    )}
                  >
                    {config.ativo ? 'Catálogo ativo' : 'Catálogo inativo'}
                  </span>
                </div>

                {/* URL display */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 mb-1">Link do catálogo</p>
                  <p className="font-mono text-sm text-slate-700 break-all leading-relaxed">
                    {catalogUrl}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    onClick={copiarLink}
                    className="justify-start gap-2 border-slate-200 hover:border-[#D4A528] hover:text-[#D4A528]"
                  >
                    <Copy size={16} />
                    Copiar Link
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => window.open(catalogUrl, '_blank')}
                    className="justify-start gap-2 border-slate-200 hover:border-[#1A1A2E] hover:text-[#1A1A2E]"
                  >
                    <ExternalLink size={16} />
                    Abrir Catálogo
                  </Button>

                  <Button
                    onClick={compartilharWhatsApp}
                    className="justify-start gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <MessageCircle size={16} />
                    Enviar via WhatsApp
                  </Button>
                </div>

                <Separator />

                {/* Quick stats */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Configuração atual
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Preços visíveis</span>
                      <span className={cn('font-medium', config.mostrar_preco ? 'text-emerald-600' : 'text-slate-400')}>
                        {config.mostrar_preco ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Disponibilidade</span>
                      <span className={cn('font-medium', config.mostrar_estoque ? 'text-emerald-600' : 'text-slate-400')}>
                        {config.mostrar_estoque ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>WhatsApp</span>
                      <span className={cn('font-medium', config.whatsapp ? 'text-emerald-600' : 'text-slate-400')}>
                        {config.whatsapp ?? 'Não configurado'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
