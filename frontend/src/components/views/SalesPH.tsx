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

// Klasa do kolejkowania i ograniczania liczby równoczesnych zapytań HTTP
class FetchQueue {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  add<T>(fetchFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        return fetchFn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.running--;
            this.processQueue();
          });
      });

      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const nextTask = this.queue.shift();
    if (nextTask) {
      nextTask();
    }
  }
}

// Singleton do użycia w całej aplikacji
const fetchQueue = new FetchQueue(3); // Maksymalnie 3 równoczesne zapytania

// Cache dla odpowiedzi API, aby uniknąć duplikacji zapytań
const apiCache = new Map<string, any>();

// Funkcja pobierająca dane z cache lub z API
const fetchWithCache = async (url: string): Promise<any> => {
  if (apiCache.has(url)) {
    return apiCache.get(url);
  }

  const response = await fetchQueue.add(() => fetch(url));
  const data = await response.json();
  apiCache.set(url, data);
  return data;
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

//
// Typy danych – nowe pola
//
export type PHData = {
  sales_net: number;
  sales_ph: number;
  sales_ph_percent: number;
  marg_branch: number;
  marg_ph: number;
  profit_ph: number;
};

export type HistoricalDataPH = {
  year: number;
  month: number;
  data: PHData;
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

// Kontekst do współdzielenia daty między komponentami
const DateContext = React.createContext<{
  currentDate: { year: number; month: number } | null;
  isLoading: boolean;
}>({
  currentDate: null,
  isLoading: true,
});

// Dostawca kontekstu daty
const DateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDate, setCurrentDate] = useState<{ year: number; month: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDate = async () => {
      try {
        const data = await fetchWithCache('/api/date');
        setCurrentDate({ year: data.year, month: data.month });
      } catch (err) {
        console.error('Błąd ładowania daty:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDate();
  }, []);

  return (
    <DateContext.Provider value={{ currentDate, isLoading }}>
      {children}
    </DateContext.Provider>
  );
};

//
// Komponent SalesViewPH – karta wyświetlająca dane PH/oddział
//
export type SalesViewPHProps = {
  branch?: string;    // Jeśli undefined – karta globalna; jeśli podany, wyświetla dane oddziału
  bgColor?: string;   // Klasa tła – domyślnie "bg-gray-50"
  loadDelay?: number; // Opóźnienie ładowania danych (ms)
};

export const SalesViewPH: React.FC<SalesViewPHProps> = ({
  branch,
  bgColor = "bg-gray-50",
  loadDelay = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const historicalRef = useRef<HTMLDivElement>(null);

  const { currentDate, isLoading: isDateLoading } = React.useContext(DateContext);

  const [loadingStates, setLoadingStates] = useState({
    yearly: true,
    monthly: true,
    historical: false,
  });
  const [error, setError] = useState<string | null>(null);

  const [yearlyData, setYearlyData] = useState<PHData | null>(null);
  const [monthlyData, setMonthlyData] = useState<PHData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPH[]>([]);
  const [shouldLoad, setShouldLoad] = useState(loadDelay === 0);

  // Jeśli przekazany został branch, do zapytań do API dodajemy parametr branch
  const branchQuery = branch ? `&branch=${encodeURIComponent(branch)}` : '';

  // Opóźnione ładowanie komponentu
  useEffect(() => {
    if (loadDelay > 0) {
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, loadDelay);
      return () => clearTimeout(timer);
    }
  }, [loadDelay]);

  // Ustaw wysokość rozwijanego panelu historycznych danych
  useEffect(() => {
    if (historicalRef.current) {
      setContentHeight(historicalRef.current.scrollHeight);
    }
  }, [historicalData, isExpanded]);

  // Pobierz dane roczne i miesięczne jednocześnie
  useEffect(() => {
    if (!currentDate || !shouldLoad) return;

    const fetchData = async () => {
      try {
        // Pobierz dane roczne i miesięczne równolegle
        const [yearlyResponse, monthlyResponse] = await Promise.all([
          fetchWithCache(
            `/api/aggregated_sales_data?year=${currentDate.year}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_ph&columns=sales_ph_percent&columns=marg_branch&columns=marg_ph&columns=profit_ph`
          ),
          fetchWithCache(
            `/api/aggregated_sales_data?year=${currentDate.year}&month=${currentDate.month}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_ph&columns=sales_ph_percent&columns=marg_branch&columns=marg_ph&columns=profit_ph`
          )
        ]);

        setYearlyData(processApiResponse(yearlyResponse));
        setMonthlyData(processApiResponse(monthlyResponse));

      } catch (err) {
        setError('Błąd ładowania danych');
      } finally {
        setLoadingStates(prev => ({
          ...prev,
          yearly: false,
          monthly: false
        }));
      }
    };

    fetchData();
  }, [currentDate, branchQuery, shouldLoad]);

  // Funkcja zwracająca wszystkie poprzednie miesiące bieżącego roku
  const getHistoricalMonthsForCurrentYear = (year: number, currentMonth: number) => {
    const months = [];
    for (let m = currentMonth - 1; m >= 1; m--) {
      months.push({ year, month: m });
    }
    return months;
  };

  // Pobierz dane historyczne (wszystkie poprzednie miesiące bieżącego roku) po rozwinięciu
  // Ale nie wszystkie naraz - sekwencyjnie po 3 miesiące
  useEffect(() => {
    if (!isExpanded || !currentDate || !shouldLoad) return;

    const fetchHistoricalData = async () => {
      setLoadingStates(prev => ({ ...prev, historical: true }));
      try {
        const historicalMonths = getHistoricalMonthsForCurrentYear(currentDate.year, currentDate.month);
        if (historicalMonths.length === 0) {
          setHistoricalData([]);
          setLoadingStates(prev => ({ ...prev, historical: false }));
          return;
        }

        // Pobieranie danych sekwencyjnie, po 3 miesiące na raz
        const batchSize = 3;
        let allProcessed: HistoricalDataPH[] = [];

        for (let i = 0; i < historicalMonths.length; i += batchSize) {
          const batch = historicalMonths.slice(i, i + batchSize);
          const batchPromises = batch.map(({ year, month }) =>
            fetchWithCache(
              `/api/aggregated_sales_data?year=${year}&month=${month}${branchQuery}&aggregate_company=true&columns=sales_net&columns=sales_ph&columns=sales_ph_percent&columns=marg_branch&columns=marg_ph&columns=profit_ph`
            )
          );

          const batchData = await Promise.all(batchPromises);
          const processed = batchData.map((d, idx) => ({
            year: batch[idx].year,
            month: batch[idx].month,
            data: processApiResponse(d),
          }));

          allProcessed = [...allProcessed, ...processed];

          // Aktualizuj dane po każdej partii, żeby użytkownik widział postęp
          setHistoricalData(allProcessed);
        }

      } catch (err) {
        setError('Błąd ładowania danych historycznych');
      } finally {
        setLoadingStates(prev => ({ ...prev, historical: false }));
      }
    };

    fetchHistoricalData();
  }, [isExpanded, currentDate, branchQuery, shouldLoad]);

  // Przetwarzanie odpowiedzi z API na obiekt PHData
  const processApiResponse = (response: any): PHData => {
    const item = response.data?.[0];
    return {
      sales_net: item?.sales_net || 0,
      sales_ph: item?.sales_ph || 0,
      sales_ph_percent: item?.sales_ph_percent || 0,
      marg_branch: item?.marg_branch || 0,
      marg_ph: item?.marg_ph || 0,
      profit_ph: item?.profit_ph || 0,
    };
  };

  // Obliczamy Sprzedaż netto oddział = sales_net - sales_ph
  const calculateBranchSales = (data: PHData) => data.sales_net - data.sales_ph;

  // Wybór ikony nagłówkowej – analogicznie jak wcześniej
  const getHeaderIcon = () => {
    if (branch) {
      if (branch === "MG") return <Monitor className="h-5 w-5 text-purple-500" />;
      if (branch === "STH") return <Wrench className="h-5 w-5 text-orange-500" />;
      if (branch === "BHP") return <HardHat className="h-5 w-5 text-yellow-500" />;
      return <MapPin className="h-5 w-5 text-blue-500" />;
    }
    return <Building2 className="h-5 w-5 text-blue-500" />;
  };

  // Renderowanie nagłówka – dla oddziału dodajemy sufiks
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
    data: PHData | null,
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
        </div>
        {/* Sprzedaż netto oddział – widoczna od sm */}
        <div className="hidden sm:block text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatCurrency(calculateBranchSales(data))}</span>
        </div>
        {/* Sprzedaż netto PH – widoczna od md */}
        <div className="text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatCurrency(data.sales_ph)}</span>
        </div>
        {/* Udział PH (%) – zawsze widoczna */}
        <div className="text-center">
          <span className={`text-xs font-medium text-green-600`}>{formatPercentage(data.sales_ph_percent)}</span>
        </div>
        {/* Marża oddział (%) – widoczna od lg */}
        <div className="hidden lg:block text-center">
          <span className={`text-xs font-medium ${TEXT_COLOR}`}>{formatPercentage(data.marg_branch)}</span>
        </div>
        {/* Marża PH (%) – widoczna od xl */}
        <div className="hidden xl:block text-center">
          <span className={`text-xs font-medium text-blue-800`}>{formatPercentage(data.marg_ph)}</span>
        </div>
        {/* Zysk PH – zawsze widoczna */}
        <div className="hidden md:block text-center">
          <span className={`text-xs font-medium text-red-600`}>{formatCurrency(data.profit_ph)}</span>
        </div>
      </div>
    );
  };

  // Pokaż stan ładowania, jeśli dane są w trakcie ładowania
  if (!shouldLoad || isDateLoading || loadingStates.yearly || loadingStates.monthly) {
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

  // Pokaż błąd, jeśli wystąpił
  if (error) {
    return (
      <Card className={`w-full ${bgColor}`}>
        <CardContent className="p-3 text-red-500">{error}</CardContent>
      </Card>
    );
  }

  // Renderuj kartę z danymi
  return (
    <Card className={`w-full ${bgColor}`}>
      <CardContent className="flex flex-col p-3 pb-2">
        {/* Nagłówek – grid responsywny: na XS 3 kolumny, na xl 7 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 items-center mb-4">
          <div className="flex items-center gap-2">
            {getHeaderIcon()}
            {renderHeader()}
          </div>
          {/* Sprzedaż netto oddział – widoczna od sm */}
          <div className="hidden sm:block text-center">
            <span className="text-xs font-medium text-gray-800">Sprzedaż netto oddział</span>
            <p className="text-sm font-bold text-gray-800">{formatCurrency(yearlyData ? calculateBranchSales(yearlyData) : 0)}</p>
          </div>
          {/* Sprzedaż netto PH – widoczna od md */}
          <div className="text-center">
            <span className="text-xs font-medium text-blue-800">Sprzedaż PH</span>
            <p className="text-sm font-bold text-blue-800">{formatCurrency(yearlyData ? yearlyData.sales_ph : 0)}</p>
          </div>
          {/* Udział PH (%) – zawsze widoczna */}
          <div className="text-center">
            <span className="text-xs font-medium text-green-700">Udział PH (%)</span>
            <p className="text-sm font-bold text-green-700">{formatPercentage(yearlyData ? yearlyData.sales_ph_percent : 0)}</p>
          </div>
          {/* Marża oddział (%) – widoczna od lg */}
          <div className="hidden lg:block text-center">
            <span className="text-xs font-medium text-gray-800">Marża oddział (%)</span>
            <p className="text-sm font-bold text-gray-800">{formatPercentage(yearlyData ? yearlyData.marg_branch : 0)}</p>
          </div>
          {/* Marża PH (%) – widoczna od xl */}
          <div className="hidden xl:block text-center">
            <span className="text-xs font-medium text-blue-800">Marża PH (%)</span>
            <p className="text-sm font-bold text-blue-800">{formatPercentage(yearlyData ? yearlyData.marg_ph : 0)}</p>
          </div>
          {/* Zysk PH – zawsze widoczna */}
          <div className="hidden md:block text-center">
            <span className="text-xs font-medium text-red-800">Zysk PH (CN)</span>
            <p className="text-sm font-bold text-red-800">{formatCurrency(yearlyData ? yearlyData.profit_ph : 0)}</p>
          </div>
        </div>

        <div className="border-b border-gray-300 mb-4"></div>

        {/* Wiersz bieżącego miesiąca – etykieta jako np. "luty 2025" */}
        {currentDate && (
          <div className="space-y-3">
            {renderDataRow(
              formatMonthYear(currentDate.month, currentDate.year),
              monthlyData,
              <CalendarDays className="h-4 w-4 text-gray-500" />
            )}
          </div>
        )}

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
            {loadingStates.historical ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-full" />
                <div className="h-6 bg-gray-200 rounded w-full" />
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
const OverallAndBranchesSalesPH: React.FC = () => {
  // Lista oddziałów – kolejność ustalana jest statycznie
  const branches = ["Pcim", "Rzgów", "Malbork", "Lublin", "Łomża", "Myślibórz", "MG", "STH", "BHP"];

  // Zamiast ciasteczek używamy kontekstu Auth
  const { userRole: authUserRole, userBranch: authUserBranch } = useAuth();
  const [onlyBranch, setOnlyBranch] = useState<string | null>(null);

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

  // Funkcja pomocnicza do ustalania koloru tła dla oddziału
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

  return (
    <DateProvider>
      <div className="space-y-8">
        {/* Komunikat wyświetlany na urządzeniach mobilnych (poniżej sm) – zawsze */}
        <div className="sm:hidden text-center mb-2 text-gray-600">
          <div>
            Po więcej danych obróć ekran <RotateCcw className="inline-block h-4 w-4 text-gray-500" /><br />
            lub użyj komputera <Monitor className="inline-block h-4 w-4 text-gray-500" />
          </div>
        </div>

        {onlyBranch && authUserRole !== "ADMIN" && authUserRole !== "BOARD" ? (
          // Jeśli użytkownik jest oddziałowy (ale nie ADMIN ani BOARD), renderujemy tylko kartę danego oddziału
          <div className="space-y-8">
            <SalesViewPH branch={onlyBranch} bgColor={getBgColorForBranch(onlyBranch)} />
          </div>
        ) : (
          // Jeśli użytkownik nie jest oddziałowy lub ma rolę ADMIN/BOARD, renderujemy globalną kartę
          // oraz karty dla wszystkich oddziałów z opóźnieniami
          <>
            {/* Globalna karta – bez oddziału; tło zielone */}
            <SalesViewPH bgColor="bg-green-50" loadDelay={0} />

            {/* Pozioma linia oddzielająca globalną kartę od kart oddziałowych */}
            <hr className="border-t border-gray-300 my-4" />

            {/* Karty dla oddziałów – tła ustawiane naprzemiennie lub indywidualnie */}
            {branches.map((branch, index) => {
              let bgColor = index % 2 === 0 ? "bg-gray-50" : "bg-gray-100";
              if (branch === "MG" || branch === "STH" || branch === "BHP") {
                bgColor = getBgColorForBranch(branch);
              }
              // Opóźnienie ładowania każdego oddziału o 200ms * index
              const delay = 200 * (index + 1);

              return (
                <React.Fragment key={branch}>
                  {/* Dodatkowa linia przed kartą oddziału MG */}
                  {branch === "MG" && <hr className="border-t border-gray-300 my-4" />}
                  <SalesViewPH branch={branch} bgColor={bgColor} loadDelay={delay} />
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
    </DateProvider>
  );
};

export default OverallAndBranchesSalesPH;