import { Metadata } from "next"
import ProfitsView from "@/components/views/ProfitsView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Zyski - CRM",
  description: "Moduł zysków systemu CRM",
}

export default function ProfitsPage() {
  return (
    <AuthGuard>
      <ProfitsView />
    </AuthGuard>
  );
}
