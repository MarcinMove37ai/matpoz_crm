/**
 * @file src/components/views/CostsViewIluo.tsx
 * @description Widok "Koszty ILUO (beta)" — lista dokumentów z costs_raw (ERP).
 *
 * KROK 2b: oddział z backendu (kod + nazwa), filtr na kodach.
 * KROK 3:  przełącznik etykiety chowany, gdy backend wymusza etykietę.
 * KROK 4c: sekcja "Przypisanie kosztu" w modalu szczegółów:
 *          - selecty Właściciel + Przedstawiciel (poziomo), badge oddziału,
 *          - reguły jak AddCostDialog (Przedstawiciel => PH wymagany,
 *            Oddział/Centrala => PH zablokowany),
 *          - dokument przypisany => zielona plakietka statusu zamiast formularza,
 *          - po sukcesie odświeżenie listy i nagłówka w modalu.
 */

"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, X, ChevronUp, ChevronDown, ChevronsUpDown, Loader2,
  Hash, Receipt, Package, Tag, CalendarDays, Check
} from 'lucide-react';
import {
  costsRawService,
  CostRawHeader,
  CostRawDetail,
} from '@/services/costsRaw';
import { getBranchDisplayName } from '@/lib/branchDictionary';
import { useAuth } from '@/hooks/useAuth';

// Sortowanie — pola zgodne z białą listą w backendzie
type SortColumn = 'data' | 'numer' | 'nazwa_skrocona' | 'netto' | 'brutto' | 'oddzial';
type SortDir = 'asc' | 'desc';

// Filtr przypisania etykiety
type LabelFilter = 'all' | 'with' | 'without';

// Filtr statusu przypisania — domyślnie lista robocza "do przypisania"
type AssignFilter = 'unassigned' | 'assigned' | 'all';

// Właściciele kosztu przy przypisaniu (jak AddCostDialog, bez "Prywatny")
const COST_OWNERS = ['Wspólny', 'Oddział', 'Centrala', 'Przedstawiciel'];
// Dokument prowizyjny (Prowizja - KOSZT): tylko Oddział/Przedstawiciel
const COMMISSION_COST_OWNERS = ['Oddział', 'Przedstawiciel'];
// Właściciele, przy których select PH jest zablokowany
const OWNERS_WITHOUT_PH = ['Oddział', 'Centrala'];

// Kolory badge'y oddziałów — spójne z legacy CostsView (klucz = KOD legacy)
const branchBadgeClass = (code: string | null): string => {
  switch (code) {
    case 'MG': return 'bg-red-100 text-red-800';
    case 'STH': return 'bg-purple-100 text-purple-800';
    case 'BHP': return 'bg-yellow-100 text-yellow-800';
    case 'Pcim': return 'bg-green-100 text-green-800';
    case 'Rzgów': return 'bg-blue-100 text-blue-800';
    case 'Private': return 'bg-orange-100 text-orange-800';
    default: return 'bg-blue-100 text-blue-800';
  }
};

// Normalizacja nazwy oddziału użytkownika na kod legacy (jak w AddCostDialog)
const BRANCH_NORMALIZE: Record<string, string> = {
  "LUBLIN": "Lublin",
  "PCIM": "Pcim",
  "RZGOW": "Rzgów",
  "RZGÓW": "Rzgów",
  "MALBORK": "Malbork",
  "LOMZA": "Łomża",
  "ŁOMŻA": "Łomża",
  "LOMŻA": "Łomża",
  "MYSLIBORZ": "Myślibórz",
  "MYŚLIBÓRZ": "Myślibórz",
};

const CostsViewIluo = () => {
  const { user, userRole, userBranch } = useAuth();

  // KROK 5 (korekta): ADMIN i BOARD widzą WSZYSTKO (z HQ/IIM/INT) i przypisują;
  // BRANCH widzi tylko swój oddział i przypisuje; REPRESENTATIVE, BASIA, STAFF
  // — bez dostępu (menu chowa link, zapora niżej łapie wejście z URL).
  const isAdmin = userRole === 'ADMIN';
  const isBoard = userRole === 'BOARD';
  const isBranchRole = userRole === 'BRANCH';
  const hasAccess = isAdmin || isBoard || isBranchRole;
  const normalizedUserBranch = userBranch
    ? (BRANCH_NORMALIZE[userBranch.toUpperCase()] || userBranch)
    : null;
  // BRANCH: wymuszony filtr własnego oddziału (dropdown zablokowany)
  const forcedBranch = isBranchRole ? normalizedUserBranch : null;

  // --- Dane listy ---
  const [rows, setRows] = useState<CostRawHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    total_sum: 0,
    total_sum_netto: 0,
    limit: 50,
    offset: 0,
  });

  // Flaga z backendu: etykieta wymuszona => chowamy przełącznik etykiety
  const [labelRequired, setLabelRequired] = useState(false);

  // --- Filtry / sortowanie ---
  const [searchNazwa, setSearchNazwa] = useState('');
  const [debouncedNazwa, setDebouncedNazwa] = useState('');
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('unassigned');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortColumn>('data');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // --- Modal szczegółów ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detail, setDetail] = useState<CostRawDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- Przypisanie (krok 4c) ---
  const [assignOwner, setAssignOwner] = useState('');
  const [assignPh, setAssignPh] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [representatives, setRepresentatives] = useState<string[]>([]);

  // Cache pozycji: id dokumentu -> szczegóły (drugie otwarcie = natychmiast)
  const detailCache = useRef<Map<number, CostRawDetail>>(new Map());

  // Portal montujemy dopiero po stronie klienta (brak document w SSR)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Formatowanie waluty — spójne z CostsView
  const formatCurrency = (value: number | null) => {
    return (value ?? 0).toLocaleString('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Formatowanie daty dokumentu (YYYY-MM-DD z ISO)
  const formatDocDate = (iso: string | null) => {
    if (!iso) return '-';
    return iso.slice(0, 10);
  };

  // Debounce wyszukiwania dostawcy
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedNazwa(searchNazwa), 500);
    return () => clearTimeout(handler);
  }, [searchNazwa]);

  // Pobieranie listy
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await costsRawService.getList({
        szukaj: debouncedNazwa || undefined,
        oddzial: forcedBranch || (selectedBranch === 'all' ? undefined : selectedBranch),
        ma_etykiete: labelFilter === 'all' ? undefined : labelFilter === 'with',
        przypisane: assignFilter === 'all' ? undefined : assignFilter === 'assigned',
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      setRows(data.data);
      setLabelRequired(data.require_label === true);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        total_sum: data.total_sum,
        total_sum_netto: data.total_sum_netto,
        limit: data.limit,
        offset: data.offset,
      }));
    } catch (err) {
      console.error('Błąd podczas pobierania kosztów ILUO:', err);
      setError('Wystąpił błąd podczas ładowania danych. Spróbuj ponownie później.');
    } finally {
      setLoading(false);
    }
  }, [debouncedNazwa, selectedBranch, forcedBranch, labelFilter, assignFilter, sortBy, sortDir, pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Lista KODÓW oddziałów do dropdownu — raz, niezależnie od filtrów
  useEffect(() => {
    let active = true;
    costsRawService.getBranches()
      .then(list => { if (active) setBranchOptions(list); })
      .catch(err => console.error('Błąd podczas pobierania oddziałów:', err));
    return () => { active = false; };
  }, []);

  // Lista przedstawicieli — BRANCH pobiera tylko swój oddział (jak AddCostDialog)
  useEffect(() => {
    let active = true;
    const endpoint = isBranchRole && normalizedUserBranch
      ? `/api/representatives?branch=${encodeURIComponent(normalizedUserBranch)}`
      : '/api/representatives';
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        if (active && Array.isArray(data)) {
          setRepresentatives(data.map((rep: any) => rep.representative_name).filter(Boolean));
        }
      })
      .catch(err => console.error('Błąd podczas pobierania przedstawicieli:', err));
    return () => { active = false; };
  }, [isBranchRole, normalizedUserBranch]);

  // Reset paginacji przy zmianie filtra/sortowania
  useEffect(() => {
    setPagination(prev => ({ ...prev, offset: 0 }));
  }, [debouncedNazwa, selectedBranch, labelFilter, assignFilter, sortBy, sortDir]);

  // Sortowanie po kliknięciu nagłówka
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  const SortableHeader = ({
    column, children, className = "font-medium text-gray-800 text-center"
  }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
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

  // Otwarcie modala — dociąga pozycje (z cache jeśli już były)
  const openDetail = useCallback(async (id: number) => {
    setIsModalOpen(true);
    setDetailError(null);
    setAssignError(null);
    setAssignOwner('');
    setAssignPh('');

    const cached = detailCache.current.get(id);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      return;
    }

    try {
      setDetailLoading(true);
      setDetail(null);
      const data = await costsRawService.getDetail(id);
      detailCache.current.set(id, data);
      setDetail(data);
    } catch (err) {
      console.error('Błąd podczas pobierania szczegółów dokumentu:', err);
      setDetailError('Nie udało się załadować pozycji dokumentu.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setDetail(null);
    setDetailError(null);
    setAssignError(null);
    setAssignOwner('');
    setAssignPh('');
  }, []);

  // Zamknięcie modala klawiszem Esc
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, closeModal]);

  // Zmiana właściciela — czyści/blokuje PH wg reguł AddCostDialog
  const handleOwnerChange = (value: string) => {
    setAssignOwner(value);
    setAssignError(null);
    if (OWNERS_WITHOUT_PH.includes(value)) {
      setAssignPh('');
    }
  };

  const isPhDisabled = !assignOwner || OWNERS_WITHOUT_PH.includes(assignOwner);

  // Wysłanie przypisania
  const handleAssign = async () => {
    if (!detail) return;
    setAssignError(null);

    if (!assignOwner) {
      setAssignError('Wybierz właściciela kosztu.');
      return;
    }
    if (assignOwner === 'Przedstawiciel' && !assignPh) {
      setAssignError('Dla właściciela "Przedstawiciel" wybierz przedstawiciela.');
      return;
    }

    const author = user?.fullName || user?.username || '';
    if (!author) {
      setAssignError('Brak zalogowanego użytkownika — nie można przypisać.');
      return;
    }

    try {
      setAssignLoading(true);
      const result = await costsRawService.assign(detail.header.id, {
        cost_own: assignOwner,
        cost_ph: assignPh || null,
        author,
      });

      // Zaktualizuj nagłówek w modalu i w cache (bez ponownego fetchu)
      const updated: CostRawDetail = {
        ...detail,
        header: {
          ...detail.header,
          assigned_cost_id: result.cost_id,
          assigned_at: result.assigned_at,
          assigned_by: author,
        },
      };
      setDetail(updated);
      detailCache.current.set(detail.header.id, updated);

      // Odśwież listę; przy filtrze "Do przypisania" dokument znika z listy,
      // więc zamykamy modal — plakietkę statusu widać w widoku "Przypisane"
      fetchList();
      if (assignFilter === 'unassigned') {
        closeModal();
      }
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Wystąpił błąd podczas przypisywania kosztu.');
    } finally {
      setAssignLoading(false);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  // Sumy kolumn pozycji (do tfoot): suma sztuk i suma wartości netto
  const sumSztuk = detail
    ? detail.pozycje.reduce((s, p) => s + (p.ilosc ?? 0), 0)
    : 0;
  const sumNetto = detail
    ? detail.pozycje.reduce((s, p) => s + (p.ilosc ?? 0) * (p.cena ?? 0), 0)
    : 0;

  // KROK 5: zapora dla ról bez dostępu (menu chowa link, to łapie wejście z URL)
  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Brak dostępu do widoku Koszty z ILUO</p>
          <p className="text-sm text-gray-400 mt-1">Widok dostępny dla zarządu, administratora i oddziałów.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 md:p-6">
          {/* Pasek: wyszukiwanie + filtr etykiety + podsumowanie */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Wyszukiwanie dostawcy — styl spójny z modułem kosztów */}
              <div className="relative w-full sm:w-72">
                <Input
                  type="text"
                  placeholder="Dostawca, numer, numer obcy, NIP"
                  value={searchNazwa}
                  onChange={(e) => setSearchNazwa(e.target.value)}
                  className={`h-11 w-full border-gray-200 border-2 rounded-lg text-gray-800 placeholder:text-gray-400 pr-8 transition-colors duration-200 ${
                    searchNazwa.trim() !== '' ? 'bg-green-50' : 'bg-white'
                  }`}
                />
                {searchNazwa && (
                  <button
                    type="button"
                    onClick={() => setSearchNazwa('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 transition-colors duration-200 z-10"
                    aria-label="Wyczyść"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filtr statusu przypisania — domyślnie lista robocza "do przypisania" */}
              <div className="inline-flex h-11 rounded-lg border-2 border-gray-200 overflow-hidden bg-white">
                {([
                  { key: 'unassigned', label: 'Do przypisania' },
                  { key: 'assigned', label: 'Przypisane' },
                  { key: 'all', label: 'Wszystkie' },
                ] as { key: AssignFilter; label: string }[]).map((opt, idx) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAssignFilter(opt.key)}
                    className={`px-3 text-sm font-medium transition-colors duration-200 ${
                      idx > 0 ? 'border-l-2 border-gray-200' : ''
                    } ${
                      assignFilter === opt.key
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Filtr etykiety — ukryty, gdy backend wymusza etykietę (produkcja) */}
              {!labelRequired && (
                <div className="inline-flex h-11 rounded-lg border-2 border-gray-200 overflow-hidden bg-white">
                  {([
                    { key: 'all', label: 'Wszystkie' },
                    { key: 'with', label: 'Z etykietą' },
                    { key: 'without', label: 'Bez etykiety' },
                  ] as { key: LabelFilter; label: string }[]).map((opt, idx) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setLabelFilter(opt.key)}
                      className={`px-3 text-sm font-medium transition-colors duration-200 ${
                        idx > 0 ? 'border-l-2 border-gray-200' : ''
                      } ${
                        labelFilter === opt.key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Filtr oddziału — BRANCH ma zablokowany własny oddział */}
              <div className="relative w-full sm:w-56">
                <select
                  value={forcedBranch || selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={isBranchRole}
                  className={`h-11 w-full border-gray-200 border-2 rounded-lg px-3 pr-8 appearance-none transition-colors duration-200 ${
                    isBranchRole
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : selectedBranch !== 'all'
                        ? 'bg-green-50 text-gray-800 cursor-pointer'
                        : 'bg-white text-gray-800 cursor-pointer'
                  }`}
                >
                  {isBranchRole && forcedBranch ? (
                    <option value={forcedBranch}>{getBranchDisplayName(forcedBranch)}</option>
                  ) : (
                    <>
                      <option value="all">Wszystkie oddziały</option>
                      {branchOptions.map((branch) => (
                        <option key={branch} value={branch}>{getBranchDisplayName(branch)}</option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Suma (netto | brutto):{' '}
              <span className="font-bold text-gray-900">
                {formatCurrency(pagination.total_sum_netto)}
              </span>
              <span className="text-gray-400 mx-1">|</span>
              <span className="font-bold text-blue-700">
                {formatCurrency(pagination.total_sum)}
              </span>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto border-t border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="data">Data</SortableHeader>
                  <SortableHeader column="numer">Numer</SortableHeader>
                  <TableHead className="font-medium text-gray-800 text-center">Numer obcy</TableHead>
                  <SortableHeader column="nazwa_skrocona" className="font-medium text-gray-800 text-left w-28">Dostawca</SortableHeader>
                  <TableHead className="font-medium text-gray-800 text-center">NIP</TableHead>
                  <SortableHeader column="netto">Netto</SortableHeader>
                  <SortableHeader column="brutto">Brutto</SortableHeader>
                  <SortableHeader column="oddzial">Oddział</SortableHeader>
                  <TableHead className="font-semibold text-gray-900 text-center w-40">Etykieta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />
                      Ładowanie...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                      Brak dokumentów do wyświetlenia.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer transition-colors ${
                        row.prowizja ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-blue-50'
                      }`}
                      onClick={() => openDetail(row.id)}
                      title={row.prowizja ? 'Dokument prowizyjny — kliknij, aby zobaczyć pozycje' : 'Kliknij, aby zobaczyć pozycje'}
                    >
                      <TableCell className="text-center text-gray-800">{formatDocDate(row.data)}</TableCell>
                      <TableCell className="text-center font-medium text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          {row.assigned_cost_id !== null && (
                            <Check className="h-4 w-4 text-green-600" aria-label="Przypisany" />
                          )}
                          {row.numer || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-gray-500 max-w-0 truncate" title={(row.numer_obcy || '').trim()}>{(row.numer_obcy || '-').trim()}</TableCell>
                      <TableCell className="text-left text-gray-800 max-w-0 truncate" title={(row.nazwa_skrocona || '').trim()}>{(row.nazwa_skrocona || '-').trim()}</TableCell>
                      <TableCell className="text-center text-gray-600">{row.nip || '-'}</TableCell>
                      <TableCell className="text-center font-bold text-gray-900">{formatCurrency(row.netto)}</TableCell>
                      <TableCell className="text-center font-bold text-blue-700">{formatCurrency(row.brutto)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex justify-center items-center px-2 py-1 rounded-full text-xs font-medium ${branchBadgeClass(row.oddzial)}`}>
                          {row.oddzial_display || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.etykieta && row.etykieta.trim() !== '' ? (
                          <span className="inline-flex justify-center items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800 border border-green-300">
                            {row.etykieta.trim()}
                          </span>
                        ) : (
                          <span className="inline-flex justify-center items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">
                            brak
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!loading && rows.length > 0 && (
                  <TableRow className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                    <TableCell className="text-center text-gray-700">-</TableCell>
                    <TableCell className="text-center text-gray-700">SUMA (filtr)</TableCell>
                    <TableCell className="text-center text-gray-700">-</TableCell>
                    <TableCell className="text-left text-gray-700">-</TableCell>
                    <TableCell className="text-center text-gray-700">-</TableCell>
                    <TableCell className="font-bold text-gray-900 text-center">
                      {formatCurrency(pagination.total_sum_netto)}
                    </TableCell>
                    <TableCell className="font-bold text-blue-700 text-center">
                      {formatCurrency(pagination.total_sum)}
                    </TableCell>
                    <TableCell className="text-center text-gray-700">-</TableCell>
                    <TableCell className="text-center text-gray-700">
                      {pagination.total} dok.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginacja */}
          {pagination.total > pagination.limit && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600">
                Wyświetlanie {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} z {pagination.total} dokumentów
                <span className="ml-2 text-gray-400">(strona {currentPage} / {totalPages})</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
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
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
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
        </CardContent>
      </Card>

      {/* ===================== MODAL SZCZEGÓŁÓW ===================== */}
      {mounted && isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nagłówek modala — gradient firmowy */}
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-7 pt-6 pb-7">
              <button
                onClick={closeModal}
                className="absolute top-5 right-5 p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-xl transition-colors"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-end justify-between gap-6 pr-10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-blue-100 text-xs font-medium mb-2">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>Dokument kosztowy</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight truncate">
                    {detail?.header.numer || 'Szczegóły dokumentu'}
                  </h3>
                  {detail && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-blue-100 text-sm">
                      <span className="font-medium text-white truncate">{(detail.header.nazwa_skrocona || '').trim()}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDocDate(detail.header.data)}
                      </span>
                      {detail.header.etykieta && detail.header.etykieta.trim() !== '' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold">
                          <Tag className="h-3 w-3" />
                          {detail.header.etykieta.trim()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Treść modala */}
            <div className="overflow-y-auto px-7 py-6 flex-1">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <span className="text-sm">Ładowanie pozycji...</span>
                </div>
              ) : detailError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{detailError}</AlertDescription>
                </Alert>
              ) : detail ? (
                <>
                  {/* Metryki nagłówka — karty z ikonami (bez oddziału: definiuje go numer dokumentu) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1.5">
                        <Hash className="h-3.5 w-3.5" /> NIP
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{detail.header.nip || '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1.5">
                        <Receipt className="h-3.5 w-3.5" /> Numer obcy
                      </div>
                      <div className="text-sm font-semibold text-gray-900 truncate" title={detail.header.numer_obcy || ''}>{detail.header.numer_obcy || '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1.5">
                        <Package className="h-3.5 w-3.5" /> Pozycji
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{detail.pozycje.length}</div>
                    </div>
                  </div>

                  {/* Tabela pozycji — zebra, czytelna, z podsumowaniem kolumn */}
                  <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="text-left font-semibold px-4 py-3">Nazwa</th>
                          <th className="text-center font-semibold px-4 py-3 whitespace-nowrap">Indeks</th>
                          <th className="text-right font-semibold px-4 py-3">Ilość</th>
                          <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Cena netto</th>
                          <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Wartość netto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.pozycje.map((p, idx) => (
                          <tr key={idx} className={`${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-blue-50/40 transition-colors`}>
                            <td className="px-4 py-3 text-gray-800">{p.nazwa || '-'}</td>
                            <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs whitespace-nowrap">{p.indeks || '-'}</td>
                            <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{(p.ilosc ?? 0).toLocaleString('pl-PL')}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{formatCurrency(p.cena)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                              {formatCurrency((p.ilosc ?? 0) * (p.cena ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-gray-700 font-semibold">
                        <tr>
                          <td className="px-4 py-3 text-right text-xs uppercase tracking-wide text-gray-400" colSpan={2}>Razem</td>
                          <td className="px-4 py-3 text-right tabular-nums">{sumSztuk.toLocaleString('pl-PL')}</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{formatCurrency(sumNetto)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* ============ SEKCJA PRZYPISANIA (krok 4c) ============ */}
                  <div className="mt-6 rounded-2xl border border-gray-200 p-5 bg-gray-50/50">
                    {detail.header.assigned_cost_id !== null ? (
                      /* Dokument już przypisany — plakietka statusu */
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-800 border border-green-300">
                          <Check className="h-4 w-4" />
                          Przypisany · koszt #{detail.header.assigned_cost_id}
                        </span>
                        <span className="text-sm text-gray-500">
                          {detail.header.assigned_by || ''}
                          {detail.header.assigned_at ? ` · ${detail.header.assigned_at.slice(0, 10)}` : ''}
                        </span>
                      </div>
                    ) : (
                      /* Formularz przypisania — selecty poziomo + badge oddziału */
                      <>
                        <h4 className="text-sm font-medium text-gray-600 mb-3">
                          Przypisanie kosztu
                          {detail.header.prowizja && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                              Wypłata prowizji
                            </span>
                          )}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={assignOwner}
                            onChange={(e) => handleOwnerChange(e.target.value)}
                            className="h-11 min-w-[180px] border-gray-200 border-2 rounded-lg text-gray-800 px-3 bg-white cursor-pointer"
                          >
                            <option value="">Właściciel kosztu</option>
                            {(detail.header.prowizja ? COMMISSION_COST_OWNERS : COST_OWNERS).map(owner => (
                              <option key={owner} value={owner}>{owner}</option>
                            ))}
                          </select>

                          <select
                            value={assignPh}
                            onChange={(e) => { setAssignPh(e.target.value); setAssignError(null); }}
                            disabled={isPhDisabled}
                            className={`h-11 min-w-[180px] border-gray-200 border-2 rounded-lg px-3 ${
                              isPhDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-800 cursor-pointer'
                            }`}
                          >
                            <option value="">
                              {assignOwner === 'Przedstawiciel' ? 'Wybierz przedstawiciela' : 'Brak przedstawiciela'}
                            </option>
                            {representatives.map(rep => (
                              <option key={rep} value={rep}>{rep}</option>
                            ))}
                          </select>

                          <div className="ml-auto">
                            <button
                              type="button"
                              onClick={handleAssign}
                              disabled={assignLoading}
                              className={`h-11 px-5 rounded-lg text-sm font-medium text-white ${
                                assignLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {assignLoading ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Przypisywanie...
                                </span>
                              ) : (
                                'Przypisz koszt'
                              )}
                            </button>
                          </div>
                        </div>

                        {assignError && (
                          <p className="mt-2 text-sm text-red-600">{assignError}</p>
                        )}
                      </>
                    )}
                  </div>
                  {/* ============ KONIEC SEKCJI PRZYPISANIA ============ */}
                </>
              ) : null}
            </div>

            {/* Podsumowanie dokumentu — brutto na lewo, netto/VAT na prawo */}
            {detail && !detailLoading && !detailError && (
              <div className="border-t border-gray-200 px-7 py-5 bg-gradient-to-br from-gray-50 to-gray-100/50">
                <div className="flex items-stretch justify-between gap-6">
                  <div className="text-left pr-6 border-r border-gray-300 flex flex-col justify-end">
                    <div className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Brutto</div>
                    <div className="text-2xl font-bold text-blue-700 tabular-nums leading-tight">{formatCurrency(detail.header.brutto)}</div>
                  </div>
                  <div className="flex items-end">
                    <div className="text-right pr-8">
                      <div className="text-xs text-gray-400 font-medium">Netto</div>
                      <div className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(detail.header.netto)}</div>
                    </div>
                    <div className="text-right pl-8 border-l border-gray-300">
                      <div className="text-xs text-gray-400 font-medium">VAT</div>
                      <div className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(detail.header.vat)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CostsViewIluo;