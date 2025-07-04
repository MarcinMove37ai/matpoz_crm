import { Metadata } from "next"
import SettingsView from "@/components/views/SettingsView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Ustawienia - CRM",
  description: "Moduł ustawień systemu CRM",
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsView />
    </AuthGuard>
  );
}
