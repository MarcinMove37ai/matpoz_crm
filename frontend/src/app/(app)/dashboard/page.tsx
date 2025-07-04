import { Metadata } from "next";
import DashboardView from "@/components/views/DashboardView";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Dashboard - CRM",
  description: "Panel główny systemu CRM",
};

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'BOARD']}>
      <DashboardView />
    </AuthGuard>
  );
}
