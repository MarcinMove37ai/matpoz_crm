// src/app/salpa/client-page.tsx
"use client"

import React, { Suspense, lazy } from "react"
import NoSSR from "../../utils/NoSSR"

// Proper way to lazy load a component
const SalpaComponent = lazy(() => import("@/components/views/Salpa"));

export default function ClientSalpa() {
  // Loading indicator - only shown when component is loading
  const LoadingIndicator = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse h-32 w-32 bg-blue-200 rounded-full"></div>
    </div>
  );

  return (
    <NoSSR>
      <Suspense fallback={<LoadingIndicator />}>
        <SalpaComponent />
      </Suspense>
    </NoSSR>
  );
}