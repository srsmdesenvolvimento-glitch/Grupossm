import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { EmpresaProvider } from '@/contexts/EmpresaContext'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { Toaster } from 'sonner'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grupo SRSM — Sistema de Gestão',
  description: 'Sistema de gestão empresarial — Empório dos Móveis e SRS M Factoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <QueryProvider>
          <AuthProvider>
            <EmpresaProvider>
              {children}
              <Toaster richColors position="top-right" />
            </EmpresaProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
