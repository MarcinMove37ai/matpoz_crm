"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  CalendarDays,
  Calendar,
  MapPin,
  Monitor,
  Wrench,
  HardHat,
  PiggyBank,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionYears } from '@/hooks/useTransactionYears';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

//
// Funkcje pomocnicze – formatowanie waluty
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

// Funkcja pomocnicza do obliczania sumy kosztów
const calculateTotalCost = (data: CostsData): CostsData => {
  return {
    ...data,
    total_cost: data.total_branch_cost + data.total_hq_cost + data.total_ph_cost
  };
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
export type CostsData = {
  total_cost: number;
  total_branch_cost: number;
  total_hq_cost: number;
  total_ph_cost: number;
};

export type HistoricalCostsData = {
  year: number;
  month: number;
  data: CostsData;
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
// Komponent CostsSummaryCard – pojedyncza karta kosztów
//
export type CostsSummaryCardProps = {
  branch?: string;    // Jeśli undefined – karta globalna; jeśli podany, wyświetla dane oddziału
  bgColor?: string;   // Klasa tła – domyślnie "bg-gray-50"
  selectedYear: number | null; // Wybrany rok
};

export const CostsSummaryCard: React.FC<CostsSummaryCardProps> = ({ branch, bgColor = "bg-gray-50", selectedYear }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState<{ year: number; month: number } | null>(null);
  const [loadingStates, setLoadingStates] = useState({
    date: true,
    yearly: true,
    monthly: true,
    historical: false,
  });
  const [error, setError] = useState<string | null>(null);

  const [yearlyData, setYearlyData] = useState<CostsData | null>(null);
  const [monthlyData, setMonthlyData] = useState<CostsData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalCostsData[]>([]);

  // Jeśli przekazany został branch, do zapytań do API dodajemy parametr branch
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';

  // Pobierz aktualną datę z API
  useEffect(() => {
    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        const data = await response.json();
        setCurrentDate({ year: data.year, month: data.month });
        setLoadingStates(prev => ({ ...prev, date: false }));
      } catch (err) {
        setError('Błąd ładowania daty');
        setLoadingStates(prev => ({ ...prev, date: false }));
      }
    };
    fetchDate();
  }, []);

  // Ustaw wysokość rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  // Pobierz dane roczne
  useEffect(() => {
    if (!selectedYear) return;
    setLoadingStates(prev => ({ ...prev, yearly: true }));
    const fetchYearlyData = async () => {
      try {
        const response = await fetch(
          `/api/costs/summary?year=${selectedYear}${branchQuery}`
        );
        const data = await response.json();
        // Oblicz total_cost jako sumę pozostałych kosztów
        setYearlyData(calculateTotalCost(data.total_summary));
        setLoadingStates(prev => ({ ...prev, yearly: false }));
      } catch (err) {
        setError('Błąd ładowania danych rocznych');
        setLoadingStates(prev => ({ ...prev, yearly: false }));
      }
    };
    fetchYearlyData();
  }, [selectedYear, branchQuery]);

  // Pobierz dane miesięczne
  useEffect(() => {
    if (!currentDate || !selectedYear) return;

    // Określamy, który miesiąc pokazać
    let monthToShow = currentDate.month;
    // Jeśli wybrany rok jest wcześniejszy niż bieżący, pokazujemy grudzień
    if (selectedYear < currentDate.year) {
      monthToShow = 12;
    }
    // Jeśli wybrany rok jest bieżący, pokazujemy aktualny miesiąc

    setLoadingStates(prev => ({ ...prev, monthly: true }));
    const fetchMonthlyData = async () => {
      try {
        const response = await fetch(
          `/api/costs/summary?year=${selectedYear}&month=${monthToShow}${branchQuery}`
        );
        const data = await response.json();
        // Oblicz total_cost jako sumę pozostałych kosztów
        setMonthlyData(calculateTotalCost(data.total_summary));
        setLoadingStates(prev => ({ ...prev, monthly: false }));
      } catch (err) {
        setError('Błąd ładowania danych miesięcznych');
        setLoadingStates(prev => ({ ...prev, monthly: false }));
      }
    };
    fetchMonthlyData();
  }, [currentDate, selectedYear, branchQuery]);

  // Funkcja zwracająca wszystkie poprzednie miesiące wybranego roku
  const getHistoricalMonths = (year: number, currentMonth: number) => {
    const months = [];
    // Jeśli wybrany rok jest wcześniejszy niż bieżący, pokazujemy wszystkie miesiące (1-11)
    if (currentDate && year < currentDate.year) {
      for (let m = 11; m >= 1; m--) {
        months.push({ year, month: m });
      }
    } else {
      // W przeciwnym razie pokazujemy miesiące do aktualnego
      for (let m = currentMonth - 1; m >= 1; m--) {
        months.push({ year, month: m });
      }
    }
    return months;
  };

  // Pobierz dane historyczne po rozwinięciu
  useEffect(() => {
    if (!isExpanded || !currentDate || !selectedYear) return;
    const fetchHistoricalData = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      try {
        // Określamy, który miesiąc jest obecnie wyświetlany
        let currentMonth = currentDate.month;
        if (selectedYear < currentDate.year) {
          currentMonth = 12;
        }

        const historicalMonths = getHistoricalMonths(selectedYear, currentMonth);
        if (historicalMonths.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }
        const promises = historicalMonths.map(({ year, month }) =>
          fetch(
            `/api/costs/summary?year=${year}&month=${month}${branchQuery}`
          )
        );
        const responses = await Promise.all(promises);
        const data = await Promise.all(responses.map(res => res.json()));
        const processed = data.map((d, i) => ({
          year: historicalMonths[i].year,
          month: historicalMonths[i].month,
          // Oblicz total_cost jako sumę pozostałych kosztów dla danych historycznych
          data: calculateTotalCost(d.total_summary),
        }));
        setHistoricalData(processed);
      } catch (err) {
        setError('Błąd ładowania danych historycznych');
      } finally {
        setLoadingStates(prev => ({ ...prev, historical: false }));
      }
    };
    fetchHistoricalData();
  }, [isExpanded, currentDate, selectedYear, branchQuery]);

  // Wybór ikony nagłówkowej – dla oddziału (jeśli prop branch jest przekazany)
  const getHeaderIcon = () => {
    if (branch) {
      if (branch === "MG") return <Monitor className="h-5 w-5 text-purple-500" />;
      if (branch === "STH") return <Wrench className="h-5 w-5 text-orange-500" />;
      if (branch === "BHP") return <HardHat className="h-5 w-5 text-yellow-500" />;
      return <MapPin className="h-5 w-5 text-blue-500" />;
    }
    return <Building2 className="h-5 w-5 text-blue-500" />;
  };

  // Renderowanie nagłówka – dla oddziału dodajemy sufiks (np. "Internet" dla MG)
  const renderHeader = () => {
    if (branch) {
      let suffix = "";
      if (branch === "MG") {
        suffix = "Internet";
      } else if (branch === "STH") {
        suffix = "Serwis";
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
      } else if (branch === "BHP") {
        suffix = "BHP";
      } else if (branch === "Myślibórz") {
        suffix = "Myślibórz";
      }
      return (
        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-100">
          {getHeaderIcon()}
          <span className="text-sm font-medium text-gray-800">
            {suffix}
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-blue-100">
        {getHeaderIcon()}
        <span className="text-sm font-medium text-gray-800">
          Suma
        </span>
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

  // Określamy, który miesiąc pokazać
  let monthToShow = currentDate ? currentDate.month : 1;
  let yearToShow = selectedYear || (currentDate ? currentDate.year : new Date().getFullYear());

  // Jeśli wybrany rok jest wcześniejszy niż bieżący, pokazujemy grudzień
  if (currentDate && selectedYear && selectedYear < currentDate.year) {
    monthToShow = 12;
  }

  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="p-0">
        {/* Nagłówek z kolumnami */}
        <div className="flex flex-col p-3 pb-2">
          {/* Nagłówek z informacjami o kosztach */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4 items-center border-b border-gray-300 pb-2">
            {/* Etykieta karty */}
            <div className="flex items-center">
              {renderHeader()}
            </div>

            {/* Koszt łączny */}
            <div className="text-center">
              <span className="text-xs font-medium text-red-700">Koszty łącznie</span>
              <p className="text-sm font-bold text-red-700">{formatCurrency(yearlyData?.total_cost || 0)}</p>
            </div>

            {/* Koszty oddziałów - ukryte w wąskim widoku */}
            <div className="hidden md:block text-center">
              <span className="text-xs font-medium text-gray-700">Koszty Oddziały</span>
              <p className="text-sm font-bold text-gray-700">{formatCurrency(yearlyData?.total_branch_cost || 0)}</p>
            </div>

            {/* Koszty centrala */}
            <div className="text-center">
              <span className="text-xs font-medium text-blue-700">Koszty Centrala</span>
              <p className="text-sm font-bold text-blue-700">{formatCurrency(yearlyData?.total_hq_cost || 0)}</p>
            </div>

            {/* Koszty PH - ukryte w wąskim widoku */}
            <div className="hidden md:block text-center">
              <span className="text-xs font-medium text-green-700">Koszty PH</span>
              <p className="text-sm font-bold text-green-700">{formatCurrency(yearlyData?.total_ph_cost || 0)}</p>
            </div>
          </div>

          {/* Wiersz bieżącego miesiąca */}
          {monthlyData && (
            <div className="mt-3 mb-2">
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4 items-center border-b border-gray-100 pb-2">
                {/* Etykieta miesiąca */}
                <div className="inline-flex items-center gap-2 px-2 py-1">
                  <CalendarDays className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-800">
                    {formatMonthYear(monthToShow, yearToShow)}
                  </span>
                </div>

                {/* Koszty łączne */}
                <div className="text-center">
                  <span className="text-sm font-medium text-red-600">{formatCurrency(monthlyData.total_cost)}</span>
                </div>

                {/* Koszty oddziałów - ukryte w wąskim widoku */}
                <div className="hidden md:block text-center">
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(monthlyData.total_branch_cost)}</span>
                </div>

                {/* Koszty centrala */}
                <div className="text-center">
                  <span className="text-sm font-medium text-blue-600">{formatCurrency(monthlyData.total_hq_cost)}</span>
                </div>

                {/* Koszty PH - ukryte w wąskim widoku */}
                <div className="hidden md:block text-center">
                  <span className="text-sm font-medium text-green-600">{formatCurrency(monthlyData.total_ph_cost)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Przycisk rozwijania danych historycznych */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center pt-1 pb-0.5 text-xs ${TEXT_COLOR} ${TEXT_COLOR_HOVER} my-1`}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Dane historyczne */}
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
                {historicalData.map((monthData, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 items-center border-b border-gray-100 pb-2">
                      {/* Etykieta miesiąca */}
                        <div className="inline-flex items-center gap-2 px-2 py-1">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-xs font-medium text-gray-800">
                            {formatMonthYear(monthData.month, monthData.year)}
                          </span>
                        </div>

                      {/* Koszty łączne */}
                      <div className="text-center">
                        <span className="text-sm font-medium text-red-600">{formatCurrency(monthData.data.total_cost)}</span>
                      </div>

                      {/* Koszty oddziałów - ukryte w wąskim widoku */}
                      <div className="hidden md:block text-center">
                        <span className="text-sm font-medium text-gray-700">{formatCurrency(monthData.data.total_branch_cost)}</span>
                      </div>

                      {/* Koszty centrala */}
                      <div className="text-center">
                        <span className="text-sm font-medium text-blue-600">{formatCurrency(monthData.data.total_hq_cost)}</span>
                      </div>

                      {/* Koszty PH - ukryte w wąskim widoku */}
                      <div className="hidden md:block text-center">
                        <span className="text-sm font-medium text-green-600">{formatCurrency(monthData.data.total_ph_cost)}</span>
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

//
// Komponent rodzicielski – globalna karta oraz karty dla oddziałów
//
const CostsSummaryView: React.FC = () => {
  // Lista oddziałów – kolejność ustalana jest statycznie
  const branches = ["Pcim", "Rzgów", "Malbork", "Lublin", "Łomża", "Myślibórz", "MG", "STH", "BHP"];

  // Używamy hook useAuth zamiast bezpośredniego pobierania z ciasteczek
  const { userRole: authUserRole, userBranch: authUserBranch } = useAuth();
  const [onlyBranch, setOnlyBranch] = useState<string | null>(null);

  // Dodajemy hook useTransactionYears i stan dla wybranego roku
  const { data: yearsData, loading: yearsLoading } = useTransactionYears();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Funkcja pomocnicza do normalizacji nazwy oddziału
  const normalizeBranchName = (branch: string): string => {
    if (!branch) return '';

    // Mapowanie nazw oddziałów
    const branchMap: Record<string, string> = {
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
    const branchKey = branch.toLowerCase();
    return branchMap[branchKey] || branch;
  };

  useEffect(() => {
    // Jeśli rola to ADMIN lub BOARD, nie ograniczamy widoku
    if (authUserRole === "ADMIN" || authUserRole === "BOARD") {
      setOnlyBranch(null);
      return;
    }

    if (authUserBranch) {
      // Normalizujemy nazwę oddziału
      const normalizedBranch = normalizeBranchName(authUserBranch);
      setOnlyBranch(normalizedBranch);
    } else {
      setOnlyBranch(null);
    }
  }, [authUserRole, authUserBranch]);

  // Ustawienie domyślnego roku po załadowaniu lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  // Funkcja obliczająca tło karty dla oddziału
  const getBgColorForBranch = (branch: string): string => {
    let bgColor = "bg-gray-50";
    if (branch === "MG") {
      bgColor = "bg-red-50";
    } else if (branch === "STH") {
      bgColor = "bg-purple-50";
    } else if (branch === "BHP") {
      bgColor = "bg-yellow-50";
    }
    return bgColor;
  };

  // Stan ładowania dla całej strony
  if (yearsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 rounded w-1/4" />
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Komunikat wyświetlany na urządzeniach mobilnych (poniżej md) */}
      <div className="md:hidden text-center mb-4 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {/* Selektor roku - dodajemy na górze komponentu */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Podział Kosztów</h2>
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

      {onlyBranch && authUserRole !== "ADMIN" && authUserRole !== "BOARD" ? (
        // Jeśli użytkownik jest oddziałowy (ale nie ADMIN ani BOARD), renderujemy tylko kartę danego oddziału
        <div className="space-y-6">
          <CostsSummaryCard branch={onlyBranch} bgColor={getBgColorForBranch(onlyBranch)} selectedYear={selectedYear} />
        </div>
      ) : (
        // Jeśli użytkownik nie jest oddziałowy lub ma rolę ADMIN/BOARD, renderujemy globalną kartę oraz karty dla wszystkich oddziałów
        <>
          {/* Globalna karta – bez oddziału; tło zielone */}
          <CostsSummaryCard bgColor="bg-green-50" selectedYear={selectedYear} />

          {/* Pozioma linia oddzielająca globalną kartę od kart oddziałowych */}
          <hr className="border-t border-gray-300 my-4" />

          {/* Karty dla oddziałów – w układzie siatki */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branches.map((branch, index) => {
              let bgColor = index % 2 === 0 ? "bg-gray-50" : "bg-gray-100";
              if (branch === "MG" || branch === "STH" || branch === "BHP") {
                bgColor = getBgColorForBranch(branch);
              }
              return (
                <div key={branch}>
                  {/* Dodatkowa linia przed kartą oddziału MG w widoku mobilnym */}
                  {branch === "MG" && <hr className="border-t border-gray-300 my-4 md:hidden" />}
                  <CostsSummaryCard branch={branch} bgColor={bgColor} selectedYear={selectedYear} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CostsSummaryView;