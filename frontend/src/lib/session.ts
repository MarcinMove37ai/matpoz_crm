// src/lib/session.ts
import { fetchAuthSession, getCurrentUser, fetchUserAttributes } from '@aws-amplify/auth';

interface SessionValidationResult {
  isValid: boolean;
  userRole?: string;
  locale?: string;  // Dodane pole
}

export async function validateSession(): Promise<SessionValidationResult> {
  try {
    const session = await fetchAuthSession();
    if (!session?.tokens) {
      return { isValid: false };
    }

    const currentUser = await getCurrentUser();
    const attributes = await fetchUserAttributes();

    console.log('Session validation - full attributes:', attributes);

    // Upewnij się, że locale jest poprawnie pobrany
    const locale = attributes.locale || ''; // Usuwamy sprawdzanie custom:locale

    console.log('Session validation - selected locale:', locale);

    const payload = session.tokens?.accessToken?.payload as { 'cognito:groups'?: string[] };
    const groups = payload?.['cognito:groups'] || [];
    const userRole = groups[0] || 'REPRESENTATIVE';

    return {
      isValid: true,
      userRole,
      locale
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false };
  }
}