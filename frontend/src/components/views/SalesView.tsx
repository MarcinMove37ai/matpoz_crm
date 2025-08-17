"use client";

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
  RotateCcw,
  Wrench,
  HardHat,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

//
// Hook do pobierania dostępnych lat
//
const useAvailableYears = () => {
  const [yearsData, setYearsData] = useState<{ years: number[], currentYear: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/years');

        // Sprawdź czy odpowiedź jest poprawna
        if (!response.ok) {
          throw new Error(`Problem z API: ${response.status} ${response.statusText}`);
        }

        // Sprawdź czy odpowiedź jest w formacie JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Odpowiedź nie jest w formacie JSON');
        }

        const data = await response.json();

        // Jeśli API nie działa, użyj przykładowych danych
        if (!data || !data.years) {
          console.warn('API nie zwróciło oczekiwanych danych, używam danych tymczasowych');
          const currentYear = new Date().getFullYear();
          setYearsData({
            years: [currentYear - 2, currentYear - 1, currentYear, currentYear + 1],
            currentYear: currentYear
          });
        } else {
          setYearsData(data);
        }
        setError(null);
      } catch (err) {
        console.error('Błąd pobierania dostępnych lat:', err);
        setError('Nie udało się pobrać listy dostępnych lat');

        // Awaryjnie użyj aktualnego roku
        const currentYear = new Date().getFullYear();
        setYearsData({
          years: [currentYear - 2, currentYear - 1, currentYear, currentYear + 1],
          currentYear: currentYear
        });
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
  }, []);

  return { yearsData, loading, error };
};

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
export type SalesData = {
  sales_net: number;
  profit_net: number;
  sales_payd: number;
  profit_payd: number;
  marg_total: number;
  sales_payd_percent: number;
};

export type HistoricalData = {
  year: number;
  month: number;
  data: SalesData;
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
// Komponent SalesView – pojedyncza karta sprzedaży
//
export type SalesViewProps = {
  branch?: string;    // Jeśli undefined – karta globalna; jeśli podany, wyświetla dane oddziału
  bgColor?: string;   // Klasa tła – domyślnie "bg-gray-50"
  selectedYear?: number | null; // Dodane prop dla wybranego roku
};

export const SalesView: React.FC<SalesViewProps> = ({ branch, bgColor = "bg-gray-50", selectedYear }) => {
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

  const [yearlyData, setYearlyData] = useState<SalesData | null>(null);
  const [monthlyData, setMonthlyData] = useState<SalesData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);

  // Referencje do kontrolerów anulowania dla zapytań API
  const abortControllerRef = useRef<{
    date?: AbortController;
    yearly?: AbortController;
    monthly?: AbortController;
    historical?: AbortController[];
  }>({
    historical: []
  });

  // Funkcja do anulowania aktywnych zapytań
  const cancelActiveRequests = (type?: 'date' | 'yearly' | 'monthly' | 'historical') => {
    // Bezpieczne anulowanie zapytania - sprawdza, czy kontroler istnieje i czy sygnał nie został już uaktywniony
    const safeAbort = (controller?: AbortController) => {
      if (controller && !controller.signal.aborted) {
        try {
          controller.abort();
        } catch (error) {
          // Ignorujemy błędy związane z anulowaniem już anulowanych zapytań
          console.warn('Błąd podczas anulowania zapytania:', error);
        }
      }
    };

    if (!type || type === 'date') {
      safeAbort(abortControllerRef.current.date);
      abortControllerRef.current.date = undefined;
    }

    if (!type || type === 'yearly') {
      safeAbort(abortControllerRef.current.yearly);
      abortControllerRef.current.yearly = undefined;
    }

    if (!type || type === 'monthly') {
      safeAbort(abortControllerRef.current.monthly);
      abortControllerRef.current.monthly = undefined;
    }

    if (!type || type === 'historical') {
      if (abortControllerRef.current.historical && abortControllerRef.current.historical.length > 0) {
        abortControllerRef.current.historical.forEach(controller => safeAbort(controller));
        abortControllerRef.current.historical = [];
      }
    }
  };

  // Jeśli przekazany został branch, do zapytań do API dodajemy parametr branch
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';

  // Bezpieczne pobieranie danych z API z obsługą błędów
  const safelyFetchData = async (url: string, abortController?: AbortController) => {
    try {
      // Sprawdzamy, czy kontroler nie został już anulowany przed wykonaniem zapytania
      if (abortController && abortController.signal.aborted) {
        console.log(`Zapytanie do ${url} już anulowane przed rozpoczęciem`);
        return null;
      }

      const response = await fetch(url, { signal: abortController?.signal });

      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Odpowiedź nie jest w formacie JSON');
      }

      return await response.json();
    } catch (error) {
      // Nie logujemy błędu jeśli zapytanie zostało anulowane
      if (error instanceof DOMException && (error.name === 'AbortError' || error.message.includes('abort'))) {
        console.log(`Zapytanie do ${url} zostało anulowane`);
        return null;
      }
      console.error(`Błąd podczas pobierania danych z ${url}:`, error);
      throw error;
    }
  };

  // Zmodyfikowany useEffect dla załadowania daty - anuluje poprzednie zapytania
  useEffect(() => {
    const fetchDate = async () => {
      // Anuluj aktywne zapytanie o datę
      cancelActiveRequests('date');

      // Przygotuj nowy kontroler
      const abortController = new AbortController();
      abortControllerRef.current.date = abortController;

      setLoadingStates(prev => ({ ...prev, date: true }));

      try {
        // Najpierw próbujemy pobrać z API
        try {
          const data = await safelyFetchData('/api/date', abortController);
          if (data) {
            setCurrentDate({
              year: selectedYear || data.year,
              month: data.month
            });
          }
        } catch (apiError) {
          console.warn('Używam daty awaryjnej, API nie działa:', apiError);
          // Awaryjnie używamy aktualnej daty
          const now = new Date();
          setCurrentDate({
            year: selectedYear || now.getFullYear(),
            month: now.getMonth() + 1
          });
        }

        setLoadingStates(prev => ({ ...prev, date: false }));
      } catch (err) {
        console.error('Błąd ładowania daty:', err);
        setError('Błąd ładowania daty');
        setLoadingStates(prev => ({ ...prev, date: false }));
      }
    };

    fetchDate();

    // Czyszczenie przy odmontowaniu
    return () => {
      cancelActiveRequests('date');
    };
  }, [selectedYear]); // Tylko selectedYear jako zależność

  // Ustaw wysokość rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  // Fetch danych rocznych i miesięcznych, bez danych historycznych
  useEffect(() => {
    if (!currentDate) return;

    const fetchMainData = async () => {
      // Anuluj aktywne zapytania roczne i miesięczne
      cancelActiveRequests('yearly');
      cancelActiveRequests('monthly');

      // Przygotuj nowe kontrolery
      const yearlyController = new AbortController();
      const monthlyController = new AbortController();
      abortControllerRef.current.yearly = yearlyController;
      abortControllerRef.current.monthly = monthlyController;

      // Ustawienie stanów ładowania
      setLoadingStates(prev => ({
        ...prev,
        yearly: true,
        monthly: true
      }));

      try {
        // Równoległe pobieranie danych rocznych i miesięcznych
        const fetchPromises = [
          // Dane roczne
          (async () => {
            try {
              const data = await safelyFetchData(
                `/api/aggregated_sales_data?year=${currentDate.year}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_payd&columns=sales_payd_percent&columns=marg_total&columns=profit_net&columns=profit_payd`,
                yearlyController
              );
              if (data) {
                setYearlyData(processApiResponse(data));
              }
            } catch (error) {
              console.warn('Używam przykładowych danych rocznych, API nie działa:', error);
              // Przykładowe dane gdy API nie działa
              setYearlyData({
                sales_net: 5000000,
                profit_net: 1200000,
                sales_payd: 4500000,
                profit_payd: 1000000,
                marg_total: 24,
                sales_payd_percent: 90
              });
            }
          })(),

          // Dane miesięczne
          (async () => {
            try {
              // Jeśli to rok poprzedni, pobieramy dane za grudzień
              const systemYear = new Date().getFullYear();
              const monthToFetch = currentDate.year < systemYear ? 12 : currentDate.month;

              const data = await safelyFetchData(
                `/api/aggregated_sales_data?year=${currentDate.year}&month=${monthToFetch}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_payd&columns=sales_payd_percent&columns=marg_total&columns=profit_net&columns=profit_payd`,
                monthlyController
              );
              if (data) {
                setMonthlyData(processApiResponse(data));
              }
            } catch (error) {
              console.warn('Używam przykładowych danych miesięcznych, API nie działa:', error);
              // Przykładowe dane gdy API nie działa
              setMonthlyData({
                sales_net: 420000,
                profit_net: 105000,
                sales_payd: 380000,
                profit_payd: 95000,
                marg_total: 25,
                sales_payd_percent: 90.5
              });
            }
          })()
        ];

        // Czekamy na zakończenie wszystkich zapytań
        await Promise.all(fetchPromises);
      } catch (err) {
        console.error('Błąd ładowania danych:', err);
        setError('Wystąpił błąd podczas ładowania danych');
      } finally {
        setLoadingStates(prev => ({
          ...prev,
          yearly: false,
          monthly: false
        }));
      }
    };

    fetchMainData();

    // Czyszczenie przy odmontowaniu
    return () => {
      cancelActiveRequests('yearly');
      cancelActiveRequests('monthly');
    };
  }, [currentDate, branchQuery]); // Zależności: currentDate, branchQuery

  // Osobny useEffect dla ładowania danych historycznych, uruchamiany po rozwinięciu panelu
  useEffect(() => {
    if (!isExpanded || !currentDate) return;

    const fetchHistoricalData = async () => {
      // Anuluj wcześniejsze zapytania
      cancelActiveRequests('historical');

      // Ustaw stan ładowania tylko dla danych historycznych
      setLoadingStates(prev => ({ ...prev, historical: true }));

      try {
        const historicalMonths = getHistoricalMonths(currentDate.year, currentDate.month);
        if (historicalMonths.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }

        // Pobieranie danych sekwencyjnie, po 3 miesiące na raz
        const batchSize = 3;
        let allProcessed: HistoricalData[] = [];

        for (let i = 0; i < historicalMonths.length; i += batchSize) {
          // Sprawdź, czy komponent nie został odmontowany
          if (!isExpanded) {
            console.log('Anulowanie dalszego pobierania - komponent nie jest już rozwinięty');
            break;
          }

          const batch = historicalMonths.slice(i, i + batchSize);
          const batchControllers = batch.map(() => new AbortController());

          // Dodaj kontrolery do referencji
          abortControllerRef.current.historical = [
            ...(abortControllerRef.current.historical || []),
            ...batchControllers
          ];

          try {
            const batchPromises = batch.map(({ year, month }, index) =>
              safelyFetchData(
                `/api/aggregated_sales_data?year=${year}&month=${month}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_payd&columns=sales_payd_percent&columns=marg_total&columns=profit_net&columns=profit_payd`,
                batchControllers[index]
              ).catch(error => {
                console.warn(`Używam przykładowych danych dla ${month}/${year}, API nie działa:`, error);
                // Przykładowe dane fallbackowe
                return {
                  data: [{
                    sales_net: 400000 - (month * 10000),
                    profit_net: 100000 - (month * 2000),
                    sales_payd: 360000 - (month * 8000),
                    profit_payd: 90000 - (month * 1800),
                    marg_total: 25,
                    sales_payd_percent: 90
                  }]
                };
              })
            );

            const batchData = await Promise.all(batchPromises);

            // Dodatkowe sprawdzenie czy komponent jest nadal rozwinięty
            if (!isExpanded) {
              console.log('Przerwano aktualizację danych - komponent nie jest już rozwinięty');
              break;
            }

            const processed = batchData.map((d, idx) => ({
              year: batch[idx].year,
              month: batch[idx].month,
              data: processApiResponse(d),
            }));

            allProcessed = [...allProcessed, ...processed];

            // Aktualizuj dane po każdej partii, żeby użytkownik widział postęp
            setHistoricalData(allProcessed);
          } catch (err) {
            console.error('Błąd podczas przetwarzania partii danych:', err);
            // Kontynuujemy mimo błędu, aby pobrać pozostałe partie danych
          }
        }

      } catch (err) {
        console.error('Błąd ładowania danych historycznych:', err);
        setError('Błąd ładowania danych historycznych');
      } finally {
        setLoadingStates(prev => ({ ...prev, historical: false }));
      }
    };

    fetchHistoricalData();

    // Czyszczenie przy odmontowaniu
    return () => {
      cancelActiveRequests('historical');
    };
  }, [isExpanded, currentDate, branchQuery]); // Zależności: isExpanded, currentDate, branchQuery

  // Funkcja zwracająca miesiące do wyświetlenia w danych historycznych
  // Zmodyfikowana, aby obsługiwać różne przypadki dla bieżącego roku i lat poprzednich
  const getHistoricalMonths = (year: number, currentMonth: number) => {
    const months = [];
    const systemDate = new Date();
    const systemYear = systemDate.getFullYear();

    if (year === systemYear) {
      // Dla bieżącego roku: miesiące od (bieżący-1) do stycznia
      for (let m = currentMonth - 1; m >= 1; m--) {
        months.push({ year, month: m });
      }
    } else if (year < systemYear) {
      // Dla lat poprzednich: stały zakres od listopada do stycznia
      for (let m = 11; m >= 1; m--) {
        months.push({ year, month: m });
      }
    } else {
      // Dla lat przyszłych: tak samo jak dla bieżącego roku
      for (let m = currentMonth - 1; m >= 1; m--) {
        months.push({ year, month: m });
      }
    }

    return months;
  };

  // Przetwarzanie odpowiedzi z API na obiekt SalesData
  const processApiResponse = (response: any): SalesData => {
    const item = response?.data?.[0];
    if (!item) {
      console.warn('Pusta odpowiedź API, używam danych domyślnych');
      return {
        sales_net: 0,
        profit_net: 0,
        sales_payd: 0,
        profit_payd: 0,
        marg_total: 0,
        sales_payd_percent: 0,
      };
    }

    return {
      sales_net: item?.sales_net || 0,
      profit_net: item?.profit_net || 0,
      sales_payd: item?.sales_payd || 0,
      profit_payd: item?.profit_payd || 0,
      marg_total: item?.marg_total || 0,
      sales_payd_percent: item?.sales_payd_percent || 0,
    };
  };

  // Pobieramy wartość marży z marg_total
  const calculateMargin = (data: SalesData) => data.marg_total;

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
        <h3 className="text-lg font-semibold text-gray-800">
          {suffix}
        </h3>
      );
    }
    return (
      <h3 className="text-lg font-semibold text-gray-800">
        Suma
      </h3>
    );
  };

  // Funkcja do responsywnego renderowania pojedynczego wiersza danych
  const renderDataRow = (
    label: string,
    data: SalesData | null,
    icon: React.ReactNode,
    showBorder: boolean = false
  ) => {
    if (!data) return null;
    return (
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center ${showBorder ? 'border-b border-gray-200 pb-3' : ''}`}>
        {/* Komórka etykiety (z ikoną) – zawsze widoczna */}
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-xs ${TEXT_COLOR}`}>{label}</span>
        </div>
        {/* Sprzedaż netto – ukryta na XS, widoczna od sm */}
        <div className="text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatCurrency(data.sales_net)}</span>
        </div>
        {/* Zapłacone netto – ukryta na XS i sm, widoczna od md */}
        <div className="hidden md:block text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatCurrency(data.sales_payd)}</span>
        </div>
        {/* Zapłacone PLN (%) – zawsze widoczna */}
        <div className="text-center">
          <span className={`text-xs font-medium text-green-600`}>{formatPercentage(data.sales_payd_percent)}</span>
        </div>
        {/* Zysk netto (CN) – ukryta na XS, sm, md; widoczna od lg */}
        <div className="hidden lg:block text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatCurrency(data.profit_net)}</span>
        </div>
        {/* Zysk netto zapłacone (CN) – ukryta na XS, sm, md, lg; widoczna od xl */}
        <div className="hidden xl:block text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatCurrency(data.profit_payd)}</span>
        </div>
        {/* Marża total (%) – zawsze widoczna */}
        <div className="hidden sm:block text-center">
          <span className={`text-xs font-medium text-red-600`}>{formatPercentage(calculateMargin(data))}</span>
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

  // Określenie etykiety dla głównego wiersza
  const mainRowLabel = () => {
    if (!currentDate) return "";
    const systemYear = new Date().getFullYear();

    // Dla lat poprzednich wyświetlamy grudzień
    if (currentDate.year < systemYear) {
      return formatMonthYear(12, currentDate.year);
    }

    // Dla bieżącego roku i przyszłych lat wyświetlamy aktualny miesiąc
    return formatMonthYear(currentDate.month, currentDate.year);
  };

  // Zmodyfikowane renderowanie - obsługa stanów ładowania wewnątrz komponentu
  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="flex flex-col p-3 pb-2">
        {(loadingStates.date || loadingStates.yearly) ? (
          // Stan ładowania głównych danych - nagłówek i dane roczne
          <>
            <div className="animate-pulse space-y-4 mb-4">
              <div className="h-10 bg-gray-200 rounded w-1/4" />
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
            <div className="border-b border-gray-200 mb-4"></div>
            <div className="animate-pulse h-6 bg-gray-200 rounded w-full my-3" />
          </>
        ) : (
          // Dane załadowane - pełny widok
          <>
            {/* Nagłówek – grid responsywny: na XS widoczne 3 kolumny, na xl 7 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center mb-4">
              <div className="flex items-center gap-2">
                {getHeaderIcon()}
                {renderHeader()}
              </div>
              {/* Sprzedaż netto – widoczna od sm */}
              <div className="text-center">
                <span className="text-xs font-medium text-gray-800">Sprzedaż netto</span>
                <p className="text-sm font-bold text-gray-800">{formatCurrency(yearlyData?.sales_net || 0)}</p>
              </div>
              {/* Zapłacone netto – widoczna od md */}
              <div className="hidden md:block text-center">
                <span className="text-xs font-medium text-blue-800">Zapłacone netto</span>
                <p className="text-sm font-bold text-blue-800">{formatCurrency(yearlyData?.sales_payd || 0)}</p>
              </div>
              {/* Zapłacone PLN (%) – zawsze widoczna */}
              <div className="text-center">
                <span className="text-xs font-medium text-green-700">Zapłacone (%)</span>
                <p className="text-sm font-bold text-green-700">{formatPercentage(yearlyData?.sales_payd_percent || 0)}</p>
              </div>
              {/* Zysk netto (CN) – widoczna od lg */}
              <div className="hidden lg:block text-center">
                <span className="text-xs font-medium text-gray-800">Zysk netto (CN)</span>
                <p className="text-sm font-bold text-gray-800">{formatCurrency(yearlyData?.profit_net || 0)}</p>
              </div>
              {/* Zysk netto zapłacone (CN) – widoczna od xl */}
              <div className="hidden xl:block text-center">
                <span className="text-xs font-medium text-blue-800">Zysk netto zapłacone (CN)</span>
                <p className="text-sm font-bold text-blue-800">{formatCurrency(yearlyData?.profit_payd || 0)}</p>
              </div>
              {/* Marża total (%) – zawsze widoczna */}
              <div className="hidden sm:block text-center">
                <span className="text-xs font-medium text-red-800">Marża total (%)</span>
                <p className="text-sm font-bold text-red-800">{formatPercentage(calculateMargin(yearlyData || {} as SalesData))}</p>
              </div>
            </div>

            <div className="border-b border-gray-300 mb-4"></div>

            {/* Wiersz bieżącego miesiąca – etykieta zależna od wybranego roku */}
            {loadingStates.monthly ? (
              <div className="animate-pulse h-6 bg-gray-200 rounded w-full my-3" />
            ) : currentDate && (
              <div className="space-y-3">
                {renderDataRow(
                  mainRowLabel(),
                  monthlyData,
                  <CalendarDays className="h-4 w-4 text-gray-500" />
                )}
              </div>
            )}
          </>
        )}

        {/* Przycisk rozwijania danych historycznych - zawsze widoczny */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-center pt-1 pb-0.5 text-xs ${TEXT_COLOR} ${TEXT_COLOR_HOVER} mt-4`}
          disabled={loadingStates.historical}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Rozwijany panel z danymi historycznymi */}
        <div
          style={{ maxHeight: isExpanded ? contentHeight : 0 }}
          className="overflow-hidden transition-all duration-300 ease-in-out"
        >
          <div ref={historicalRef} className="space-y-3 px-0 py-5">
            {loadingStates.historical ? (
              <div className="py-4 text-center">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-full" />
                  <div className="h-6 bg-gray-200 rounded w-full" />
                  <div className="h-6 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ) : (
              historicalData.map((monthData, idx) => (
                <div key={idx}>
                  {renderDataRow(
                    formatMonthYear(monthData.month, monthData.year),
                    monthData.data,
                    <Calendar className="h-4 w-4 text-gray-500" />,
                    idx !== historicalData.length - 1
                  )}
                </div>
              ))
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
const OverallAndBranchesSales: React.FC = () => {
  // Lista oddziałów – kolejność ustalana jest statycznie
  const branches = ["Pcim", "Rzgów", "Malbork", "Lublin", "Łomża", "Myślibórz", "MG", "STH", "BHP"];

  const branchDisplayNames: { [key: string]: string } = {
    "MG": "Internet",
    "STH": "Serwis"
  };

  // Zamiast ciasteczek używamy kontekstu Auth
  const { userRole: authUserRole, userBranch: authUserBranch } = useAuth();
  const [onlyBranch, setOnlyBranch] = useState<string | null>(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);

  // Pobieranie i obsługa wyboru roku
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { yearsData, loading: yearsLoading, error: yearsError } = useAvailableYears();

  // Ustawienie domyślnego roku po załadowaniu dostępnych lat
  useEffect(() => {
    if (yearsData?.currentYear && !selectedYear) {
      console.log('Ustawianie domyślnego roku:', yearsData.currentYear);
      setSelectedYear(yearsData.currentYear);
    }
  }, [yearsData, selectedYear]);

  useEffect(() => {
    // Jeśli rola to ADMIN lub BOARD, nie ograniczamy widoku
    if (authUserRole === "ADMIN" || authUserRole === "BOARD") {
      setOnlyBranch(null);
      return;
    }

    if (authUserBranch) {
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
      const branchKey = authUserBranch.toLowerCase();
      setOnlyBranch(mapping[branchKey] || authUserBranch);
    } else {
      setOnlyBranch(null);
    }
  }, [authUserRole, authUserBranch]);
  const handleBranchFilterChange = (value: string) => {
    setSelectedBranchFilter(value === 'all' ? null : value);
  };
  // Funkcja obliczająca tło karty dla oddziału – analogicznie jak w oryginalnym kodzie
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

  // Sprawdzamy, czy mamy dane, jeśli nie, tworzymy podstawowy rok z aktualnego roku
  const currentSystemYear = new Date().getFullYear();
  const currentYearData = selectedYear ||
                        yearsData?.currentYear ||
                        currentSystemYear;

  return (
    <div className="space-y-8">
      {/* Nagłówek z selektorami - struktura ujednolicona z innymi widokami */}
      <div className="mb-6">
        {/* Kontener dla tytułu i mobilnego selektora roku */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Sprzedaż Firma</h2>

          {/* WERSJA MOBILNA selektora roku (widoczny tylko na małych ekranach) */}
          <div className="sm:hidden">
            <Select
              value={selectedYear?.toString() || yearsData?.currentYear?.toString() || currentSystemYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
              disabled={yearsLoading}
            >
              <SelectTrigger className={`${selectStyles.trigger} w-32`}>
                <SelectValue className={selectStyles.placeholder} placeholder="Wybierz rok" />
              </SelectTrigger>
              <SelectContent className={`${selectStyles.content} w-32`}>
                {/* Zawartość selektora lat (bez zmian) */}
                {yearsLoading ? (
                  <SelectItem value="loading">Ładowanie...</SelectItem>
                ) : yearsData?.years && yearsData.years.length > 0 ? (
                  yearsData.years.map((year) => (
                    <SelectItem className={selectStyles.item} key={year} value={year.toString()}>{year}</SelectItem>
                  ))
                ) : (
                  [currentSystemYear - 2, currentSystemYear - 1, currentSystemYear, currentSystemYear + 1, currentSystemYear + 2]
                    .map((year) => (
                      <SelectItem className={selectStyles.item} key={year} value={year.toString()}>{year}</SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Kontener na filtry (selektor oddziału i desktopowy selektor roku) */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          {/* Selektor oddziałów (tylko dla Admin/Board) */}
          {(authUserRole === 'ADMIN' || authUserRole === 'BOARD') && (
            <Select
              value={selectedBranchFilter ?? 'all'}
              onValueChange={handleBranchFilterChange}
            >
              <SelectTrigger className={`${selectStyles.trigger} w-full sm:w-48`}>
                <SelectValue placeholder="Filtruj oddział" />
              </SelectTrigger>
              <SelectContent className={`${selectStyles.content} w-full sm:w-48`}>
                <SelectItem className={selectStyles.item} value="all">Wszystkie oddziały</SelectItem>
                {branches.map((branch) => (
                  <SelectItem className={selectStyles.item} key={branch} value={branch}>
                    {branchDisplayNames[branch] || branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* WERSJA DESKTOPOWA selektora roku (ukryty na małych ekranach) */}
          <div className="hidden sm:block">
            <Select
              value={selectedYear?.toString() || yearsData?.currentYear?.toString() || currentSystemYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
              disabled={yearsLoading}
            >
              <SelectTrigger className={`${selectStyles.trigger} w-full sm:w-32`}>
                <SelectValue className={selectStyles.placeholder} placeholder="Wybierz rok" />
              </SelectTrigger>
              <SelectContent className={`${selectStyles.content} w-full sm:w-32`}>
                {/* Zawartość selektora lat (bez zmian) */}
                {yearsLoading ? (
                  <SelectItem value="loading">Ładowanie lat...</SelectItem>
                ) : yearsData?.years && yearsData.years.length > 0 ? (
                  yearsData.years.map((year) => (
                    <SelectItem className={selectStyles.item} key={year} value={year.toString()}>{year}</SelectItem>
                  ))
                ) : (
                  [currentSystemYear - 2, currentSystemYear - 1, currentSystemYear, currentSystemYear + 1, currentSystemYear + 2]
                  .map((year) => (
                    <SelectItem className={selectStyles.item} key={year} value={year.toString()}>{year}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Komunikat wyświetlany na urządzeniach mobilnych (poniżej sm) – zawsze */}
      <div className="sm:hidden text-center mb-2 text-gray-600">
        <div>
          Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
          lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
        </div>
      </div>

      {/* Obsługa błędu API, wyświetlamy komunikat z informacją */}
      {yearsError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Wystąpił problem z pobraniem lat. Używam lat tymczasowych.
              </p>
            </div>
          </div>
        </div>
      )}

      {onlyBranch && authUserRole !== "ADMIN" && authUserRole !== "BOARD" ? (
        // Widok dla użytkownika z przypisanym oddziałem (bez zmian)
        <div className="space-y-8">
          <SalesView branch={onlyBranch} bgColor={getBgColorForBranch(onlyBranch)} selectedYear={currentYearData} />
        </div>
      ) : (
        // Widok dla ADMIN/BOARD
        <>
          {/* Pokaż globalną kartę "Suma" tylko wtedy, gdy żaden filtr nie jest aktywny */}
          {!selectedBranchFilter && (
            <>
              <SalesView bgColor="bg-green-50" selectedYear={currentYearData} />
              <hr className="border-t border-gray-300 my-4" />
            </>
          )}

          {/* Renderuj karty oddziałów, filtrując je, jeśli wybrano konkretny oddział */}
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
                  <SalesView branch={branch} bgColor={bgColor} selectedYear={currentYearData} />
                </React.Fragment>
              );
            })}
        </>
      )}
    </div>
  );
};

export default OverallAndBranchesSales;