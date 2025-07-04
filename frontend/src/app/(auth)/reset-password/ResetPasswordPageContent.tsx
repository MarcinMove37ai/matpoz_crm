'use client'

import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function ResetPasswordPageContent() {
  return (
    <AuthGuard requireAuth={false}>
      <ResetPasswordForm />
    </AuthGuard>
  )
}