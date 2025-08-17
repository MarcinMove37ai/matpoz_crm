"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  PiggyBank,
  MapPin,
  Monitor,
  Wrench,
  HardHat,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Hook do pobierania dostępnych lat
const useAvailableYears = () => {
  const [yearsData, setYearsData] = useState<{ years: number[], currentYear: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  return { yearsData, loading, error };
};

// Funkcja pomocnicza - formatowanie waluty
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(numValue);
};

// Typy danych
export type BranchProfitData = {
  profit: number;            // Zysk CN
  costs: number;             // Koszty
  netProfit: number;         // Zysk netto
  payouts: number;           // Wypłaty
  balance: number;           // Saldo oddziału (Zysk netto - Wypłaty)
  // Dodajemy opcjonalne pola na opłacone wartości
  profitPaid?: number;       // Opłacony Zysk CN
  netProfitPaid?: number;    // Opłacony Zysk netto
  balancePaid?: number;      // Opłacone Saldo
  // Nowe pola dla salda z poprzedniego roku
  previousYearBalance?: number;      // Saldo z poprzedniego roku
  previousYearBalancePaid?: number;  // Opłacone saldo z poprzedniego roku
};

export type HistoricalBranchData = {
  year: number;
  month: number;
  data: BranchProfitData;
};

// Nowy typ dla przechowywania informacji o aktualnej dacie
export type CurrentDateType = {
  year: number | null;       // Rok wybrany przez użytkownika
  month: number;             // Aktualny miesiąc
  systemYear: number;        // Rok systemowy (aktualny rok z systemu)
} | null;

// Funkcje formatujące daty - zamiana numeru miesiąca na polską nazwę
const getMonthName = (month: number): string => {
  const monthNames = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
  ];
  return monthNames[month - 1] || "";
};

// Komponent karty zysków oddziału
export type BranchProfitsCardProps = {
  branch: string;            // Nazwa oddziału
  bgColor?: string;          // Klasa tła – domyślnie "bg-gray-50"
  selectedYear?: number | null;    // Wybrany rok - dodane nowe pole
};

export const BranchProfitsCard: React.FC<BranchProfitsCardProps> = ({ branch, bgColor = "bg-gray-50", selectedYear }) => {
  const formatMonthYear = (month: number, year: number): string => {
    return `${getMonthName(month)} ${year}`;
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState<CurrentDateType>(null);
  const [loadingStates, setLoadingStates] = useState({
    date: true,
    yearly: true,
    current: true,
    historical: false,
  });
  const [error, setError] = useState<string | null>(null);

  const [yearlyData, setYearlyData] = useState<BranchProfitData | null>(null);
  const [currentMonthData, setCurrentMonthData] = useState<BranchProfitData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalBranchData[]>([]);
  const { yearsData } = useAvailableYears();

  // Przygotowanie parametru oddziału do zapytań API
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';

  // Wybór ikony nagłówkowej dla oddziału
  const getHeaderIcon = () => {
    if (branch === "MG") return <Monitor className="h-5 w-5 text-red-500" />;
    if (branch === "STH") return <Wrench className="h-5 w-5 text-purple-500" />;
    if (branch === "BHP") return <HardHat className="h-5 w-5 text-yellow-500" />;
    return <MapPin className="h-5 w-5 text-blue-500" />;
  };

// Original styling with background and text colors
const renderHeader = () => {
  let suffix = "";
  let bgColor = "bg-gray-50";
  let textColor = "text-gray-800";

  if (branch === "MG") {
    suffix = "Internet";
    bgColor = "bg-blue-100";
    textColor = "text-red-700";
  } else if (branch === "STH") {
    suffix = "Serwis";
    bgColor = "bg-purple-50";
    textColor = "text-purple-700";
  } else if (branch === "BHP") {
    suffix = "BHP";
    bgColor = "bg-yellow-50";
    textColor = "text-yellow-700";
  } else if (branch === "Pcim") {
    suffix = "Pcim";
  } else if (branch === "Rzgów") {
    suffix = "Rzgów";
  } else if (branch === "Malbork") {
    suffix = "Malbork";
  } else if (branch === "Lublin") {
    suffix = "Lublin";
  } else if (branch === "Łomża") {
    suffix = "Łomża";
  } else if (branch === "Myślibórz") {
    suffix = "Myślibórz";
  }

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md ${
      branch === "MG" ? "bg-blue-100" :
      branch === "STH" ? "bg-purple-50" :
      branch === "BHP" ? "bg-yellow-50" :
      "bg-blue-100"
    }`}>
      {getHeaderIcon()}
      <span className={`text-sm font-medium ${
        branch === "MG" ? "text-red-700" :
        branch === "STH" ? "text-purple-700" :
        branch === "BHP" ? "text-yellow-700" :
        "text-gray-800"
      }`}>
        {suffix}
      </span>
    </div>
  );
};

  // Renderowanie bloku danych dla bieżącego miesiąca lub danych historycznych - z nagłówkami w pierwszej kolumnie
  const renderDataBlock = (data: BranchProfitData) => {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center">
        {/* Pusta pierwsza kolumna (bo nagłówek jest już w renderDataRow) */}
        <div></div>

        {/* Zysk CN z wartością opłaconą w nawiasach - ukryte na najwęższym ekranie */}
        <div className="hidden sm:block text-center">
          <span className="text-sm font-medium text-gray-800">{formatCurrency(data.profit)}</span>
          <div className="text-xs text-gray-600">({data.profitPaid ? formatCurrency(data.profitPaid) : "N/A"})</div>
        </div>

        {/* Koszty - ukryte na mobilnych i małych ekranach */}
        <div className="hidden md:block text-center">
          <span className="text-sm font-medium text-red-600">{formatCurrency(data.costs)}</span>
        </div>

        {/* Zysk netto - ukryte na mobilnych i małych ekranach */}
        <div className="hidden md:block text-center">
          <span className="text-sm font-medium text-blue-600">{formatCurrency(data.netProfit)}</span>
          <div className="text-xs text-blue-400">({data.netProfitPaid ? formatCurrency(data.netProfitPaid) : "N/A"})</div>
        </div>

        {/* Zysk netto opłacony zamiast salda */}
        <div className="text-center">
          {/* Pusta zawartość - dane ukryte */}
        </div>
      </div>
    );
  };

  // Funkcja do renderowania wiersza danych - z nagłówkiem w pierwszej kolumnie
  const renderDataRow = (
    label: string,
    data: BranchProfitData,
    icon: React.ReactNode,
    showBorder: boolean = false
  ) => {
    return (
      <div className={`${showBorder ? 'border-b border-gray-200 pb-3' : ''} mb-3`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center">
          {/* Pierwsza kolumna - nagłówek wiersza */}
          <div className="flex items-center gap-2 ml-2">
            {icon}
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </div>

          {/* Zysk CN z wartością opłaconą w nawiasach - ukryte na najwęższym ekranie */}
          <div className="hidden sm:block text-center">
            <span className="text-sm font-medium text-gray-800">{formatCurrency(data.profit)}</span>
            <div className="text-xs text-gray-600">({data.profitPaid ? formatCurrency(data.profitPaid) : "N/A"})</div>
          </div>

          {/* Koszty - ukryte na mobilnych i małych ekranach */}
          <div className="hidden md:block text-center">
            <span className="text-sm font-medium text-red-600">{formatCurrency(data.costs)}</span>
          </div>

          {/* Zysk netto - ukryte na mobilnych i małych ekranach */}
          <div className="hidden md:block text-center">
            <span className="text-sm font-medium text-blue-600">{formatCurrency(data.netProfit)}</span>
            <div className="text-xs text-blue-400">({data.netProfitPaid ? formatCurrency(data.netProfitPaid) : "N/A"})</div>
          </div>

          {/* Zysk netto opłacony zamiast salda */}
          <div className="text-center">
            {/* Pusta zawartość - dane ukryte */}
          </div>
        </div>
      </div>
    );
  };

  // Pobierz aktualną datę z API - zaktualizowana aby obsługiwać rok systemowy i wybrany
  useEffect(() => {
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
          setError('Błąd ładowania daty');
          setLoadingStates(prev => ({ ...prev, date: false }));
        }
      };
      fetchDate();
  }, [selectedYear]);

  // Ustaw wysokość rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  // Pobierz dane roczne - zaktualizowana aby używać roku z currentDate i uwzględniać saldo roku poprzedniego
  useEffect(() => {
    if (!currentDate) return;

    // Używamy selectedYear jeśli jest dostępny, w przeciwnym razie używamy currentDate.systemYear
    const yearToFetch = currentDate.year || currentDate.systemYear;
    const previousYear = yearToFetch - 1;

    const fetchYearlyData = async () => {
      try {
        // Najpierw pobierz dane z poprzedniego roku, aby uzyskać saldo
        let previousYearBalance = 0;
        let previousYearBalancePaid = 0;

        // Sprawdź, czy poprzedni rok nie jest wcześniejszy niż najstarszy dostępny rok
        if (previousYear >= (yearsData?.years?.[yearsData.years.length - 1] || 0)) {
          // Pobierz dane sprzedażowe z poprzedniego roku
          const prevSalesResponse = await fetch(
            `/api/aggregated_profits?year=${previousYear}${branchQuery}`
          );
          const prevSalesData = await prevSalesResponse.json();

          // Pobierz dane kosztowe z poprzedniego roku
          const prevCostsResponse = await fetch(
            `/api/costs/summary?year=${previousYear}${branchQuery}`
          );
          const prevCostsData = await prevCostsResponse.json();

          // Pobierz dane o wypłatach z poprzedniego roku
          const prevPayoutsResponse = await fetch(
            `/api/costs/branch_payouts?year=${previousYear}${branchQuery}`
          );
          const prevPayoutsData = await prevPayoutsResponse.json();

          // Znajdź odpowiednią wypłatę dla danego oddziału
          const prevBranchPayout = prevPayoutsData.find((item: { branch: string }) =>
            item.branch === branch
          )?.total_payout || 0;

          // Przetwarzanie danych sprzedażowych z poprzedniego roku
          const prevProfit = branch === "MG" || branch === "STH" || branch === "BHP"
            ? prevSalesData.data[0]?.rep_profit || 0
            : prevSalesData.data[0]?.branch_profit || 0;

          const prevProfitPaid = branch === "MG" || branch === "STH" || branch === "BHP"
            ? prevSalesData.data[0]?.rep_profit_paid || 0
            : prevSalesData.data[0]?.branch_profit_paid || 0;

          // Przetwarzanie danych kosztowych z poprzedniego roku
          const prevTotalCost = branch === "MG" || branch === "STH" || branch === "BHP"
            ? prevCostsData.total_summary?.total_ph_cost || 0
            : prevCostsData.total_summary?.total_branch_cost || 0;

          // Oblicz saldo z poprzedniego roku
          previousYearBalance = prevProfit - prevTotalCost - prevBranchPayout;
          previousYearBalancePaid = prevProfitPaid - prevTotalCost - prevBranchPayout;

          // Nie ograniczamy ujemnego salda - będzie pomniejszać saldo bieżącego roku
        }

        // Teraz pobierz dane dla bieżącego roku
        const salesResponse = await fetch(
          `/api/aggregated_profits?year=${yearToFetch}${branchQuery}`
        );
        const salesData = await salesResponse.json();

        // Pobierz dane kosztowe
        const costsResponse = await fetch(
          `/api/costs/summary?year=${yearToFetch}${branchQuery}`
        );
        const costsData = await costsResponse.json();

        // Pobierz dane o wypłatach z nowego endpointu
        const payoutsResponse = await fetch(
          `/api/costs/branch_payouts?year=${yearToFetch}${branchQuery}`
        );
        const payoutsData = await payoutsResponse.json();

        // Znajdź odpowiednią wypłatę dla bieżącego oddziału
        const branchPayout = payoutsData.find((item: { branch: string }) =>
          item.branch === branch
        )?.total_payout || 0;

        // Przetwarzanie danych sprzedażowych
        const profit = branch === "MG" || branch === "STH" || branch === "BHP"
          ? salesData.data[0]?.rep_profit || 0
          : salesData.data[0]?.branch_profit || 0;

        const profit_paid = branch === "MG" || branch === "STH" || branch === "BHP"
          ? salesData.data[0]?.rep_profit_paid || 0
          : salesData.data[0]?.branch_profit_paid || 0;

        // Przetwarzanie danych kosztowych
        const total_cost = branch === "MG" || branch === "STH" || branch === "BHP"
          ? costsData.total_summary?.total_ph_cost || 0
          : costsData.total_summary?.total_branch_cost || 0;

        // Zamiast tymczasowej wartości, używamy rzeczywistych danych o wypłatach
        const payouts = branchPayout;

        // Uwzględniamy saldo z poprzedniego roku w obliczeniach
        const currentYearNetProfit = profit - total_cost;
        const currentYearNetProfitPaid = profit_paid - total_cost;

        const profitData: BranchProfitData = {
          profit,
          costs: total_cost,
          netProfit: currentYearNetProfit,
          payouts,
          // Dodajemy saldo z poprzedniego roku do bieżącego salda
          balance: currentYearNetProfit - payouts + previousYearBalance,
          // Opłacone wartości
          profitPaid: profit_paid,
          netProfitPaid: currentYearNetProfitPaid,
          balancePaid: currentYearNetProfitPaid - payouts + previousYearBalancePaid,
          // Dodajemy nowe pola, aby wskazać ile z salda pochodzi z poprzedniego roku
          previousYearBalance,
          previousYearBalancePaid
        };

        setYearlyData(profitData);
        setLoadingStates(prev => ({ ...prev, yearly: false }));
      } catch (err) {
        console.error('Błąd ładowania danych rocznych:', err);
        setError('Błąd ładowania danych rocznych');
        setLoadingStates(prev => ({ ...prev, yearly: false }));
      }
    };

    fetchYearlyData();
  }, [currentDate, branchQuery, branch, yearsData]);

  // Pobierz dane dla bieżącego miesiąca
  useEffect(() => {
    if (!currentDate) return;

    const fetchCurrentMonthData = async () => {
      try {
        // Używamy roku systemowego dla bieżących danych
        const salesResponse = await fetch(
          `/api/aggregated_profits?year=${currentDate.systemYear}&month=${currentDate.month}${branchQuery}`
        );
        const salesData = await salesResponse.json();

        // Pobierz dane kosztowe
        const costsResponse = await fetch(
          `/api/costs/summary?year=${currentDate.systemYear}&month=${currentDate.month}${branchQuery}`
        );
        const costsData = await costsResponse.json();

        // Pobierz dane o wypłatach z nowego endpointu
        const payoutsResponse = await fetch(
          `/api/costs/branch_payouts?year=${currentDate.systemYear}&month=${currentDate.month}${branchQuery}`
        );
        const payoutsData = await payoutsResponse.json();

        // Znajdź odpowiednią wypłatę dla bieżącego oddziału
        const branchPayout = payoutsData.find((item: { branch: string }) =>
          item.branch === branch
        )?.total_payout || 0;

        // Przetwarzanie danych sprzedażowych
        const profit = branch === "MG" || branch === "STH" || branch === "BHP"
          ? salesData.data[0]?.rep_profit || 0
          : salesData.data[0]?.branch_profit || 0;

        const profit_paid = branch === "MG" || branch === "STH" || branch === "BHP"
          ? salesData.data[0]?.rep_profit_paid || 0
          : salesData.data[0]?.branch_profit_paid || 0;

        // Przetwarzanie danych kosztowych
        const total_cost = branch === "MG" || branch === "STH" || branch === "BHP"
          ? costsData.total_summary?.total_ph_cost || 0
          : costsData.total_summary?.total_branch_cost || 0;

        // Zamiast tymczasowej wartości, używamy rzeczywistych danych o wypłatach
        const payouts = branchPayout;

        const profitData: BranchProfitData = {
          profit,
          costs: total_cost,
          netProfit: profit - total_cost,
          payouts,
          balance: profit - total_cost - payouts,
          // Opłacone wartości
          profitPaid: profit_paid,
          netProfitPaid: profit_paid - total_cost,
          balancePaid: profit_paid - total_cost - payouts
        };

        setCurrentMonthData(profitData);
        setLoadingStates(prev => ({ ...prev, current: false }));
      } catch (err) {
        console.error('Błąd ładowania danych bieżącego miesiąca:', err);
        setError('Błąd ładowania danych bieżącego miesiąca');
        setLoadingStates(prev => ({ ...prev, current: false }));
      }
    };

    fetchCurrentMonthData();
  }, [currentDate, branchQuery, branch]);

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
    if (!isExpanded || !currentDate) return;

    const fetchHistoricalData = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      try {
        // Określ, które miesiące pobrać w zależności od roku
        const yearToUse = currentDate.year || currentDate.systemYear;
        const historicalMonths = getHistoricalMonths(
          yearToUse,
          currentDate.month,
          currentDate.systemYear
        );

        if (historicalMonths.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }

        const historicalDataArray: HistoricalBranchData[] = [];

        // Pobierz dane dla każdego miesiąca
        for (const { year, month } of historicalMonths) {
          // Pobierz dane sprzedażowe (profit)
          const salesResponse = await fetch(
            `/api/aggregated_profits?year=${year}&month=${month}${branchQuery}`
          );
          const salesData = await salesResponse.json();

          // Pobierz dane kosztowe
          const costsResponse = await fetch(
            `/api/costs/summary?year=${year}&month=${month}${branchQuery}`
          );
          const costsData = await costsResponse.json();

          // Pobierz dane o wypłatach z nowego endpointu
          const payoutsResponse = await fetch(
            `/api/costs/branch_payouts?year=${year}&month=${month}${branchQuery}`
          );
          const payoutsData = await payoutsResponse.json();

          // Znajdź odpowiednią wypłatę dla bieżącego oddziału
          const branchPayout = payoutsData.find((item: { branch: string }) =>
            item.branch === branch
          )?.total_payout || 0;

          // Przetwarzanie danych sprzedażowych
          const profit = branch === "MG" || branch === "STH" || branch === "BHP"
            ? salesData.data[0]?.rep_profit || 0
            : salesData.data[0]?.branch_profit || 0;

          const profit_paid = branch === "MG" || branch === "STH" || branch === "BHP"
            ? salesData.data[0]?.rep_profit_paid || 0
            : salesData.data[0]?.branch_profit_paid || 0;

          // Przetwarzanie danych kosztowych
          const total_cost = branch === "MG" || branch === "STH" || branch === "BHP"
            ? costsData.total_summary?.total_ph_cost || 0
            : costsData.total_summary?.total_branch_cost || 0;

          // Zamiast tymczasowej wartości, używamy rzeczywistych danych o wypłatach
          const payouts = branchPayout;

          const profitData: BranchProfitData = {
            profit,
            costs: total_cost,
            netProfit: profit - total_cost,
            payouts,
            balance: profit - total_cost - payouts,
            // Opłacone wartości
            profitPaid: profit_paid,
            netProfitPaid: profit_paid - total_cost,
            balancePaid: profit_paid - total_cost - payouts
          };

          historicalDataArray.push({
            year,
            month,
            data: profitData
          });
        }

        setHistoricalData(historicalDataArray);
      } catch (err) {
        console.error('Błąd ładowania danych historycznych:', err);
        setError('Błąd ładowania danych historycznych');
      } finally {
        setLoadingStates(prev => ({ ...prev, historical: false }));
      }
    };

    fetchHistoricalData();
  }, [isExpanded, currentDate, branchQuery, branch]);

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

  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="p-0">
        {/* Nagłówek karty z nazwą oddziału i nagłówkami kolumn */}
        <div className="flex flex-col p-3 pb-2">
          {/* Nagłówki kolumn z nazwą oddziału w pierwszej kolumnie */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center border-b border-gray-300 pb-2">
            {/* Pierwsza kolumna - nazwa oddziału */}
            <div className="flex items-center gap-2">
              {renderHeader()}
            </div>

            {/* Zysk CN - ukryte na najwęższym ekranie */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-gray-500">Zysk CN</span>
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

            {/* Saldo oddziału */}
            <div className="text-center">
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

              {/* Zysk CN z wartością opłaconą w nawiasach */}
              <div className="text-center">
                <span className="text-sm font-medium text-gray-800">
                  {yearlyData ? formatCurrency(yearlyData.profit) : "N/A"}
                </span>
                <div className="text-xs text-gray-500">
                  ({yearlyData?.profitPaid ? formatCurrency(yearlyData.profitPaid) : "N/A"})
                </div>
              </div>

              {/* Koszty - ukryte na małych ekranach */}
              <div className="hidden md:block text-center">
                <span className="text-sm font-medium text-red-600">
                  {yearlyData ? formatCurrency(yearlyData.costs) : "N/A"}
                </span>
              </div>

              {/* Zysk netto - ukryte na małych ekranach */}
              <div className="hidden md:block text-center">
                <span className="text-sm font-medium text-blue-600">
                  {yearlyData ? formatCurrency(yearlyData.netProfit) : "N/A"}
                </span>
                <div className="text-xs text-blue-400">
                  ({yearlyData?.netProfitPaid ? formatCurrency(yearlyData.netProfitPaid) : "N/A"})
                </div>
              </div>

              {/* Szczegóły salda w estetycznej ramce */}
              <div className="text-center">
                {yearlyData && (
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-3 shadow-sm text-center">
                    <div className="space-y-1">
                      {/* Saldo z ubiegłego roku */}
                      {yearlyData.previousYearBalancePaid !== undefined && (
                        <div className="text-xs text-blue-600">
                          Saldo z {currentDate?.year ? currentDate.year - 1 : 'ubiegłego roku'}: <span className="font-bold">{formatCurrency(yearlyData.previousYearBalancePaid)}</span>
                        </div>
                      )}

                      {/* Zysk CN (opłacony) bieżący rok */}
                      <div className="text-xs text-green-700">
                        Zysk (opłacony) {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{yearlyData.profitPaid ? formatCurrency(yearlyData.profitPaid) : 'N/A'}</span>
                      </div>

                      {/* Koszty bieżący rok */}
                      <div className="text-xs text-red-600">
                        Koszty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(yearlyData.costs)}</span>
                      </div>

                      {/* Wypłaty */}
                      <div className="text-xs text-orange-600">
                        Wypłaty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(yearlyData.payouts)}</span>
                      </div>

                      {/* Bieżące saldo - saldo poprzednie + zysk CN - koszty - wypłaty */}
                      <div className="text-sm text-green-800 pt-2 mt-2 border-t-2 border-green-300 bg-green-100 rounded px-2 py-1">
                        Bieżące saldo: <span className="font-bold">{
                          yearlyData.profitPaid !== undefined
                            ? formatCurrency(
                                (yearlyData.previousYearBalancePaid || 0) +
                                yearlyData.profitPaid -
                                yearlyData.costs -
                                yearlyData.payouts
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
              {yearlyData && (
                <div className="w-full">
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4 shadow-sm text-center">
                    <div className="space-y-2">
                      {/* Saldo z ubiegłego roku */}
                      {yearlyData.previousYearBalancePaid !== undefined && (
                        <div className="text-sm text-blue-600">
                          Saldo z {currentDate?.year ? currentDate.year - 1 : 'ubiegłego roku'}: <span className="font-bold">{formatCurrency(yearlyData.previousYearBalancePaid)}</span>
                        </div>
                      )}

                      {/* Zysk CN (opłacony) bieżący rok */}
                      <div className="text-sm text-green-700">
                        Zysk (opłacony) {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{yearlyData.profitPaid ? formatCurrency(yearlyData.profitPaid) : 'N/A'}</span>
                      </div>

                      {/* Koszty bieżący rok */}
                      <div className="text-sm text-red-600">
                        Koszty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(yearlyData.costs)}</span>
                      </div>

                      {/* Wypłaty */}
                      <div className="text-sm text-orange-600">
                        Wypłaty {currentDate?.year || currentDate?.systemYear}: <span className="font-bold">{formatCurrency(yearlyData.payouts)}</span>
                      </div>

                      {/* Bieżące saldo - saldo poprzednie + zysk CN - koszty - wypłaty */}
                      <div className="text-lg text-green-800 pt-3 mt-3 border-t-2 border-green-300 bg-green-100 rounded px-3 py-2">
                        Bieżące saldo: <span className="font-bold">{
                          yearlyData.profitPaid !== undefined
                            ? formatCurrency(
                                (yearlyData.previousYearBalancePaid || 0) +
                                yearlyData.profitPaid -
                                yearlyData.costs -
                                yearlyData.payouts
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
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center pt-1 pb-0.5 text-xs text-gray-500 hover:text-gray-700 mt-1 mb-1"
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
                      true
                    )}
                  </div>
                )}

                {/* Render all historical months */}
                {historicalData.map((month, idx) => (
                  <div key={idx}>
                    {renderDataRow(
                      formatMonthYear(month.month, month.year),
                      month.data,
                      <Calendar className="h-4 w-4 text-gray-500" />,
                      idx !== historicalData.length - 1
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Główny komponent BranchProfitsView
const BranchProfitsView: React.FC = () => {
  const { userRole, userBranch } = useAuth();
  const [onlyBranch, setOnlyBranch] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();
  const [reloadTrigger, setReloadTrigger] = useState<number>(0); // Nowy stan do wymuszenia przeładowania
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);

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

  // Ustawienie domyślnego roku po załadowaniu dostępnych lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  // Lista oddziałów – kolejność ustalana jest statycznie
  const branches = ["Pcim", "Rzgów", "Malbork", "Lublin", "Łomża", "Myślibórz"];

  const branchDisplayNames: { [key: string]: string } = {
    "MG": "MG - Internet",
    "STH": "STH - Serwis",
    "BHP": "BHP" // Dla BHP nie ma potrzeby zmiany
  };

  // Sprawdzenie uprawnień użytkownika
  const canViewProfitData = userRole === 'ADMIN' || userRole === 'BOARD' || userRole === 'BRANCH';

  useEffect(() => {
    // Jeśli rola to ADMIN lub BOARD, nie ograniczamy widoku
    if (userRole === "ADMIN" || userRole === "BOARD") {
      setOnlyBranch(null);
      return;
    }

    if (userBranch) {
      // Mapowanie nazw oddziałów jeśli potrzebne
      const mapping: Record<string, string> = {
        "pcim": "Pcim",
        "lublin": "Lublin",
        "rzgów": "Rzgów",
        "rzgow": "Rzgów",
        "malbork": "Malbork",
        "łomża": "Łomża",
        "lomza": "Łomża",
        "myślibórz": "Myślibórz",
        "mysliborz": "Myślibórz",
        "mg": "MG",
        "sth": "STH",
        "bhp": "BHP"
      };

      // Normalizacja wartości oddziału
      const branchKey = userBranch.toLowerCase();
      setOnlyBranch(mapping[branchKey] || userBranch);
    } else {
      setOnlyBranch(null);
    }
  }, [userRole, userBranch]);

  // Funkcja pomocnicza do ustalania koloru tła dla oddziału
  const getBgColorForBranch = (branch: string): string => {
    let bgColor = "bg-gray-50";
    if (branch === "MG") {
      bgColor = "bg-blue-50";
    } else if (branch === "STH") {
      bgColor = "bg-purple-50";
    } else if (branch === "BHP") {
      bgColor = "bg-yellow-50";
    }
    return bgColor;
  };

  // Obsługa zmiany roku - wymusza przeładowanie całego widoku
  const handleYearChange = (value: string) => {
    const newYear = parseInt(value);
    setSelectedYear(newYear);
    // Zwiększamy licznik, aby wymusić przeładowanie komponentów
    setReloadTrigger(prev => prev + 1);
  };
  // Obsługa zmiany w filtrze oddziałów
  const handleBranchFilterChange = (value: string) => {
    setSelectedBranchFilter(value === 'all' ? null : value);
  };
  if (!canViewProfitData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <PiggyBank className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Brak dostępu</h2>
            <p className="text-gray-500">
              Nie masz uprawnień do przeglądania danych o zyskach.
              Skontaktuj się z administratorem, jeśli uważasz, że powinieneś mieć dostęp.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Nagłówek z selektorami */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Zyski Oddział</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Selektor oddziałów widoczny dla Admina/Board */}
          {(userRole === 'ADMIN' || userRole === 'BOARD') && (
            <Select
              value={selectedBranchFilter ?? 'all'}
              onValueChange={handleBranchFilterChange}
            >
              <SelectTrigger className={`${selectStyles.trigger} w-full sm:w-40`}>
                <SelectValue placeholder="Wybierz oddział" />
              </SelectTrigger>
              <SelectContent className={`${selectStyles.content} w-full sm:w-40`}>
                <SelectItem className={selectStyles.item} value="all">Wszystkie</SelectItem>
                {branches.map((branch) => (
                  <SelectItem
                    className={selectStyles.item}
                    key={branch}
                    value={branch}
                  >
                    {branchDisplayNames[branch] || branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Selektor roku */}
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

      {/* Komunikat wyświetlany na urządzeniach mobilnych i małych ekranach - zaktualizowany */}
      <div className="sm:hidden text-center mb-4 text-gray-600">
        <div>
          Pokazane tylko najważniejsze dane<br />
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /> lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {onlyBranch && userRole === "BRANCH" ? (
        // Jeśli użytkownik jest managerem oddziału, renderujemy tylko kartę tego oddziału
        <div className="space-y-8" key={`branch-${onlyBranch}-${reloadTrigger}`}>
          <BranchProfitsCard
            branch={onlyBranch}
            bgColor={getBgColorForBranch(onlyBranch)}
            selectedYear={selectedYear}
          />
        </div>
      ) : (
        // Jeśli użytkownik ma rolę ADMIN/BOARD, renderujemy karty dla wszystkich lub jednego oddziału
        <>
          {/* Karty dla oddziałów – tła ustawiane naprzemiennie lub indywidualnie */}
          {branches
            .filter(branch => !selectedBranchFilter || branch === selectedBranchFilter)
            .map((branch, index) => {
              let bgColor = index % 2 === 0 ? "bg-gray-50" : "bg-gray-100";
              if (branch === "MG" || branch === "STH" || branch === "BHP") {
                bgColor = getBgColorForBranch(branch);
              }
              return (
                <React.Fragment key={`branch-${branch}-${reloadTrigger}`}>
                  <BranchProfitsCard
                    branch={branch}
                    bgColor={bgColor}
                    selectedYear={selectedYear}
                  />
                </React.Fragment>
              );
            })}
        </>
      )}
    </div>
  );
};

export default BranchProfitsView;