import { Metadata } from "next";
import RepresentativesSalesView from "@/components/views/SalesRep";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Przedstawiciele - CRM",
  description: "Moduł przedstawicieli handlowych systemu CRM",
};

export default function SalesRepresentatives() {
  return (
    <AuthGuard>
      <RepresentativesSalesView />
    </AuthGuard>
  );
}