/**
 * @file src/lib/branchDictionary.ts
 * @description Słownik etykiet oddziałów dla modułów kosztów.
 *
 * KROK 2b (audyt 2026-07): ŹRÓDŁEM PRAWDY oddziału jest BACKEND
 * (routes/costs_raw.py). API zwraca:
 *   - oddzial          -> KOD legacy (all_costs.cost_branch), np. "Pcim", "HQ"
 *   - oddzial_display  -> nazwa prezentacyjna wiersza, np. "Sklep internetowy"
 *
 * Front NIE wyznacza już oddziału z numeru dokumentu ani z punkt_handlowy.
 * Ten plik utrzymuje wyłącznie mapkę KOD -> ETYKIETA na potrzeby elementów
 * UI, które operują na kodach (np. dropdown filtra zasilany z /branches).
 * Mapowanie zgodne z getBranchDisplayName z CostsView (legacy).
 */

// KOD legacy (all_costs.cost_branch) -> etykieta w UI
export const BRANCH_CODE_DISPLAY: Record<string, string> = {
  HQ: 'Centrala',
  STH: 'Serwis',
  Private: 'Prywatny',
  MG: 'Interent', // pisownia spójna z legacy CostsView; obejmuje sklep internetowy (INT)
};

/**
 * Etykieta UI dla kodu oddziału legacy.
 * Kody bez wpisu w mapie (Pcim, Rzgów, Malbork, Lublin, Łomża, Myślibórz, BHP)
 * wyświetlają się wprost.
 */
export function getBranchDisplayName(branchCode: string | null | undefined): string {
  if (!branchCode) return '-';
  return BRANCH_CODE_DISPLAY[branchCode] || branchCode;
}