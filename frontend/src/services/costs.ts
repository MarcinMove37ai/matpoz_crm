import { CostData } from '@/types/costs';

class CostsService {
  private readonly apiUrl = '/api/costs';

  async createCost(costData: CostData) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(costData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Błąd podczas zapisywania kosztu');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas zapisywania kosztu');
    }
  }

  // Nowa metoda do pobierania kosztów
  async getCosts(params: {
    year?: number;
    month?: number;
    branch?: string;
    cost_own?: string;
    cost_kind?: string;
    cost_author?: string;
    cost_ph?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiUrl}?${queryParams.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas pobierania kosztów: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas pobierania kosztów');
    }
  }

  // Nowa metoda do aktualizacji kosztu
  async updateCost(costId: number, costData: CostData, userName: string) {
    try {
      const response = await fetch(`${this.apiUrl}/${costId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...costData,
          current_user: userName  // Dodajemy info o zalogowanym użytkowniku
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas aktualizacji kosztu: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas aktualizacji kosztu');
    }
  }

  // Nowa metoda do usuwania kosztu
  async deleteCost(costId: number, userName: string) {
    try {
      const queryParams = new URLSearchParams({
        current_user: userName  // Przekazujemy info o zalogowanym użytkowniku
      });

      const response = await fetch(`${this.apiUrl}/${costId}?${queryParams.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Błąd podczas usuwania kosztu: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Wystąpił nieznany błąd podczas usuwania kosztu');
    }
  }
}

export const costsService = new CostsService();