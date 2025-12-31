import { Metadata } from "next"
import ZeroCostsView from "@/components/views/ZeroCostsView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Weryfikacja Marży - CRM",
  description: "Weryfikacja transakcji z błędną marżą",
}

export default function ZeroCostsPage() {
  return (
    <AuthGuard>
      <ZeroCostsView />
    </AuthGuard>
  );
}