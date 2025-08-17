/**
 * @file src/components/views/CostsView.tsx
 * @description Widok główny modułu kosztów
 */

"use client"

import { useTransactionYears } from '@/hooks/useTransactionYears';
import AddCostDialog from '@/components/costs/AddCostDialog';
import EditCostDialog from '@/components/costs/EditCostDialog';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { costsService } from '@/services/costs';
import { CostData } from '@/types/costs';

const branchMapping: Record<string, string> = {
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

// Stałe dla filtrów
const monthNames = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

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

// Typy dla sortowania
type SortColumn = 'cost_contrahent' | 'cost_nip' | 'date' | 'cost_doc_no' | 'cost_value' | 'cost_ph_value' | 'cost_kind' | 'cost_4what' | 'cost_own' | 'cost_ph' | 'cost_author' | 'cost_branch';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  column: SortColumn | null;
  direction: SortDirection;
}

// Interfejs dla kosztów z API
interface Cost {
  cost_id: number;
  cost_contrahent: string;
  cost_nip: string;
  cur_day: number;
  cur_mo: number;
  cur_yr: number;
  cost_mo: number;
  cost_year: number;
  cost_doc_no: string;
  cost_value: number;
  cost_branch_value: number;
  cost_hq_value: number;
  cost_ph_value: number;
  cost_kind: string;
  cost_4what: string;
  cost_own: string;
  cost_ph: string | null;
  cost_author: string;
  cost_branch: string;
}

const CostsView = () => {
  const { formatDate, loading: dateLoading, date } = useCurrentDate();
  const { data: yearsData, loading: yearsLoading } = useTransactionYears();
  const { user, userRole, userBranch } = useAuth(); // NOWA METODA POBIERANIA DANYCH UŻYTKOWNIKA

  // Stan dla filtrów
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedCostOwner, setSelectedCostOwner] = useState<string | null>(null);
  const [selectedCostType, setSelectedCostType] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedPH, setSelectedPH] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Stan dla sortowania
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    direction: null
  });

  // Stan dla danych
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0
  });

  // Stan dla zaznaczonych kosztów i edycji
  const [selectedCosts, setSelectedCosts] = useState<number[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [costToEdit, setCostToEdit] = useState<Cost | null>(null);

  // Stan przechowujący pierwotne dane dla filtrów
  const [initialFilterOptions, setInitialFilterOptions] = useState({
    branches: [] as string[],
    costOwners: [] as string[],
    costTypes: [] as string[],
    authors: [] as string[],
    representatives: [] as string[]
  });

  // Funkcja do sortowania
  const handleSort = (column: SortColumn) => {
    setSortConfig(prevConfig => {
      if (prevConfig.column === column) {
        // Jeśli kliknięto tę samą kolumnę, zmień kierunek
        if (prevConfig.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prevConfig.direction === 'desc') {
          return { column: null, direction: null }; // Usuń sortowanie
        } else {
          return { column, direction: 'asc' };
        }
      } else {
        // Jeśli kliknięto nową kolumnę, ustaw sortowanie rosnące
        return { column, direction: 'asc' };
      }
    });
  };

  // Funkcja do sortowania danych
  const sortedCosts = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) {
      return costs;
    }

    return [...costs].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case 'cost_contrahent':
          aValue = a.cost_contrahent;
          bValue = b.cost_contrahent;
          break;
        case 'cost_nip':
          aValue = a.cost_nip;
          bValue = b.cost_nip;
          break;
        case 'date':
          aValue = new Date(a.cur_yr, a.cur_mo - 1, a.cur_day);
          bValue = new Date(b.cur_yr, b.cur_mo - 1, b.cur_day);
          break;
        case 'cost_doc_no':
          aValue = a.cost_doc_no;
          bValue = b.cost_doc_no;
          break;
        case 'cost_value':
          aValue = a.cost_value;
          bValue = b.cost_value;
          break;
        case 'cost_ph_value':
          aValue = a.cost_ph_value;
          bValue = b.cost_ph_value;
          break;
        case 'cost_kind':
          aValue = a.cost_kind;
          bValue = b.cost_kind;
          break;
        case 'cost_4what':
          aValue = a.cost_4what;
          bValue = b.cost_4what;
          break;
        case 'cost_own':
          aValue = a.cost_own;
          bValue = b.cost_own;
          break;
        case 'cost_ph':
          aValue = a.cost_ph || '';
          bValue = b.cost_ph || '';
          break;
        case 'cost_author':
          aValue = a.cost_author;
          bValue = b.cost_author;
          break;
        case 'cost_branch':
          aValue = a.cost_branch;
          bValue = b.cost_branch;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [costs, sortConfig]);

  // Komponent ikony sortowania
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortConfig.column !== column) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }

    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="h-4 w-4 text-blue-600" />;
    } else if (sortConfig.direction === 'desc') {
      return <ChevronDown className="h-4 w-4 text-blue-600" />;
    }

    return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
  };

  // Komponent nagłówka z sortowaniem
  const SortableHeader = ({
    column,
    children,
    className = "font-medium text-gray-800 text-center"
  }: {
    column: SortColumn;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`${className} cursor-pointer hover:bg-gray-100 transition-colors select-none`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        <SortIcon column={column} />
      </div>
    </TableHead>
  );

  // Obliczanie sum dla podsumowania
  const costsSummary = useMemo(() => {
    const totalCostValue = sortedCosts.reduce((sum, cost) => sum + cost.cost_value, 0);
    const totalPhValue = sortedCosts.reduce((sum, cost) => sum + cost.cost_ph_value, 0);

    return {
      totalCostValue,
      totalPhValue,
      count: sortedCosts.length
    };
  }, [sortedCosts]);

  // Funkcja do formatowania walut z dokładnością do 2 miejsc po przecinku
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Funkcja do pobierania przedstawicieli handlowych z API
  const fetchRepresentatives = useCallback(async () => {
    try {
      const response = await fetch('/api/costs/representatives');
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return [];
    } catch (error) {
      console.error('Błąd podczas pobierania przedstawicieli:', error);
      return [];
    }
  }, []);

  // Funkcja do pobierania wszystkich możliwych opcji filtrów
  const fetchInitialFilterOptions = useCallback(async () => {
    try {
      // Parametry zapytania tylko z ograniczeniami wynikającymi z uprawnień
      const baseParams: {
        year?: number;
        branch?: string;
        cost_author?: string;
        cost_ph?: string;
        limit: number;
      } = {
        limit: 1000 // Zwiększamy limit, aby pobrać więcej danych do filtrów
      };

      if (selectedYear) {
        baseParams.year = selectedYear;
      }

      // Ograniczenia wynikające z roli użytkownika
      if (userRole === 'BRANCH' && userBranch) {
        const branchKey = userBranch.toLowerCase();
        const correctBranchName = branchMapping[branchKey] || userBranch;
        // W funkcji fetchInitialFilterOptions użyj `baseParams`
        baseParams.branch = correctBranchName;
        // W funkcji fetchCosts użyj `params`
        // params.branch = correctBranchName;
      }

      if (userRole === 'STAFF' && user?.fullName) {
        baseParams.cost_author = user.fullName;
      }

      // Ograniczenia dla przedstawiciela handlowego - używamy user.fullName zamiast userRepresentative
      if (userRole === 'REPRESENTATIVE' && user?.fullName) {
        baseParams.cost_ph = user.fullName;
      }

      const initialData = await costsService.getCosts(baseParams);
      const representatives = await fetchRepresentatives();

      if (initialData.costs.length > 0) {
        // Wydobycie unikalnych wartości z początkowych danych
        const branches = [...new Set(initialData.costs.map((cost: Cost) => cost.cost_branch))];
        const costOwners = [...new Set(initialData.costs.map((cost: Cost) => cost.cost_own))];
        const costTypes = [...new Set(initialData.costs.map((cost: Cost) => cost.cost_kind))];
        const authors = [...new Set(initialData.costs.map((cost: Cost) => cost.cost_author))];

        setInitialFilterOptions({
          branches: branches as string[],
          costOwners: costOwners as string[],
          costTypes: costTypes as string[],
          authors: authors as string[],
          representatives: representatives as string[]
        });
      }
    } catch (error) {
      console.error('Błąd podczas pobierania opcji filtrów:', error);
    }
  }, [selectedYear, userRole, userBranch, user?.fullName, fetchRepresentatives]);

  // Funkcja do pobierania kosztów z API
  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Parametry zapytania
      const params: {
        year?: number;
        month?: number;
        branch?: string;
        cost_own?: string;
        cost_kind?: string;
        cost_author?: string;
        cost_ph?: string;
        limit: number;
        offset: number;
      } = {
        limit: pagination.limit,
        offset: pagination.offset
      };

      if (selectedYear) {
        params.year = selectedYear;
      }

      if (selectedMonth && selectedMonth !== 'all') {
        params.month = parseInt(selectedMonth);
      }

      if (selectedBranch && selectedBranch !== 'all') {
        params.branch = selectedBranch;
      }

      if (selectedCostOwner && selectedCostOwner !== 'all') {
        params.cost_own = selectedCostOwner;
      }

      if (selectedCostType && selectedCostType !== 'all') {
        params.cost_kind = selectedCostType;
      }

      if (selectedAuthor && selectedAuthor !== 'all') {
        params.cost_author = selectedAuthor;
      }

      if (selectedPH && selectedPH !== 'all') {
        params.cost_ph = selectedPH;
      }
      // BASIA widzi wyłącznie koszty, których sama jest autorem, bez ograniczeń oddziału
      if (userRole === 'BASIA' && user?.fullName) {
        params.cost_author = user.fullName;
        // Nie dodajemy ograniczenia na oddział
      }

      // Dodatkowa logika filtrowania na podstawie roli użytkownika
      // BRANCH widzi tylko koszt własnego oddziału
      if (userRole === 'BRANCH' && userBranch) {
        const branchKey = userBranch.toLowerCase();
        const correctBranchName = branchMapping[branchKey] || userBranch;
        // W funkcji fetchInitialFilterOptions użyj `baseParams`
        params.branch = correctBranchName;
        // W funkcji fetchCosts użyj `params`
        // params.branch = correctBranchName;
      }

      // STAFF widzi wyłącznie koszty, których sam jest autorem
      if (userRole === 'STAFF' && user?.fullName) {
        params.cost_author = user.fullName;
      }

      // REPRESENTATIVE widzi tylko koszty powiązane z nim - używamy user.fullName zamiast userRepresentative
      if (userRole === 'REPRESENTATIVE' && user?.fullName) {
        params.cost_ph = user.fullName;
      }

      const data = await costsService.getCosts(params);

      setCosts(data.costs);
      setPagination({
        total: data.total,
        limit: data.limit,
        offset: data.offset
      });

      // Po odświeżeniu danych resetuj wybrane koszty
      setSelectedCosts([]);

    } catch (error) {
      console.error('Błąd podczas pobierania kosztów:', error);
      setError('Wystąpił błąd podczas ładowania danych. Spróbuj ponownie później.');
    } finally {
      setLoading(false);
    }
  }, [
    selectedYear,
    selectedMonth,
    selectedBranch,
    selectedCostOwner,
    selectedCostType,
    selectedAuthor,
    selectedPH,
    pagination.limit,
    pagination.offset,
    userRole,
    userBranch,
    user?.fullName
  ]);

  // Pobranie pełnej listy opcji filtrów przy załadowaniu lub zmianie roku
  useEffect(() => {
    if (selectedYear || yearsData?.currentYear) {
      fetchInitialFilterOptions();
    }
  }, [fetchInitialFilterOptions, selectedYear, yearsData?.currentYear]);

  // Pobieranie kosztów przy pierwszym załadowaniu i zmianie filtrów
  useEffect(() => {
    if (selectedYear || yearsData?.currentYear) {
      fetchCosts();
    }
  }, [
    fetchCosts,
    selectedYear,
    selectedMonth,
    selectedBranch,
    selectedCostOwner,
    selectedCostType,
    selectedAuthor,
    selectedPH,
    yearsData?.currentYear
  ]);

  // Ustawienie domyślnego roku po załadowaniu lat
  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  // Obsługa dodania nowego kosztu
  const handleAddCost = (costData: CostData) => {
    // Po dodaniu kosztu, odświeżamy listę
    fetchCosts();
    console.log('Dodano nowy koszt:', costData);
  };

  // Obsługa edycji kosztu
  const handleEditCost = (costData: CostData & { cost_id: number }) => {
    // Po edycji kosztu, odświeżamy listę
    fetchCosts();
    console.log('Zaktualizowano koszt:', costData);
  };

  // Obsługa usunięcia kosztu
  const handleDeleteCost = async (costIds: number[]) => {
    try {
      const confirmed = window.confirm(
        costIds.length === 1
          ? 'Czy na pewno chcesz usunąć ten koszt?'
          : `Czy na pewno chcesz usunąć ${costIds.length} wybrane koszty?`
      );

      if (confirmed) {
        // Usuwanie wielu kosztów sekwencyjnie
        for (const costId of costIds) {
          await costsService.deleteCost(costId);
        }

        // Po usunięciu kosztów, odświeżamy listę
        fetchCosts();
        setSelectedCosts([]);
      }
    } catch (error) {
      console.error('Błąd podczas usuwania kosztów:', error);
      setError('Wystąpił błąd podczas usuwania kosztów.');
    }
  };

  // Obsługa zaznaczania wszystkich kosztów
  const handleSelectAllCosts = (checked: boolean) => {
    if (checked) {
      setSelectedCosts(sortedCosts.map(cost => cost.cost_id));
    } else {
      setSelectedCosts([]);
    }
  };

  // Obsługa zaznaczania pojedynczego kosztu
  const handleSelectCost = (costId: number, checked: boolean) => {
    if (checked) {
      setSelectedCosts(prev => [...prev, costId]);
    } else {
      setSelectedCosts(prev => prev.filter(id => id !== costId));
    }
  };

  // Obsługa otwierania dialogu edycji
  const handleOpenEditDialog = () => {
    if (selectedCosts.length === 1) {
      const costId = selectedCosts[0];
      const costToEdit = sortedCosts.find(cost => cost.cost_id === costId) || null;
      setCostToEdit(costToEdit);
      setIsEditDialogOpen(true);
    }
  };

  // Przygotowanie wartości dla strony
  const isAdmin = userRole === 'ADMIN' || userRole === 'BOARD';
  const isBranch = userRole === 'BRANCH';
  const isStaff = userRole === 'STAFF';
  const isBasia = userRole === 'BASIA';
  const isRepresentative = userRole === 'REPRESENTATIVE';

  // Określanie uprawnień
  const canEdit = isAdmin || isBranch || isStaff || isBasia;
  const canAdd = isAdmin || isBranch || isStaff || isBasia;
  const canDelete = isAdmin || isBranch || isStaff || isBasia;

  // Sprawdzanie czy wszystkie koszty są zaznaczone
  const allCostsSelected = sortedCosts.length > 0 && selectedCosts.length === sortedCosts.length && !isRepresentative;

  // Sprawdzanie czy przycisk edycji powinien być aktywny
  const isEditButtonEnabled = selectedCosts.length === 1 && canEdit;

  // Sprawdzanie czy przycisk usuwania powinien być aktywny
  const isDeleteButtonEnabled = selectedCosts.length > 0 && canDelete;

  // Ustawienia domyślne dla filtrów w zależności od roli
  useEffect(() => {
    if ((isBranch || isStaff) && userBranch) {
      setSelectedBranch(userBranch);
    }
  }, [isBranch, isStaff, userBranch]);

  // Blokowanie zmiany autora dla roli STAFF
  useEffect(() => {
    if (isStaff && user?.fullName) {
      setSelectedAuthor(user.fullName);
    }
  }, [isStaff, user?.fullName]);

  // Blokowanie zmiany przedstawiciela dla roli REPRESENTATIVE - zmodyfikowane do użycia user.fullName
  useEffect(() => {
    if (isRepresentative && user?.fullName) {
      setSelectedPH(user.fullName);
    }
  }, [isRepresentative, user?.fullName]);

  if (dateLoading || yearsLoading) {
    return (
      <Card className="w-full bg-blue-50">
        <CardContent className="p-6">
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
    <div className="space-y-6">
      <Card className="w-full bg-blue-50">
        <CardContent className="p-6 pb-2">
          <div className="flex flex-col">
            <div className="flex flex-col mb-4 gap-4">
              {/* NOWY BLOK: Tytuł i selektor roku w jednej linii */}
              <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800">Moduł Kosztów</h2>
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

              {/* Blok z przyciskami pozostaje bez zmian, ale w nowym kontenerze, aby wyrównać go do prawej */}
              <div className="flex justify-start sm:justify-end">
                {!isRepresentative && (
                  <div className="flex flex-wrap gap-2">
                    {canAdd && (
                      <AddCostDialog
                        onAddCost={handleAddCost}
                        selectedYear={selectedYear ?? yearsData?.currentYear}
                        userRole={userRole}
                        userBranch={userBranch}
                      />
                    )}

                    {/* Przycisk edycji */}
                    {canEdit && (
                      <Button
                        onClick={handleOpenEditDialog}
                        disabled={!isEditButtonEnabled}
                        className={`flex items-center space-x-1 ${
                          isEditButtonEnabled
                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={
                          !canEdit
                            ? 'Nie masz uprawnień do edycji kosztów'
                            : selectedCosts.length === 0
                              ? 'Zaznacz koszt, aby go edytować'
                              : selectedCosts.length > 1
                                ? 'Możesz edytować tylko jeden koszt na raz'
                                : 'Edytuj zaznaczony koszt'
                        }
                      >
                        <Pencil className="h-5 w-5" />
                        <span className="sm:inline">Edytuj</span>
                      </Button>
                    )}

                    {/* Przycisk usuwania */}
                    {canDelete && (
                      <Button
                        onClick={() => handleDeleteCost(selectedCosts)}
                        disabled={!isDeleteButtonEnabled}
                        className={`flex items-center space-x-1 ${
                          isDeleteButtonEnabled
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={
                          !canDelete
                            ? 'Nie masz uprawnień do usuwania kosztów'
                            : selectedCosts.length === 0
                              ? 'Zaznacz koszty do usunięcia'
                              : `Usuń zaznaczone koszty (${selectedCosts.length})`
                        }
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="sm:inline">Usuń</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-b border-gray-300 mb-4"></div>

            {/* Filtry - niektóre zablokowane dla REPRESENTATIVE */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <Select value={selectedMonth ?? undefined} onValueChange={setSelectedMonth}>
                <SelectTrigger className={selectStyles.trigger}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Wybierz miesiąc" />
                </SelectTrigger>
                <SelectContent className={selectStyles.content}>
                  <SelectItem className={selectStyles.item} value="all">Wszystkie miesiące</SelectItem>
                  {monthNames.map((month, index) => (
                    <SelectItem
                      className={selectStyles.item}
                      key={index}
                      value={(index + 1).toString()}
                    >
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                  value={selectedBranch ?? undefined}
                  onValueChange={setSelectedBranch}
                  disabled={isBranch || isStaff || isRepresentative} // Blokujemy dla REPRESENTATIVE
              >
                <SelectTrigger className={`${selectStyles.trigger} ${(isBranch || isStaff || isRepresentative) ? "bg-gray-100 opacity-70" : ""}`}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Wybierz oddział" />
                </SelectTrigger>
                <SelectContent className={selectStyles.content}>
                  <SelectItem className={selectStyles.item} value="all">Wszystkie oddziały</SelectItem>
                  {initialFilterOptions.branches.map((branch) => (
                    <SelectItem
                      className={selectStyles.item}
                      key={branch}
                      value={branch}
                    >
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtr "Czyj koszt?" - ukryty dla REPRESENTATIVE */}
              {!isRepresentative && (
                <Select
                  value={selectedCostOwner ?? undefined}
                  onValueChange={setSelectedCostOwner}
                >
                  <SelectTrigger className={selectStyles.trigger}>
                    <SelectValue className={selectStyles.placeholder} placeholder="Czyj koszt?" />
                  </SelectTrigger>
                  <SelectContent className={selectStyles.content}>
                    <SelectItem className={selectStyles.item} value="all">Wszystkie</SelectItem>
                    {initialFilterOptions.costOwners.map((owner) => (
                      <SelectItem
                        className={selectStyles.item}
                        key={owner}
                        value={owner}
                      >
                        {owner}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={selectedCostType ?? undefined}
                onValueChange={setSelectedCostType}
                disabled={isRepresentative} // Blokujemy dla REPRESENTATIVE
              >
                <SelectTrigger className={`${selectStyles.trigger} ${isRepresentative ? "bg-gray-100 opacity-70" : ""}`}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Rodzaj kosztu" />
                </SelectTrigger>
                <SelectContent className={`${selectStyles.content} h-[200px] overflow-y-auto`}>
                  <SelectItem className={selectStyles.item} value="all">Wszystkie rodzaje</SelectItem>
                  {initialFilterOptions.costTypes.map((type) => (
                    <SelectItem
                      className={selectStyles.item}
                      key={type}
                      value={type}
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                  value={selectedAuthor ?? undefined}
                  onValueChange={setSelectedAuthor}
                  disabled={isStaff || isRepresentative || isBasia} // Blokada dla STAFF i REPRESENTATIVE
                >
                  <SelectTrigger className={`${selectStyles.trigger} ${(isStaff || isRepresentative) ? "bg-gray-100 opacity-70" : ""}`}>
                    <SelectValue className={selectStyles.placeholder} placeholder="Kto wpisał koszt?" />
                  </SelectTrigger>
                  <SelectContent className={`${selectStyles.content} h-[200px] overflow-y-auto`}>
                    <SelectItem className={selectStyles.item} value="all">Wszyscy</SelectItem>
                    {initialFilterOptions.authors.map((author) => (
                      <SelectItem
                        className={selectStyles.item}
                        key={author}
                        value={author}
                      >
                        {author}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>

              <Select
                value={selectedPH ?? undefined}
                onValueChange={setSelectedPH}
                disabled={isRepresentative} // Blokada dla REPRESENTATIVE
              >
                <SelectTrigger className={`${selectStyles.trigger} ${isRepresentative ? "bg-gray-100 opacity-70" : ""}`}>
                  <SelectValue className={selectStyles.placeholder} placeholder="Przedstawiciel" />
                </SelectTrigger>
                <SelectContent className={`${selectStyles.content} h-[200px] overflow-y-auto`}>
                  <SelectItem className={selectStyles.item} value="all">Wszyscy</SelectItem>
                  {initialFilterOptions.representatives.map((ph) => (
                    <SelectItem
                      className={selectStyles.item}
                      key={ph}
                      value={ph}
                    >
                      {ph}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Błąd ładowania */}
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Tabela */}
            <div className="bg-white rounded-md border border-gray-200 overflow-x-auto">
              <Table className="min-w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    {/* Checkbox do zaznaczania wszystkich - ukryty dla REPRESENTATIVE */}
                    {!isRepresentative && (
                      <TableHead className="w-[40px] text-center">
                        <Checkbox
                          checked={allCostsSelected}
                          onCheckedChange={handleSelectAllCosts}
                          aria-label="Zaznacz wszystkie koszty"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-[50px] font-medium text-gray-800 text-center">Lp</TableHead>
                    <SortableHeader column="cost_contrahent" className="w-[180px] font-medium text-gray-800 text-center">
                      Kontrahent
                    </SortableHeader>
                    <SortableHeader column="cost_nip" className="w-[110px] font-medium text-gray-800 text-center">
                      NIP
                    </SortableHeader>
                    <SortableHeader column="date" className="w-[100px] font-medium text-gray-800 text-center">
                      Data wpisu
                    </SortableHeader>
                    <SortableHeader column="cost_doc_no" className="w-[120px] font-medium text-gray-800 text-center">
                      Numer faktury
                    </SortableHeader>
                    <SortableHeader column="cost_value" className="w-[100px] font-medium text-gray-800 text-center">
                      Kwota
                    </SortableHeader>

                    {/* Kolumna "Udział PH w koszcie" - tylko dla REPRESENTATIVE */}
                    {isRepresentative && (
                      <SortableHeader column="cost_ph_value" className="w-[120px] font-medium text-gray-800 text-center">
                        Udział PH w koszcie
                      </SortableHeader>
                    )}

                    <SortableHeader column="cost_kind" className="w-[130px] font-medium text-gray-800 text-center">
                      Rodzaj kosztu
                    </SortableHeader>
                    <SortableHeader column="cost_4what" className="w-[180px] font-medium text-gray-800 text-center">
                      Za co?
                    </SortableHeader>

                    {/* Kolumna "Czyj koszt?" - ukryta dla REPRESENTATIVE */}
                    {!isRepresentative && (
                      <SortableHeader column="cost_own" className="w-[100px] font-medium text-gray-800 text-center">
                        Czyj koszt?
                      </SortableHeader>
                    )}

                    <SortableHeader column="cost_ph" className="w-[130px] font-medium text-gray-800 text-center">
                      Przedstawiciel
                    </SortableHeader>
                    <SortableHeader column="cost_author" className="w-[150px] font-medium text-gray-800 text-center">
                      Kto wpisał koszt?
                    </SortableHeader>
                    <SortableHeader column="cost_branch" className="w-[80px] font-medium text-gray-800 text-center">
                      Oddział
                    </SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // Stan ładowania
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={isRepresentative ? 12 : 13}>
                          <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : sortedCosts.length === 0 ? (
                    // Brak danych
                    <TableRow>
                      <TableCell colSpan={isRepresentative ? 11 : 13} className="text-center py-8 text-gray-500">
                        {isRepresentative
                          ? "Nie znaleziono kosztów powiązanych z Twoim kontem przedstawiciela."
                          : "Brak kosztów do wyświetlenia"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Dane kosztów
                    <>
                      {sortedCosts.map((cost, index) => (
                        <TableRow
                          key={cost.cost_id}
                          className={`hover:bg-gray-50 ${
                            selectedCosts.includes(cost.cost_id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          {/* Checkbox do zaznaczania pojedynczego kosztu - ukryty dla REPRESENTATIVE */}
                          {!isRepresentative && (
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedCosts.includes(cost.cost_id)}
                                onCheckedChange={(checked) =>
                                  handleSelectCost(cost.cost_id, checked === true)
                                }
                                aria-label={`Zaznacz koszt ${cost.cost_id}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium text-gray-800 text-center">
                            {pagination.offset + index + 1}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center truncate px-2">
                            {cost.cost_contrahent}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center">
                            {cost.cost_nip}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center">
                            {`${String(cost.cur_day).padStart(2, '0')}.${String(cost.cur_mo).padStart(2, '0')}.${cost.cur_yr}`}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center">
                            {cost.cost_doc_no}
                          </TableCell>
                          <TableCell className="font-medium text-red-600 text-center">
                            {formatCurrency(cost.cost_value)}
                          </TableCell>

                          {/* Kolumna "Udział PH w koszcie" - tylko dla REPRESENTATIVE */}
                          {isRepresentative && (
                            <TableCell className="font-medium text-blue-600 text-center">
                              {formatCurrency(cost.cost_ph_value)}
                            </TableCell>
                          )}

                          <TableCell className="text-gray-800 text-center truncate px-2">
                            {cost.cost_kind}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center truncate px-2">
                            {cost.cost_4what}
                          </TableCell>

                          {/* Kolumna "Czyj koszt?" - ukryta dla REPRESENTATIVE */}
                          {!isRepresentative && (
                            <TableCell className="text-gray-800 text-center">
                              {cost.cost_own}
                            </TableCell>
                          )}

                          <TableCell className="text-blue-600 text-center font-medium">
                            {cost.cost_ph || '-'}
                          </TableCell>
                          <TableCell className="text-gray-800 text-center">
                            {cost.cost_author}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex justify-center items-center px-2 py-1 rounded-full text-xs font-medium
                              ${cost.cost_branch === 'MG' ? 'bg-red-100 text-red-800' :
                                cost.cost_branch === 'STH' ? 'bg-purple-100 text-purple-800' :
                                cost.cost_branch === 'BHP' ? 'bg-yellow-100 text-yellow-800' :
                                cost.cost_branch === 'Pcim' ? 'bg-green-100 text-green-800' :
                                cost.cost_branch === 'Rzgów' ? 'bg-blue-100 text-blue-800' :
                                'bg-blue-100 text-blue-800'}`}>
                              {cost.cost_branch}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Wiersz podsumowania */}
                      {sortedCosts.length > 0 && (
                        <TableRow className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                          {!isRepresentative && <TableCell className="text-center">-</TableCell>}
                          <TableCell className="text-center text-gray-700">SUMA</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="font-bold text-red-700 text-center">
                            {formatCurrency(costsSummary.totalCostValue)}
                          </TableCell>

                          {isRepresentative && (
                            <TableCell className="font-bold text-blue-700 text-center">
                              {formatCurrency(costsSummary.totalPhValue)}
                            </TableCell>
                          )}

                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>

                          {!isRepresentative && (
                            <TableCell className="text-center text-gray-700">-</TableCell>
                          )}

                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">-</TableCell>
                          <TableCell className="text-center text-gray-700">
                            {costsSummary.count} poz.
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginacja */}
            {pagination.total > pagination.limit && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Wyświetlanie {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} z {pagination.total} kosztów
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (pagination.offset > 0) {
                        setPagination(prev => ({
                          ...prev,
                          offset: Math.max(0, prev.offset - prev.limit)
                        }));
                      }
                    }}
                    disabled={pagination.offset === 0}
                    className={`px-3 py-1 rounded text-sm ${
                      pagination.offset === 0
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Poprzednia
                  </button>
                  <button
                    onClick={() => {
                      if (pagination.offset + pagination.limit < pagination.total) {
                        setPagination(prev => ({
                          ...prev,
                          offset: prev.offset + prev.limit
                        }));
                      }
                    }}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                    className={`px-3 py-1 rounded text-sm ${
                      pagination.offset + pagination.limit >= pagination.total
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    Następna
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog edycji kosztu - nie pokazujemy dla REPRESENTATIVE */}
      {!isRepresentative && (
        <EditCostDialog
          onEditCost={handleEditCost}
          cost={costToEdit}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          userRole={userRole}
          userBranch={userBranch}
        />
      )}
    </div>
  );
};

export default CostsView;