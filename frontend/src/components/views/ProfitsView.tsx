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
export type ProfitCategoryData = {
  firm: number;
  branches: number;
  ph: number;
  fund: number;
  total: number;
  // Dodajemy opcjonalne pola na opłacone wartości
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

export type HistoricalProfitData = {
  year: number;
  month: number;
  data: ProfitData;
};

// Rozszerzymy typ dla currentDate, aby zawierał również rok systemowy
type CurrentDateType = {
  year: number;
  month: number;
  systemYear: number;
} | null;

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

// Funkcje formatujące daty - zamiana numeru miesiąca na polską nazwę
const getMonthName = (month: number, useShortFormat: boolean = false): string => {
  if (useShortFormat) {
    // Format liczbowy dla małych ekranów (01, 02, ..., 12)
    return String(month).padStart(2, '0');
  }

  const monthNames = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
  ];
  return monthNames[month - 1] || "";
};

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

// Komponent karty zysków
export type ProfitsCardProps = {
  branch?: string;    // Jeśli undefined – karta globalna; jeśli podany, wyświetla dane oddziału
  bgColor?: string;   // Klasa tła – domyślnie "bg-gray-50"
  selectedYear: number; // Rok do wyświetlenia danych
};

export const ProfitsCard: React.FC<ProfitsCardProps> = ({ branch, bgColor = "bg-green-50", selectedYear }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState<CurrentDateType>(null);
  const [loadingStates, setLoadingStates] = useState({
    date: true,
    yearly: true,
    monthly: true,
    historical: false,
  });
  const [error, setError] = useState<string | null>(null);

  const [yearlyData, setYearlyData] = useState<ProfitData | null>(null);
  const [monthlyData, setMonthlyData] = useState<ProfitData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalProfitData[]>([]);

  // Jeśli przekazany został branch, do zapytań do API dodajemy parametr branch
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';

  // Wybór ikony nagłówkowej – dla oddziału (jeśli prop branch jest przekazany)
  const getHeaderIcon = () => {
    if (branch) {
      if (branch === "MG") return <Monitor className="h-5 w-5 text-red-500" />;
      if (branch === "STH") return <Wrench className="h-5 w-5 text-purple-500" />;
      if (branch === "BHP") return <HardHat className="h-5 w-5 text-yellow-500" />;
      return <MapPin className="h-5 w-5 text-blue-500" />;
    }
    return <Building2 className="h-5 w-5 text-blue-500" />;
  };

  // Renderowanie nagłówka – dla oddziału dodajemy sufiks (np. "Internet" dla MG)
  const renderHeader = () => {
    let suffix = "";
    let bgColor = "bg-gray-50";
    let textColor = "text-gray-800";

    if (branch) {
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
    } else {
      // For the summary card
      bgColor = "bg-blue-50";
      textColor = "text-blue-700";
      suffix = "Suma";
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

  // Pobierz aktualną datę z API
  useEffect(() => {
    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        // Zapisuj także rok systemowy
        setCurrentDate({
          year: selectedYear,
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

  // Pobierz dane roczne
  useEffect(() => {
    if (!currentDate) return;

    const fetchYearlyData = async () => {
      setLoadingStates(prev => ({ ...prev, yearly: true }));
      try {
        // Pobierz dane sprzedażowe (profit)
        const salesResponse = await fetch(
          `/api/aggregated_profits?year=${selectedYear}${branchQuery}&aggregate_company=${!branch ? 'true' : 'false'}`
        );
        const salesData = await salesResponse.json();

        // Pobierz dane kosztowe
        const costsResponse = await fetch(
          `/api/costs/summary?year=${selectedYear}${branchQuery}`
        );
        const costsData = await costsResponse.json();

        // Przetwarzanie danych sprzedażowych
        const profit = salesData.data[0]?.profit || 0;
        const hq_profit = salesData.data[0]?.hq_profit || 0;
        const branch_profit = salesData.data[0]?.branch_profit || 0;
        const rep_profit = salesData.data[0]?.rep_profit || 0;
        const found = salesData.data[0]?.found || 0;
        const profit_paid = salesData.data[0]?.profit_paid || 0;
        const hq_profit_paid = salesData.data[0]?.hq_profit_paid || 0;
        const branch_profit_paid = salesData.data[0]?.branch_profit_paid || 0;
        const rep_profit_paid = salesData.data[0]?.rep_profit_paid || 0;
        const found_paid = salesData.data[0]?.found_paid || 0;

        // Przetwarzanie danych kosztowych
        const total_cost = costsData.total_summary?.total_cost || 0;
        const total_branch_cost = costsData.total_summary?.total_branch_cost || 0;
        const total_hq_cost = costsData.total_summary?.total_hq_cost || 0;
        const total_ph_cost = costsData.total_summary?.total_ph_cost || 0;

        // Obliczamy wartości dla struktury ProfitData z dodatkowymi wartościami opłaconymi
        const profitData: ProfitData = {
          profitCN: {
            firm: hq_profit,
            branches: branch_profit,
            ph: rep_profit,
            fund: found,
            total: profit,
            // Dodajemy opłacone wartości (przykładowe współczynniki)
            firmPaid: hq_profit_paid,
            branchesPaid: branch_profit_paid,
            phPaid: rep_profit_paid,
            fundPaid: found_paid,
            totalPaid: profit_paid
          },
          costs: {
            firm: total_hq_cost,
            branches: total_branch_cost,
            ph: total_ph_cost,
            fund: 0,                      // Fundusz nie ma kosztów
            total: total_hq_cost + total_branch_cost + total_ph_cost
          },
          netProfit: {
            firm: hq_profit - total_hq_cost,
            branches: branch_profit - total_branch_cost,
            ph: rep_profit - total_ph_cost,
            fund: found,  // Dodana brakująca właściwość
            total: profit - total_cost,
            // Dodajemy opłacone wartości (przykładowe współczynniki)
            firmPaid: hq_profit_paid - total_hq_cost,
            branchesPaid: branch_profit_paid - total_branch_cost,
            phPaid: rep_profit_paid - total_ph_cost,
            fundPaid: found_paid,
            totalPaid: profit_paid - total_cost
          }
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
  }, [currentDate, branchQuery, selectedYear, branch]);

  // Pobierz dane miesięczne
  useEffect(() => {
    if (!currentDate) return;

    const fetchMonthlyData = async () => {
      setLoadingStates(prev => ({ ...prev, monthly: true }));
      try {
        // Pobierz dane sprzedażowe (profit)
        const salesResponse = await fetch(
          `/api/aggregated_profits?year=${selectedYear}&month=${currentDate.month}${branchQuery}&aggregate_company=${!branch ? 'true' : 'false'}`
        );
        const salesData = await salesResponse.json();

        // Pobierz dane kosztowe
        const costsResponse = await fetch(
          `/api/costs/summary?year=${selectedYear}&month=${currentDate.month}${branchQuery}`
        );
        const costsData = await costsResponse.json();

        // Przetwarzanie danych sprzedażowych
        const profit = salesData.data[0]?.profit || 0;
        const hq_profit = salesData.data[0]?.hq_profit || 0;
        const branch_profit = salesData.data[0]?.branch_profit || 0;
        const rep_profit = salesData.data[0]?.rep_profit || 0;
        const found = salesData.data[0]?.found || 0;
        const profit_paid = salesData.data[0]?.profit_paid || 0;
        const hq_profit_paid = salesData.data[0]?.hq_profit_paid || 0;
        const branch_profit_paid = salesData.data[0]?.branch_profit_paid || 0;
        const rep_profit_paid = salesData.data[0]?.rep_profit_paid || 0;
        const found_paid = salesData.data[0]?.found_paid || 0;

        // Przetwarzanie danych kosztowych
        const total_cost = costsData.total_summary?.total_cost || 0;
        const total_branch_cost = costsData.total_summary?.total_branch_cost || 0;
        const total_hq_cost = costsData.total_summary?.total_hq_cost || 0;
        const total_ph_cost = costsData.total_summary?.total_ph_cost || 0;

        // Obliczamy wartości dla struktury ProfitData
        const profitData: ProfitData = {
           profitCN: {
            firm: hq_profit,
            branches: branch_profit,
            ph: rep_profit,
            fund: found,
            total: profit,
            // Dodajemy opłacone wartości (przykładowe współczynniki)
            firmPaid: hq_profit_paid,
            branchesPaid: branch_profit_paid,
            phPaid: rep_profit_paid,
            fundPaid: found_paid,
            totalPaid: profit_paid
          },
          costs: {
            firm: total_hq_cost,
            branches: total_branch_cost,
            ph: total_ph_cost,
            fund: 0,
            total: total_hq_cost + total_branch_cost + total_ph_cost
          },
          netProfit: {
            firm: hq_profit - total_hq_cost,
            branches: branch_profit - total_branch_cost,
            ph: rep_profit - total_ph_cost,
            fund: found,  // Dodaj tę linię
            total: profit - total_cost,
              // Dodajemy opłacone wartości
            firmPaid: hq_profit_paid - total_hq_cost,
            branchesPaid: branch_profit_paid - total_branch_cost,
            phPaid: rep_profit_paid - total_ph_cost,
            fundPaid: found_paid,
            totalPaid: profit_paid - total_cost
          }
        };

        setMonthlyData(profitData);
        setLoadingStates(prev => ({ ...prev, monthly: false }));
      } catch (err) {
        console.error('Błąd ładowania danych miesięcznych:', err);
        setError('Błąd ładowania danych miesięcznych');
        setLoadingStates(prev => ({ ...prev, monthly: false }));
      }
    };

    fetchMonthlyData();
  }, [currentDate, branchQuery, selectedYear, branch]);

  // Funkcja zwracająca miesiące do wyświetlenia w historii
  const getHistoricalMonths = (year: number, currentMonth: number, systemYear: number) => {
    const months = [];

    // Sprawdzamy, czy wybrany rok to rok bieżący w systemie
    const isCurrentYear = year === systemYear;

    if (isCurrentYear) {
      // Dla bieżącego roku - od bieżącego miesiąca do stycznia
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

  // Pobierz dane historyczne po rozwinięciu
  useEffect(() => {
    if (!isExpanded || !currentDate) return;

    const fetchHistoricalData = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      try {
        // Użyj funkcji getHistoricalMonths zamiast getHistoricalMonthsForCurrentYear
        const historicalMonths = getHistoricalMonths(
          selectedYear,
          currentDate.month,
          currentDate.systemYear
        );

        if (historicalMonths.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }

        const historicalDataArray: HistoricalProfitData[] = [];

        // Pobierz dane dla każdego miesiąca
        for (const { year, month } of historicalMonths) {
          // Pobierz dane sprzedażowe (profit)
          const salesResponse = await fetch(
            `/api/aggregated_profits?year=${year}&month=${month}${branchQuery}&aggregate_company=${!branch ? 'true' : 'false'}`
          );
          const salesData = await salesResponse.json();

          // Pobierz dane kosztowe
          const costsResponse = await fetch(
            `/api/costs/summary?year=${year}&month=${month}${branchQuery}`
          );
          const costsData = await costsResponse.json();

          // Przetwarzanie danych sprzedażowych
          const profit = salesData.data[0]?.profit || 0;
          const hq_profit = salesData.data[0]?.hq_profit || 0;
          const branch_profit = salesData.data[0]?.branch_profit || 0;
          const rep_profit = salesData.data[0]?.rep_profit || 0;
          const found = salesData.data[0]?.found || 0;
          const profit_paid = salesData.data[0]?.profit_paid || 0;
          const hq_profit_paid = salesData.data[0]?.hq_profit_paid || 0;
          const branch_profit_paid = salesData.data[0]?.branch_profit_paid || 0;
          const rep_profit_paid = salesData.data[0]?.rep_profit_paid || 0;
          const found_paid = salesData.data[0]?.found_paid || 0;

          // Przetwarzanie danych kosztowych
          const total_cost = costsData.total_summary?.total_cost || 0;
          const total_branch_cost = costsData.total_summary?.total_branch_cost || 0;
          const total_hq_cost = costsData.total_summary?.total_hq_cost || 0;
          const total_ph_cost = costsData.total_summary?.total_ph_cost || 0;

          // Obliczamy wartości dla struktury ProfitData
          const profitData: ProfitData = {
            profitCN: {
              firm: hq_profit,
              branches: branch_profit,
              ph: rep_profit,
              fund: found,
              total: profit,
              // Dodajemy opłacone wartości (przykładowe współczynniki)
              firmPaid: hq_profit_paid,
              branchesPaid: branch_profit_paid,
              phPaid: rep_profit_paid,
              fundPaid: found_paid,
              totalPaid: profit_paid
            },
            costs: {
              firm: total_hq_cost,
              branches: total_branch_cost,
              ph: total_ph_cost,
              fund: 0,
              total: total_hq_cost + total_branch_cost + total_ph_cost
            },
            netProfit: {
              firm: hq_profit - total_hq_cost,
              branches: branch_profit - total_branch_cost,
              ph: rep_profit - total_ph_cost,
              fund: found,  // Dodaj tę linię
              total: profit - total_cost,
              // Dodajemy opłacone wartości
              firmPaid: hq_profit_paid - total_hq_cost,
              branchesPaid: branch_profit_paid - total_branch_cost,
              phPaid: rep_profit_paid - total_ph_cost,
              fundPaid: found_paid,
              totalPaid: profit_paid - total_cost
            }
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
  }, [isExpanded, currentDate, branchQuery, selectedYear, branch]);

  // Formatowanie miesiąca i roku
  const formatMonthYear = (month: number, year: number): string => {
    return `${getMonthName(month)} ${year}`;
  };

  if (error) {
    return (
      <Card className={`w-full ${bgColor}`}>
        <CardContent className="p-3 text-red-500">{error}</CardContent>
      </Card>
    );
  }

  if (loadingStates.date || loadingStates.yearly || loadingStates.monthly) {
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
        {/* Nagłówek karty z nagłówkami kolumn */}
        <div className="flex flex-col p-3 pb-2">
          {/* Nagłówki kolumn */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center border-b border-gray-300 pb-2">
            {/* Pierwsza kolumna - etykieta */}
            <div className="flex items-center gap-2">
              {renderHeader()}
            </div>

            {/* Firma */}
            <div className="text-center">
              <span className="text-xs font-medium text-gray-500">Firma</span>
              <div className="text-xs text-gray-400">(opłacona)</div>
            </div>

            {/* Oddziały - ukryte na mobilnych */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-gray-500">Oddziały</span>
              <div className="text-xs text-gray-400">(opłacone)</div>
            </div>

            {/* PH - ukryte na mobilnych */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-gray-500">PH</span>
              <div className="text-xs text-gray-400">(opłacone)</div>
            </div>

            {/* Fundusz - ukryte na mobilnych */}
            <div className="hidden sm:block text-center">
              <span className="text-xs font-medium text-gray-500">Fundusz</span>
              <div className="text-xs text-gray-400">(opłacony)</div>
            </div>

            {/* Total */}
            <div className="text-center">
              <span className="text-xs font-medium text-gray-500">Total</span>
              <div className="text-xs text-gray-400">(opłacony)</div>
            </div>
          </div>


          {/* Dane roczne - wszystkie wiersze (Zysk CN, Koszty, Zysk netto) */}
          {yearlyData && (
            <div>
              {/* Wiersz Zysk CN */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                <div className="ml-2">
                  <span className="text-xs font-medium text-gray-700">Zysk CN</span>
                </div>

                {/* Firma */}
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-800">
                    {formatCurrency(yearlyData.profitCN.firm)}
                  </span>
                  <div className="text-xs text-gray-600">
                    ({formatCurrency(yearlyData.profitCN.firmPaid || yearlyData.profitCN.firm * 0.85)})
                  </div>
                </div>

                {/* Oddziały - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-gray-800">
                    {formatCurrency(yearlyData.profitCN.branches)}
                  </span>
                  <div className="text-xs text-gray-600">
                    ({formatCurrency(yearlyData.profitCN.branchesPaid || yearlyData.profitCN.branches * 0.85)})
                  </div>
                </div>

                {/* PH - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-gray-800">
                    {formatCurrency(yearlyData.profitCN.ph)}
                  </span>
                  <div className="text-xs text-gray-600">
                    ({formatCurrency(yearlyData.profitCN.phPaid || yearlyData.profitCN.ph * 0.85)})
                  </div>
                </div>

                {/* Fundusz - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-gray-800">
                    {formatCurrency(yearlyData.profitCN.fund)}
                  </span>
                  <div className="text-xs text-gray-600">
                    ({formatCurrency(yearlyData.profitCN.fundPaid || yearlyData.profitCN.fund * 0.85)})
                  </div>
                </div>

{/* Total */}
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-800">
                    {formatCurrency(yearlyData.profitCN.total)}
                  </span>
                  <div className="text-xs text-gray-600">
                    ({formatCurrency(yearlyData.profitCN.totalPaid || yearlyData.profitCN.total * 0.85)})
                  </div>
                </div>
              </div>

              {/* Wiersz Koszty */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                <div className="ml-2">
                  <span className="text-xs font-medium text-gray-700">Koszty</span>
                </div>

                {/* Firma */}
                <div className="text-center">
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrency(yearlyData.costs.firm)}
                  </span>
                </div>

                {/* Oddziały - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrency(yearlyData.costs.branches)}
                  </span>
                </div>

                {/* PH - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrency(yearlyData.costs.ph)}
                  </span>
                </div>

                {/* Fundusz - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-gray-400">-</span>
                </div>

                {/* Total */}
                <div className="text-center">
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrency(yearlyData.costs.total)}
                  </span>
                </div>
              </div>

              {/* Wiersz Zysk netto */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1">
                <div className="ml-2">
                  <span className="text-xs font-medium text-gray-700">Zysk netto</span>
                </div>

                {/* Firma */}
                <div className="text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatCurrency(yearlyData.netProfit.firm)}
                  </span>
                  <div className="text-xs text-blue-400">
                    ({formatCurrency(yearlyData.netProfit.firmPaid || yearlyData.netProfit.firm * 0.85)})
                  </div>
                </div>

                {/* Oddziały - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatCurrency(yearlyData.netProfit.branches)}
                  </span>
                  <div className="text-xs text-blue-400">
                    ({formatCurrency(yearlyData.netProfit.branchesPaid || yearlyData.netProfit.branches * 0.85)})
                  </div>
                </div>

                {/* PH - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatCurrency(yearlyData.netProfit.ph)}
                  </span>
                  <div className="text-xs text-blue-400">
                    ({formatCurrency(yearlyData.netProfit.phPaid || yearlyData.netProfit.ph * 0.85)})
                  </div>
                </div>

                {/* Fundusz - ukryte na mobilnych */}
                <div className="hidden sm:block text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatCurrency(yearlyData.netProfit.fund)}
                  </span>
                  <div className="text-xs text-blue-400">
                    ({formatCurrency(yearlyData.netProfit.fundPaid || yearlyData.netProfit.fund * 0.85)})
                  </div>
                </div>

                {/* Total */}
                <div className="text-center">
                  <span className="text-sm font-medium text-blue-600">
                    {formatCurrency(yearlyData.netProfit.total)}
                  </span>
                  <div className="text-xs text-blue-400">
                    ({formatCurrency(yearlyData.netProfit.totalPaid || yearlyData.netProfit.total * 0.85)})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Przycisk rozwijania historycznych danych */}
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
                 monthlyData &&
                 currentDate.year === currentDate.systemYear && (
                  <div className="mb-4">
                    {/* Tytuł miesiąca */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center border-b border-gray-200 pb-2 mb-2">
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-red-100">
                          <Calendar className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-medium text-red-700">
                            {formatMonthYear(currentDate.month, currentDate.systemYear)}
                          </span>
                       </div>

                      {/* Pozostałe kolumny nagłówka */}
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500">Firma</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">Oddziały</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">PH</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">Fundusz</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500">Total</span>
                      </div>
                    </div>

                    {/* Dane miesięczne - wszystkie wiersze */}
                    <div>
                      {/* Wiersz Zysk CN */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Zysk CN</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(monthlyData.profitCN.firm)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(monthlyData.profitCN.firmPaid || monthlyData.profitCN.firm * 0.85)})
                          </div>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(monthlyData.profitCN.branches)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(monthlyData.profitCN.branchesPaid || monthlyData.profitCN.branches * 0.85)})
                          </div>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(monthlyData.profitCN.ph)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(monthlyData.profitCN.phPaid || monthlyData.profitCN.ph * 0.85)})
                          </div>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(monthlyData.profitCN.fund)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(monthlyData.profitCN.fundPaid || monthlyData.profitCN.fund * 0.85)})
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(monthlyData.profitCN.total)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(monthlyData.profitCN.totalPaid || monthlyData.profitCN.total * 0.85)})
                          </div>
                        </div>
                      </div>

                      {/* Wiersz Koszty */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Koszty</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(monthlyData.costs.firm)}
                          </span>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(monthlyData.costs.branches)}
                          </span>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(monthlyData.costs.ph)}
                          </span>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-400">-</span>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(monthlyData.costs.total)}
                          </span>
                        </div>
                      </div>

                      {/* Wiersz Zysk netto */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Zysk netto</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(monthlyData.netProfit.firm)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(monthlyData.netProfit.firmPaid || monthlyData.netProfit.firm * 0.85)})
                          </div>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(monthlyData.netProfit.branches)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(monthlyData.netProfit.branchesPaid || monthlyData.netProfit.branches * 0.85)})
                          </div>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(monthlyData.netProfit.ph)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(monthlyData.netProfit.phPaid || monthlyData.netProfit.ph * 0.85)})
                          </div>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(monthlyData.netProfit.fund)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(monthlyData.netProfit.fundPaid || monthlyData.netProfit.fund * 0.85)})
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(monthlyData.netProfit.total)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(monthlyData.netProfit.totalPaid || monthlyData.netProfit.total * 0.85)})
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dane historyczne dla wszystkich miesięcy */}
                {historicalData.map((month, idx) => (
                  <div key={idx} className="mb-4">
                    {/* Tytuł miesiąca */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center border-b border-gray-200 pb-2 mb-2">
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-red-100">
                          <Calendar className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-medium text-red-700">
                            {formatMonthYear(month.month, month.year)}
                          </span>
                      </div>

                      {/* Pozostałe kolumny nagłówka */}
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500">Firma</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">Oddziały</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">PH</span>
                      </div>
                      <div className="hidden sm:block text-center">
                        <span className="text-xs font-medium text-gray-500">Fundusz</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-medium text-gray-500">Total</span>
                      </div>
                    </div>

                    {/* Dane historyczne - wszystkie wiersze */}
                    <div>
                      {/* Wiersz Zysk CN */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Zysk CN</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(month.data.profitCN.firm)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(month.data.profitCN.firmPaid || month.data.profitCN.firm * 0.85)})
                          </div>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(month.data.profitCN.branches)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(month.data.profitCN.branchesPaid || month.data.profitCN.branches * 0.85)})
                          </div>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(month.data.profitCN.ph)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(month.data.profitCN.phPaid || month.data.profitCN.ph * 0.85)})
                          </div>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(month.data.profitCN.fund)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(month.data.profitCN.fundPaid || month.data.profitCN.fund * 0.85)})
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-800">
                            {formatCurrency(month.data.profitCN.total)}
                          </span>
                          <div className="text-xs text-gray-600">
                            ({formatCurrency(month.data.profitCN.totalPaid || month.data.profitCN.total * 0.85)})
                          </div>
                        </div>
                      </div>

                      {/* Wiersz Koszty */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1 border-b border-gray-100">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Koszty</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(month.data.costs.firm)}
                          </span>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(month.data.costs.branches)}
                          </span>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(month.data.costs.ph)}
                          </span>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-gray-400">-</span>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-red-600">
                            {formatCurrency(month.data.costs.total)}
                          </span>
                        </div>
                      </div>

                      {/* Wiersz Zysk netto */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 items-center py-1">
                        <div className="ml-2">
                          <span className="text-xs font-medium text-gray-700">Zysk netto</span>
                        </div>

                        {/* Firma */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(month.data.netProfit.firm)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(month.data.netProfit.firmPaid || month.data.netProfit.firm * 0.85)})
                          </div>
                        </div>

                        {/* Oddziały - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(month.data.netProfit.branches)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(month.data.netProfit.branchesPaid || month.data.netProfit.branches * 0.85)})
                          </div>
                        </div>

                        {/* PH - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(month.data.netProfit.ph)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(month.data.netProfit.phPaid || month.data.netProfit.ph * 0.85)})
                          </div>
                        </div>

                        {/* Fundusz - ukryte na mobilnych */}
                        <div className="hidden sm:block text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(month.data.netProfit.fund)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(month.data.netProfit.fundPaid || month.data.netProfit.fund * 0.85)})
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-center">
                          <span className="text-sm font-medium text-blue-600">
                            {formatCurrency(month.data.netProfit.total)}
                          </span>
                          <div className="text-xs text-blue-400">
                            ({formatCurrency(month.data.netProfit.totalPaid || month.data.netProfit.total * 0.85)})
                          </div>
                        </div>
                      </div>
                    </div>
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

// Główny komponent ProfitsView
const ProfitsView: React.FC = () => {
  const { userRole, userBranch } = useAuth();
  const [onlyBranch, setOnlyBranch] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);

  // Lista oddziałów – kolejność ustalana jest statycznie
  const branches = ["Pcim", "Rzgów", "Malbork", "Lublin", "Łomża", "Myślibórz", "MG", "STH", "BHP"];

  const branchDisplayNames: { [key: string]: string } = {
    "MG": "MG - Internet",
    "STH": "STH - Serwis",
    "BHP": "BHP"
  };

  // Sprawdzenie uprawnień użytkownika
  const canViewProfitData = userRole === 'ADMIN' || userRole === 'BOARD';

  // Ustawienie domyślnego roku po załadowaniu dostępnych lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

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
    <div className="space-y-6">
        {/* === POCZĄTEK ZMIAN === */}
        {/* === POCZĄTEK ZMIAN === */}
        <div className="mb-6">
            {/* --- Układ TYLKO dla mobile (ukryty na sm i większych) --- */}
            <div className="sm:hidden">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">Zyski Firma</h2>
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
                                    <SelectItem className={selectStyles.item} key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {(userRole === 'ADMIN' || userRole === 'BOARD') && (
                    <div className="mt-4">
                        <Select value={selectedBranchFilter ?? 'all'} onValueChange={handleBranchFilterChange}>
                            <SelectTrigger className={`${selectStyles.trigger} w-full`}>
                                <SelectValue placeholder="Filtruj oddział" />
                            </SelectTrigger>
                            <SelectContent className={`${selectStyles.content} w-full`}>
                                <SelectItem className={selectStyles.item} value="all">Wszystkie</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem className={selectStyles.item} key={branch} value={branch}>
                                        {branchDisplayNames[branch] || branch}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* --- Układ TYLKO dla desktop (ukryty na xs) --- */}
            <div className="hidden sm:flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Zyski Firma</h2>
                <div className="flex items-center gap-4">
                    {(userRole === 'ADMIN' || userRole === 'BOARD') && (
                        <Select value={selectedBranchFilter ?? 'all'} onValueChange={handleBranchFilterChange}>
                            <SelectTrigger className={`${selectStyles.trigger} w-48`}>
                                <SelectValue placeholder="Filtruj oddział" />
                            </SelectTrigger>
                            <SelectContent className={`${selectStyles.content} w-48`}>
                                <SelectItem className={selectStyles.item} value="all">Wszystkie</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem className={selectStyles.item} key={branch} value={branch}>
                                        {branchDisplayNames[branch] || branch}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
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
                                    <SelectItem className={selectStyles.item} key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
        {/* === KONIEC ZMIAN === */}
        {/* === KONIEC ZMIAN === */}

      <div className="sm:hidden text-center mb-4 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {selectedYear ? (
        onlyBranch && userRole !== "ADMIN" && userRole !== "BOARD" ? (
          <div className="space-y-6">
            <ProfitsCard branch={onlyBranch} bgColor={getBgColorForBranch(onlyBranch)} selectedYear={selectedYear} />
          </div>
        ) : (
          <>
            {!selectedBranchFilter && (
                <>
                    <ProfitsCard bgColor="bg-green-50" selectedYear={selectedYear} />
                    <hr className="border-t border-gray-300 my-4" />
                </>
            )}

            {branches
              .filter(branch => !selectedBranchFilter || branch === selectedBranchFilter)
              .map((branch, index) => {
                let bgColor = index % 2 === 0 ? "bg-gray-50" : "bg-gray-100";
                if (branch === "MG" || branch === "STH" || branch === "BHP") {
                  bgColor = getBgColorForBranch(branch);
                }
                return (
                  <React.Fragment key={branch}>
                    {branch === "MG" && !selectedBranchFilter && <hr className="border-t border-gray-300 my-4" />}
                    <ProfitsCard branch={branch} bgColor={bgColor} selectedYear={selectedYear} />
                  </React.Fragment>
                );
            })}
          </>
        )
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-pulse">Ładowanie danych...</div>
        </div>
      )}
    </div>
  );
};

export default ProfitsView;