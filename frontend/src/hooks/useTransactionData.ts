// hooks/useTransactionData.ts
import { useState, useEffect } from 'react';

interface YearTotalsResponse {
  year_totals: {
    total: {
      net_sales: number;
      profit: number;
      net_sales_paid: number;
      profit_paid: number;
    };
    representatives: {
      net_sales: number;
      profit: number;
    };
    branches: {
      [key: string]: {
        net_sales: number;
        profit: number;
      };
    };
  };
}

interface StatsResponse {
  daily: {
    branches: {
      total: {
        net_sales: number;
        profit: number;
        net_sales_paid: number;
        profit_paid: number;
      };
      details: Record<string, {
        net_sales: number;
        profit: number;
      }>;
    };
    representatives: {
      total: {
        net_sales: number;
        profit: number;
      };
    };
  };
  monthly: {
    branches: {
      total: {
        net_sales: number;
        profit: number;
        net_sales_paid: number;
        profit_paid: number;
      };
      details: Record<string, {
        net_sales: number;
        profit: number;
      }>;
    };
    representatives: {
      total: {
        net_sales: number;
        profit: number;
      };
    };
  };
}

interface HistoricalResponse {
  historical: Array<{
    month: string;
    branches: {
      total: {
        net_sales: number;
        profit: number;
        net_sales_paid: number;
        profit_paid: number;
      };
      details: Record<string, {
        net_sales: number;
        profit: number;
      }>;
    };
    representatives: {
      total: {
        net_sales: number;
        profit: number;
      };
    };
  }>;
}

export interface TransactionData {
  netSales: number;
  profit: number;
  paidSales: number;
  paidProfit: number;
}

export interface BranchData {
  total: TransactionData;
  daily: TransactionData;
  monthly: TransactionData;
  historical: Array<TransactionData & { month: string }>;
}

const defaultData: BranchData = {
  total: { netSales: 0, profit: 0, paidSales: 0, paidProfit: 0 },
  daily: { netSales: 0, profit: 0, paidSales: 0, paidProfit: 0 },
  monthly: { netSales: 0, profit: 0, paidSales: 0, paidProfit: 0 },
  historical: [],
};

const API_BASE = '/api';

async function fetchWithRetry(url: string, retries = 3, delayMs = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to fetch data");
}

function transformBranchTotals(data: StatsResponse['daily']['branches']['total'] | StatsResponse['monthly']['branches']['total']): TransactionData {
  return {
    netSales: data.net_sales || 0,
    profit: data.profit || 0,
    paidSales: data.net_sales_paid || 0,
    paidProfit: data.profit_paid || 0,
  };
}

export function useTransactionData(
  branchName?: string,
  options: { isRepresentative?: boolean } = {}
): { data: BranchData; loading: boolean; error: string | null } {
  const [data, setData] = useState<BranchData>(defaultData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);

        // Fetch all required data in parallel
        const [statsResponse, historyResponse, yearTotalsResponse] = await Promise.all([
          fetchWithRetry(`${API_BASE}/first_stats`),
          fetchWithRetry(`${API_BASE}/second_stats`),
          fetchWithRetry(`${API_BASE}/sum_stats`)
        ]);

        const [statsData, historyData, yearTotalsData]: [
          StatsResponse,
          HistoricalResponse,
          YearTotalsResponse
        ] = await Promise.all([
          statsResponse.json(),
          historyResponse.json(),
          yearTotalsResponse.json()
        ]);

        if (!isMounted) return;

        if (options.isRepresentative) {
          // Handle representative data
          const newData = {
            daily: {
              netSales: statsData.daily.representatives.total.net_sales,
              profit: statsData.daily.representatives.total.profit,
              paidSales: 0,
              paidProfit: 0,
            },
            monthly: {
              netSales: statsData.monthly.representatives.total.net_sales,
              profit: statsData.monthly.representatives.total.profit,
              paidSales: 0,
              paidProfit: 0,
            },
            total: {
              netSales: yearTotalsData.year_totals.representatives.net_sales,
              profit: yearTotalsData.year_totals.representatives.profit,
              paidSales: 0,
              paidProfit: 0,
            },
            historical: historyData.historical.map(item => ({
              month: item.month,
              netSales: item.representatives.total.net_sales,
              profit: item.representatives.total.profit,
              paidSales: 0,
              paidProfit: 0,
            })),
          };
          setData(newData);
        } else if (branchName) {
          // Handle specific branch data
          const newData = {
            daily: {
              netSales: statsData.daily.branches.details[branchName]?.net_sales || 0,
              profit: statsData.daily.branches.details[branchName]?.profit || 0,
              paidSales: 0,
              paidProfit: 0,
            },
            monthly: {
              netSales: statsData.monthly.branches.details[branchName]?.net_sales || 0,
              profit: statsData.monthly.branches.details[branchName]?.profit || 0,
              paidSales: 0,
              paidProfit: 0,
            },
            total: {
              netSales: yearTotalsData.year_totals.branches[branchName]?.net_sales || 0,
              profit: yearTotalsData.year_totals.branches[branchName]?.profit || 0,
              paidSales: 0,
              paidProfit: 0,
            },
            historical: historyData.historical.map(item => ({
              month: item.month,
              netSales: item.branches.details[branchName]?.net_sales || 0,
              profit: item.branches.details[branchName]?.profit || 0,
              paidSales: 0,
              paidProfit: 0,
            })),
          };
          setData(newData);
        } else {
          // Handle summary data (SUMA)
          const newData = {
            daily: transformBranchTotals(statsData.daily.branches.total),
            monthly: transformBranchTotals(statsData.monthly.branches.total),
            total: {
              netSales: yearTotalsData.year_totals.total.net_sales,
              profit: yearTotalsData.year_totals.total.profit,
              paidSales: yearTotalsData.year_totals.total.net_sales_paid,
              paidProfit: yearTotalsData.year_totals.total.profit_paid,
            },
            historical: historyData.historical.map(item => ({
              month: item.month,
              netSales: item.branches.total.net_sales || 0,
              profit: item.branches.total.profit || 0,
              paidSales: item.branches.total.net_sales_paid || 0,
              paidProfit: item.branches.total.profit_paid || 0,
            })),
          };
          setData(newData);
        }

        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        if (isMounted) {
          setError(err.message || 'Błąd pobierania danych');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [branchName, options.isRepresentative]);

  return { data, loading, error };
}