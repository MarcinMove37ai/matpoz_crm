// hooks/useCurrentDate.ts
import { useState, useEffect } from 'react';

interface DateResponse {
  date: string;
  year: number;
  month: number;
  day: number;
}

export const useCurrentDate = () => {
  const [date, setDate] = useState<DateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDate = async () => {
      try {
        const response = await fetch('/api/date');
        if (!response.ok) {
          throw new Error('Failed to fetch date');
        }
        const data = await response.json();
        setDate(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching date');
      } finally {
        setLoading(false);
      }
    };

    fetchDate();
  }, []);

  const formatDate = (mobile: boolean = false) => {
    if (!date) return '';

    const dateObj = new Date(date.date);

    if (mobile) {
      return dateObj.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }

    return dateObj.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return { date, loading, error, formatDate };
};