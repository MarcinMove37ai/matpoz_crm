import { Metadata } from "next";
import OverallAndBranchesSalesPH from "@/components/views/SalesPH";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Sprzedaż - CRM",
  description: "Moduł sprzedaży systemu CRM",
};

export default function SalesPH() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'BOARD', 'BRANCH', '']} redirectTo="/costs">
      <OverallAndBranchesSalesPH />
    </AuthGuard>
  );
}
