import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/atualizar-senha']

function isPublicPath(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) return true
  }
  if (pathname.startsWith('/catalogo/')) return true
  if (pathname.startsWith('/api/webhooks/')) return true
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user } = await updateSession(request)

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/selecionar-empresa'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  if (!isPublicPath(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') {
      url.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
