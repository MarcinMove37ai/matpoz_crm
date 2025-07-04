import { Metadata } from 'next'
import { Suspense } from 'react'
import LoginPageContent from './LoginPageContent'

export const metadata: Metadata = {
  title: 'Logowanie - CRM MatPoz',
  description: 'Zaloguj się do systemu CRM',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Ładowanie...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}