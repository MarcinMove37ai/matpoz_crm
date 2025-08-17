"use client";
import SearchableSelect from "@/components/ui/SearchableSelect";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  PiggyBank,
  Monitor,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Import zmodyfikowanego interceptora dla anulowania zapytań przy zmianie roku
import { useEnhancedRequestCancellation } from '@/utils/enhancedFetchInterceptor';

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
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Błąd pobierania dostępnych lat:', err);
          setError('Nie udało się pobrać listy dostępnych lat');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
  }, [mounted]);

  return { yearsData, loading, error };
};

// Funkcja pomocnicza - formatowanie waluty
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

// Typy danych
export type RepresentativeProfitData = {
  profit: number;            // Zysk przedstawiciela
  costs: number;             // Koszty
  netProfit: number;         // Zysk netto
  payouts: number;           // Wypłaty
  balance: number;           // Saldo przedstawiciela (Zysk netto - Wypłaty)
  // Dodajemy opcjonalne pola na opłacone wartości
  profitPaid?: number;       // Opłacony Zysk
  netProfitPaid?: number;    // Opłacony Zysk netto
  balancePaid?: number;      // Opłacone Saldo
  branch?: string;           // Oddział przedstawiciela
  // Nowe pola dla salda z poprzedniego roku
  previousYearBalance?: number;      // Saldo z poprzedniego roku
  previousYearBalancePaid?: number;  // Opłacone saldo z poprzedniego roku
};

export type HistoricalRepresentativeData = {
  year: number;
  month: number;
  data: RepresentativeProfitData;
  branch?: string;  // Dodane pole dla oddziału
};

// Dodany typ do przechowywania danych rocznych per oddział
export type YearlyBranchData = {
  branch: string;
  data: RepresentativeProfitData;
};

// Nowy typ dla przechowywania informacji o aktualnej dacie
export type CurrentDateType = {
  year: number | null | undefined;  // Dodane undefined
  month: number;
  systemYear: number;
} | null;

// Nowy typ dla danych z API
export type ApiSalesData = {
  representative_name: string;
  year: number;
  month: number;
  branch_name: string;
  sales_net: number;
  profit_net: number;
  sales_payd: number;
  profit_payd: number;
  sales_payd_percent: number;
  marg_total: number;
  paid_profit_margin_percentage: number;
};

// Nowy typ dla danych kosztowych z API
export type ApiCostData = {
  representative: string;
  year: number;
  month: number;
  branch: string;
  total_ph_cost: number;
};

// Nowy typ dla danych o wypłatach z API
export type ApiPayoutData = {
  representative: string;
  year: number;
  month: number;
  branch: string;
  total_payout: number;
};

// Funkcje formatujące daty - zamiana numeru miesiąca na polską nazwę
const getMonthName = (month: number): string => {
  const monthNames = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
  ];
  return monthNames[month - 1] || "";
};

// Komponent karty zysków przedstawiciela
export type RepresentativeProfitsCardProps = {
  representative: string;    // Nazwa przedstawiciela
  bgColor?: string;          // Klasa tła – domyślnie "bg-gray-50"
  branchFilter?: string;     // Filtrowanie po oddziale
  hideSummary?: boolean;     // Parametr do ukrywania wiersza z sumą
  selectedYear?: number | null;     // Wybrany rok - dodane nowe pole
  onEmptyData?: (representative: string) => void;  // Funkcja callback gdy brak danych
  allSalesData: ApiSalesData[];  // Nowe pole: wszystkie dane sprzedażowe
  costsData: ApiCostData[];            // Zaktualizowane pole: dane kosztowe
  payoutsData: ApiPayoutData[];          // Zaktualizowane pole: dane o wypłatach
  previousYearSalesData?: ApiSalesData[];  // Nowe pole: dane sprzedażowe z poprzedniego roku
  previousYearCostsData?: ApiCostData[];  // Zaktualizowane pole: dane kosztowe z poprzedniego roku
  previousYearPayoutsData?: ApiPayoutData[];  // Zaktualizowane pole: dane o wypłatach z poprzedniego roku
};

export const RepresentativeProfitsCard: React.FC<RepresentativeProfitsCardProps> = ({
  representative,
  bgColor = "bg-gray-50",
  branchFilter,
  hideSummary = false,
  selectedYear,
  onEmptyData,
  allSalesData,
  costsData,
  payoutsData,
  previousYearSalesData,
  previousYearCostsData,
  previousYearPayoutsData
}) => {
  const formatMonthYear = (month: number, year: number): string => {
    return `${getMonthName(month)} ${year}`;
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [currentDate, setCurrentDate] = useState<CurrentDateType>(null);
  const [loadingStates, setLoadingStates] = useState({
    date: true,
    yearly: true,
    current: true,
    historical: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Używamy zmodyfikowanego hooka anulowania zapytań z kontekstem roku dla tego komponentu
  useEnhancedRequestCancellation({
    contextValue: selectedYear
  });

  // Ustawiamy mounted po pierwszym renderowaniu
  useEffect(() => {
    setMounted(true);
  }, []);

  // Zmieniamy na tablicę obiektów per oddział
  const [yearlyData, setYearlyData] = useState<YearlyBranchData[]>([]);
  const [totalYearlyData, setTotalYearlyData] = useState<RepresentativeProfitData | null>(null);
  const [currentMonthData, setCurrentMonthData] = useState<RepresentativeProfitData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalRepresentativeData[]>([]);
  const { yearsData } = useAvailableYears();

  // Dodaj funkcję sprawdzającą, czy są dane
  const hasValidData = (data: RepresentativeProfitData | null): boolean => {
    if (!data) return false;

    // Sprawdź czy którakolwiek z wartości jest większa od zera
    return (
      (data.profit ?? 0) > 0 ||
      (data.costs ?? 0) > 0 ||
      (data.netProfit ?? 0) > 0 ||
      (data.payouts ?? 0) > 0 ||
      (data.balance ?? 0) > 0 ||
      ((data.profitPaid ?? 0) > 0) ||
      ((data.netProfitPaid ?? 0) > 0) ||
      ((data.balancePaid ?? 0) > 0)
    );
  };

  // Pobierz aktualną datę z API z uwzględnieniem wybranego roku
  useEffect(() => {
    if (!mounted) return;

    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        setCurrentDate({
          year: selectedYear ?? null,
          month: data.month,
          systemYear: data.year
        });
        setLoadingStates(prev => ({ ...prev, date: false }));
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('Błąd ładowania daty');
        }
        setLoadingStates(prev => ({ ...prev, date: false }));
      }
    };
    fetchDate();
  }, [selectedYear, mounted]);

  // Ustaw wysokość rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded, yearlyData]);

  // Zoptymalizowana funkcja do pobierania kosztów dla przedstawiciela i oddziału
  const getCostForRepresentative = (year: number, month: number | null, branch: string | null, costsDataSource: ApiCostData[] = costsData): number => {
    if (!costsDataSource || costsDataSource.length === 0) return 0;

    // Filtrowanie zagregowanych danych kosztowych
    const filteredCosts = costsDataSource.filter((cost: ApiCostData) => {
      const yearMatch = cost.year === year;
      const monthMatch = month ? cost.month === month : true;
      const branchMatch = branch ? cost.branch === branch : true;
      const repMatch = cost.representative === representative;

      return yearMatch && monthMatch && branchMatch && repMatch;
    });

    // Sumowanie kosztów
    return filteredCosts.reduce((sum: number, cost: ApiCostData) => sum + (cost.total_ph_cost || 0), 0);
  };

  // Zoptymalizowana funkcja do pobierania wypłat dla przedstawiciela i oddziału
  const getPayoutForRepresentative = (year: number, month: number | null, branch: string | null, payoutsDataSource: ApiPayoutData[] = payoutsData): number => {
    if (!payoutsDataSource || payoutsDataSource.length === 0) return 0;

    // Filtrowanie zagregowanych danych o wypłatach
    const filteredPayouts = payoutsDataSource.filter((payout: ApiPayoutData) => {
      const yearMatch = payout.year === year;
      const monthMatch = month ? payout.month === month : true;
      const branchMatch = branch ? payout.branch === branch : true;
      const repMatch = payout.representative === representative;

      return yearMatch && monthMatch && branchMatch && repMatch;
    });

    // Sumowanie wypłat
    return filteredPayouts.reduce((sum: number, payout: ApiPayoutData) => sum + (payout.total_payout || 0), 0);
  };

  // Funkcja pomocnicza do obliczania salda z poprzedniego roku - bez useCallback
  const getPreviousYearBalance = () => {
    if (!previousYearSalesData || !previousYearCostsData || !previousYearPayoutsData || !currentDate) {
      return { balance: 0, balancePaid: 0 };
    }

    const previousYear = (currentDate.year || currentDate.systemYear) - 1;

    // Sprawdź, czy poprzedni rok jest dostępny
    if (!yearsData?.years || previousYear < (yearsData.years[yearsData.years.length - 1] || 0)) {
      return { balance: 0, balancePaid: 0 };
    }

    // Filtrowanie danych z poprzedniego roku dla wybranego przedstawiciela (wszystkie oddziały)
    const filteredPrevYearSalesData = previousYearSalesData.filter(item =>
      item.representative_name === representative &&
      item.year === previousYear &&
      (!branchFilter || item.branch_name === branchFilter)
    );

    if (filteredPrevYearSalesData.length === 0) {
      return { balance: 0, balancePaid: 0 };
    }

    // Agreguj wszystkie dane sprzedażowe dla przedstawiciela (niezależnie od oddziału)
    const aggregatedPrevSalesData = filteredPrevYearSalesData.reduce((acc, item) => {
      return {
        profit_net: (acc.profit_net || 0) + (item.profit_net || 0),
        profit_payd: (acc.profit_payd || 0) + (item.profit_payd || 0),
      };
    }, { profit_net: 0, profit_payd: 0 });

    // Pobierz łączny koszt dla wszystkich oddziałów przedstawiciela
    const totalPrevCost = getCostForRepresentative(previousYear, null, branchFilter || null, previousYearCostsData);

    // Pobierz łączne wypłaty dla wszystkich oddziałów przedstawiciela
    const totalPrevPayout = getPayoutForRepresentative(previousYear, null, branchFilter || null, previousYearPayoutsData);

    // Oblicz saldo dla poprzedniego roku
    const prevNetProfit = (aggregatedPrevSalesData.profit_net || 0) - totalPrevCost;
    const prevNetProfitPaid = (aggregatedPrevSalesData.profit_payd || 0) - totalPrevCost;

    return {
      balance: prevNetProfit - totalPrevPayout,
      balancePaid: prevNetProfitPaid - totalPrevPayout
    };
  };

  // Pobierz dane roczne - zaktualizowana implementacja z uwzględnieniem poprzedniego roku
  useEffect(() => {
    if (!currentDate || !mounted || !allSalesData) return;

    const yearToUse = currentDate.year || currentDate.systemYear;

    try {
      // Pobierz globalne saldo z poprzedniego roku dla przedstawiciela - używamy zwykłej funkcji, nie hooka
      const globalPrevYearBalance = getPreviousYearBalance();

      // Filtrowanie danych sprzedażowych dla wybranego przedstawiciela i roku
      const filteredSalesData = allSalesData.filter(item =>
        item.representative_name === representative &&
        item.year === yearToUse &&
        (!branchFilter || item.branch_name === branchFilter)
      );

      if (filteredSalesData.length === 0) {
        setYearlyData([]);
        setTotalYearlyData(null);
        setLoadingStates(prev => ({ ...prev, yearly: false }));
        return;
      }

      // Grupowanie danych według oddziałów
      const branchGroups: { [branch: string]: ApiSalesData[] } = {};

      // Grupuj dane według oddziałów
      filteredSalesData.forEach(item => {
        const branch = item.branch_name || 'Brak oddziału';
        if (!branchGroups[branch]) {
          branchGroups[branch] = [];
        }
        branchGroups[branch].push(item);
      });

      // Tablica na dane roczne per oddział
      const yearlyDataByBranch: YearlyBranchData[] = [];

      // Sumowanie wartości dla całego roku (wszystkie oddziały)
      let totalYearProfit = 0;
      let totalYearCosts = 0;
      let totalYearPayouts = 0;
      let totalYearProfitPaid = 0;

      // Dla każdego oddziału przetwórz dane
      for (const [branch, items] of Object.entries(branchGroups)) {
        // Jeśli jest filtr oddziału i nie jest to ten oddział, pomiń
        if (branchFilter && branch !== branchFilter) continue;

        // Agreguj dane sprzedażowe z wszystkich miesięcy dla tego oddziału
        const aggregatedSalesData = items.reduce((acc, item) => {
          return {
            sales_net: (acc.sales_net || 0) + item.sales_net,
            profit_net: (acc.profit_net || 0) + item.profit_net,
            sales_payd: (acc.sales_payd || 0) + item.sales_payd,
            profit_payd: (acc.profit_payd || 0) + item.profit_payd,
          };
        }, { sales_net: 0, profit_net: 0, sales_payd: 0, profit_payd: 0 });

        // Pobierz koszt dla tego oddziału
        const total_cost = getCostForRepresentative(yearToUse, null, branch);

        // Pobierz wypłaty dla tego oddziału
        const repPayout = getPayoutForRepresentative(yearToUse, null, branch);

        // Przygotuj dane do wyświetlenia dla tego oddziału - bez uwzględniania salda z poprzedniego roku na poziomie oddziału
        const netProfit = (aggregatedSalesData.profit_net || 0) - total_cost;
        const netProfitPaid = (aggregatedSalesData.profit_payd || 0) - total_cost;

        const profitData: RepresentativeProfitData = {
          profit: aggregatedSalesData.profit_net || 0,
          costs: total_cost,
          netProfit: netProfit,
          payouts: repPayout,
          // Obliczamy saldo bez uwzględniania salda z poprzedniego roku na poziomie oddziału
          balance: netProfit - repPayout,
          // Opłacone wartości
          profitPaid: aggregatedSalesData.profit_payd || 0,
          netProfitPaid: netProfitPaid,
          balancePaid: netProfitPaid - repPayout,
          branch: branch
        };

        // Dodaj do tablicy danych per oddział
        yearlyDataByBranch.push({
          branch: branch,
          data: profitData
        });

        // Sumuj do totali
        totalYearProfit += profitData.profit;
        totalYearCosts += profitData.costs;
        totalYearPayouts += profitData.payouts;
        totalYearProfitPaid += profitData.profitPaid || 0;
      }

      // Oblicz totale dla wszystkich oddziałów - uwzględniając globalne saldo z poprzedniego roku
      const totalNetProfit = totalYearProfit - totalYearCosts;
      const totalNetProfitPaid = totalYearProfitPaid - totalYearCosts;
      const totalData: RepresentativeProfitData = {
        profit: totalYearProfit,
        costs: totalYearCosts,
        netProfit: totalNetProfit,
        payouts: totalYearPayouts,
        // Uwzględniamy tylko globalne saldo z poprzedniego roku
        balance: totalNetProfit - totalYearPayouts + globalPrevYearBalance.balance,
        profitPaid: totalYearProfitPaid,
        netProfitPaid: totalNetProfitPaid,
        balancePaid: totalNetProfitPaid - totalYearPayouts + globalPrevYearBalance.balancePaid,
        // Dodajemy informacje o globalnym saldzie z poprzedniego roku
        previousYearBalance: globalPrevYearBalance.balance,
        previousYearBalancePaid: globalPrevYearBalance.balancePaid
      };

      // Sortuj oddziały alfabetycznie
      yearlyDataByBranch.sort((a, b) => a.branch.localeCompare(b.branch));

      setYearlyData(yearlyDataByBranch);
      setTotalYearlyData(totalData);
      setLoadingStates(prev => ({ ...prev, yearly: false }));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Błąd przetwarzania danych rocznych:', err);
        setError('Błąd przetwarzania danych rocznych');
      }
      setLoadingStates(prev => ({ ...prev, yearly: false }));
    }
  }, [
    currentDate,
    representative,
    branchFilter,
    mounted,
    allSalesData,
    costsData,
    payoutsData,
    previousYearSalesData,
    previousYearCostsData,
    previousYearPayoutsData,
    yearsData
  ]);

  // Pobierz dane dla bieżącego miesiąca - nowa implementacja
  useEffect(() => {
    if (!currentDate || !mounted || !allSalesData) return;

    try {
      // Filtrowanie danych dla bieżącego miesiąca i roku systemowego
      const currentMonthItems = allSalesData.filter(item =>
        item.representative_name === representative &&
        item.year === currentDate.systemYear &&
        item.month === currentDate.month &&
        (!branchFilter || item.branch_name === branchFilter)
      );

      if (currentMonthItems.length === 0) {
        setCurrentMonthData(null);
        setLoadingStates(prev => ({ ...prev, current: false }));
        return;
      }

      // Użyj pierwszego pasującego elementu
      const item = currentMonthItems[0];
      const branch = item.branch_name;

      // Pobierz koszt dla tego miesiąca i oddziału
      const total_cost = getCostForRepresentative(currentDate.systemYear, currentDate.month, branch);

      // Pobierz wypłaty dla tego miesiąca i oddziału
      const repPayout = getPayoutForRepresentative(currentDate.systemYear, currentDate.month, branch);

      // Dane miesięczne
      const profitData: RepresentativeProfitData = {
        profit: item.profit_net || 0,
        costs: total_cost,
        netProfit: (item.profit_net || 0) - total_cost,
        payouts: repPayout,
        balance: (item.profit_net || 0) - total_cost - repPayout,
        // Opłacone wartości
        profitPaid: item.profit_payd || 0,
        netProfitPaid: (item.profit_payd || 0) - total_cost,
        balancePaid: (item.profit_payd || 0) - total_cost - repPayout,
        branch: branch
      };

      setCurrentMonthData(profitData);
      setLoadingStates(prev => ({ ...prev, current: false }));
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Błąd przetwarzania danych bieżącego miesiąca:', err);
        setError('Błąd przetwarzania danych bieżącego miesiąca');
      }
      setLoadingStates(prev => ({ ...prev, current: false }));
    }
  }, [currentDate, representative, branchFilter, mounted, allSalesData, costsData, payoutsData]);

  // Funkcja zwracająca miesiące historyczne w zależności od roku
  const getHistoricalMonths = (year: number, currentMonth: number, systemYear: number) => {
    const months = [];
    const isCurrentYear = year === systemYear;

    if (isCurrentYear) {
      // Dla bieżącego roku - od bieżącego miesiąca do stycznia (w odwrotnej kolejności)
      for (let m = currentMonth - 1; m >= 1; m--) {
        months.push({ year, month: m });
      }
    } else {
      // Dla lat historycznych - wszystkie miesiące od grudnia do stycznia
      for (let m = 12; m >= 1; m--) {
        months.push({ year, month: m });
      }
    }

    return months;
  };

  // Pobierz dane historyczne (zaktualizowana funkcja)
  useEffect(() => {
    if (!isExpanded || !currentDate || !mounted || !allSalesData) return;

    const fetchHistoricalData = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      try {
        // Określ, które miesiące pobrać w zależności od roku
        const yearToUse = currentDate.year || currentDate.systemYear;

        // Najpierw dodajemy wszystkie oddziały z bieżącego miesiąca oprócz pierwszego
        const currentMonthHistoricalData: HistoricalRepresentativeData[] = [];

        if (yearToUse === currentDate.systemYear) {
          // Filtrowanie danych dla bieżącego miesiąca
          const currentMonthItems = allSalesData.filter(item =>
            item.representative_name === representative &&
            item.year === currentDate.systemYear &&
            item.month === currentDate.month &&
            (!branchFilter || item.branch_name === branchFilter)
          );

          // Przetwarzamy tylko oddziały pasujące do filtra
          if (currentMonthItems.length > 0) {
            // Iterujemy po wszystkich elementach oprócz pierwszego (już wyświetlonego jako currentMonthData)
            for (let i = 1; i < currentMonthItems.length; i++) {
              const item = currentMonthItems[i];
              const branch = item.branch_name;

              // Pobierz koszt dla tego miesiąca i oddziału
              const total_cost = getCostForRepresentative(currentDate.systemYear, currentDate.month, branch);

              // Pobierz wypłaty dla tego miesiąca i oddziału
              const repPayout = getPayoutForRepresentative(currentDate.systemYear, currentDate.month, branch);

              const profitData: RepresentativeProfitData = {
                profit: item.profit_net || 0,
                costs: total_cost,
                netProfit: (item.profit_net || 0) - total_cost,
                payouts: repPayout,
                balance: (item.profit_net || 0) - total_cost - repPayout,
                // Opłacone wartości
                profitPaid: item.profit_payd || 0,
                netProfitPaid: (item.profit_payd || 0) - total_cost,
                balancePaid: (item.profit_payd || 0) - total_cost - repPayout,
                branch: branch
              };

              currentMonthHistoricalData.push({
                year: currentDate.systemYear,
                month: currentDate.month,
                branch: branch,
                data: profitData
              });
            }
          }
        }

        // Teraz pobieramy dane historyczne dla poprzednich miesięcy
        const historicalMonths = getHistoricalMonths(
          yearToUse,
          yearToUse === currentDate.systemYear ? currentDate.month : 12,
          currentDate.systemYear
        );

        const historicalDataArray: HistoricalRepresentativeData[] = [...currentMonthHistoricalData];

        if (historicalMonths.length === 0 && currentMonthHistoricalData.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }

        // Pobierz dane dla każdego miesiąca
        for (const { year, month } of historicalMonths) {
          // Filtrujemy dane dla danego miesiąca i roku
          const monthItems = allSalesData.filter(item =>
            item.representative_name === representative &&
            item.year === year &&
            item.month === month &&
            (!branchFilter || item.branch_name === branchFilter)
          );

          // Jeśli są dane z historii
          if (monthItems.length > 0) {
            // Przetwórz każdą pozycję osobno
            for (const item of monthItems) {
              const branch = item.branch_name;

              // Pobierz koszt dla tego miesiąca i oddziału
              const total_cost = getCostForRepresentative(year, month, branch);

              // Pobierz wypłaty dla tego miesiąca i oddziału
              const repPayout = getPayoutForRepresentative(year, month, branch);

              const profitData: RepresentativeProfitData = {
                profit: item.profit_net || 0,
                costs: total_cost,
                netProfit: (item.profit_net || 0) - total_cost,
                payouts: repPayout,
                balance: (item.profit_net || 0) - total_cost - repPayout,
                // Opłacone wartości
                profitPaid: item.profit_payd || 0,
                netProfitPaid: (item.profit_payd || 0) - total_cost,
                balancePaid: (item.profit_payd || 0) - total_cost - repPayout,
                branch: branch
              };

              historicalDataArray.push({
                year,
                month,
                branch: branch,
                data: profitData
              });
            }
          }
        }

        // Sortowanie danych historycznych (od najnowszych)
        historicalDataArray.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          if (a.month !== b.month) return b.month - a.month;

          // Jeśli rok i miesiąc są takie same, sortuj według nazwy oddziału
          if (a.branch && b.branch) {
            return a.branch.localeCompare(b.branch);
          }
          return 0;
        });

        setHistoricalData(historicalDataArray);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Błąd przetwarzania danych historycznych:', err);
          setError('Błąd przetwarzania danych historycznych');
        }
      } finally {
        setLoadingStates(prev => ({ ...prev, historical: false }));
      }
    };

    fetchHistoricalData();
  }, [
    isExpanded,
    currentDate,
    representative,
    branchFilter,
    mounted,
    allSalesData,
    costsData,
    payoutsData
  ]);

  // Dodaj useEffect do informowania o braku danych
  useEffect(() => {
    if (!mounted) return;

    if (
      !loadingStates.yearly &&
      !loadingStates.current &&
      onEmptyData &&
      (!yearlyData || yearlyData.length === 0 || !yearlyData.some(item => hasValidData(item.data))) &&
      (!totalYearlyData || !hasValidData(totalYearlyData))
    ) {
      onEmptyData(representative);
    }
  }, [loadingStates.yearly, loadingStates.current, yearlyData, totalYearlyData, representative, onEmptyData, mounted, hasValidData]);

// Renderowanie nagłówka z nazwą przedstawiciela
    const renderHeader = () => {
      return (
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-100">
          <User className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">
            {representative}
          </span>
        </div>
      );
    };

  // Renderowanie wiersza danych - z nagłówkiem w pierwszej kolumnie
  const renderDataRow = (
    label: string,
    data: RepresentativeProfitData,
    icon: React.ReactNode,
    showBorder: boolean = false,
    branch?: string // Dodajemy parametr dla nazwy oddziału
  ) => {
    return (
      <div className={`${showBorder ? 'border-b border-gray-100 pb-3' : ''} mb-3`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center">
          {/* Pierwsza kolumna - nagłówek wiersza z nazwą oddziału */}
          <div className="flex items-center gap-2 ml-2">
            {icon}
            <span className="text-xs font-medium text-gray-700">{label}</span>
            {/* Wyświetl oddział jeśli istnieje i jest inny niż główny filtr */}
            {data.branch && (!branchFilter || data.branch !== branchFilter) && (
              <span className="text-xs text-gray-500">({data.branch})</span>
            )}
          </div>

          {/* Zysk przedstawiciela z wartością opłaconą w nawiasach - ukryte na najwęższym ekranie */}
          <div className="hidden sm:block text-center">
            <span className="text-sm font-medium text-gray-800">{formatCurrency(data.profit)}</span>
            <div className="text-xs text-gray-600">({formatCurrency(data.profitPaid || data.profit * 0.85)})</div>
          </div>

          {/* Koszty - ukryte na mobilnych i małych ekranach */}
          <div className="hidden md:block text-center">
            <span className="text-sm font-medium text-red-600">{formatCurrency(data.costs)}</span>
          </div>

          {/* Zysk netto - ukryte na mobilnych i małych ekranach */}
          <div className="hidden md:block text-center">
            <span className="text-sm font-medium text-blue-600">{formatCurrency(data.netProfit)}</span>
            <div className="text-xs text-blue-400">({formatCurrency(data.netProfitPaid || data.netProfit * 0.85)})</div>
          </div>

          {/* Saldo - ukryte dla wierszy historycznych/miesięcznych */}
          <div className="text-center">
            {/* Zawartość ukryta - saldo pokazane tylko w głównej ramce */}
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <Card className={`w-full ${bgColor}`}>
        <CardContent className="p-3 text-red-500">{error}</CardContent>
      </Card>
    );
  }

  if (loadingStates.date || loadingStates.current || loadingStates.yearly) {
    return (
      <Card className={`w-full ${bgColor}`}>
        <CardContent className="p-3">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/4" />
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Dodaj wczesne zwracanie pustego komponentu - nie renderuj karty jeśli nie ma danych
  if (
    !loadingStates.yearly &&
    !loadingStates.current &&
    (!yearlyData || yearlyData.length === 0 || !yearlyData.some(item => hasValidData(item.data))) &&
    (!totalYearlyData || !hasValidData(totalYearlyData))
  ) {
    return null;  // Nie renderuj karty jeśli nie ma danych
  }

  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="p-3">
        {/* Nagłówek karty z nazwą przedstawiciela i nagłówkami kolumn */}
        <div className="flex flex-col p-3 pb-2">
          {/* Nagłówki kolumn z nazwą przedstawiciela w pierwszej kolumnie */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center border-b border-gray-200 pb-2">
            {/* Pierwsza kolumna - nazwa przedstawiciela */}
            <div className="flex items-center gap-2">
              {renderHeader()}
            </div>

            {/* Zysk przedstawiciela - ukryte na najwęższym ekranie */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-gray-500">Zysk</span>
              <div className="text-xs text-gray-400">(wartość opłacona)</div>
            </div>

            {/* Koszty - ukryte na mobilnych i małych ekranach */}
            <div className="hidden md:block text-center">
              <span className="text-xs font-medium text-red-500">Koszty</span>
            </div>

            {/* Zysk netto - ukryte na mobilnych i małych ekranach */}
            <div className="hidden md:block text-center">
              <span className="text-xs font-medium text-blue-500">Zysk netto</span>
              <div className="text-xs text-blue-400">(wartość opłacona)</div>
            </div>

            {/* Saldo z wypłatami - ukryte na mobile */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-green-500">Saldo</span>
            </div>
          </div>

          {/* Wiersz z danymi rocznymi - responsive layout */}
          <div className="pt-2">
            {/* Layout dla większych ekranów (sm i więcej) */}
            <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-5 gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">
                  {currentDate && (currentDate.year || currentDate.systemYear)}
                </span>
              </div>

              {/* Zysk z wartością opłaconą w nawiasach */}
              <div className="text-center">
                <span className="text-sm font-medium text-gray-800">
                  {totalYearlyData ? formatCurrency(totalYearlyData.profit) : "N/A"}
                </span>
                <div className="text-xs text-gray-500">
                  ({totalYearlyData?.profitPaid ? formatCurrency(totalYearlyData.profitPaid) : "N/A"})
                </div>
              </div>

              {/* Koszty - ukryte na małych ekranach */}
              <div className="hidden md:block text-center">
                <span className="text-sm font-medium text-red-600">
                  {totalYearlyData ? formatCurrency(totalYearlyData.costs) : "N/A"}
                </span>
              </div>

              {/* Zysk netto - ukryte na małych ekranach */}
              <div className="hidden md:block text-center">
                <span className="text-sm font-medium text-blue-600">
                  {totalYearlyData ? formatCurrency(totalYearlyData.netProfit) : "N/A"}
                </span>
                <div className="text-xs text-blue-400">
                  ({totalYearlyData?.netProfitPaid ? formatCurrency(totalYearlyData.netProfitPaid) : "N/A"})
                </div>
              </div>

              {/* Szczegóły salda w estetycznej ramce */}
              <div className="text-center">
                {totalYearlyData && (
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-3 shadow-sm text-center">
                    <div className="space-y-1">
                      {/* Saldo z ubiegłego roku */}
                      {totalYearlyData.previousYearBalancePaid !== undefined && (
                        <div className="text-xs text-blue-600">
                          Saldo z {currentDate?.year ? currentDate.year - 1 : 'ubiegłego roku'}: <span className="font-bold">{formatCurrency(totalYearlyData.previousYearBalancePaid)}</span>
                        </div>
                      )}

                      {/* Zysk (opłacony) bieżący rok */}
                      <div className="text-xs text-green-700">
                        Zysk (opłacony) {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{totalYearlyData.profitPaid ? formatCurrency(totalYearlyData.profitPaid) : 'N/A'}</span>
                      </div>

                      {/* Koszty bieżący rok */}
                      <div className="text-xs text-red-600">
                        Koszty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(totalYearlyData.costs)}</span>
                      </div>

                      {/* Wypłaty bieżący rok */}
                      <div className="text-xs text-orange-600">
                        Wypłaty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(totalYearlyData.payouts)}</span>
                      </div>

                      {/* Bieżące saldo - saldo poprzednie + zysk - koszty - wypłaty */}
                      <div className="text-sm text-green-800 pt-2 mt-2 border-t-2 border-green-300 bg-green-100 rounded px-2 py-1">
                        Bieżące saldo: <span className="font-bold">{
                          totalYearlyData.profitPaid !== undefined
                            ? formatCurrency(
                                (totalYearlyData.previousYearBalancePaid || 0) +
                                totalYearlyData.profitPaid -
                                totalYearlyData.costs -
                                totalYearlyData.payouts
                              )
                            : 'N/A'
                        }</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Layout mobilny - jedna kolumna z saldem na całą szerokość */}
            <div className="block sm:hidden">
              {totalYearlyData && (
                <div className="w-full">
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4 shadow-sm text-center">
                    <div className="space-y-2">
                      {/* Saldo z ubiegłego roku */}
                      {totalYearlyData.previousYearBalancePaid !== undefined && (
                        <div className="text-sm text-blue-600">
                          Saldo z {currentDate?.year ? currentDate.year - 1 : 'ubiegłego roku'}: <span className="font-bold">{formatCurrency(totalYearlyData.previousYearBalancePaid)}</span>
                        </div>
                      )}

                      {/* Zysk (opłacony) bieżący rok */}
                      <div className="text-sm text-green-700">
                        Zysk (opłacony) {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{totalYearlyData.profitPaid ? formatCurrency(totalYearlyData.profitPaid) : 'N/A'}</span>
                      </div>

                      {/* Koszty bieżący rok */}
                      <div className="text-sm text-red-600">
                        Koszty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(totalYearlyData.costs)}</span>
                      </div>

                      {/* Wypłaty bieżący rok */}
                      <div className="text-sm text-orange-600">
                        Wypłaty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(totalYearlyData.payouts)}</span>
                      </div>

                      {/* Bieżące saldo - saldo poprzednie + zysk - koszty - wypłaty */}
                      <div className="text-lg text-green-800 pt-3 mt-3 border-t-2 border-green-300 bg-green-100 rounded px-3 py-2">
                        Bieżące saldo: <span className="font-bold">{
                          totalYearlyData.profitPaid !== undefined
                            ? formatCurrency(
                                (totalYearlyData.previousYearBalancePaid || 0) +
                                totalYearlyData.profitPaid -
                                totalYearlyData.costs -
                                totalYearlyData.payouts
                              )
                            : 'N/A'
                        }</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Przycisk rozwijania historycznych danych - przeniesiony bezpośrednio po rocznych */}
        {/* Przycisk rozwijania historycznych danych - przeniesiony bezpośrednio po rocznych */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full hidden sm:flex items-center justify-center pt-1 pb-0.5 text-xs text-gray-500 hover:text-gray-700 mt-1 mb-1" // <-- ZMIANA TUTAJ
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Panel z historycznymi danymi - z animacją */}
        <div
          style={{ maxHeight: isExpanded ? contentHeight : 0 }}
          className="overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div ref={historicalRef} className="px-3 py-2">
            {loadingStates.historical ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Nagłówek dla bieżącego miesiąca - tylko dla bieżącego roku */}
                {currentDate &&
                 currentMonthData &&
                 currentDate.year === currentDate.systemYear && (
                  <div>
                    {renderDataRow(
                      formatMonthYear(currentDate.month, currentDate.systemYear),
                      currentMonthData,
                      <Calendar className="h-4 w-4 text-gray-500" />,
                      true,
                      currentMonthData.branch
                    )}
                  </div>
                )}

                {/* Render all other historical months */}
                {historicalData.map((monthItem, idx) => {
                  // Sprawdzamy, czy to nie duplikat bieżącego miesiąca, jeśli tak - pomijamy
                  if (currentDate &&
                      currentMonthData &&
                      monthItem.year === currentDate.systemYear &&
                      monthItem.month === currentDate.month &&
                      monthItem.branch === currentMonthData.branch) {
                    return null;
                  }

                  return (
                    <div key={`${monthItem.year}-${monthItem.month}-${monthItem.branch || idx}`}>
                      {renderDataRow(
                        formatMonthYear(monthItem.month, monthItem.year),
                        monthItem.data,
                        <Calendar className="h-4 w-4 text-gray-500" />,
                        idx !== historicalData.length - 1,
                        monthItem.branch
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Główny komponent ProfitsPHView
const ProfitsPHView: React.FC = () => {
  // Zwykły stan dla ProfitsPHView
  const [representatives, setRepresentatives] = useState<string[]>([]);
  const [sortedRepresentatives, setSortedRepresentatives] = useState<string[]>([]); // Nowy stan dla posortowanych przedstawicieli
  const [representativesProfitData, setRepresentativesProfitData] = useState<{[representative: string]: number}>({}); // Nowy stan dla przechowywania wartości zysków
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userRole, userBranch, user } = useAuth();
  const [onlyRepresentative, setOnlyRepresentative] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();
  const [reloadTrigger, setReloadTrigger] = useState<number>(0); // Nowy stan do wymuszenia przeładowania
  const [mounted, setMounted] = useState(false);

  // Nowy stan dla wybranego przedstawiciela z selecta
  const [selectedRepresentativeFilter, setSelectedRepresentativeFilter] = useState<string | null>(null);

  // Nowe stany dla przechowywania centralnie pobranych danych
  const [allSalesData, setAllSalesData] = useState<ApiSalesData[]>([]);
  const [costsData, setCostsData] = useState<ApiCostData[]>([]);
  const [payoutsData, setPayoutsData] = useState<ApiPayoutData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Nowe stany dla danych z poprzedniego roku
  const [previousYearSalesData, setPreviousYearSalesData] = useState<ApiSalesData[]>([]);
  const [previousYearCostsData, setPreviousYearCostsData] = useState<ApiCostData[]>([]);
  const [previousYearPayoutsData, setPreviousYearPayoutsData] = useState<ApiPayoutData[]>([]);
  const [previousYearDataLoading, setPreviousYearDataLoading] = useState(false);

  // Stany do obsługi danych klientów
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);

  // Używamy zmodyfikowanego hooka anulowania zapytań z kontekstem roku dla głównego komponentu
  useEnhancedRequestCancellation({
    contextValue: selectedYear
  });

  // Ustawiamy mounted po pierwszym renderowaniu
  useEffect(() => {
    setMounted(true);
  }, []);

  // Dodaj funkcję do pobierania danych klientów
  useEffect(() => {
    if (!mounted) return;

    const fetchClients = async () => {
      setClientsLoading(true);
      setClientsError(null);

      try {
        const response = await fetch('/api/clients');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        // Ograniczamy do 10 pozycji
        setClientsData(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch (error) {
        console.error('Błąd pobierania danych klientów:', error);
        setClientsError('Nie udało się pobrać danych klientów');
      } finally {
        setClientsLoading(false);
      }
    };

    // Wykonaj zapytanie o klientów
    fetchClients();
  }, [mounted]);

  // Dodaj stan do śledzenia przedstawicieli bez danych
  const [emptyRepresentatives, setEmptyRepresentatives] = useState<Set<string>>(new Set());

  // Dodaj funkcję do obsługi informacji o braku danych
  const handleEmptyData = useCallback((representative: string) => {
    setEmptyRepresentatives(prev => new Set([...prev, representative]));
  }, []);

  // Style dla komponentu Select
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

  // Sprawdzenie uprawnień użytkownika
  const canViewProfitData = userRole === 'ADMIN' || userRole === 'BOARD' || userRole === 'BRANCH' || userRole === 'REPRESENTATIVE';

  // Sprawdzenie czy użytkownik może widzieć select przedstawiciela
  const canUseRepresentativeFilter = userRole === 'ADMIN' || userRole === 'BOARD' || userRole === 'BRANCH';

  // Ustawienie domyślnego roku po załadowaniu dostępnych lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  // Obsługa zmiany roku - kompleksowy reset i przeładowanie
  const handleYearChange = (value: string) => {
    const newYear = parseInt(value);

    // Już na poziomie handlera resetujemy stan
    setRepresentatives([]);
    setSortedRepresentatives([]); // Resetujemy również posortowanych przedstawicieli
    setRepresentativesProfitData({}); // Resetujemy dane o zyskach
    setLoading(true);
    setError(null);
    // Resetuj też listę pustych przedstawicieli przy zmianie roku
    setEmptyRepresentatives(new Set());

    // Ustawiamy nowy rok
    setSelectedYear(newYear);

    // Zwiększamy licznik, aby wymusić przeładowanie komponentów
    setReloadTrigger(prev => prev + 1);

    console.log(`Zmieniono rok na ${newYear}, resetuję listę przedstawicieli i wymuszam przeładowanie`);
  };

  // Obsługa zmiany wybranego przedstawiciela
  const handleRepresentativeFilterChange = (value: string) => {
    const selectedRep = value === 'all' ? null : value;
    setSelectedRepresentativeFilter(selectedRep);

    // Resetuj listę pustych przedstawicieli przy zmianie filtra
    setEmptyRepresentatives(new Set());

    console.log(`Zmieniono filtr przedstawiciela na: ${selectedRep || 'wszyscy'}`);
  };

  // Nowa funkcja - obliczanie i sortowanie przedstawicieli według wartości zysku
  const calculateAndSortRepresentatives = useCallback((salesData: ApiSalesData[]) => {
    // Upewniam się, że mamy dane sprzedażowe
    if (!salesData || salesData.length === 0) return;

    // 1. Pobierz unikalne nazwy przedstawicieli
    const repNames = [...new Set(
      salesData
        .filter((item) => item.representative_name)
        .map((item) => item.representative_name)
    )];

    // 2. Obliczanie zysku dla każdego przedstawiciela
    const profitData: {[representative: string]: number} = {};

    repNames.forEach(rep => {
      // Filtrujemy dane dla danego przedstawiciela
      const repData = salesData.filter((item) =>
        item.representative_name === rep &&
        (!branchFilter || item.branch_name === branchFilter)
      );

      // Sumujemy zyski
      const totalProfit = repData.reduce((sum, item) =>
        sum + item.profit_net, 0
      );

      // Zapisujemy tylko jeśli wartość jest większa od zera
      if (totalProfit > 0) {
        profitData[rep] = totalProfit;
      }
    });

    // 3. Sortowanie przedstawicieli według wartości zysku (malejąco)
    const sorted = Object.keys(profitData).sort((a, b) => profitData[b] - profitData[a]);

    // 4. Aktualizacja stanów
    setRepresentativesProfitData(profitData);
    setSortedRepresentatives(sorted);

    console.log(`Posortowano ${sorted.length} przedstawicieli według wartości zysku`);

  }, [branchFilter]);

  // Pobierz dane dla poprzedniego roku
  const fetchPreviousYearData = useCallback(async (year: number) => {
    if (!yearsData?.years || yearsData.years.length === 0) return;

    const previousYear = year - 1;

    // Sprawdź, czy poprzedni rok jest dostępny w danych
    if (previousYear < yearsData.years[yearsData.years.length - 1]) {
      console.log(`Poprzedni rok ${previousYear} nie jest dostępny w danych`);
      setPreviousYearSalesData([]);
      setPreviousYearCostsData([]);
      setPreviousYearPayoutsData([]);
      return;
    }

    try {
      setPreviousYearDataLoading(true);

      // 1. Pobieranie danych sprzedażowych z poprzedniego roku
      const prevSalesResponse = await fetch(`/api/aggregated_representative_ind_data?year=${previousYear}&fields_set=minimal`);
      if (!prevSalesResponse.ok) {
        throw new Error(`Błąd pobierania danych sprzedażowych dla poprzedniego roku: ${prevSalesResponse.status}`);
      }
      const prevSalesData = await prevSalesResponse.json();

      // 2. Pobieranie danych kosztowych dla poprzedniego roku - NOWY ENDPOINT
      const prevCostsResponse = await fetch(`/api/costs/representatives-summary?year=${previousYear}`);
      if (!prevCostsResponse.ok) {
        throw new Error(`Błąd pobierania danych kosztowych dla poprzedniego roku: ${prevCostsResponse.status}`);
      }
      const prevCostsData = await prevCostsResponse.json();

      // 3. Pobieranie danych o wypłatach dla poprzedniego roku
      const prevPayoutsResponse = await fetch(`/api/costs/representative_payouts?year=${previousYear}`);
      if (!prevPayoutsResponse.ok) {
        throw new Error(`Błąd pobierania danych o wypłatach dla poprzedniego roku: ${prevPayoutsResponse.status}`);
      }
      const prevPayoutsData = await prevPayoutsResponse.json();

      // Aktualizacja stanów
      setPreviousYearSalesData(prevSalesData.data || []);
      setPreviousYearCostsData(prevCostsData.data || []); // Używamy nowej struktury
      setPreviousYearPayoutsData(prevPayoutsData || []);

      console.log(`Pobrano dane dla poprzedniego roku ${previousYear}`);
      console.log(`Koszty z poprzedniego roku: ${(prevCostsData.data || []).length} rekordów`);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(`Błąd pobierania danych dla poprzedniego roku ${previousYear}:`, err);
      }
    } finally {
      setPreviousYearDataLoading(false);
    }
  }, [yearsData]);

  // Nowa funkcja - pobieranie wszystkich danych sprzedażowych, kosztowych i wypłat dla wybranego roku
  const fetchAllData = useCallback(async (year: number) => {
    try {
      setDataLoading(true);

      // 1. Pobieranie wszystkich danych sprzedażowych jednym zapytaniem
      const salesResponse = await fetch(`/api/aggregated_representative_ind_data?year=${year}&fields_set=minimal`);
      if (!salesResponse.ok) {
        throw new Error(`Błąd pobierania danych sprzedażowych: ${salesResponse.status}`);
      }
      const salesData = await salesResponse.json();

      // 2. Pobieranie danych kosztowych dla wybranego roku - NOWY ZOPTYMALIZOWANY ENDPOINT
      const costsResponse = await fetch(`/api/costs/representatives-summary?year=${year}`);
      if (!costsResponse.ok) {
        throw new Error(`Błąd pobierania danych kosztowych: ${costsResponse.status}`);
      }
      const costsData = await costsResponse.json();

      // 3. Pobieranie danych o wypłatach dla wybranego roku
      const payoutsResponse = await fetch(`/api/costs/representative_payouts?year=${year}`);
      if (!payoutsResponse.ok) {
        throw new Error(`Błąd pobierania danych o wypłatach: ${payoutsResponse.status}`);
      }
      const payoutsData = await payoutsResponse.json();

      // Aktualizacja stanów z pobranymi danymi
      setAllSalesData(salesData.data || []);
      setCostsData(costsData.data || []); // Nowa struktura danych kosztowych
      setPayoutsData(payoutsData || []);

      // Ekstrahowanie unikalnych przedstawicieli z danych sprzedażowych
      const reps = salesData.data
        .filter((item: ApiSalesData) => item.representative_name)
        .map((item: ApiSalesData) => item.representative_name as string);

      // Usunięcie duplikatów i zapewnienie typowania jako string[]
      const uniqueReps = [...new Set(reps)] as string[];

      setRepresentatives(uniqueReps);

      // Obliczanie i sortowanie przedstawicieli na podstawie pobranych danych
      calculateAndSortRepresentatives(salesData.data || []);

      // Pobierz dane dla poprzedniego roku
      await fetchPreviousYearData(year);

      setDataLoading(false);
      setLoading(false);

      console.log(`Pobrano dane dla ${uniqueReps.length} przedstawicieli`);
      console.log(`Koszty bieżący rok: ${(costsData.data || []).length} rekordów`);
      console.log(`Wypłaty bieżący rok: ${(payoutsData || []).length} rekordów`);

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(`Błąd pobierania danych dla roku ${year}:`, err);
        setError(`Błąd ładowania danych: ${err.message}`);
      }
      setDataLoading(false);
      setLoading(false);
    }
  }, [calculateAndSortRepresentatives, fetchPreviousYearData]);

  // Pobierz wszystkie dane dla wybranego roku
  useEffect(() => {
    if (!mounted) return;

    if (selectedYear) {
      fetchAllData(selectedYear);
    } else if (yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
      fetchAllData(yearsData.currentYear);
    }
  }, [selectedYear, yearsData?.currentYear, mounted, fetchAllData, reloadTrigger]);

  // Aktualizuj sortowanie po zmianie filtra oddziału
  useEffect(() => {
    if (allSalesData && allSalesData.length > 0) {
      calculateAndSortRepresentatives(allSalesData);
    }
  }, [branchFilter, allSalesData, calculateAndSortRepresentatives]);

  // Określ czy użytkownik powinien widzieć tylko swoje dane
  useEffect(() => {
    if (!mounted) return;

    // Dla REPRESENTATIVE powinna być zawsze ograniczona widoczność
    if (userRole === "REPRESENTATIVE") {
      // Szukamy dopasowania używając user.fullName
      if (user?.fullName) {
        const matchingRepByFullName = representatives.find(
          rep => rep.toLowerCase() === user.fullName?.toLowerCase()
        );

        if (matchingRepByFullName) {
          setOnlyRepresentative(matchingRepByFullName);
          return;
        } else {
          setOnlyRepresentative(user.fullName);
          return;
        }
      }
    }

    // Sprawdź czy użytkownik wybrał konkretnego przedstawiciela z selecta
    if (canUseRepresentativeFilter && selectedRepresentativeFilter) {
      setOnlyRepresentative(selectedRepresentativeFilter);
      return;
    }

    // BRANCH widzą tylko przedstawicieli z ich oddziału
    if (userRole === "BRANCH" && userBranch) {
      setOnlyRepresentative(null);
      setBranchFilter(userBranch);
      return;
    }

    // ADMIN i BOARD widzą wszystkich (jeśli nie ma filtra przedstawiciela)
    if (userRole === "ADMIN" || userRole === "BOARD") {
      setOnlyRepresentative(null);
      setBranchFilter(null);
      return;
    }

    // Domyślnie - wyczyść filtry
    setOnlyRepresentative(null);
    setBranchFilter(null);
  }, [userRole, user, userBranch, representatives, mounted, selectedRepresentativeFilter, canUseRepresentativeFilter]);

  // Funkcja pomocnicza do ustalania koloru tła dla przedstawiciela
  const getBgColorForRepresentative = (idx: number): string => {
    const colors = ["bg-gray-50", "bg-blue-50", "bg-green-50", "bg-yellow-50", "bg-purple-50"];
    return colors[idx % colors.length];
  };

  if (!canViewProfitData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <PiggyBank className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Brak dostępu</h2>
            <p className="text-gray-500">
              Nie masz uprawnień do przeglądania danych o zyskach przedstawicieli.
              Skontaktuj się z administratorem, jeśli uważasz, że powinieneś mieć dostęp.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (loading || dataLoading) {
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
    <div className="space-y-6">
      {/* Nagłówek z selektorami */}
        <div className="mb-6 sm:flex sm:items-center sm:justify-between">

          {/* Kontener na tytuł i mobilny select roku - pozostaje bez zmian */}
          <div className="flex justify-between items-center mb-4 sm:mb-0">
            <h2 className="text-xl font-semibold text-gray-800">Zyski PH</h2>

            {/* Mobilny select roku, ukryty na desktopie */}
            <div className="sm:hidden">
              <Select
                value={selectedYear?.toString() ?? yearsData?.currentYear?.toString()}
                onValue-change={handleYearChange}
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

          {/* Kontener na filtry (select przedstawiciela i desktopowy select roku) */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">

            {/* Select przedstawiciela */}
            {canUseRepresentativeFilter && (
                <SearchableSelect
                  className="w-full sm:w-48"
                  placeholder="Wybierz przedstawiciela"
                  value={selectedRepresentativeFilter || 'all'}
                  onValueChange={handleRepresentativeFilterChange}
                  items={[
                    { value: 'all', label: 'Wszyscy' },
                    ...sortedRepresentatives.map(rep => ({ value: rep, label: rep }))
                  ]}
                  expandUpward={false}
                />
            )}

            {/* Desktopowy select roku, ukryty na mobile */}
            <div className="hidden sm:block">
              <Select
                value={selectedYear?.toString() ?? yearsData?.currentYear?.toString()}
                onValueChange={handleYearChange}
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

      {/* Komunikat wyświetlany na urządzeniach mobilnych i małych ekranach - zaktualizowany */}
      <div className="sm:hidden text-center mb-4 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {onlyRepresentative ? (
        // Jeśli użytkownik jest przedstawicielem lub wybrał konkretnego przedstawiciela, pokazujemy tylko jego kartę
        <div key={`rep-${onlyRepresentative}-${reloadTrigger}`}>
          <RepresentativeProfitsCard
            representative={onlyRepresentative}
            bgColor="bg-blue-50"
            branchFilter={branchFilter || undefined}
            hideSummary={userRole === "BRANCH"}
            selectedYear={selectedYear}
            onEmptyData={handleEmptyData}
            allSalesData={allSalesData}
            costsData={costsData}
            payoutsData={payoutsData}
            previousYearSalesData={previousYearSalesData}
            previousYearCostsData={previousYearCostsData}
            previousYearPayoutsData={previousYearPayoutsData}
          />
        </div>
      ) : (
        // Dla pozostałych użytkowników pokazujemy karty tylko tych przedstawicieli, którzy mają dane
        // Używamy posortowanej listy sortedRepresentatives zamiast representatives
        <>
          {sortedRepresentatives.length === 0 ? (
            <div className="text-gray-500 p-4">
              Brak danych przedstawicieli dla wybranego roku
              {branchFilter ? ` w oddziale ${branchFilter}` : ''}.
            </div>
          ) : (
            sortedRepresentatives
              .filter(rep => !emptyRepresentatives.has(rep))
              .map((representative, index) => (
                <div key={`rep-${representative}-${reloadTrigger}`}>
                  <RepresentativeProfitsCard
                    representative={representative}
                    bgColor={getBgColorForRepresentative(index)}
                    branchFilter={branchFilter || undefined}
                    hideSummary={userRole === "BRANCH"}
                    selectedYear={selectedYear}
                    onEmptyData={handleEmptyData}
                    allSalesData={allSalesData}
                    costsData={costsData}
                    payoutsData={payoutsData}
                    previousYearSalesData={previousYearSalesData}
                    previousYearCostsData={previousYearCostsData}
                    previousYearPayoutsData={previousYearPayoutsData}
                  />
                </div>
              ))
          )}
        </>
      )}
    </div>
  );
};

export default ProfitsPHView;