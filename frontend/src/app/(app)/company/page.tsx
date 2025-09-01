import { Metadata } from "next"
import CompanyView from "@/components/views/CompanyView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Firma - CRM",
  description: "Moduł zarządzania firmą w systemie CRM",
}

export default function CompanyPage() {
  return (
    <AuthGuard>
      <CompanyView />
    </AuthGuard>
  );
}