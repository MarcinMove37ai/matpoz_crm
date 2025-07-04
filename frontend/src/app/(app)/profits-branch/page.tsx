import { Metadata } from "next"
import ProfitsBranchView from "@/components/views/ProfitsBranchView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Zyski - CRM",
  description: "Moduł zysków oddziałów systemu CRM",
}

export default function ProfitsBranchPage() {
  return (
    <AuthGuard>
      <ProfitsBranchView />
    </AuthGuard>
  );
}
