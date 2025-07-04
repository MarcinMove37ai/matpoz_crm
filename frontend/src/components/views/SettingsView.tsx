"use client"

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import dynamic from 'next/dynamic';

const CostKindsTable = dynamic(() => import('../tables/CostKindsTable'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center p-4">
      <span className="text-gray-500">Ładowanie...</span>
    </div>
  )
});

const SettingsView = () => {
  return (
    <div className="space-y-6">
  <div className="border-b border-gray-200 pb-4">
    <h2 className="text-2xl font-semibold text-gray-800">Ustawienia systemu</h2>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <Card className="bg-blue-50">
      <CardContent className="p-6">
        <CostKindsTable />
      </CardContent>
    </Card>
  </div>
</div>
  );
};

export default SettingsView;