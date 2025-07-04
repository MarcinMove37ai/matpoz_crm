import { Metadata } from 'next'
import ResetPasswordPageContent from './ResetPasswordPageContent'

export const metadata: Metadata = {
  title: 'Reset hasła - CRM MatPoz',
  description: 'Zresetuj hasło do systemu CRM',
}

export default function ResetPasswordPage() {
  return <ResetPasswordPageContent />
}