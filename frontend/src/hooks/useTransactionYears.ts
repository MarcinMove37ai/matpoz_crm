import { useState, useEffect } from 'react';

interface YearResponse {
  years: number[];
  currentYear: number;
}

export const useTransactionYears = () => {
  const [data, setData] = useState<YearResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/years');
        if (!response.ok) {
          throw new Error('Failed to fetch years');
        }
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching years');
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
  }, []);

  return { data, loading, error };
};