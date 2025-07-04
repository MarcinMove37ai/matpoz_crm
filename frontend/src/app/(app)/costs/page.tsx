import { Metadata } from "next"
import CostsView from "@/components/views/CostsView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Koszty - CRM",
  description: "Moduł kosztów systemu CRM",
}

export default function CostsPage() {
  return (
    <AuthGuard>
      <CostsView />
    </AuthGuard>
  );
}