import { Metadata } from "next"
import CostsViewIluo from "@/components/views/CostsViewIluo"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Koszty ILUO (beta) - CRM",
  description: "Moduł kosztów ILUO (dane z ERP) systemu CRM",
}

export default function CostsIluoPage() {
  return (
    <AuthGuard>
      <CostsViewIluo />
    </AuthGuard>
  );
}