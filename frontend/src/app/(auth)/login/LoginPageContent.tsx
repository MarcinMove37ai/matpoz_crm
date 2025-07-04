'use client'

import LoginForm from '@/components/auth/LoginForm'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function LoginPageContent() {
  return (
    <AuthGuard requireAuth={false}>
      <LoginForm />
    </AuthGuard>
  )
}