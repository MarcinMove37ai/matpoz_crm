/**
 * @file src/lib/branchDictionary.ts
 * @description Wspólny słownik oddziałów dla modułów kosztów.
 *
 * ŹRÓDŁO PRAWDY OODDZIAŁU: prefiks w numerze dokumentu (np. "FZ RZG/..." -> Rzgów).
 * Pole punkt_handlowy z ERP bywa mylące (np. dokument RZG ma punkt_handlowy "MAT-POŻ"),
 * dlatego oddział wyznaczamy z numeru, a punkt_handlowy służy TYLKO jako fallback,
 * gdy prefiksu nie ma w słowniku.
 *
 * Nazwy docelowe są zgodne ze słownikiem cost_branch z tabeli all_costs
 * (ten sam, którego używa CostsView), aby interpretacja była identyczna.
 */

// Prefiks numeru dokumentu -> kanoniczna nazwa oddziału (cost_branch)
export const BRANCH_PREFIX_MAP: Record<string, string> = {
  RZG: 'Rzgów',
  MAL: 'Malbork',
  PCI: 'Pcim',
  LOM: 'Łomża',
  MYS: 'Myślibórz',
  LUB: 'Lublin',
  MG: 'Centrala',   // MG w dokumencie = centrala (HQ)
  STH: 'Serwis',    // STH w dokumencie = serwis
};

/**
 * Wyciąga prefiks oddziału z numeru dokumentu.
 * Obsługuje faktury (FZ) i korekty (KFZ).
 * Przykłady: "FZ RZG/26/01/0008" -> "RZG", "KFZ LOM/25/11/0002" -> "LOM".
 * Zwraca null, gdy numer nie pasuje do wzorca.
 */
export function extractBranchPrefix(numer: string | null | undefined): string | null {
  if (!numer) return null;
  const match = numer.match(/^K?FZ\s+([A-ZŁ]+)\//);
  return match ? match[1] : null;
}

/**
 * Wyznacza nazwę oddziału dla dokumentu kosztowego.
 * 1. Prefiks z numeru -> nazwa ze słownika (źródło prawdy).
 * 2. Fallback: surowy punkt_handlowy (gdy prefiks nieznany lub brak).
 * 3. Ostatecznie '-' gdy nie ma żadnej informacji.
 */
export function resolveBranchName(
  numer: string | null | undefined,
  punktHandlowy: string | null | undefined,
): string {
  const prefix = extractBranchPrefix(numer);
  if (prefix && BRANCH_PREFIX_MAP[prefix]) {
    return BRANCH_PREFIX_MAP[prefix];
  }
  // Fallback na punkt_handlowy (nierozpoznany prefiks)
  const fallback = (punktHandlowy || '').trim();
  return fallback !== '' ? fallback : '-';
}