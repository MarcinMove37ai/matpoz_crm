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

// Style dla komponentu Select
const selectStyles = {
  trigger: "border border-gray-300 bg-white text-sm font-medium",
  placeholder: "text-gray-500",
  content: "bg-white border border-gray-200 shadow-lg",
  item: "text-sm cursor-pointer hover:bg-gray-100",
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
// ZMIANA: Komponent SalesViewRepresentative nie pobiera danych samodzielnie,
// otrzymuje je od rodzica
//
export type SalesViewRepresentativeProps = {
  representative: string;
  bgColor?: string;   // Klasa tła – domyślnie "bg-gray-50"
  branchFilter?: string | null;
  selectedYear: number;
  // Dodajemy nowe propsy z danymi
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

  // Ref do śledzenia czy zgłoszono puste dane
  const emptyDataReportedRef = useRef(false);
  // Ref do śledzenia czy dane sprzedażowe zostały już przekazane
  const salesDataReportedRef = useRef(false);

  // Efekt do ustawiania wysokości rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  // Przekazanie danych o sprzedaży do komponentu nadrzędnego
  useEffect(() => {
    if (yearlyData && onSalesData && !salesDataReportedRef.current) {
      onSalesData(representative, yearlyData.sales_net);
      salesDataReportedRef.current = true;
    }
  }, [yearlyData, representative, onSalesData]);

  // Reset flagi salesDataReported przy zmianie roku
  useEffect(() => {
    salesDataReportedRef.current = false;
    emptyDataReportedRef.current = false;
  }, [selectedYear]);

  // Wywołanie onEmptyData jeśli brak danych
  useEffect(() => {
    if (!yearlyData && onEmptyData && !emptyDataReportedRef.current) {
      onEmptyData(representative);
      emptyDataReportedRef.current = true;
    }
  }, [yearlyData, representative, onEmptyData]);

  // Funkcja do responsywnego renderowania pojedynczego wiersza danych
  const renderDataRow = (
    label: string,
    data: RepresentativeData | null,
    icon: React.ReactNode,
    showBorder: boolean = false
  ) => {
    if (!data) return null;
    return (
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center ${showBorder ? 'border-b border-gray-200 pb-3' : ''}`}>
        {/* Kolumna etykiety – zawsze widoczna */}
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-xs ${TEXT_COLOR}`}>{label}</span>
          {/* Pokaż oddział zawsze, gdy istnieje (nawet jeśli jest już filtrowany) */}
          {data.branch_name && (
            <span className="text-xs text-gray-500 ml-1">({data.branch_name})</span>
          )}
        </div>
        {/* Sprzedaż netto – widoczna od sm */}
        <div className="text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatCurrency(data.sales_net)}</span>
        </div>
        {/* Zysk netto – widoczna od md */}
        <div className="text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatCurrency(data.profit_net)}</span>
        </div>
        {/* Sprzedaż opłacona – widoczna od md */}
        <div className="hidden md:block text-center">
          <span className={`text-xs font-medium text-green-600`}>{formatCurrency(data.sales_payd)}</span>
        </div>
        {/* % Sprzedaży opłaconej – widoczna od lg */}
        <div className="hidden lg:block text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatPercentage(data.sales_payd_percent)}</span>
        </div>
        {/* % Marży – widoczna od xl */}
        <div className="hidden xl:block text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatPercentage(data.marg_total)}</span>
        </div>
        {/* Zysk opłacony – zawsze widoczna */}
        <div className="hidden sm:block text-center">
          <span className={`text-xs font-medium text-red-600`}>{formatCurrency(data.profit_payd)}</span>
        </div>
      </div>
    );
  };

  // Przypadek braku danych - nie renderujemy karty wcale
  if (!yearlyData) {
    return null;
  }

  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="flex flex-col p-3 pb-2">
        {/* Nagłówek – grid responsywny: na XS 3 kolumny, na xl 7 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">
              {representative}
            </h3>
            {/* Wyświetl informację o filtrze oddziału */}
            {branchFilter && (
              <span className="text-sm font-medium text-blue-600 ml-2">
              </span>
            )}
          </div>
          {/* Sprzedaż netto – widoczna od sm */}
          <div className="text-center">
            <span className="text-xs font-medium text-gray-800">Sprzedaż netto</span>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(yearlyData ? yearlyData.sales_net : 0)}</p>
          </div>
          {/* Zysk netto – widoczna od md */}
          <div className="text-center">
            <span className="text-xs font-medium text-blue-800">Zysk netto</span>
            <p className="text-sm font-bold text-blue-800">{formatCurrency(yearlyData ? yearlyData.profit_net : 0)}</p>
          </div>
          {/* Sprzedaż opłacona – widoczna od md */}
          <div className="hidden md:block text-center">
            <span className="text-xs font-medium text-green-700">Sprzedaż opłacona</span>
            <p className="text-sm font-bold text-green-700">{formatCurrency(yearlyData ? yearlyData.sales_payd : 0)}</p>
          </div>
          {/* % Sprzedaży opłaconej – widoczna od lg */}
          <div className="hidden lg:block text-center">
            <span className="text-xs font-medium text-gray-800">% Sprzedaży opłaconej</span>
            <p className="text-sm font-bold text-gray-800">{formatPercentage(yearlyData ? yearlyData.sales_payd_percent : 0)}</p>
          </div>
          {/* % Marży – widoczna od xl */}
          <div className="hidden xl:block text-center">
            <span className="text-xs font-medium text-blue-800">% Marży</span>
            <p className="text-sm font-bold text-blue-800">{formatPercentage(yearlyData ? yearlyData.marg_total : 0)}</p>
          </div>
          {/* Zysk opłacony – zawsze widoczna */}
          <div className="hidden sm:block text-center">
            <span className="text-xs font-medium text-red-800">Zysk opłacony</span>
            <p className="text-sm font-bold text-red-800">{formatCurrency(yearlyData ? yearlyData.profit_payd : 0)}</p>
          </div>
        </div>

        <div className="border-b border-gray-300 mb-4"></div>

        {/* Przycisk rozwijania danych historycznych */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center pt-1 pb-0.5 text-xs ${TEXT_COLOR} ${TEXT_COLOR_HOVER} mt-4`}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Dane historyczne – etykiety sformatowane, np. "styczeń 2025" */}
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
// Komponent rodzicielski – zarządzanie listą przedstawicieli
//
const RepresentativesSalesView: React.FC = () => {
  // Stan globalny dla danych ze wszystkich zapytań
  const [allData, setAllData] = useState<RepresentativeData[]>([]);
  const [representatives, setRepresentatives] = useState<string[]>([]);
  const [sortedRepresentatives, setSortedRepresentatives] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();
  // Stan do śledzenia czy komponent został zamontowany
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<{ year: number; month: number } | null>(null);

  // Nowy stan do przechowywania danych sprzedażowych wszystkich przedstawicieli
  const [representativesSalesData, setRepresentativesSalesData] = useState<{[representative: string]: number}>({});

  // Używamy kontekstu Auth
  const { userRole: authUserRole, userBranch: authUserBranch, user } = useAuth();
  const [onlyRepresentative, setOnlyRepresentative] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  // Efekt dla ustawienia mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Używamy zmodyfikowanego hooka anulowania zapytań, dodając rok jako kontekst
  // To sprawi, że zmiana roku anuluje trwające zapytania
  useEnhancedRequestCancellation({
    contextValue: selectedYear,
    debug: true // Włączamy debugowanie, aby łatwiej śledzić anulowane zapytania
  });

  // Ustawienie domyślnego roku po załadowaniu dostępnych lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  // Reset stanu przy zmianie roku - przygotowanie do ponownego załadowania danych
  useEffect(() => {
    if (selectedYear) {
      // Resetujemy stany tylko gdy mamy wybrany rok
      setLoading(true);
      setAllData([]);
      setRepresentativesSalesData({});
      setSortedRepresentatives([]);
    }
  }, [selectedYear]);

  // Pobierz aktualną datę z API
  useEffect(() => {
    // Wykonuj zapytania tylko po stronie klienta
    if (!mounted || !selectedYear) return;

    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        setCurrentDate({ year: selectedYear, month: data.month });
      } catch (err) {
        // Ignorujemy błędy AbortError - to normalne przy anulowaniu zapytania
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error(`Błąd pobierania daty:`, err);
          setError('Błąd ładowania daty');
        }
      }
    };
    fetchDate();
  }, [selectedYear, mounted]);

  // KLUCZOWA ZMIANA: Pobieranie wszystkich danych za jednym razem
  useEffect(() => {
    if (!mounted || !selectedYear || !currentDate) return;

    const fetchAllRepresentativesData = async () => {
      try {
        setLoading(true);
        console.log("Pobieranie wszystkich danych dla roku:", selectedYear);

        // Tworzymy URL bez filtra przedstawiciela - pobieramy wszystkich naraz
        let url = `/api/aggregated_representative_ind_data?year=${selectedYear}`;

        // Dodajemy filtr oddziału jeśli jest określony
        if (branchFilter) {
          url += `&branch_name=${encodeURIComponent(branchFilter)}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (!result.data || result.data.length === 0) {
          console.warn("Brak danych dla wybranego roku");
          setLoading(false);
          return;
        }

        console.log(`Pobrano ${result.data.length} rekordów danych dla roku ${selectedYear}`);

        // Zapisujemy wszystkie pobrane dane
        setAllData(result.data);

        // Wyodrębniamy unikalne nazwy przedstawicieli
        const repNames = [...new Set(
          result.data
            .filter((item: RepresentativeData) => item.representative_name)
            .map((item: RepresentativeData) => item.representative_name)
        )];

        console.log("Znaleziono przedstawicieli:", repNames);
        setRepresentatives(repNames as string[]);

        // Obliczamy sumy sprzedaży dla każdego przedstawiciela
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

        // Sortujemy przedstawicieli według wartości sprzedaży (malejąco)
        const sorted = Object.keys(salesData).sort((a, b) => salesData[b] - salesData[a]);

        setRepresentativesSalesData(salesData);
        setSortedRepresentatives(sorted);
        setLoading(false);

      } catch (err) {
        // Ignorujemy błędy AbortError - to normalne przy anulowaniu zapytania
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Błąd podczas pobierania danych:", err);
          setError('Błąd pobierania danych sprzedażowych');
        }
        setLoading(false);
      }
    };

    fetchAllRepresentativesData();
  }, [selectedYear, branchFilter, currentDate, mounted]);

  // Określ czy użytkownik powinien widzieć tylko swoje dane
  useEffect(() => {
    if (!mounted) return;

    console.log("Kontrola dostępu - Rola:", authUserRole, "Użytkownik:", user, "Oddział:", authUserBranch);

    // Dla REPRESENTATIVE powinna być zawsze ograniczona widoczność
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

    // BRANCH widzą tylko przedstawicieli z ich oddziału
    if (authUserRole === "BRANCH" && authUserBranch) {
      setOnlyRepresentative(null);
      setBranchFilter(authUserBranch);
      return;
    }

    // ADMIN i BOARD widzą wszystkich
    if (authUserRole === "ADMIN" || authUserRole === "BOARD") {
      setOnlyRepresentative(null);
      setBranchFilter(null);
      return;
    }

    // Domyślnie - wyczyść filtry
    setOnlyRepresentative(null);
    setBranchFilter(null);
  }, [authUserRole, user, authUserBranch, representatives, mounted]);

  // Funkcja do przygotowania danych dla konkretnego przedstawiciela
  const getRepresentativeData = useCallback((representative: string) => {
    if (!allData || !currentDate) return {
      yearlyData: null,
      monthlyData: null,
      historicalData: []
    };

    // Filtrujemy dane dla tego przedstawiciela
    const repData = allData.filter(item =>
      item.representative_name === representative &&
      (!branchFilter || item.branch_name === branchFilter)
    );

    if (repData.length === 0) {
      return {
        yearlyData: null,
        monthlyData: null,
        historicalData: []
      };
    }

    // Obliczamy dane roczne (sumujemy wszystkie miesiące)
    const yearData = sumUpMonthlyData(repData, currentDate.year, representative);

    // Pobierz dane dla bieżącego miesiąca
    const currentMonthData = repData.find(item =>
      item.year === currentDate.year &&
      item.month === currentDate.month
    ) || null;

    // Sortujemy dane historyczne (od najnowszych)
    const historicalItems = [...repData].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;

      // Jeśli rok i miesiąc są takie same, sortuj według nazwy oddziału
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

  // Funkcja sumująca dane miesięczne na rok z poprawioną kalkulacją marży
  const sumUpMonthlyData = (monthlyData: RepresentativeData[], year: number, repName: string): RepresentativeData => {
    if (!monthlyData || monthlyData.length === 0) {
      return {
        representative_name: repName,
        year: year,
        month: 0,
        sales_net: 0,
        profit_net: 0,
        sales_payd: 0,
        profit_payd: 0,
        sales_payd_percent: 0,
        marg_total: 0
      };
    }

    const filteredData = monthlyData.filter(item =>
      item.representative_name === repName && item.year === year);

    // Zbieramy dane do wyliczenia średniej ważonej dla marży
    let totalSales = 0;
    let totalMarginValue = 0; // Suma wartości (sprzedaż * procent marży)

    const totals = filteredData.reduce((acc, curr) => {
      // Dodajemy do kalkulacji średniej ważonej
      totalSales += curr.sales_net;
      totalMarginValue += curr.sales_net * curr.marg_total;

      return {
        sales_net: acc.sales_net + curr.sales_net,
        profit_net: acc.profit_net + curr.profit_net,
        sales_payd: acc.sales_payd + curr.sales_payd,
        profit_payd: acc.profit_payd + curr.profit_payd
      };
    }, { sales_net: 0, profit_net: 0, sales_payd: 0, profit_payd: 0 });

    // Obliczanie % z wypłaconych sprzedaży
    const sales_payd_percent = totals.sales_net > 0
      ? (totals.sales_payd / totals.sales_net) * 100
      : 0;

    // Obliczanie średniej ważonej marży
    const marg_total = totalSales > 0
      ? totalMarginValue / totalSales
      : 0;

    return {
      representative_name: repName,
      year: year,
      month: 0, // Miesiąc 0 oznacza dane roczne
      branch_name: branchFilter, // Dodaj informację o filtrowanym oddziale
      sales_net: totals.sales_net,
      profit_net: totals.profit_net,
      sales_payd: totals.sales_payd,
      profit_payd: totals.profit_payd,
      sales_payd_percent: sales_payd_percent,
      marg_total: marg_total
    };
  };

  // Funkcja pomocnicza do ustalania koloru tła dla przedstawiciela
  const getBgColorForRepresentative = (idx: number): string => {
    const colors = ["bg-gray-50", "bg-blue-50", "bg-green-50", "bg-yellow-50", "bg-purple-50"];
    return colors[idx % colors.length];
  };

  // Puste funkcje callbacków
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

  return (
    <div className="space-y-8">
      {/* Selektor roku */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Przedstawiciele</h2>
        <div>
          <Select
            value={selectedYear?.toString() ?? yearsData?.currentYear?.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className={`${selectStyles.trigger} w-32`}>
              <SelectValue className={selectStyles.placeholder} placeholder="Wybierz rok" />
            </SelectTrigger>
            <SelectContent className={`${selectStyles.content} w-32`}>
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

      {/* Komunikat wyświetlany na urządzeniach mobilnych (poniżej sm) – zawsze */}
      <div className="sm:hidden text-center mb-2 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {onlyRepresentative ? (
        // Jeśli użytkownik jest przedstawicielem, pokazujemy tylko jego kartę
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
        // Dla pozostałych użytkowników pokazujemy tylko karty posortowanych przedstawicieli
        <>
          {sortedRepresentatives.length === 0 ? (
            <div className="text-gray-500 p-4">
              Brak danych przedstawicieli dla wybranego roku
              {branchFilter ? ` w oddziale ${branchFilter}` : ''}.
            </div>
          ) : (
            sortedRepresentatives.map((representative, index) => {
              // Pobieramy przygotowane dane dla tego przedstawiciela
              const repData = getRepresentativeData(representative);

              // Renderujemy komponent tylko jeśli są dane
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