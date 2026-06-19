/**
 * @file src/services/costsRaw.ts
 * @description Warstwa serwisowa dla modułu "Koszty ILUO (beta)" (tabela costs_raw / ERP).
 *              Styl spójny z services/costs.ts.
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
  oddzial: string | null;
  numer_obcy: string | null;
  liczba_pozycji: number;
}

// Odpowiedź listy (paginowana)
export interface CostRawListResponse {
  data: CostRawHeader[];
  total: number;
  total_sum: number;
  total_sum_netto: number;
  limit: number;
  offset: number;
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

class CostsRawService {
  private readonly apiUrl = '/api/costs-iluo';

  // Lista dokumentów (same nagłówki, paginowane)
  async getList(params: {
    oddzial?: string;
    szukaj?: string;
    nazwa_like?: string;
    numer_like?: string;
    ma_etykiete?: boolean;
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

  // Lista unikalnych oddziałów (punkt_handlowy) — do dropdownu filtra
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