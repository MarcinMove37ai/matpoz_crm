/**
 * @file src/services/transactions.ts
 * @description Serwis do obsługi zapytań o transakcje
 */

export interface ZeroMarginParams {
  year?: number;
  branch?: string;
  representative?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

export interface ZeroMarginTransaction {
  id: number;
  date: string;
  doc_no: string;
  nip: string;          // API zwraca NIP
  net_value: number;
  profit: number;
  representative: string;
  branch: string;
}

export interface ZeroMarginResponse {
  data: ZeroMarginTransaction[];
  total: number;
  limit: number;
  offset: number;
}

class TransactionsService {
  private readonly apiUrl = '/api/transactions';

  async getZeroMarginTransactions(params: ZeroMarginParams): Promise<ZeroMarginResponse> {
    try {
      // Budowanie parametrów URL
      const queryParams = new URLSearchParams();

      // Dodajemy parametry tylko jeśli mają wartość
      if (params.year) queryParams.append('year', params.year.toString());
      if (params.branch && params.branch !== 'all') queryParams.append('branch', params.branch);
      if (params.representative && params.representative !== 'all') queryParams.append('representative', params.representative);
      if (params.date_from) queryParams.append('date_from', params.date_from);
      if (params.date_to) queryParams.append('date_to', params.date_to);

      // Paginacja
      queryParams.append('limit', params.limit.toString());
      queryParams.append('offset', params.offset.toString());

      const response = await fetch(`${this.apiUrl}/zero-margin?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Błąd pobierania transakcji: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Błąd w transactionsService:', error);
      throw error;
    }
  }
}

export const transactionsService = new TransactionsService();