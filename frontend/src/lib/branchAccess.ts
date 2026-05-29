// Oddziały (rola BRANCH) z dostępem do widoku "Zyski (Oddział)".
// Dodanie kolejnego oddziału = dopisanie jednej pozycji TUTAJ (jedyne miejsce edycji).
// Wartości lowercase, identycznie jak klucze w 'mapping' w BranchProfitsView
// (uwaga na polskie znaki: 'łomża', 'myślibórz').
export const BRANCH_PROFIT_ACCESS: string[] = ['malbork'];

// Sprawdza, czy dany oddział (rola BRANCH) ma dostęp do widoku zysków oddziału.
// Bezpieczne na undefined/null oraz wielkość liter.
export const hasBranchProfitAccess = (branch?: string | null): boolean =>
  !!branch && BRANCH_PROFIT_ACCESS.includes(branch.toLowerCase());