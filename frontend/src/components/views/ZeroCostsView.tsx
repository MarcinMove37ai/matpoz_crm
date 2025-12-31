/**
 * @file src/components/views/ZeroCostsView.tsx
 * @description Widok weryfikacji marży - Z funkcją kopiowania i powiadomieniami
 */

"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTransactionYears } from '@/hooks/useTransactionYears';
import { useAuth } from '@/hooks/useAuth';
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
import { Button } from "@/components/ui/button";
// Dodano ikonę Copy i ArrowUpDown
import { AlertCircle, Plus, ChevronLeft, ChevronRight, X, Copy, Calendar, ArrowUpDown } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import ScrollableSelect from '@/components/ui/ScrollableSelect';
// Import Toasta
import { useToast } from "@/context/ToastContext";

import { transactionsService, ZeroMarginTransaction } from '@/services/transactions';

const ZeroCostsView = () => {
  const { data: yearsData, loading: yearsLoading } = useTransactionYears();
  const { userRole, userBranch, user } = useAuth();
  // Inicjalizacja toasta
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [representativesList, setRepresentativesList] = useState<string[]>([]);

  const [transactions, setTransactions] = useState<ZeroMarginTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  });

  // State dla sortowania
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (!dateTo) setDateTo(formatDate(today));
    if (!dateFrom) setDateFrom(formatDate(sevenDaysAgo));
  }, []);

  useEffect(() => {
    const fetchReps = async () => {
      try {
        const response = await fetch('/api/costs/representatives');
        if (response.ok) {
          const data = await response.json();
          setRepresentativesList(data);
        }
      } catch (err) {
        console.error("Błąd pobierania listy PH", err);
      }
    };
    fetchReps();
  }, []);

  const branchItems = useMemo(() => [
    { value: 'all', label: 'Wszystkie oddziały' },
    { value: 'Rzgów', label: 'Rzgów' },
    { value: 'Lublin', label: 'Lublin' },
    { value: 'Malbork', label: 'Malbork' },
    { value: 'Centrala', label: 'Centrala' },
    { value: 'Pcim', label: 'Pcim' },
    { value: 'Łomża', label: 'Łomża' },
    { value: 'Myślibórz', label: 'Myślibórz' },
    { value: 'MG', label: 'MG' },
    { value: 'STH', label: 'STH' },
    { value: 'BHP', label: 'BHP' },
  ], []);

  const repItems = useMemo(() => [
    { value: 'all', label: 'Wszyscy PH' },
    ...representativesList.map(rep => ({ value: rep, label: rep }))
  ], [representativesList]);

  useEffect(() => {
    // 1. Ustaw rok domyślny jeśli nie wybrano
    if (!selectedYear && yearsData?.currentYear) {
      setSelectedYear(yearsData.currentYear);
      return;
    }

    // 2. Jeśli rok jest wybrany, zaktualizuj zakres dat
    if (selectedYear) {
      const now = new Date();
      const isCurrentYear = selectedYear === now.getFullYear();

      // Początek roku
      const newFrom = `${selectedYear}-01-01`;
      // Koniec roku (lub dzisiaj, jeśli to bieżący rok)
      const newTo = isCurrentYear
        ? now.toISOString().split('T')[0]
        : `${selectedYear}-12-31`;

      setDateFrom(newFrom);
      setDateTo(newTo);
    }
  }, [selectedYear, yearsData]);

  const fetchTransactions = useCallback(async () => {
    if (!dateFrom || !dateTo) return;

    try {
      setIsLoading(true);

      const params = {
        limit: pagination.limit,
        offset: pagination.offset,
        year: selectedYear || undefined,
        date_from: dateFrom,
        date_to: dateTo,
        branch: undefined as string | undefined,
        representative: undefined as string | undefined
      };

      if (selectedBranch && selectedBranch !== 'all') params.branch = selectedBranch;
      if (selectedRep && selectedRep !== 'all') params.representative = selectedRep;

      if (userRole === 'BRANCH' && userBranch) params.branch = userBranch;
      if (userRole === 'REPRESENTATIVE' && user?.fullName) params.representative = user.fullName;

      const response = await transactionsService.getZeroMarginTransactions(params);

      setTransactions(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.total
      }));

    } catch (error) {
      console.error("Błąd pobierania transakcji:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedBranch, selectedRep, dateFrom, dateTo, pagination.limit, pagination.offset, userRole, userBranch, user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, offset: 0 }));
  }, [selectedYear, selectedBranch, selectedRep, dateFrom, dateTo, pagination.limit]);

  // --- FUNKCJA KOPIOWANIA ---
  const handleCopyDocNo = (docNo: string, e: React.MouseEvent) => {
    navigator.clipboard.writeText(docNo);

    // Przekazujemy pozycję myszki
    toast({
      title: "Skopiowano numer transakcji",
      description: "Wklej w wyszukiwarkę Iluo aby sprawdzić szczegóły",
      className: "bg-green-100 border-green-300 text-green-900 shadow-xl", // Jasny zielony styl
      position: { x: e.clientX, y: e.clientY } // Współrzędne kursora
    });
  };

  // --- FUNKCJA SORTOWANIA ---
  const handleSort = () => {
    if (sortOrder === null) {
      setSortOrder('desc');
    } else if (sortOrder === 'desc') {
      setSortOrder('asc');
    } else {
      setSortOrder(null);
    }
  };

  // Posortowane transakcje
  const sortedTransactions = useMemo(() => {
    if (!sortOrder) return transactions;

    return [...transactions].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.net_value - b.net_value;
      } else {
        return b.net_value - a.net_value;
      }
    });
  }, [transactions, sortOrder]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(val);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="w-full h-full overflow-y-auto space-y-4 pb-4">
      <Card className="w-full bg-[#ffffff] border border-[#e5e7eb] shadow-sm">
        <CardContent className="p-5">
          <h2 className="text-xl font-bold text-[#111827] mb-5">Filtry wyszukiwania</h2>

          <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
            <div className="flex flex-col min-w-[150px] flex-1">
              <label className="text-sm font-medium text-[#374151] mb-1.5">Rok</label>
              <Select
                value={selectedYear?.toString() || ''}
                onValueChange={(val) => setSelectedYear(Number(val))}
                disabled={yearsLoading}
              >
                <SelectTrigger className="h-9 bg-[#f9fafb] border-[#d1d5db] text-[#111827]">
                  <SelectValue placeholder={yearsLoading ? "Ładowanie..." : "Wybierz rok"} />
                </SelectTrigger>
                <SelectContent>
                  {yearsData?.years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col min-w-[150px] flex-1">
              <label className="text-sm font-medium text-[#374151] mb-1.5">Data od</label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 bg-[#f9fafb] border-[#d1d5db] text-[#111827] pr-9"
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280] pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col min-w-[150px] flex-1">
              <label className="text-sm font-medium text-[#374151] mb-1.5">Data do</label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 bg-[#f9fafb] border-[#d1d5db] text-[#111827] pr-9"
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280] pointer-events-none" />
              </div>
            </div>

            {userRole === 'ADMIN' && (
              <>
                <div className="flex flex-col min-w-[180px] flex-1">
                  <label className="text-sm font-medium text-[#374151] mb-1.5">Oddział</label>
                  <SearchableSelect
                    items={branchItems}
                    value={selectedBranch || 'all'}
                    onValueChange={setSelectedBranch}
                    placeholder="Wybierz oddział"
                  />
                </div>
                <div className="flex flex-col min-w-[180px] flex-1">
                  <label className="text-sm font-medium text-[#374151] mb-1.5">Przedstawiciel</label>
                  <SearchableSelect
                    items={repItems}
                    value={selectedRep || 'all'}
                    onValueChange={setSelectedRep}
                    placeholder="Wybierz PH"
                  />
                </div>
              </>
            )}

            <div className="flex items-end gap-2 pt-4 md:pt-0">
              <Button
                onClick={fetchTransactions}
                disabled={isLoading}
                className="h-9 bg-[#2563eb] hover:bg-[#1d4ed8] text-[#ffffff] px-5 font-medium"
              >
                {isLoading ? 'Szukam...' : 'Szukaj'}
              </Button>

              {(selectedBranch !== 'all' || selectedRep !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedBranch('all');
                    setSelectedRep('all');
                  }}
                  className="h-9 w-9 flex items-center justify-center bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] border border-[#fecaca] rounded transition-colors"
                  title="Wyczyść filtr"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 pt-4 md:pt-0">
                <span className="text-sm text-[#6b7280]">Znaleziono:</span>
                <span className="bg-[#fee2e2] text-[#b91c1c] px-3 py-1 rounded-full text-sm font-bold border border-[#fecaca]">
                    {pagination.total}
                </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert variant="destructive" className="bg-[#fef2f2] border-[#fecaca] flex items-center py-2.5 px-4">
        <AlertCircle className="h-5 w-5 text-[#dc2626] shrink-0" />
        <div className="ml-3 flex flex-row items-center gap-2 text-sm flex-wrap">
          <span className="text-[#991b1b] font-bold whitespace-nowrap">
            Wymagana weryfikacja
          </span>
          <span className="text-[#b91c1c] hidden sm:inline opacity-60">
            |
          </span>
          <AlertDescription className="text-[#b91c1c] mt-0 leading-none">
            Lista zawiera dokumenty sprzedaży bez przypisanych kosztów.
          </AlertDescription>
        </div>
      </Alert>

      <Card className="w-full bg-[#ffffff] border border-[#e5e7eb] shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f3f4f6]">
                <TableRow className="border-b border-[#e5e7eb] h-9 hover:bg-[#f3f4f6]">
                  <TableHead className="w-[50px] text-center font-bold text-[#111827] text-xs">Lp</TableHead>
                  <TableHead className="font-bold text-[#111827] text-xs">Data</TableHead>
                  <TableHead className="font-bold text-[#111827] text-xs">Nr Dokumentu</TableHead>
                  <TableHead className="font-bold text-[#111827] text-xs">Kontrahent (NIP)</TableHead>
                  <TableHead
                    className="text-right font-bold text-[#111827] text-xs cursor-pointer hover:bg-[#e5e7eb] select-none"
                    onClick={handleSort}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Netto</span>
                      <ArrowUpDown className="h-3 w-3" />
                      {sortOrder && (
                        <span className="text-[10px] text-[#2563eb]">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-bold text-[#111827] text-xs">Zysk</TableHead>
                  <TableHead className="text-center font-bold text-[#111827] text-xs">Marża</TableHead>
                  <TableHead className="font-bold text-[#111827] text-xs">Przedstawiciel</TableHead>
                  <TableHead className="font-bold text-[#111827] text-xs">Oddział</TableHead>
                  <TableHead className="text-center font-bold text-[#111827] text-xs">Akcja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   Array(5).fill(0).map((_, i) => (
                    <TableRow key={i} className="h-10">
                      <TableCell colSpan={10}><div className="h-4 bg-[#f3f4f6] animate-pulse rounded w-full"></div></TableCell>
                    </TableRow>
                   ))
                ) : sortedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-[#6b7280]">
                        Brak błędnych transakcji w wybranym okresie.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTransactions.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={`border-b border-[#e5e7eb] transition-colors h-9 ${
                        index % 2 === 0 ? 'bg-[#ffffff]' : 'bg-[#f9fafb]'
                      } hover:bg-[#e0f2fe]`}
                    >
                      <TableCell className="text-center font-medium text-[#000000] text-xs py-1">
                        {pagination.offset + index + 1}
                      </TableCell>
                      <TableCell className="text-[#374151] font-medium text-xs py-1 whitespace-nowrap">
                        {formatDate(item.date)}
                      </TableCell>

                      {/* --- MODYFIKACJA: KOLUMNA Z PRZYCISKIEM KOPIOWANIA --- */}
                      <TableCell className="font-mono text-[#4b5563] text-xs py-1 whitespace-nowrap">
                          <div className="flex items-center gap-1 group">
                              <span>{item.doc_no}</span>
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  // TUTAJ ZMIANA: przekazujemy 'e' do funkcji
                                  onClick={(e) => handleCopyDocNo(item.doc_no, e)}
                                  title="Skopiuj numer dokumentu sprzedaży"
                              >
                                  <Copy className="h-3 w-3" />
                              </Button>
                          </div>
                        </TableCell>
                      {/* ----------------------------------------------------- */}

                      <TableCell className="font-bold text-[#111827] text-xs py-1 truncate max-w-[200px]" title={item.nip}>
                        {item.nip || "Brak NIP"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#374151] text-xs py-1">
                        {formatCurrency(item.net_value)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-[#dc2626] text-xs py-1">
                        {formatCurrency(item.profit)}
                      </TableCell>
                      <TableCell className="text-center py-1">
                        <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold bg-[#fee2e2] text-[#991b1b]">
                          100%
                        </span>
                      </TableCell>
                      <TableCell className="text-[#374151] text-xs py-1 truncate max-w-[150px]">
                        {item.representative}
                      </TableCell>
                      <TableCell className="text-[#374151] text-xs py-1">
                        {item.branch}
                      </TableCell>
                      <TableCell className="text-center py-1">
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-3 bg-[#16a34a] hover:bg-[#15803d] text-[#ffffff] flex items-center gap-1 mx-auto"
                          onClick={() => alert(`Tutaj otworzy się dialog dodawania kosztu dla faktury: ${item.doc_no}`)}
                        >
                          Dodaj <Plus className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-[#e5e7eb] bg-[#f9fafb] gap-4">
            <div className="flex items-center gap-2 text-sm text-[#374151]">
                <span>Pokaż</span>
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(val) => setPagination(prev => ({...prev, limit: Number(val), offset: 0}))}
                >
                  <SelectTrigger className="h-8 w-[70px] bg-[#ffffff] border-[#d1d5db] text-[#111827]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom">
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>na stronę</span>
            </div>

            <div className="flex items-center gap-4">
               <span className="text-xs text-[#6b7280]">
                  {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} z {pagination.total}
               </span>
               <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 bg-[#ffffff] border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]"
                    disabled={pagination.offset === 0}
                    onClick={() => setPagination(prev => ({...prev, offset: Math.max(0, prev.offset - prev.limit)}))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 bg-[#ffffff] border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6]"
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                    onClick={() => setPagination(prev => ({...prev, offset: prev.offset + prev.limit}))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
               </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default ZeroCostsView;