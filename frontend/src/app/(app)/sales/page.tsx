import { Metadata } from "next";
import OverallAndBranchesSales from "@/components/views/SalesView";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Sprzedaż - CRM",
  description: "Moduł sprzedaży systemu CRM",
};

export default function SalesPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'BOARD', 'BRANCH']} redirectTo="/costs">
      <OverallAndBranchesSales />
    </AuthGuard>
  );
}
