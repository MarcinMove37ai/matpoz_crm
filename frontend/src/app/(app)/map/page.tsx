import { Metadata } from "next"
import MapView from "@/components/views/MapView"
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = {
  title: "Mapa Klientów - CRM",
  description: "Moduł mapy klientów systemu CRM",
}

export default function MapPage() {
  return (
    <AuthGuard>
      <MapView />
    </AuthGuard>
  );
}
