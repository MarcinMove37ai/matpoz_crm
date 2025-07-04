import AdminLayout from '@/components/layouts/AdminLayout'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}