/**
 * @file src/services/costsRaw.ts
 * @description Warstwa serwisowa dla modułu "Koszty ILUO (beta)" (tabela costs_raw / ERP).
 *              Styl spójny z services/costs.ts.
 *
 * KROK 2b: oddzial (KOD legacy) + oddzial_display (nazwa) z backendu.
 * KROK 3:  odpowiedź listy niesie stan flag produkcyjnych.
 * KROK 4:  status przypisania w nagłówku + metoda assign().
 */

// Płaski nagłówek dokumentu (lista)
export interface CostRawHeader {
  id: number;
  numer: string | null;
  data: string | null;
  nip: string | null;
  nazwa_skrocona: string | null;
  netto: number | null;
  vat: number | null;
  brutto: number | null;
  etykieta: string | null;
  punkt_handlowy: string | null;
  oddzial: string | null;          // KOD legacy (np. "Pcim", "HQ", "MG", "Private")
  oddzial_display: string | null;  // nazwa wyświetlana (np. "Centrala", "Sklep internetowy")
  numer_obcy: string | null;
  liczba_pozycji: number;
  prowizja: boolean;  // dokument prowizyjny (Prowizja - KOSZT) — właściciel tylko Oddział/PH
  // Status przypisania (krok 4)
  assigned_cost_id: number | null; // cost_id w all_costs; null = nieprzypisany
  assigned_at: string | null;
  assigned_by: string | null;
}

// Odpowiedź listy (paginowana)
export interface CostRawListResponse {
  data: CostRawHeader[];
  total: number;
  total_sum: number;
  total_sum_netto: number;
  limit: number;
  offset: number;
  // Flagi produkcyjne (źródło: backend) — patrz routes/costs_raw.py
  require_label: boolean;
  date_filter_enabled: boolean;
  min_date: string | null;
}

// Pojedyncza pozycja dokumentu (modal)
export interface CostRawPosition {
  indeks: string | null;
  nazwa: string | null;
  ilosc: number | null;
  cena: number | null;
  vat: number | null;
}

// Szczegóły dokumentu: nagłówek + pozycje
export interface CostRawDetail {
  header: CostRawHeader;
  pozycje: CostRawPosition[];
}

// Body przypisania własności (krok 4)
export interface CostRawAssignRequest {
  cost_own: string;          // Wspólny | Oddział | Centrala | Przedstawiciel
  cost_ph: string | null;    // wymagany dla "Przedstawiciel"
  author: string;
}

// Wynik przypisania (krok 4)
export interface CostRawAssignResponse {
  cost_id: number;
  assigned_at: string;
  cost_branch: string;
  cost_mo: number;
  cost_year: number;
  cost_value: number;
}

class CostsRawService {
  private readonly apiUrl = '/api/costs-iluo';

  // Lista dokumentów (same nagłówki, paginowane)
  async getList(params: {
    oddzial?: string;
    wyklucz_oddzialy?: string;
    szukaj?: string;
    nazwa_like?: string;
    numer_like?: string;
    ma_etykiete?: boolean;
    przypisane?: boolean;
    data_od?: string;
    data_do?: string;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<CostRawListResponse> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiUrl}?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas pobierania kosztów ILUO: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas pobierania kosztów ILUO');
    }
  }

  // Szczegóły jednego dokumentu (nagłówek + pozycje) — dla modala
  async getDetail(costId: number): Promise<CostRawDetail> {
    try {
      const response = await fetch(`${this.apiUrl}/${costId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas pobierania szczegółów dokumentu: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas pobierania szczegółów dokumentu');
    }
  }

  // Przypisanie własności kosztu -> tworzy rekord w all_costs (krok 4)
  async assign(costId: number, body: CostRawAssignRequest): Promise<CostRawAssignResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/${costId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas przypisywania kosztu: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas przypisywania kosztu');
    }
  }

  // Lista unikalnych KODÓW oddziałów (legacy cost_branch) — do dropdownu filtra
  async getBranches(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/branches`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas pobierania oddziałów: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas pobierania oddziałów');
    }
  }
}

export const costsRawService = new CostsRawService();