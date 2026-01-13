/**
 * @file src/components/views/CostsView.tsx
 * @description Widok główny modułu kosztów z SearchableSelect
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, X, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { costsService } from '@/services/costs';
import { CostData } from '@/types/costs';
import SearchableSelect from '@/components/ui/SearchableSelect';

const branchMapping: Record<string, string> = {
    "pcim": "Pcim",
    "lublin": "Lublin",
    "rzgów": "Rzgów",
    "rzgow": "Rzgów",
    "malbork": "Malbork",
    "łomża": "Łomża",
    "lomza": "Łomża",
    "myśliborz": "Myślibórz",
    "mysliborz": "Myślibórz",
    "mg": "MG",
    "sth": "STH",
    "bhp": "BHP"
};

const getBranchDisplayName = (branch: string): string => {
  if (branch === 'HQ') return 'Centrala';
  if (branch === 'STH') return 'Serwis';
  return branch;
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
  // Stany dla ścieżki "Powiel"
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [costToDuplicate, setCostToDuplicate] = useState<Cost | null>(null);
  const [scrollPosition, setScrollPosition] = useState<number | null>(null);

  const { formatDate, loading: dateLoading, date } = useCurrentDate();
  const { data: yearsData, loading: yearsLoading } = useTransactionYears();
  const { user, userRole, userBranch } = useAuth();

  // Stan dla filtrów
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedCostOwner, setSelectedCostOwner] = useState<string | null>(null);
  const [selectedCostType, setSelectedCostType] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedPH, setSelectedPH] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Stan dla wyszukiwania
  const [searchContractor, setSearchContractor] = useState<string>('');
  const [debouncedContractor, setDebouncedContractor] = useState<string>('');

  const [searchAmount, setSearchAmount] = useState<string>('');
  const [amountTolerance, setAmountTolerance] = useState<number>(1);
  const [debouncedAmount, setDebouncedAmount] = useState<string>('');
  const [debouncedTolerance, setDebouncedTolerance] = useState<number>(1);
  const [isRangeSearch, setIsRangeSearch] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState<string>('');
  const [debouncedMaxAmount, setDebouncedMaxAmount] = useState<string>('');

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
    total_sum: 0,
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

  // Funkcje pomocnicze do sprawdzania aktywności filtrów
  const isFilterActive = (value: string | null, excludeFromActiveCheck = false) => {
    return !excludeFromActiveCheck && value && value !== 'all';
  };

  // Funkcja do sprawdzania aktywności pól wyszukiwania
  const isSearchFieldActive = (value: string) => {
    return value.trim() !== '';
  };

  // Jednolite style dla przycisków X
  const clearButtonStyle = "absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 transition-colors duration-200 z-10";
  const clearButtonStyleForSelect = "absolute right-11 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 transition-colors duration-200 z-10";

  // Przygotowanie opcji dla SearchableSelect
  const monthOptions = useMemo(() => [
    { value: 'all', label: 'Wszystkie miesiące' },
    ...monthNames.map((month, index) => ({
      value: (index + 1).toString(),
      label: month
    }))
  ], []);

  const branchOptions = useMemo(() => [
    { value: 'all', label: 'Wszystkie oddziały' },
    ...initialFilterOptions.branches.map(branch => ({
      value: branch,
      label: getBranchDisplayName(branch)
    }))
  ], [initialFilterOptions.branches]);

  const costOwnerOptions = useMemo(() => [
    { value: 'all', label: 'Wszystkie' },
    ...initialFilterOptions.costOwners.map(owner => ({
      value: owner,
      label: owner
    }))
  ], [initialFilterOptions.costOwners]);

  const costTypeOptions = useMemo(() => [
    { value: 'all', label: 'Wszystkie rodzaje' },
    ...initialFilterOptions.costTypes.map(type => ({
      value: type,
      label: type
    }))
  ], [initialFilterOptions.costTypes]);

  const authorOptions = useMemo(() => [
    { value: 'all', label: 'Wszyscy' },
    ...initialFilterOptions.authors.map(author => ({
      value: author,
      label: author
    }))
  ], [initialFilterOptions.authors]);

  const representativeOptions = useMemo(() => [
    { value: 'all', label: 'Wszyscy' },
    ...initialFilterOptions.representatives.map(rep => ({
      value: rep,
      label: rep
    }))
  ], [initialFilterOptions.representatives]);

  // Logika debouncingu
  useEffect(() => {
      const handler = setTimeout(() => {
      setDebouncedAmount(searchAmount);
      setDebouncedTolerance(amountTolerance);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchAmount, amountTolerance]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedContractor(searchContractor);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchContractor]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMinAmount(minAmount);
      setDebouncedMaxAmount(maxAmount);
    }, 500);
    return () => clearTimeout(handler);
  }, [minAmount, maxAmount]);

  // Funkcja do sortowania
  const handleSort = (column: SortColumn) => {
    setSortConfig(prevConfig => {
      if (prevConfig.column === column) {
        if (prevConfig.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prevConfig.direction === 'desc') {
          return { column: null, direction: null };
        } else {
          return { column, direction: 'asc' };
        }
      } else {
        return { column, direction: 'asc' };
      }
    });
  };


  const sortedCosts = useMemo(() => {
      // Filtruj koszty HQ dla nie-adminów jako dodatkowe zabezpieczenie
      const filteredCosts = costs.filter(cost => {
          // Admin widzi wszystko
          if (userRole === 'ADMIN') {
            return true;
          }

          // Jeśli to nie jest koszt HQ, pokazuj
          if (cost.cost_branch !== 'HQ') {
            return true;
          }

          // Jeśli to koszt HQ i użytkownik to BASIA, pokazuj tylko jeśli ona go utworzyła
          if (userRole === 'BASIA' && user?.fullName && cost.cost_author === user.fullName) {
            return true;
          }

          // W pozostałych przypadkach ukrywaj koszty HQ
          return false;
      });

      if (!sortConfig.column || !sortConfig.direction) {
        return filteredCosts;
      }

      return [...filteredCosts].sort((a, b) => {
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
  }, [costs, sortConfig, userRole]);

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
    const totalCostValue = pagination.total_sum;
    const totalPhValue = sortedCosts.reduce((sum, cost) => sum + cost.cost_ph_value, 0);

    return {
      totalCostValue,
      totalPhValue,
      count: pagination.total
    };
  }, [sortedCosts, pagination.total_sum, pagination.total]);

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
      const baseParams: {
        year?: number;
        branch?: string;
        cost_author?: string;
        cost_ph?: string;
        limit: number;
      } = {
        limit: 1000
      };

      if (selectedYear) {
        baseParams.year = selectedYear;
      }

      if (userRole === 'BRANCH' && userBranch) {
        const branchKey = userBranch.toLowerCase();
        const correctBranchName = branchMapping[branchKey] || userBranch;
        baseParams.branch = correctBranchName;
      }

      if (userRole === 'STAFF' && user?.fullName) {
        baseParams.cost_author = user.fullName;
      }

      if (userRole === 'REPRESENTATIVE' && user?.fullName) {
        baseParams.cost_ph = user.fullName;
      }

      const initialData = await costsService.getCosts(baseParams);
      const representatives = await fetchRepresentatives();

      if (initialData.costs.length > 0) {
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
        contrahent_like?: string;
        amount_gte?: number;
        amount_lte?: number;
        exclude_branch?: string;
      } = {
        limit: pagination.limit,
        offset: pagination.offset,
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

      // Logika wyszukiwania dynamicznego
      if (debouncedContractor) {
        params.contrahent_like = debouncedContractor;
      }

      if (isRangeSearch) {
        // Logika dla wyszukiwania w zakresie "od - do"
        const min = parseFloat(debouncedMinAmount);
        const max = parseFloat(debouncedMaxAmount);
        if (!isNaN(min)) {
          params.amount_gte = min;
        }
        if (!isNaN(max)) {
          params.amount_lte = max;
        }
      } else {
        // Logika dla wyszukiwania pojedynczej kwoty z tolerancją
        if (debouncedAmount) {
          const amount = parseFloat(debouncedAmount);
          if (!isNaN(amount)) {
            params.amount_gte = amount - debouncedTolerance;
            params.amount_lte = amount + debouncedTolerance;
          }
        }
      }

      // Logika uprawnień
      if (userRole === 'BASIA' && user?.fullName) {
        params.cost_author = user.fullName;
      }
      if (userRole === 'BRANCH' && userBranch) {
        const branchKey = userBranch.toLowerCase();
        const correctBranchName = branchMapping[branchKey] || userBranch;
        params.branch = correctBranchName;
      }
      if (userRole === 'STAFF' && user?.fullName) {
        params.cost_author = user.fullName;
      }
      if (userRole === 'REPRESENTATIVE' && user?.fullName) {
        params.cost_ph = user.fullName;
      }

      // Dla nie-adminów (oprócz BASIA) wyklucz koszty z oddziału HQ (Centrala)
      // BASIA będzie miała dodatkowe filtrowanie po stronie klienta
      if (userRole !== 'ADMIN' && userRole !== 'BASIA') {
        // Dodaj parametr wykluczający oddział HQ
        params.exclude_branch = 'HQ';
      }

      const data = await costsService.getCosts(params);

      setCosts(data.costs);
      setPagination({
        total: data.total,
        total_sum: data.total_sum || 0,
        limit: data.limit,
        offset: data.offset,
      });

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
    user?.fullName,
    debouncedContractor,
    debouncedAmount,
    debouncedTolerance,
isRangeSearch,
    debouncedMinAmount,
    debouncedMaxAmount,
  ]);

  // Handler dla przycisku "Powiel"
  const handleDuplicateCost = (cost: Cost) => {
    setScrollPosition(window.scrollY);
    setCostToDuplicate(cost);
    setIsDuplicateDialogOpen(true);
  };

  // useEffect do przywracania scrolla TYLKO dla ścieżki "Powiel"
  useEffect(() => {
    if (!isDuplicateDialogOpen && scrollPosition !== null) {
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
        setScrollPosition(null);
      }, 0);
    }
  }, [isDuplicateDialogOpen, scrollPosition]);

  useEffect(() => {
    if (selectedYear || yearsData?.currentYear) {
      fetchInitialFilterOptions();
    }
  }, [fetchInitialFilterOptions, selectedYear, yearsData?.currentYear]);

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
    yearsData?.currentYear,
    debouncedContractor,
    debouncedAmount,
    debouncedTolerance,
    isRangeSearch,
    debouncedMinAmount,
    debouncedMaxAmount,
  ]);

  useEffect(() => {
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
    }
  }, [selectedYear, yearsData]);

  const handleAddCost = (costData: CostData) => {
    fetchCosts();
    console.log('Dodano nowy koszt:', costData);
  };

  const handleEditCost = (costData: CostData & { cost_id: number }) => {
    fetchCosts();
    console.log('Zaktualizowano wszystkie koszt:', costData);
  };

  const handleDeleteCost = async (costIds: number[]) => {
    try {
      const confirmed = window.confirm(
        costIds.length === 1
          ? 'Czy na pewno chcesz usunąć ten koszt?'
          : `Czy na pewno chcesz usunąć ${costIds.length} wybrane koszty?`
      );

      if (confirmed) {
        for (const costId of costIds) {
          await costsService.deleteCost(costId);
        }
        fetchCosts();
        setSelectedCosts([]);
      }
    } catch (error) {
      console.error('Błąd podczas usuwania kosztów:', error);
      setError('Wystąpił błąd podczas usuwania kosztów.');
    }
  };

  const handleSelectAllCosts = (checked: boolean) => {
    if (checked) {
      setSelectedCosts(sortedCosts.map(cost => cost.cost_id));
    } else {
      setSelectedCosts([]);
    }
  };

  const handleSelectCost = (costId: number, checked: boolean) => {
    if (checked) {
      setSelectedCosts(prev => [...prev, costId]);
    } else {
      setSelectedCosts(prev => prev.filter(id => id !== costId));
    }
  };

  const handleOpenEditDialog = () => {
    if (selectedCosts.length === 1) {
      const costId = selectedCosts[0];
      const costToEdit = sortedCosts.find(cost => cost.cost_id === costId) || null;
      setCostToEdit(costToEdit);
      setIsEditDialogOpen(true);
    }
  };

  // Funkcje do resetowania filtrów
  const handleResetMonth = () => setSelectedMonth(null);
  const handleResetBranch = () => setSelectedBranch(null);
  const handleResetCostOwner = () => setSelectedCostOwner(null);
  const handleResetCostType = () => setSelectedCostType(null);
  const handleResetAuthor = () => setSelectedAuthor(null);
  const handleResetPH = () => setSelectedPH(null);

  const isAdmin = userRole === 'ADMIN' || userRole === 'BOARD';
  const isBranch = userRole === 'BRANCH';
  const isStaff = userRole === 'STAFF';
  const isBasia = userRole === 'BASIA';
  const isRepresentative = userRole === 'REPRESENTATIVE';
  const canEdit = isAdmin || isBranch || isStaff || isBasia;
  const canAdd = isAdmin || isBranch || isStaff || isBasia;
  const canDelete = isAdmin || isBranch || isStaff || isBasia;
  const allCostsSelected = sortedCosts.length > 0 && selectedCosts.length === sortedCosts.length && !isRepresentative;
  const isEditButtonEnabled = selectedCosts.length === 1 && canEdit;
  const isDeleteButtonEnabled = selectedCosts.length > 0 && canDelete;

  useEffect(() => {
    if ((isBranch || isStaff) && userBranch) {
      setSelectedBranch(userBranch);
    }
  }, [isBranch, isStaff, userBranch]);

  useEffect(() => {
    if (isStaff && user?.fullName) {
      setSelectedAuthor(user.fullName);
    }
  }, [isStaff, user?.fullName]);

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
              <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-semibold text-gray-800">Moduł Kosztów xxx</h2>
                <div className="relative">
                    <Select
                        value={selectedYear?.toString() ?? ''}
                        onValueChange={(value) => setSelectedYear(value ? parseInt(value) : null)}
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

              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-2 flex-grow">
                  <div className="relative w-48">
                    <Input
                        type="text"
                        placeholder="Kontrahent"
                        value={searchContractor}
                        onChange={(e) => setSearchContractor(e.target.value)}
                        className={`h-11 w-full border-gray-200 border-2 rounded-lg text-gray-800 placeholder:text-gray-400 pr-8 transition-colors duration-200 ${
                          isSearchFieldActive(searchContractor) ? 'bg-green-50' : 'bg-white'
                        }`}
                    />
                    {searchContractor && (
                        <button
                            type="button"
                            onClick={() => setSearchContractor('')}
                            className={clearButtonStyle}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                  <div className="flex items-center gap-2">
                    {!isRangeSearch ? (
                      <div className="flex items-center gap-1">
                        <div className="relative w-36">
                            <Input
                                type="text"
                                placeholder="Kwota"
                                value={searchAmount}
                                onChange={(e) => setSearchAmount(e.target.value)}
                                className={`h-11 w-full border-gray-200 border-2 rounded-lg text-gray-800 placeholder:text-gray-400 pr-8 transition-colors duration-200 ${
                                  isSearchFieldActive(searchAmount) ? 'bg-green-50' : 'bg-white'
                                }`}
                            />
                            {searchAmount && (
                                <button
                                    type="button"
                                    onClick={() => setSearchAmount('')}
                                    className={clearButtonStyle}
                                    aria-label="Wyczyść"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Select value={amountTolerance.toString()} onValueChange={v => setAmountTolerance(parseInt(v))} disabled={!searchAmount}>
                          <SelectTrigger className={`${selectStyles.trigger} w-[100px] ${!searchAmount ? 'bg-gray-100 opacity-70' : ''}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={selectStyles.content}>
                            <SelectItem className={selectStyles.item} value="1">± 1 zł</SelectItem>
                            <SelectItem className={selectStyles.item} value="10">± 10 zł</SelectItem>
                            <SelectItem className={selectStyles.item} value="100">± 100 zł</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative w-32">
                            <Input
                                type="text"
                                placeholder="Kwota od"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                className={`h-11 w-full border-gray-200 border-2 rounded-lg text-gray-800 placeholder:text-gray-400 pr-8 transition-colors duration-200 ${
                                  isSearchFieldActive(minAmount) ? 'bg-green-50' : 'bg-white'
                                }`}
                            />
                            {minAmount && (
                                <button
                                    type="button"
                                    onClick={() => setMinAmount('')}
                                    className={clearButtonStyle}
                                    aria-label="Wyczyść"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="relative w-32">
                            <Input
                                type="text"
                                placeholder="Kwota do"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                className={`h-11 w-full border-gray-200 border-2 rounded-lg text-gray-800 placeholder:text-gray-400 pr-8 transition-colors duration-200 ${
                                  isSearchFieldActive(maxAmount) ? 'bg-green-50' : 'bg-white'
                                }`}
                            />
                            {maxAmount && (
                                <button
                                    type="button"
                                    onClick={() => setMaxAmount('')}
                                    className={clearButtonStyle}
                                    aria-label="Wyczyść"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                      </div>
                    )}
                    <div className="hidden items-center space-x-2 md:flex">
                      <Checkbox
                        id="range-search"
                        checked={isRangeSearch}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setIsRangeSearch(isChecked);
                          if (isChecked) {
                            setSearchAmount('');
                          } else {
                            setMinAmount('');
                            setMaxAmount('');
                          }
                        }}
                      />
                      <label htmlFor="range-search" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                        od - do
                      </label>
                    </div>
                  </div>
                </div>

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
            </div>

            <div className="border-b border-gray-300 mb-4"></div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                <div className="relative">
                    <SearchableSelect
                        value={selectedMonth ?? 'all'}
                        onValueChange={(value) => setSelectedMonth(value === 'all' ? null : value)}
                        placeholder="Wybierz miesiąc"
                        items={monthOptions}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedMonth) ? 'bg-green-50' : ''}`}
                    />
                    {selectedMonth && selectedMonth !== 'all' && (
                        <button
                            type="button"
                            onClick={handleResetMonth}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <SearchableSelect
                        value={selectedBranch ?? 'all'}
                        onValueChange={(value) => setSelectedBranch(value === 'all' ? null : value)}
                        placeholder="Wybierz oddział"
                        items={branchOptions}
                        disabled={isBranch || isStaff || isRepresentative}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedBranch, isBranch || isStaff || isRepresentative) ? 'bg-green-50' : ''}`}
                    />
                    {selectedBranch && selectedBranch !== 'all' && !(isBranch || isStaff || isRepresentative) && (
                        <button
                            type="button"
                            onClick={handleResetBranch}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

              {!isRepresentative && (
                <div className="relative">
                    <SearchableSelect
                        value={selectedCostOwner ?? 'all'}
                        onValueChange={(value) => setSelectedCostOwner(value === 'all' ? null : value)}
                        placeholder="Czyj koszt?"
                        items={costOwnerOptions}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedCostOwner) ? 'bg-green-50' : ''}`}
                    />
                    {selectedCostOwner && selectedCostOwner !== 'all' && (
                        <button
                            type="button"
                            onClick={handleResetCostOwner}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
              )}

                <div className="relative">
                    <SearchableSelect
                        value={selectedCostType ?? 'all'}
                        onValueChange={(value) => setSelectedCostType(value === 'all' ? null : value)}
                        placeholder="Rodzaj kosztu"
                        items={costTypeOptions}
                        disabled={isRepresentative}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedCostType, isRepresentative) ? 'bg-green-50' : ''}`}
                    />
                    {selectedCostType && selectedCostType !== 'all' && !isRepresentative && (
                        <button
                            type="button"
                            onClick={handleResetCostType}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <SearchableSelect
                        value={selectedAuthor ?? 'all'}
                        onValueChange={(value) => setSelectedAuthor(value === 'all' ? null : value)}
                        placeholder="Kto wpisał koszt?"
                        items={authorOptions}
                        disabled={isStaff || isRepresentative || isBasia}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedAuthor, isStaff || isRepresentative || isBasia) ? 'bg-green-50' : ''}`}
                    />
                    {selectedAuthor && selectedAuthor !== 'all' && !(isStaff || isRepresentative || isBasia) && (
                        <button
                            type="button"
                            onClick={handleResetAuthor}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <SearchableSelect
                        value={selectedPH ?? 'all'}
                        onValueChange={(value) => setSelectedPH(value === 'all' ? null : value)}
                        placeholder="Przedstawiciel"
                        items={representativeOptions}
                        disabled={isRepresentative}
                        expandUpward={false}
                        className={`w-full ${isFilterActive(selectedPH, isRepresentative) ? 'bg-green-50' : ''}`}
                    />
                    {selectedPH && selectedPH !== 'all' && !isRepresentative && (
                        <button
                            type="button"
                            onClick={handleResetPH}
                            className={clearButtonStyleForSelect}
                            aria-label="Wyczyść"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-white rounded-md border border-gray-200 overflow-x-auto">
              <Table className="min-w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
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
                    {/* Dodatkowa komórka na przycisk Powiel */}
                    {canAdd && !isRepresentative && (
                        <TableHead className="w-[80px] font-medium text-gray-800 text-center">Powiel</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={isRepresentative ? 12 : 14}>
                          <div className="h-10 w-full bg-gray-200 animate-pulse rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : sortedCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRepresentative ? 11 : 14} className="text-center py-8 text-gray-500">
                        {isRepresentative
                          ? "Nie znaleziono kosztów powiązanych z Twoim kontem przedstawiciela."
                          : "Brak kosztów do wyświetlenia"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {sortedCosts.map((cost, index) => (
                        <TableRow
                            key={cost.cost_id}
                            className={`hover:bg-gray-50 ${
                              selectedCosts.includes(cost.cost_id)
                                ? 'bg-blue-50'
                                : cost.cost_kind === 'Wypłata'
                                  ? 'bg-yellow-50'
                                  : ''
                            }`}
                        >
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
                                {getBranchDisplayName(cost.cost_branch)} {/* Zastosuj funkcję mapującą */}
                              </span>
                          </TableCell>
                          {canAdd && !isRepresentative && (
                              <TableCell className="text-center">
                                <Button
                                  onClick={() => handleDuplicateCost(cost)}
                                  className="bg-green-600 text-white hover:bg-green-700 h-8 w-8 p-1.5"
                                  title="Powiel koszt"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TableCell>
                          )}
                        </TableRow>
                      ))}

                      {sortedCosts.length > 0 && (
                        <TableRow className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                          {!isRepresentative && <TableCell className="text-center">-</TableCell>}
                          <TableCell className="text-center text-gray-700">SUMA (total)</TableCell>
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
                          {canAdd && !isRepresentative && (
                            <TableCell className="text-center text-gray-700">-</TableCell>
                          )}
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

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

      {/* Dialog do powielania kosztów - kontrolowany przez stan */}
      {!isRepresentative && canAdd && (
        <AddCostDialog
          onAddCost={(costData) => {
            handleAddCost(costData);
            setIsDuplicateDialogOpen(false); // Zamknij dialog po dodaniu
          }}
          selectedYear={selectedYear ?? yearsData?.currentYear}
          userRole={userRole}
          userBranch={userBranch}
          isOpen={isDuplicateDialogOpen}
          onOpenChange={setIsDuplicateDialogOpen}
          initialData={costToDuplicate ? {
            contractor: costToDuplicate.cost_contrahent,
            nip: costToDuplicate.cost_nip,
            invoiceNumber: costToDuplicate.cost_doc_no,
            amount: costToDuplicate.cost_value.toString(),
            month: costToDuplicate.cost_mo.toString(),
            costType: costToDuplicate.cost_kind,
            description: costToDuplicate.cost_4what,
            costOwner: costToDuplicate.cost_own,
            representative: costToDuplicate.cost_ph || '',
            department: costToDuplicate.cost_branch,
          } : undefined}
        />
    )}
    </div>
  );
};

export default CostsView;