import { Metadata } from "next"
import CostsSummaryView from "@/components/views/CostsSummaryView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Koszty podsumowanie - CRM",
  description: "Moduł podsumowania kosztów systemu CRM",
}

export default function CostsSummaryPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'BOARD', 'BRANCH']} redirectTo="/costs">
      <CostsSummaryView />
    </AuthGuard>
  );
}