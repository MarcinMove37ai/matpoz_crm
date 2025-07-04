// src/app/salpa/page.tsx
import { Metadata } from "next"
import ClientSalpa from "./client-page"
import { AuthGuard } from "@/components/auth/AuthGuard"

export const metadata: Metadata = {
  title: "Salpa Expeditions",
  description: "Salpa Expeditions - Boat Purchase and Adventures",
}

export default function SalpaPage() {
  // We need to ensure AuthGuard doesn't cause hydration issues
  // If AuthGuard is a server component, this approach should work
  return (
    <AuthGuard>
      {/* Setting a key here helps prevent issues with React's reconciliation during hydration */}
      <ClientSalpa key="salpa-client-page" />
    </AuthGuard>
  );
}