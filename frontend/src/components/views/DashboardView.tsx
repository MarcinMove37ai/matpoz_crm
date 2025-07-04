"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  Monitor,
  Wrench,
  HardHat,
} from 'lucide-react';
import { useTransactionData } from '@/hooks/useTransactionData';

interface BasicTransactionData {
  netSales: number;
  paidSales: number;
}

interface FullTransactionData {
  netSales: number;
  profit: number;
  paidSales: number;
  paidProfit: number;
}

interface BasicHistoricalData extends BasicTransactionData {
  month: string;
}

interface FullHistoricalData extends FullTransactionData {
  month: string;
}

interface BranchData {
  total: FullTransactionData;
  daily: FullTransactionData;
  monthly: FullTransactionData;
  historical: FullHistoricalData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
};

// Zaktualizowana tablica oddziałów – nowe oddziały MG, STH, BHP
const branches = [
  { id: 2, name: 'Pcim' },
  { id: 1, name: 'Rzgów' },
  { id: 4, name: 'Malbork' },
  { id: 3, name: 'Łomża' },
  { id: 5, name: 'Lublin' },
  { id: 6, name: 'Myślibórz' },
  { id: 7, name: 'MG' },
  { id: 8, name: 'STH' },
  { id: 9, name: 'BHP' },
];

// SUMA block components
const SummaryTimeRow = ({
  icon: Icon,
  label,
  data,
}: {
  icon: React.ElementType;
  label: string;
  data: FullTransactionData;
}) => (
  <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-2">
    <div className="flex items-center gap-1">
      <Icon className="h-4 w-4 text-gray-500" />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-gray-900">
        {formatCurrency(data.netSales)}
      </span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-blue-600">
        {formatCurrency(data.profit)}
      </span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-green-600">
        {formatCurrency(data.paidSales)}
      </span>
    </div>
  </div>
);

const SummaryHistoricalRow = ({ data }: { data: FullHistoricalData }) => (
  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-6 items-center py-3 border-b border-gray-200 last:border-0">
    <div className="flex items-center gap-2 text-left">
      <Calendar className="h-4 w-4 text-gray-500" />
      <span className="text-xs text-gray-600">{data.month}</span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-gray-900">
        {formatCurrency(data.netSales)}
      </span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-blue-600">
        {formatCurrency(data.profit)}
      </span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-green-600">
        {formatCurrency(data.paidSales)}
      </span>
    </div>
    <div className="text-center">
      <span className="text-xs font-medium text-purple-600">
        {formatCurrency(data.paidProfit)}
      </span>
    </div>
  </div>
);

// Branch card component (używany zarówno dla przedstawicieli, jak i oddziałów)
interface BranchCardProps {
  branch: {
    id: number;
    name: string;
    isRepresentative?: boolean;
  };
  index: number;
  expandedIndices: boolean[];
  setExpandedIndices: React.Dispatch<React.SetStateAction<boolean[]>>;
}

const BranchCard: React.FC<BranchCardProps> = ({
  branch,
  index,
  expandedIndices,
  setExpandedIndices,
}) => {
  const isRepresentative = branch.isRepresentative;
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedIndices[index] === true;

  // Ustalenie kolorów tła karty i nagłówka w zależności od oddziału
  let cardBg = "bg-gray-50";
  let headerBg = "bg-gray-50";

  if (!isRepresentative) {
    if (branch.name === "MG") {
      cardBg = "bg-red-50";
      headerBg = "bg-red-100";
    } else if (branch.name === "STH") {
      cardBg = "bg-purple-50";
      headerBg = "bg-purple-100";
    } else if (branch.name === "BHP") {
      // BHP - bez zmian, czyli pozostajemy przy domyślnych klasach
      cardBg = "bg-yellow-50";
      headerBg = "bg-yellow-100";
    }
  }

  // Funkcja zwracająca nagłówek karty w zależności od oddziału
  const getBranchHeader = () => {
    if (branch.name === "MG") {
      return (
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Internet</h3>
        </div>
      );
    } else if (branch.name === "STH") {
      return (
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-800">Serwis</h3>
        </div>
      );
    } else if (branch.name === "BHP") {
      return (
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">BHP</h3>
        </div>
      );
    } else {
      return <h3 className="text-lg font-semibold text-gray-800">{branch.name}</h3>;
    }
  };

  const { data: branchData, loading, error } = useTransactionData(
    isRepresentative ? undefined : branch.name,
    { isRepresentative }
  );

  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [isExpanded]);

  if (loading) {
    return (
      <Card className={`w-full ${isRepresentative ? 'bg-blue-50' : cardBg}`}>
        <CardContent className="p-3">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !branchData) {
    return (
      <Card className="w-full bg-red-50">
        <CardContent className="p-3">
          <div className="text-red-600">Błąd ładowania danych</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${isRepresentative ? 'bg-blue-50' : cardBg}`}>
      <CardContent className="flex flex-col p-3 pb-2">
        <div className="pb-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex items-end">
              <div className={`rounded-lg px-3 py-2 ${isRepresentative ? 'bg-white' : headerBg}`}>
                {isRepresentative ? (
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-800">PH</h3>
                  </div>
                ) : (
                  getBranchHeader()
                )}
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <span className="text-xs text-gray-500 text-center">Sprzedaż netto</span>
              <p className="text-sm font-bold text-gray-900 text-center">
                {formatCurrency(branchData.total.netSales)}
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <span className="text-xs text-gray-500 text-center">Zysk netto (CN)</span>
              <p className="text-sm font-bold text-blue-600 text-center">
                {formatCurrency(branchData.total.profit)}
              </p>
            </div>
          </div>
          <div className="border-b border-gray-400"></div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-600">Dziś</span>
            </div>
            <div className="text-center">
              <span className="text-xs font-medium text-gray-900">
                {formatCurrency(branchData.daily.netSales)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-medium text-blue-600">
                {formatCurrency(branchData.daily.profit)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-600">Miesiąc</span>
            </div>
            <div className="text-center">
              <span className="text-xs font-medium text-gray-900">
                {formatCurrency(branchData.monthly.netSales)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-medium text-blue-600">
                {formatCurrency(branchData.monthly.profit)}
              </span>
            </div>
          </div>
        </div>

        {branchData.historical.length > 0 && (
          <>
            <button
              onClick={() => {
                setExpandedIndices((prev) => {
                  const newIndices = [...prev];
                  newIndices[index] = !newIndices[index];
                  return newIndices;
                });
              }}
              className="w-full flex items-center justify-center pt-1 pb-0.5 text-xs text-gray-500 hover:text-gray-700 mt-4"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <div
              style={{ maxHeight: isExpanded ? contentHeight : 0 }}
              className="overflow-hidden transition-all duration-300 ease-in-out"
            >
              <div ref={historicalRef} className="px-3 py-2">
                {branchData.historical.map((monthData, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-3 gap-2 py-2 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        {monthData.month}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium text-gray-900">
                        {formatCurrency(monthData.netSales)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium text-blue-600">
                        {formatCurrency(monthData.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Main SUMA card component
const SummaryCard = () => {
  const [contentHeight, setContentHeight] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const historicalRef = useRef<HTMLDivElement>(null);
  const { data: totalData, loading, error } = useTransactionData();

  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [isExpanded]);

  if (loading) {
    return (
      <div className="mb-6">
        <Card className="w-full bg-green-50">
          <CardContent className="flex flex-col p-3">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 rounded w-1/4" />
              <div className="space-y-3">
                <div className="h-6 bg-gray-200 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !totalData) {
    return (
      <div className="mb-6">
        <Card className="w-full bg-red-50">
          <CardContent className="p-3">
            <div className="text-red-600">Błąd ładowania danych</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderDataRow = (
    label: string,
    data: FullTransactionData,
    icon: React.ReactNode
  ) => (
    <div
      className={`grid grid-cols-3 sm:grid-cols-5 gap-6 items-center ${
        label === 'Dziś' ? 'border-b border-gray-200 pb-3' : ''
      }`}
    >
      <div className="flex items-center gap-2 text-left">
        {icon}
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className="text-center">
        <span className="text-xs font-medium text-gray-900">
          {formatCurrency(data.netSales)}
        </span>
      </div>
      <div className="text-center">
        <span className="text-xs font-medium text-blue-600">
          {formatCurrency(data.profit)}
        </span>
      </div>
      <div className="text-center hidden sm:block">
        <span className="text-xs font-medium text-green-600">
          {formatCurrency(data.paidSales)}
        </span>
      </div>
      <div className="text-center hidden sm:block">
        <span className="text-xs font-medium text-purple-600">
          {formatCurrency(data.paidProfit)}
        </span>
      </div>
    </div>
  );

  const renderHistoricalRow = (data: FullHistoricalData) => (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 items-center py-2 border-b border-gray-200 last:border-0">
      <div className="flex items-center gap-2 text-left min-w-[100px]">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">
          {data.month}
        </span>
      </div>
      <div className="text-center w-full">
        <span className="text-xs font-semibold text-gray-900">
          {formatCurrency(data.netSales)}
        </span>
      </div>
      <div className="text-center w-full">
        <span className="text-xs font-semibold text-blue-600">
          {formatCurrency(data.profit)}
        </span>
      </div>
      <div className="text-center w-full hidden sm:block">
        <span className="text-xs font-semibold text-green-600">
          {formatCurrency(data.paidSales)}
        </span>
      </div>
      <div className="text-center w-full hidden sm:block">
        <span className="text-xs font-semibold text-purple-600">
          {formatCurrency(data.paidProfit)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      <Card className="w-full bg-green-50">
        <CardContent className="flex flex-col p-3 pb-2">
          <div className="pb-0">
            {/* Nagłówek karty "Suma" */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 items-center mb-4">
              <div className="flex items-center gap-2 text-left">
                <Building2 className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-800">Suma</h3>
              </div>
              <div className="text-center">
                <span className="text-xs font-medium text-gray-600">Sprzedaż netto</span>
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(totalData.total.netSales)}
                </p>
              </div>
              <div className="text-center">
                <span className="text-xs font-medium text-blue-600">Zysk netto (CN)</span>
                <p className="text-sm font-bold text-blue-600">
                  {formatCurrency(totalData.total.profit)}
                </p>
              </div>
              <div className="text-center hidden sm:block">
                <span className="text-xs font-medium text-green-600">Zapłacone netto</span>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(totalData.total.paidSales)}
                </p>
              </div>
              <div className="text-center hidden sm:block">
                <span className="text-xs font-medium text-purple-600">Zysk netto zapłacone (CN)</span>
                <p className="text-sm font-bold text-purple-600">
                  {formatCurrency(totalData.total.paidProfit)}
                </p>
              </div>
            </div>

            <div className="border-b border-gray-300 mb-4"></div>

            {/* Daily i Monthly */}
            <div className="space-y-3">
              {renderDataRow(
                'Dziś',
                totalData.daily,
                <Clock className="h-4 w-4 text-gray-500" />
              )}
              {renderDataRow(
                'Miesiąc',
                totalData.monthly,
                <CalendarDays className="h-4 w-4 text-gray-500" />
              )}
            </div>

            {/* Toggle button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center pt-1 pb-0.5 text-xs text-gray-500 hover:text-gray-700 mt-4"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Historical data */}
            <div
              style={{ maxHeight: isExpanded ? contentHeight : 0 }}
              className="overflow-hidden transition-all duration-300 ease-in-out"
            >
              <div ref={historicalRef} className="px-3 py-2">
                {totalData.historical.map((monthData, idx) => (
                  <React.Fragment key={idx}>
                    {renderHistoricalRow(monthData)}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main DashboardView component
const DashboardView = () => {
  const [expandedIndices, setExpandedIndices] = useState(
    new Array(branches.length).fill(false)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
        <SummaryCard />
      </div>
      {branches.map((branch, index) => (
        <div key={branch.id} className="mb-4">
          <BranchCard
            branch={branch}
            index={index}
            expandedIndices={expandedIndices}
            setExpandedIndices={setExpandedIndices}
          />
        </div>
      ))}
    </div>
  );
};

export default DashboardView;
