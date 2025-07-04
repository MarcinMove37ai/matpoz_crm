'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  /**
   * Lista dozwolonych ról – użytkownik, który nie ma jednej z tych ról, zostanie przekierowany.
   */
  allowedRoles?: string[];
  redirectTo?: string;
}

export function AuthGuard({
  children,
  requireAuth = true,
  allowedRoles,
  redirectTo = '/dashboard'
}: AuthGuardProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Jeśli wymagamy autoryzacji, a użytkownik nie jest zalogowany, przekieruj do login.
      if (requireAuth && !isAuthenticated) {
        router.replace('/login');
        return;
      }

      // Jeśli mamy ograniczenie ról, sprawdź, czy użytkownik ma jedną z dozwolonych ról.
      if (allowedRoles && isAuthenticated && user) {
        if (!allowedRoles.includes(user['custom:role'])) {
          router.replace('/costs');
          return;
        }
      }

      // Jeśli nie wymagamy autoryzacji, a użytkownik jest zalogowany – przekieruj.
      if (!requireAuth && isAuthenticated) {
        router.replace(redirectTo);
      }
    }
  }, [loading, isAuthenticated, requireAuth, allowedRoles, redirectTo, router, user]);

  // Jeśli stan autoryzacji nie jest jeszcze ustalony lub użytkownik nie ma wymaganych uprawnień, nie renderuj zawartości.
  if (loading || (requireAuth && !isAuthenticated)) {
    return null;
  }
  if (allowedRoles && user && !allowedRoles.includes(user['custom:role'])) {
    return null;
  }

  return <>{children}</>;
}
