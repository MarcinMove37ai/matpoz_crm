"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Calendar,
  User,
  Users,
  Monitor,
  RotateCcw,
  HomeIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// DODANO: Import komponentu SearchableSelect
import SearchableSelect from "@/components/ui/SearchableSelect";

// Import zmodyfikowanego interceptora dla anulowania zapytań przy zmianie roku
import { useEnhancedRequestCancellation } from '@/utils/enhancedFetchInterceptor';

//
// Funkcje pomocnicze – formatowanie waluty, procentu oraz daty
//
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercentage = (value: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

const TEXT_COLOR = 'text-gray-800';
const TEXT_COLOR_HOVER = 'hover:text-gray-900';

const selectStyles = {
      /**
       * Styl dla głównego przycisku (triggera) selekta.
       * Zmieniono px-4 na px-3, aby zmniejszyć poziomy padding i poprawić balans wizualny.
       */
      trigger:
        "h-11 px-3 py-2 justify-between rounded-lg font-medium transition-all duration-200 " + // ZMIANA TUTAJ
        "bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 text-gray-700 " +
        "hover:border-blue-300 hover:shadow-md hover:bg-gradient-to-br hover:from-blue-50 hover:to-white " +
        "focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white " +
        "data-[state=open]:border-blue-500 data-[state=open]:ring-4 data-[state=open]:ring-blue-100",

      /**
       * Styl dla tekstu zastępczego (placeholder), gdy nic nie jest wybrane.
       */
      placeholder:
        "text-gray-500",

      /**
       * Styl dla rozwijanego kontenera z opcjami.
       */
      content:
        "bg-white border-2 border-blue-200 rounded-lg shadow-2xl",

      /**
       * Styl dla pojedynczej opcji na liście.
       */
      item:
        "mx-0 my-0 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-150 text-gray-800 " +
        "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-900 " +
        "data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-blue-100 data-[highlighted]:to-indigo-100 " +
        "data-[highlighted]:text-blue-900 data-[highlighted]:outline-none",
    };
//
// Typy danych
//
export type RepresentativeData = {
  representative_name: string;
  year: number;
  month: number;
  branch_name?: string | null;
  sales_net: number;
  profit_net: number;
  sales_payd: number;
  profit_payd: number;
  sales_payd_percent: number;
  marg_total: number;
};

export type HistoricalDataRepresentative = {
  year: number;
  month: number;
  data: RepresentativeData;
};

// Hook do pobierania dostępnych lat
const useAvailableYears = () => {
  const [yearsData, setYearsData] = useState<{ years: number[], currentYear: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Dodajemy efekt, który wykona się tylko po stronie klienta
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Wykonujemy zapytanie dopiero po pierwszym renderowaniu (tylko po stronie klienta)
    if (!mounted) return;

    const fetchYears = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/years');
        const data = await response.json();
        setYearsData(data);
        setError(null);
      } catch (err) {
        console.error('Błąd pobierania dostępnych lat:', err);
        setError('Nie udało się pobrać listy dostępnych lat');
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
  }, [mounted]);

  return { yearsData, loading, error };
};

//
// Funkcje formatujące daty – zamiana numeru miesiąca na polską nazwę
//
const getMonthName = (month: number): string => {
  const monthNames = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
  ];
  return monthNames[month - 1] || "";
};

const formatMonthYear = (month: number, year: number): string => {
  return `${getMonthName(month)} ${year}`;
};

//
// Komponent SalesViewRepresentative (bez zmian)
//
export type SalesViewRepresentativeProps = {
  representative: string;
  bgColor?: string;
  branchFilter?: string | null;
  selectedYear: number;
  yearlyData: RepresentativeData | null;
  monthlyData: RepresentativeData | null;
  historicalData: RepresentativeData[];
  currentMonth: number;
  onEmptyData?: (representative: string) => void;
  onSalesData?: (representative: string, salesValue: number) => void;
};

export const SalesViewRepresentative: React.FC<SalesViewRepresentativeProps> = ({
  representative,
  bgColor = "bg-gray-50",
  branchFilter,
  selectedYear,
  yearlyData,
  monthlyData,
  historicalData,
  currentMonth,
  onEmptyData,
  onSalesData
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const emptyDataReportedRef = useRef(false);
  const salesDataReportedRef = useRef(false);

  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  useEffect(() => {
    if (yearlyData && onSalesData && !salesDataReportedRef.current) {
      onSalesData(representative, yearlyData.sales_net);
      salesDataReportedRef.current = true;
    }
  }, [yearlyData, representative, onSalesData]);

  useEffect(() => {
    salesDataReportedRef.current = false;
    emptyDataReportedRef.current = false;
  }, [selectedYear]);

  useEffect(() => {
    if (!yearlyData && onEmptyData && !emptyDataReportedRef.current) {
      onEmptyData(representative);
      emptyDataReportedRef.current = true;
    }
  }, [yearlyData, representative, onEmptyData]);

  const renderDataRow = (
    label: string,
    data: RepresentativeData | null,
    icon: React.ReactNode,
    showBorder: boolean = false
  ) => {
    if (!data) return null;
    return (
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center ${showBorder ? 'border-b border-gray-200 pb-3' : ''}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-xs ${TEXT_COLOR}`}>{label}</span>
          {data.branch_name && (
            <span className="text-xs text-gray-500 ml-1">({data.branch_name})</span>
          )}
        </div>
        <div className="text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatCurrency(data.sales_net)}</span>
        </div>
        <div className="text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatCurrency(data.profit_net)}</span>
        </div>
        <div className="hidden md:block text-center">
          <span className={`text-xs font-medium text-green-600`}>{formatCurrency(data.sales_payd)}</span>
        </div>
        <div className="hidden lg:block text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatPercentage(data.sales_payd_percent)}</span>
        </div>
        <div className="hidden xl:block text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatPercentage(data.marg_total)}</span>
        </div>
        <div className="hidden sm:block text-center">
          <span className={`text-xs font-medium text-red-600`}>{formatCurrency(data.profit_payd)}</span>
        </div>
      </div>
    );
  };

  if (!yearlyData) {
    return null;
  }

  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="flex flex-col p-3 pb-2">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">
              {representative}
            </h3>
            {branchFilter && (
              <span className="text-sm font-medium text-blue-600 ml-2">
              </span>
            )}
          </div>
          <div className="text-center">
            <span className="text-xs font-medium text-gray-800">Sprzedaż netto</span>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(yearlyData ? yearlyData.sales_net : 0)}</p>
          </div>
          <div className="text-center">
            <span className="text-xs font-medium text-blue-800">Zysk netto</span>
            <p className="text-sm font-bold text-blue-800">{formatCurrency(yearlyData ? yearlyData.profit_net : 0)}</p>
          </div>
          <div className="hidden md:block text-center">
            <span className="text-xs font-medium text-green-700">Sprzedaż opłacona</span>
            <p className="text-sm font-bold text-green-700">{formatCurrency(yearlyData ? yearlyData.sales_payd : 0)}</p>
          </div>
          <div className="hidden lg:block text-center">
            <span className="text-xs font-medium text-gray-800">% Sprzedaży opłaconej</span>
            <p className="text-sm font-bold text-gray-800">{formatPercentage(yearlyData ? yearlyData.sales_payd_percent : 0)}</p>
          </div>
          <div className="hidden xl:block text-center">
            <span className="text-xs font-medium text-blue-800">% Marży</span>
            <p className="text-sm font-bold text-blue-800">{formatPercentage(yearlyData ? yearlyData.marg_total : 0)}</p>
          </div>
          <div className="hidden sm:block text-center">
            <span className="text-xs font-medium text-red-800">Zysk opłacony</span>
            <p className="text-sm font-bold text-red-800">{formatCurrency(yearlyData ? yearlyData.profit_payd : 0)}</p>
          </div>
        </div>

        <div className="border-b border-gray-300 mb-4"></div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center pt-1 pb-0.5 text-xs ${TEXT_COLOR} ${TEXT_COLOR_HOVER} mt-4`}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <div
          style={{ maxHeight: isExpanded ? contentHeight : 0 }}
          className="overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div ref={historicalRef} className="space-y-3 px-0 py-5">
            {historicalData.map((monthData, idx) => (
              <div key={`${monthData.month}-${monthData.year}-${monthData.branch_name || idx}`}>
                {renderDataRow(
                  formatMonthYear(monthData.month, monthData.year),
                  monthData,
                  <Calendar className="h-4 w-4 text-gray-500" />,
                  idx !== historicalData.length - 1
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

//
// Komponent rodzicielski
//
const RepresentativesSalesView: React.FC = () => {
  const [allData, setAllData] = useState<RepresentativeData[]>([]);
  const [representatives, setRepresentatives] = useState<string[]>([]);
  const [sortedRepresentatives, setSortedRepresentatives] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<{ year: number; month: number } | null>(null);
  const [representativesSalesData, setRepresentativesSalesData] = useState<{[representative: string]: number}>({});
  const { userRole: authUserRole, userBranch: authUserBranch, user } = useAuth();
  const [onlyRepresentative, setOnlyRepresentative] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  // DODANO: Stan dla filtra przedstawicieli
  const [representativeFilter, setRepresentativeFilter] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEnhancedRequestCancellation({
    contextValue: selectedYear,
    debug: true
  });

  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      setAllData([]);
      setRepresentativesSalesData({});
      setSortedRepresentatives([]);
      // DODANO: Reset filtra przedstawiciela przy zmianie roku
      setRepresentativeFilter(null);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (!mounted || !selectedYear) return;
    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        setCurrentDate({ year: selectedYear, month: data.month });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error(`Błąd pobierania daty:`, err);
          setError('Błąd ładowania daty');
        }
      }
    };
    fetchDate();
  }, [selectedYear, mounted]);

  useEffect(() => {
    if (!mounted || !selectedYear || !currentDate) return;
    const fetchAllRepresentativesData = async () => {
      try {
        setLoading(true);
        let url = `/api/aggregated_representative_ind_data?year=${selectedYear}`;
        if (branchFilter) {
          url += `&branch_name=${encodeURIComponent(branchFilter)}`;
        }
        const response = await fetch(url);
        const result = await response.json();

        if (!result.data || result.data.length === 0) {
          setLoading(false);
          return;
        }
        setAllData(result.data);

        const repNames = [...new Set(
          result.data
            .filter((item: RepresentativeData) => item.representative_name)
            .map((item: RepresentativeData) => item.representative_name)
        )];
        setRepresentatives(repNames as string[]);

        const salesData: {[representative: string]: number} = {};
        repNames.forEach(rep => {
          const repData = result.data.filter((item: RepresentativeData) =>
            item.representative_name === rep
          );
          const totalSales = repData.reduce((sum: number, item: RepresentativeData) =>
            sum + item.sales_net, 0
          );
          if (totalSales > 0) {
            salesData[rep as string] = totalSales;
          }
        });

        const sorted = Object.keys(salesData).sort((a, b) => salesData[b] - salesData[a]);
        setRepresentativesSalesData(salesData);
        setSortedRepresentatives(sorted);
        setLoading(false);

      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Błąd podczas pobierania danych:", err);
          setError('Błąd pobierania danych sprzedażowych');
        }
        setLoading(false);
      }
    };
    fetchAllRepresentativesData();
  }, [selectedYear, branchFilter, currentDate, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (authUserRole === "REPRESENTATIVE") {
      if (user?.fullName) {
        const matchingRepByFullName = representatives.find(
          rep => rep.toLowerCase() === user.fullName?.toLowerCase()
        );
        if (matchingRepByFullName) {
          setOnlyRepresentative(matchingRepByFullName);
          setBranchFilter(null);
          return;
        } else {
          setOnlyRepresentative(user.fullName);
          setBranchFilter(null);
          return;
        }
      }
    }
    if (authUserRole === "BRANCH" && authUserBranch) {
      setOnlyRepresentative(null);
      setBranchFilter(authUserBranch);
      return;
    }
    if (authUserRole === "ADMIN" || authUserRole === "BOARD") {
      setOnlyRepresentative(null);
      setBranchFilter(null);
      return;
    }
    setOnlyRepresentative(null);
    setBranchFilter(null);
  }, [authUserRole, user, authUserBranch, representatives, mounted]);

  // DODANO: Handler do zmiany filtra przedstawiciela
  const handleRepresentativeFilterChange = (value: string) => {
    setRepresentativeFilter(value === 'all' ? null : value);
  };

  const getRepresentativeData = useCallback((representative: string) => {
    if (!allData || !currentDate) return {
      yearlyData: null,
      monthlyData: null,
      historicalData: []
    };
    const repData = allData.filter(item =>
      item.representative_name === representative &&
      (!branchFilter || item.branch_name === branchFilter)
    );
    if (repData.length === 0) {
      return { yearlyData: null, monthlyData: null, historicalData: [] };
    }
    const yearData = sumUpMonthlyData(repData, currentDate.year, representative);
    const currentMonthData = repData.find(item =>
      item.year === currentDate.year &&
      item.month === currentDate.month
    ) || null;
    const historicalItems = [...repData].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      if (a.branch_name && b.branch_name) {
        return a.branch_name.localeCompare(b.branch_name);
      }
      return 0;
    });
    return {
      yearlyData: yearData,
      monthlyData: currentMonthData,
      historicalData: historicalItems
    };
  }, [allData, currentDate, branchFilter]);

  const sumUpMonthlyData = (monthlyData: RepresentativeData[], year: number, repName: string): RepresentativeData => {
    if (!monthlyData || monthlyData.length === 0) {
      return { representative_name: repName, year, month: 0, sales_net: 0, profit_net: 0, sales_payd: 0, profit_payd: 0, sales_payd_percent: 0, marg_total: 0 };
    }
    const filteredData = monthlyData.filter(item => item.representative_name === repName && item.year === year);
    let totalSales = 0;
    let totalMarginValue = 0;
    const totals = filteredData.reduce((acc, curr) => {
      totalSales += curr.sales_net;
      totalMarginValue += curr.sales_net * curr.marg_total;
      return {
        sales_net: acc.sales_net + curr.sales_net,
        profit_net: acc.profit_net + curr.profit_net,
        sales_payd: acc.sales_payd + curr.sales_payd,
        profit_payd: acc.profit_payd + curr.profit_payd
      };
    }, { sales_net: 0, profit_net: 0, sales_payd: 0, profit_payd: 0 });
    const sales_payd_percent = totals.sales_net > 0 ? (totals.sales_payd / totals.sales_net) * 100 : 0;
    const marg_total = totalSales > 0 ? totalMarginValue / totalSales : 0;
    return { representative_name: repName, year, month: 0, branch_name: branchFilter, sales_net: totals.sales_net, profit_net: totals.profit_net, sales_payd: totals.sales_payd, profit_payd: totals.profit_payd, sales_payd_percent, marg_total };
  };

  const getBgColorForRepresentative = (idx: number): string => {
    const colors = ["bg-gray-50", "bg-blue-50", "bg-green-50", "bg-yellow-50", "bg-purple-50"];
    return colors[idx % colors.length];
  };

  const handleEmptyData = (representative: string) => {};
  const handleSalesData = (representative: string, salesValue: number) => {};

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (loading || !selectedYear || !currentDate) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/4" />
          <div className="h-24 bg-gray-200 rounded w-full" />
          <div className="h-24 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  // DODANO: Sprawdzenie, czy użytkownik ma uprawnienia do filtra
  const canUseRepresentativeFilter = authUserRole === 'ADMIN' || authUserRole === 'BOARD' || authUserRole === 'BRANCH';

  return (
    <div className="space-y-6">
      {/* Nagłówek z selektorami - struktura analogiczna do ProfitsPHView */}{/* Nagłówek z selektorami */}
        <div className="mb-6 sm:flex sm:items-center sm:justify-between">

          {/* Kontener dla tytułu i mobilnego selektora roku */}
          <div className="flex justify-between items-center mb-4 sm:mb-0">
            <h2 className="text-xl font-semibold text-gray-800">Przedstawiciele</h2>

            {/* WERSJA MOBILNA selektora roku (widoczny tylko na małych ekranach) */}
            <div className="sm:hidden">
              <Select
                value={selectedYear?.toString() ?? yearsData?.currentYear?.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className={`${selectStyles.trigger} w-32`}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent className={`${selectStyles.content} w-32`}>
                  {yearsLoading ? (
                    <SelectItem value="loading">Ładowanie...</SelectItem>
                  ) : (
                    yearsData?.years?.map((year) => (
                      <SelectItem
                        className={selectStyles.item}
                        key={year}
                        value={year.toString()}
                      >
                        {year}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kontener na filtry (selektor przedstawiciela i desktopowy selektor roku) */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">

            {/* SearchableSelect dla przedstawicieli */}
            {canUseRepresentativeFilter && !onlyRepresentative && (
              <SearchableSelect
                className="w-full sm:w-48"
                placeholder="Wybierz przedstawiciela"
                value={representativeFilter || 'all'}
                onValueChange={handleRepresentativeFilterChange}
                items={[
                  { value: 'all', label: 'Wszyscy' },
                  ...sortedRepresentatives.map(rep => ({ value: rep, label: rep }))
                ]}
                expandUpward={false}
              />
            )}

            {/* WERSJA DESKTOPOWA selektora roku (ukryty na małych ekranach) */}
            <div className="hidden sm:block">
              <Select
                value={selectedYear?.toString() ?? yearsData?.currentYear?.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className={`${selectStyles.trigger} w-full sm:w-32`}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent className={`${selectStyles.content} w-full sm:w-32`}>
                  {yearsLoading ? (
                    <SelectItem value="loading">Ładowanie lat...</SelectItem>
                  ) : (
                    yearsData?.years?.map((year) => (
                      <SelectItem
                        className={selectStyles.item}
                        key={year}
                        value={year.toString()}
                      >
                        {year}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

      <div className="sm:hidden text-center mb-2 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {onlyRepresentative ? (
        <SalesViewRepresentative
          representative={onlyRepresentative}
          bgColor="bg-blue-50"
          branchFilter={branchFilter}
          selectedYear={selectedYear}
          currentMonth={currentDate.month}
          {...getRepresentativeData(onlyRepresentative)}
          onEmptyData={handleEmptyData}
          onSalesData={handleSalesData}
        />
      ) : (
        <>
          {sortedRepresentatives.length === 0 ? (
            <div className="text-gray-500 p-4">
              Brak danych przedstawicieli dla wybranego roku
              {branchFilter ? ` w oddziale ${branchFilter}` : ''}.
            </div>
          ) : (
            // ZMIANA: Filtrowanie listy przedstawicieli przed mapowaniem
            sortedRepresentatives
              .filter(rep => !representativeFilter || rep === representativeFilter)
              .map((representative, index) => {
                const repData = getRepresentativeData(representative);
                if (!repData.yearlyData) return null;
                return (
                  <SalesViewRepresentative
                    key={representative}
                    representative={representative}
                    bgColor={getBgColorForRepresentative(index)}
                    branchFilter={branchFilter}
                    selectedYear={selectedYear}
                    currentMonth={currentDate.month}
                    yearlyData={repData.yearlyData}
                    monthlyData={repData.monthlyData}
                    historicalData={repData.historicalData}
                    onEmptyData={handleEmptyData}
                    onSalesData={handleSalesData}
                  />
                );
              })
          )}
        </>
      )}
    </div>
  );
};

export default RepresentativesSalesView;