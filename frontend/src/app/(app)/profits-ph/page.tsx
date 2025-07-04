import { Metadata } from "next"
import ProfitsPHView from "@/components/views/ProfitsPHView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Zyski - CRM",
  description: "Moduł zysków ambasadorów systemu CRM",
}

export default function ProfitsPHPage() {
  return (
    <AuthGuard>
      <ProfitsPHView />
    </AuthGuard>
  );
}
