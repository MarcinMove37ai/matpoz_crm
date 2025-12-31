import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/providers/AuthProvider'

// 1. IMPORTUJEMY NASZ PROSTY PROVIDER
import { ToastProvider } from "@/context/ToastContext"

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CRM System',
  description: 'System CRM',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <AuthProvider>
          {/* 2. OTACZAMY TYM APLIKACJĘ. TOASTER JEST JUŻ W ŚRODKU. */}
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}