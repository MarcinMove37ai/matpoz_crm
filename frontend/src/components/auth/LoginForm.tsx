'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (isAuthenticated) {
      console.log('Użytkownik zalogowany, przekierowanie na:', redirect);
      router.replace(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signIn(username, password);
    if (success) {
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.replace(redirect);
    }
  };

  // Nie renderuj formularza jeśli użytkownik jest zalogowany
  if (isAuthenticated) {
    return null;
  }

  const resetSuccess = searchParams.get('reset') === 'success';

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-sm mx-auto">
      {resetSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-3 py-2 rounded relative text-sm">
          Hasło zostało pomyślnie zresetowane. Możesz się teraz zalogować.
        </div>
      )}

      {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded relative text-sm">
            <span className="block text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Login
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                disabled={loading}
              />
            </div>
          </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Hasło
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link
                href="/reset-password"
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Zapomniałeś hasła?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </div>
      </form>
    </div>
  );
}
