"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  PiggyBank,
  RotateCcw,
  Monitor
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- SEKCJA POMOCNICZA: TYPY I FUNKCJE ---

const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(numValue);
};

// Typy danych
export type ProfitCategoryData = {
  firm: number;
  branches: number;
  ph: number;
  fund: number;
  total: number;
  firmPaid?: number;
  branchesPaid?: number;
  phPaid?: number;
  fundPaid?: number;
  totalPaid?: number;
};

export type ProfitData = {
  profitCN: ProfitCategoryData;
  costs: ProfitCategoryData;
  netProfit: ProfitCategoryData;
};

// NOWY typ dla danych zwracanych z funkcji agregującej
export type CompanyDataPackage = {
    aggregatedData: ProfitData;
    headquartersCosts: ProfitCategoryData;
    totalCosts: ProfitCategoryData;
    privateCosts: ProfitCategoryData;
    netProfitTotal: ProfitCategoryData;
};

export type HistoricalProfitData = {
  year: number;
  month: number;
  data: CompanyDataPackage;
};

type CurrentDateType = {
  year: number;
  month: number;
  systemYear: number;
} | null;

// Hook do pobierania dostępnych lat (bez zmian)
const useAvailableYears = () => {
  const [yearsData, setYearsData] = useState<{ years: number[], currentYear: number } | null>(null);
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/years');
        const data = await response.json();
        setYearsData(data);
      } catch (err) { console.error('Błąd pobierania dostępnych lat:', err); }
    };
    fetchYears();
  }, []);
  return { yearsData, loading: !yearsData, error: null }; // Uproszczone
};

const getMonthName = (month: number): string => {
  const monthNames = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
  return monthNames[month - 1] || "";
};

const selectStyles = {
  trigger: "h-11 px-3 py-2 justify-between rounded-lg font-medium transition-all duration-200 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md hover:bg-gradient-to-br hover:from-blue-50 hover:to-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white data-[state=open]:border-blue-500 data-[state=open]:ring-4 data-[state=open]:ring-blue-100",
  placeholder: "text-gray-500",
  content: "bg-white border-2 border-blue-200 rounded-lg shadow-2xl",
  item: "mx-0 my-0 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-150 text-gray-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-900 data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-blue-100 data-[highlighted]:to-indigo-100 data-[highlighted]:text-blue-900 data-[highlighted]:outline-none",
};

// --- GŁÓWNA LOGIKA AGREGACJI DANYCH (ZAKTUALIZOWANA) ---

const branchesConfig = {
  groupA: ["Pcim", "Łomża", "Lublin", "Malbork"],
  groupB: ["Rzgów", "Myślibórz", "MG", "STH", "BHP"],
};
const allBranches = [...branchesConfig.groupA, ...branchesConfig.groupB];

const fetchAndAggregateCompanyData = async (year: number, month?: number): Promise<CompanyDataPackage> => {
  const monthQuery = month ? `&month=${month}` : '';

  // Krok 1: Pobierz dane o zyskach i kosztach dla wszystkich oddziałów
  const branchDataPromises = allBranches.map(async (branch) => {
    const branchQuery = `&branch=${encodeURIComponent(branch)}`;
    const salesResponse = await fetch(`/api/aggregated_profits?year=${year}${monthQuery}${branchQuery}`);
    const costsResponse = await fetch(`/api/costs/summary?year=${year}${monthQuery}${branchQuery}`);
    return { branch, salesData: await salesResponse.json(), costsData: await costsResponse.json() };
  });

  const results = await Promise.all(branchDataPromises);

  const aggregatedData: ProfitData = {
    profitCN: { firm: 0, branches: 0, ph: 0, fund: 0, total: 0, firmPaid: 0, branchesPaid: 0, phPaid: 0, fundPaid: 0, totalPaid: 0 },
    costs: { firm: 0, branches: 0, ph: 0, fund: 0, total: 0 },
    netProfit: { firm: 0, branches: 0, ph: 0, fund: 0, total: 0, firmPaid: 0, branchesPaid: 0, phPaid: 0, fundPaid: 0, totalPaid: 0 },
  };

  results.forEach(({ branch, salesData, costsData }) => {
    const s = salesData.data[0] || {};
    const c = costsData.total_summary || {};
    const profitCN = { firm: s.hq_profit || 0, branches: s.branch_profit || 0, ph: s.rep_profit || 0, fund: s.found || 0, firmPaid: s.hq_profit_paid || 0, branchesPaid: s.branch_profit_paid || 0, phPaid: s.rep_profit_paid || 0, fundPaid: s.found_paid || 0 };
    const costs = { firm: c.total_hq_cost || 0, branches: c.total_branch_cost || 0, ph: c.total_ph_cost || 0 };

    if (branchesConfig.groupA.includes(branch)) {
      aggregatedData.profitCN.firm += profitCN.firm + profitCN.fund;
      aggregatedData.profitCN.firmPaid += (profitCN.firmPaid || 0) + (profitCN.fundPaid || 0);
      aggregatedData.profitCN.branches += profitCN.branches;
      aggregatedData.profitCN.branchesPaid += profitCN.branchesPaid || 0;
      aggregatedData.costs.firm += costs.firm;
      aggregatedData.costs.branches += costs.branches;
    } else {
      aggregatedData.profitCN.firm += profitCN.firm + profitCN.fund + profitCN.branches;
      aggregatedData.profitCN.firmPaid += (profitCN.firmPaid || 0) + (profitCN.fundPaid || 0) + (profitCN.branchesPaid || 0);
      aggregatedData.costs.firm += costs.firm + costs.branches;
    }

    aggregatedData.profitCN.ph += profitCN.ph;
    aggregatedData.profitCN.phPaid += profitCN.phPaid || 0;
    aggregatedData.costs.ph += costs.ph;
  });

  const calculateTotals = (category: ProfitCategoryData) => {
    category.total = category.firm + category.branches + category.ph;
    if (category.totalPaid !== undefined) {
      category.totalPaid = (category.firmPaid || 0) + (category.branchesPaid || 0) + (category.phPaid || 0);
    }
  };
  calculateTotals(aggregatedData.profitCN);
  calculateTotals(aggregatedData.costs);

  // === NOWA LOGIKA KOSZTÓW CENTRALI (ZASTĄPIENIE MOCKA) ===
  let totalHqCostValue = 0;
  try {
      const hqCostsUrl = `/api/costs?year=${year}${month ? `&month=${month}` : ''}&branch=HQ&limit=1000`;
      const hqCostsResponse = await fetch(hqCostsUrl);
      if (hqCostsResponse.ok) {
          const hqData = await hqCostsResponse.json();
          if (hqData.costs && Array.isArray(hqData.costs)) {
              totalHqCostValue = hqData.costs.reduce((sum: number, cost: { cost_value: number }) => {
                  return sum + (cost.cost_value || 0);
              }, 0);
          }
      }
  } catch (error) {
      console.error("Błąd podczas pobierania kosztów centrali:", error);
      // W przypadku błędu, koszt centrali wyniesie 0
      totalHqCostValue = 0;
  }

  const headquartersCosts: ProfitCategoryData = {
      firm: totalHqCostValue,
      branches: 0,
      ph: 0,
      fund: 0,
      total: totalHqCostValue,
  };

  const totalCosts: ProfitCategoryData = {
      firm: aggregatedData.costs.firm + headquartersCosts.firm,
      branches: aggregatedData.costs.branches,
      ph: aggregatedData.costs.ph,
      fund: 0,
      total: aggregatedData.costs.total + headquartersCosts.total
  };

  // === ZAKTUALIZOWANE OBLICZENIE ZYSKU NETTO ===
  aggregatedData.netProfit = {
      firm: aggregatedData.profitCN.firm - totalCosts.firm,
      branches: aggregatedData.profitCN.branches - totalCosts.branches,
      ph: aggregatedData.profitCN.ph - totalCosts.ph,
      fund: 0,
      total: 0,
      firmPaid: (aggregatedData.profitCN.firmPaid || 0) - totalCosts.firm,
      branchesPaid: (aggregatedData.profitCN.branchesPaid || 0) - totalCosts.branches,
      phPaid: (aggregatedData.profitCN.phPaid || 0) - totalCosts.ph,
      fundPaid: 0,
      totalPaid: 0,
  };
  calculateTotals(aggregatedData.netProfit);

  // === POBIERANIE KOSZTÓW PRYWATNYCH ===
  let totalPrivateCostValue = 0;
  try {
      const privateCostsUrl = `/api/costs?year=${year}${month ? `&month=${month}` : ''}&branch=Private&limit=1000`;
      const privateCostsResponse = await fetch(privateCostsUrl);
      if (privateCostsResponse.ok) {
          const privateData = await privateCostsResponse.json();
          if (privateData.costs && Array.isArray(privateData.costs)) {
              totalPrivateCostValue = privateData.costs.reduce((sum: number, cost: { cost_value: number }) => {
                  return sum + (cost.cost_value || 0);
              }, 0);
          }
      }
  } catch (error) {
      console.error("Błąd podczas pobierania kosztów prywatnych:", error);
      totalPrivateCostValue = 0;
  }

  const privateCosts: ProfitCategoryData = {
      firm: totalPrivateCostValue,
      branches: 0,
      ph: 0,
      fund: 0,
      total: totalPrivateCostValue,
  };

  // === OBLICZENIE ZYSKU NETTO TOTAL (po odjęciu kosztów prywatnych) ===
  const netProfitTotal: ProfitCategoryData = {
      firm: aggregatedData.netProfit.firm - privateCosts.firm,
      branches: aggregatedData.netProfit.branches,
      ph: aggregatedData.netProfit.ph,
      fund: 0,
      total: 0,
      firmPaid: (aggregatedData.netProfit.firmPaid || 0) - privateCosts.firm,
      branchesPaid: aggregatedData.netProfit.branchesPaid || 0,
      phPaid: aggregatedData.netProfit.phPaid || 0,
      fundPaid: 0,
      totalPaid: 0,
  };
  calculateTotals(netProfitTotal);

  return { aggregatedData, headquartersCosts, totalCosts, privateCosts, netProfitTotal };
};

// --- GŁÓWNY KOMPONENT WIDOKU (ZAKTUALIZOWANY) ---

const CompanyView: React.FC = () => {
  const { userRole } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading } = useAvailableYears();

  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState<CurrentDateType>(null);
  const [loadingStates, setLoadingStates] = useState({ date: true, yearly: true, monthly: true, historical: false });
  const [error, setError] = useState<string | null>(null);

  const [yearlyData, setYearlyData] = useState<CompanyDataPackage | null>(null);
  const [monthlyData, setMonthlyData] = useState<CompanyDataPackage | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalProfitData[]>([]);

  const canViewProfitData = userRole === 'ADMIN' || userRole === 'BOARD';

  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) setSelectedYear(yearsData.currentYear);
  }, [selectedYear, yearsData]);

  useEffect(() => {
    if (!selectedYear) return;
    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        setCurrentDate({ year: selectedYear, month: data.month, systemYear: data.year });
        setLoadingStates(prev => ({ ...prev, date: false }));
      } catch (err) { setError('Błąd ładowania daty'); setLoadingStates(prev => ({ ...prev, date: false })); }
    };
    fetchDate();
  }, [selectedYear]);

  useEffect(() => {
    if (!selectedYear) return;
    const fetchYearly = async () => {
      setLoadingStates(prev => ({ ...prev, yearly: true }));
      try {
        const data = await fetchAndAggregateCompanyData(selectedYear);
        setYearlyData(data);
      } catch (err) { setError('Błąd ładowania danych rocznych'); } finally { setLoadingStates(prev => ({ ...prev, yearly: false })); }
    };
    fetchYearly();
  }, [selectedYear]);

  useEffect(() => {
    if (!currentDate) return;
    const fetchMonthly = async () => {
      setLoadingStates(prev => ({ ...prev, monthly: true }));
      try {
        const data = await fetchAndAggregateCompanyData(currentDate.year, currentDate.month);
        setMonthlyData(data);
      } catch (err) { setError('Błąd ładowania danych miesięcznych'); } finally { setLoadingStates(prev => ({ ...prev, monthly: false })); }
    };
    fetchMonthly();
  }, [currentDate]);

  useEffect(() => {
    if (!isExpanded || !currentDate) return;
    const fetchHistorical = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      const months = [];
      const startMonth = currentDate.year === currentDate.systemYear ? currentDate.month - 1 : 12;
      for (let m = startMonth; m >= 1; m--) months.push({ year: currentDate.year, month: m });

      try {
        const promises = months.map(m => fetchAndAggregateCompanyData(m.year, m.month).then(data => ({ ...m, data })));
        setHistoricalData(await Promise.all(promises));
      } catch (err) { setError('Błąd ładowania danych historycznych'); } finally { setLoadingStates(prev => ({ ...prev, historical: false })); }
    };
    fetchHistorical();
  }, [isExpanded, currentDate]);

  useEffect(() => {
    if (historicalRef.current) setContentHeight(historicalRef.current.scrollHeight);
  }, [historicalData, isExpanded]);

  if (!canViewProfitData) {
    return (
      <Card><CardContent className="p-6 text-center"><PiggyBank className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h2 className="text-xl font-semibold">Brak dostępu</h2><p className="text-gray-500">Nie masz uprawnień.</p></CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Zysk Firmy + wszystkie koszty</h2>
        <Select value={selectedYear?.toString() ?? ''} onValueChange={(v) => setSelectedYear(parseInt(v))} disabled={yearsLoading}>
          <SelectTrigger className={`${selectStyles.trigger} w-32`}><SelectValue placeholder="Rok..." /></SelectTrigger>
          <SelectContent className={`${selectStyles.content} w-32`}>{yearsData?.years?.map((year) => (<SelectItem className={selectStyles.item} key={year} value={year.toString()}>{year}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      {/* Legenda (bez zmian) */}
      <div className="hidden sm:block p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700"><h3 className="font-semibold text-base text-gray-800 mb-2">Legenda Agregacji</h3><ul className="list-disc list-inside space-y-1"><li><span className="font-semibold">Firma:</span> Suma kolumn "Firma" i "Fundusz" z oddziałów (Pcim, Łomża, Lublin, Malbork) ORAZ suma kolumn "Firma", "Fundusz" i "Oddziały" z pozostałych jednostek (Rzgów, Myślibórz, MG, STH, BHP).</li><li><span className="font-semibold">Oddziały:</span> Suma wartości wyłącznie z kolumn "Oddział" dla oddziałów: Pcim, Łomża, Lublin, Malbork.</li><li><span className="font-semibold">PH:</span> Łączna suma wartości z kolumn "PH" ze wszystkich bez wyjątku oddziałów.</li><li><span className="font-semibold">Total:</span> Suma nowo obliczonych, zagregowanych kolumn: Firma + Oddziały + PH.</li></ul></div>

      {loadingStates.date || loadingStates.yearly ? (
         <Card className="w-full bg-blue-50"><CardContent className="p-3"><div className="animate-pulse space-y-4"><div className="h-10 bg-gray-200 rounded w-1/4" /><div className="space-y-3"><div className="h-6 bg-gray-200 rounded w-full" /><div className="h-6 bg-gray-200 rounded w-full" /><div className="h-6 bg-gray-200 rounded w-full" /></div></div></CardContent></Card>
      ) : error ? (
         <Card className="w-full bg-red-50"><CardContent className="p-3 text-red-500">{error}</CardContent></Card>
      ) : yearlyData ? (
        <Card className="w-full bg-blue-50">
          <CardContent className="p-0">
             <div className="flex flex-col p-3 pb-2">
                 {/* Nagłówki kolumn */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center border-b border-gray-300 pb-2">
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-100"><Building2 className="h-5 w-5 text-blue-500" /><span className="text-sm font-medium text-blue-700">Suma</span></div>
                    <div className="text-center"><span className="text-xs font-medium text-gray-500">Firma</span><div className="text-xs text-gray-400">(opłacona)</div></div>
                    <div className="hidden sm:block text-center"><span className="text-xs font-medium text-gray-500">Oddziały</span><div className="text-xs text-gray-400">(opłacone)</div></div>
                    <div className="hidden sm:block text-center"><span className="text-xs font-medium text-gray-500">PH</span><div className="text-xs text-gray-400">(opłacone)</div></div>
                    <div className="text-center"><span className="text-xs font-medium text-gray-500">Total</span><div className="text-xs text-gray-400">(opłacony)</div></div>
                </div>

                {/* === ZAKTUALIZOWANE WIERSZE DANYCH ROCZNYCH === */}
                <DataRows dataPackage={yearlyData} />

            </div>

            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-center pt-1 pb-0-5 text-xs text-gray-500 hover:text-gray-700 mt-1 mb-1">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>

            <div style={{ maxHeight: isExpanded ? contentHeight : 0 }} className="overflow-hidden transition-all duration-300 ease-in-out">
              <div ref={historicalRef} className="px-3 py-2 space-y-4">
                {loadingStates.historical ? (<div className="animate-pulse space-y-2"><div className="h-6 bg-gray-200 rounded w-full" /><div className="h-6 bg-gray-200 rounded w-full" /></div>
                ) : (
                  <>
                  {monthlyData && currentDate && currentDate.year === currentDate.systemYear && (<MonthlyDataBlock dataPackage={monthlyData} year={currentDate.year} month={currentDate.month} />)}
                  {historicalData.map((monthData, idx) => (<MonthlyDataBlock key={idx} dataPackage={monthData.data} year={monthData.year} month={monthData.month} />))}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

// Komponent pomocniczy do wyświetlania bloku miesięcznego (zaktualizowany)
const MonthlyDataBlock: React.FC<{ dataPackage: CompanyDataPackage, year: number, month: number }> = ({ dataPackage, year, month }) => (
  <div>
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center border-b border-gray-200 pb-2 mb-2">
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-red-100"><Calendar className="h-4 w-4 text-red-500" /><span className="text-xs font-medium text-red-700">{getMonthName(month)} {year}</span></div>
       <div className="text-center"><span className="text-xs font-medium text-gray-500">Firma</span></div>
       <div className="hidden sm:block text-center"><span className="text-xs font-medium text-gray-500">Oddziały</span></div>
       <div className="hidden sm:block text-center"><span className="text-xs font-medium text-gray-500">PH</span></div>
       <div className="text-center"><span className="text-xs font-medium text-gray-500">Total</span></div>
    </div>
    <DataRows dataPackage={dataPackage} />
  </div>
);

// NOWY komponent pomocniczy do renderowania wierszy, aby uniknąć powtórzeń
const DataRows: React.FC<{ dataPackage: CompanyDataPackage }> = ({ dataPackage }) => {
    const { aggregatedData, headquartersCosts, totalCosts, privateCosts, netProfitTotal } = dataPackage;
    return (
        <div>
            {/* Wiersz Zysk CN */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1">
                <div className="ml-2"><span className="text-xs font-medium text-gray-700">Zysk CN</span></div>
                <div className="text-center"><span className="text-sm font-medium text-gray-800">{formatCurrency(aggregatedData.profitCN.firm)}</span><div className="text-xs text-gray-600">({formatCurrency(aggregatedData.profitCN.firmPaid || 0)})</div></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-gray-800">{formatCurrency(aggregatedData.profitCN.branches)}</span><div className="text-xs text-gray-600">({formatCurrency(aggregatedData.profitCN.branchesPaid || 0)})</div></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-gray-800">{formatCurrency(aggregatedData.profitCN.ph)}</span><div className="text-xs text-gray-600">({formatCurrency(aggregatedData.profitCN.phPaid || 0)})</div></div>
                <div className="text-center"><span className="text-sm font-medium text-gray-800">{formatCurrency(aggregatedData.profitCN.total)}</span><div className="text-xs text-gray-600">({formatCurrency(aggregatedData.profitCN.totalPaid || 0)})</div></div>
            </div>
            {/* Wiersz Koszty */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1 border-t border-gray-200">
                <div className="ml-2"><span className="text-xs font-medium text-gray-700">Koszty oddziały</span></div>
                <div className="text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(aggregatedData.costs.firm)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(aggregatedData.costs.branches)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(aggregatedData.costs.ph)}</span></div>
                <div className="text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(aggregatedData.costs.total)}</span></div>
            </div>
             {/* NOWY Wiersz Koszty centrala */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1">
                <div className="ml-2"><span className="text-xs font-medium text-gray-700">Koszty centrala</span></div>
                <div className="text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(headquartersCosts.firm)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">-</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">-</span></div>
                <div className="text-center"><span className="text-sm font-medium text-red-600">{formatCurrency(headquartersCosts.total)}</span></div>
            </div>
            {/* NOWY Wiersz Koszty suma */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1 border-t border-gray-200 font-bold">
                <div className="ml-2"><span className="text-xs text-gray-700">Koszty suma</span></div>
                <div className="text-center"><span className="text-sm text-red-700">{formatCurrency(totalCosts.firm)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm text-red-700">{formatCurrency(totalCosts.branches)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm text-red-700">{formatCurrency(totalCosts.ph)}</span></div>
                <div className="text-center"><span className="text-sm text-red-700">{formatCurrency(totalCosts.total)}</span></div>
            </div>
            {/* Wiersz Zysk Netto Firma */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1 bg-blue-100 rounded-md mt-1">
                <div className="ml-2"><span className="text-xs font-bold text-gray-700">Zysk netto Firma</span></div>
                <div className="text-center"><span className="text-sm font-bold text-blue-600">{formatCurrency(aggregatedData.netProfit.firm)}</span><div className="text-xs text-blue-400">({formatCurrency(aggregatedData.netProfit.firmPaid || 0)})</div></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-bold text-blue-600">{formatCurrency(aggregatedData.netProfit.branches)}</span><div className="text-xs text-blue-400">({formatCurrency(aggregatedData.netProfit.branchesPaid || 0)})</div></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-bold text-blue-600">{formatCurrency(aggregatedData.netProfit.ph)}</span><div className="text-xs text-blue-400">({formatCurrency(aggregatedData.netProfit.phPaid || 0)})</div></div>
                <div className="text-center"><span className="text-sm font-bold text-blue-600">{formatCurrency(aggregatedData.netProfit.total)}</span><div className="text-xs text-blue-400">({formatCurrency(aggregatedData.netProfit.totalPaid || 0)})</div></div>
            </div>
            {/* NOWY Wiersz Koszty prywatne */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1 border-t border-gray-200 mt-1">
                <div className="ml-2"><span className="text-xs font-medium text-gray-700">Koszty prywatne</span></div>
                <div className="text-center"><span className="text-sm font-medium text-orange-600">{formatCurrency(privateCosts.firm)}</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">-</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-medium text-red-600">-</span></div>
                <div className="text-center"><span className="text-sm font-medium text-red-600">-</span></div>
            </div>
            {/* NOWY Wiersz Zysk netto total */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center py-1 bg-blue-100 rounded-md mt-1">
                <div className="ml-2"><span className="text-xs font-bold text-gray-700">Zysk netto Total</span></div>
                <div className="text-center"><span className="text-sm font-bold text-blue-600">{formatCurrency(netProfitTotal.firm)}</span><div className="text-xs text-blue-400">({formatCurrency(netProfitTotal.firmPaid || 0)})</div></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-bold text-blue-600">-</span></div>
                <div className="hidden sm:block text-center"><span className="text-sm font-bold text-blue-600">-</span></div>
                <div className="text-center"><span className="text-sm font-bold text-blue-600">-</span></div>
            </div>
        </div>
    );
};

export default CompanyView;