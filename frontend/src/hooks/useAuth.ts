import { useState, useEffect, useRef, useCallback } from 'react';
import {
  signIn,
  getCurrentUser,
  fetchAuthSession,
  signOut as amplifySignOut,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
} from '@aws-amplify/auth';
import { useRouter } from 'next/navigation';

// Stałe wartości globalne (poza komponentem) - ustalane tylko raz
const isBrowser = typeof window !== 'undefined';
const AUTH_STORAGE_KEY = 'auth_state';
const API_CACHE_KEY = 'user_api_data';
const SESSION_DURATION = 3600000; // 1 godzina w milisekundach
const API_CACHE_DURATION = 300000; // 5 minut w milisekundach
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://crm.move37th.ai';

// Stan globalny dla ograniczenia liczby operacji
let isGlobalCheckingAuth = false;
let globalAuthState: any = null;

// Aktywne zapytania do API (Map klucz -> Promise) dla deduplikacji
const pendingApiRequests = new Map();

interface UserAttributes {
  username: string;
  name: string;
  'custom:role': string;
  email?: string;
  locale?: string;
  fullName?: string;
  branch?: string;
  longitude?: number | null;
  latitude?: number | null;
}

interface UserApiResponse {
  id: number;
  cognito_user_name: string;
  name: string;
  full_name: string;
  position?: string;
  branch?: string;
  longitude?: number | null;
  latitude?: number | null;
}

interface CognitoTokenPayload {
  'cognito:groups'?: string[];
  [key: string]: any;
}

interface StoredAuthState {
  isAuthenticated: boolean;
  userRole?: string;
  username?: string;
  locale?: string;
  fullName?: string;
  branch?: string;
  longitude?: number | null;
  latitude?: number | null;
  timestamp: number;
}

interface CachedApiData {
  data: UserApiResponse;
  timestamp: number;
}

const errorMessages: { [key: string]: string } = {
  UserNotFoundException: 'Nieprawidłowy login lub hasło',
  NotAuthorizedException: 'Nieprawidłowy login lub hasło',
  UserNotConfirmedException: 'Konto nie zostało potwierdzone',
  LimitExceededException: 'Przekroczono limit prób logowania',
  InvalidParameterException: 'Nieprawidłowe dane',
  CodeMismatchException: 'Nieprawidłowy kod weryfikacyjny',
  ExpiredCodeException: 'Kod weryfikacyjny wygasł',
  InvalidPasswordException: 'Hasło nie spełnia wymagań bezpieczeństwa',
};

// Bezpieczne helpery dla przeglądarki
const setCookie = (name: string, value: string, days = 1) => {
  if (!isBrowser) return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

const removeCookie = (name: string) => {
  if (!isBrowser) return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
};

const getCookie = (name: string): string => {
  if (!isBrowser) return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()?.split(';').shift() || '');
  }
  return '';
};

// Pobieranie stanu z localStorage - z wykorzystaniem buforowania
const getStoredAuthState = (): StoredAuthState | null => {
  if (!isBrowser) return null;

  // Użyj globalnego stanu, jeśli istnieje
  if (globalAuthState) {
    return globalAuthState;
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const state = JSON.parse(stored) as StoredAuthState;

    if (Date.now() - state.timestamp > SESSION_DURATION) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    // Zapisz w globalnym stanie
    globalAuthState = state;
    return state;
  } catch (error) {
    return null;
  }
};

// Zapisywanie stanu do localStorage
const setStoredAuthState = (state: Partial<StoredAuthState> | null) => {
  if (!isBrowser) return;

  if (!state) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    globalAuthState = null;
    return;
  }

  const storedState: StoredAuthState = {
    isAuthenticated: state.isAuthenticated || false,
    userRole: state.userRole,
    username: state.username,
    locale: state.locale,
    fullName: state.fullName,
    branch: state.branch,
    longitude: state.longitude,
    latitude: state.latitude,
    timestamp: Date.now()
  };

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedState));
  globalAuthState = storedState;
};

// Cache'owanie danych z API
const getCachedApiData = (username: string): UserApiResponse | null => {
  if (!isBrowser) return null;

  try {
    const cacheKey = `${API_CACHE_KEY}_${username}`;
    const stored = localStorage.getItem(cacheKey);
    if (!stored) {
      return null;
    }

    const cache = JSON.parse(stored) as CachedApiData;

    if (Date.now() - cache.timestamp > API_CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return cache.data;
  } catch (error) {
    return null;
  }
};

const setCachedApiData = (username: string, data: UserApiResponse | null) => {
  if (!isBrowser || !data) return;

  try {
    const cacheKey = `${API_CACHE_KEY}_${username}`;
    const cacheData: CachedApiData = {
      data,
      timestamp: Date.now()
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // Cichy błąd podczas zapisywania cache
  }
};

// Aktualizacja daty - wywołujemy tylko w jednym miejscu - przy logowaniu
const updateConfigCurrentDate = async (): Promise<boolean> => {
  try {
    const apiUrl = `/api/config/update-date`;
    console.log('Aktualizacja daty konfiguracyjnej, URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Błąd odpowiedzi:', response.status, response.statusText);
    }

    return response.ok;
  } catch (error) {
    console.error('Błąd podczas aktualizacji daty konfiguracyjnej:', error);
    return false;
  }
};

// Pobieranie atrybutów użytkownika (prosty accessor)
const getUserAttributes = (currentUser: any): Record<string, string> => {
  return currentUser.attributes || {};
};

// Pobieranie grupy użytkownika
const getUserGroup = async (): Promise<string> => {
  try {
    const session = await fetchAuthSession();
    const payload = session.tokens?.accessToken?.payload as CognitoTokenPayload | undefined;
    const groups = payload?.['cognito:groups'] || [];
    return groups[0] || 'REPRESENTATIVE';
  } catch (error) {
    return 'REPRESENTATIVE';
  }
};

// Pobieranie danych użytkownika z API z deduplikacją zapytań
const fetchUserDetails = async (cognitoUserName: string): Promise<UserApiResponse | null> => {
  // Sprawdź, czy to samo zapytanie jest już w toku
  const requestKey = `api_${cognitoUserName}`;
  if (pendingApiRequests.has(requestKey)) {
    return pendingApiRequests.get(requestKey);
  }

  try {
    // Najpierw sprawdzamy cache
    const cachedData = getCachedApiData(cognitoUserName);
    if (cachedData) {
      return cachedData;
    }

    // Tworzymy nowe zapytanie i zapisujemy je w mapie
    const promise = (async () => {
      try {
        const apiUrl = `/api/users/${cognitoUserName}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          return null;
        }

        const userData = await response.json();
        console.log('Dane użytkownika z API:', userData);
        console.log('Czy zawiera longitude?', userData.hasOwnProperty('longitude'));
        console.log('Czy zawiera latitude?', userData.hasOwnProperty('latitude'));
        console.log('Wartość longitude:', userData.longitude);
        console.log('Wartość latitude:', userData.latitude);

        // Zapisujemy dane w cache
        setCachedApiData(cognitoUserName, userData);

        return userData;
      } catch (error) {
        return null;
      } finally {
        // Usuwamy zapytanie z mapy po zakończeniu
        pendingApiRequests.delete(requestKey);
      }
    })();

    // Zapisujemy obietnicę w mapie aktywnych zapytań
    pendingApiRequests.set(requestKey, promise);

    return promise;
  } catch (error) {
    pendingApiRequests.delete(requestKey);
    return null;
  }
};

// Hook dla autentykacji
export const useAuth = () => {
  // Podczas renderowania po stronie serwera, zwracamy domyślne wartości
  if (!isBrowser) {
    return {
      signIn: async () => false,
      signOut: async () => {},
      resetPassword: async () => false,
      confirmResetPassword: async () => false,
      checkAuthState: async () => false,
      loading: false,
      error: null,
      isAuthenticated: false,
      user: null,
      userRole: '',
      userBranch: '',
      userFullName: '',
      userLongitude: null,
      userLatitude: null
    };
  }

  // Po stronie klienta używamy danych z cache/localStorage
  const storedState = getStoredAuthState();

  // Stan kontrolujący, czy komponent jest zamontowany
  const mountedRef = useRef(true);

  // Flaga debounce dla odświeżania danych
  const isRefreshingRef = useRef(false);

  // Ostatni timestamp odświeżania danych
  const lastRefreshRef = useRef(0);

  // Deklaracja stanów React
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(storedState?.isAuthenticated || false);
  const [user, setUser] = useState<UserAttributes | null>(
    storedState
      ? {
          username: storedState.username || '',
          name: storedState.username || '',
          'custom:role': storedState.userRole || 'REPRESENTATIVE',
          locale: storedState.locale,
          fullName: storedState.fullName,
          branch: storedState.branch,
          longitude: storedState.longitude,
          latitude: storedState.latitude
        }
      : null
  );
  const [userRole, setUserRole] = useState(storedState?.userRole || '');
  const [userBranch, setUserBranch] = useState(storedState?.branch || '');
  const [userFullName, setUserFullName] = useState(storedState?.fullName || '');
  const [userLongitude, setUserLongitude] = useState<number | null>(storedState?.longitude || null);
  const [userLatitude, setUserLatitude] = useState<number | null>(storedState?.latitude || null);

  const router = useRouter();

  // Funkcja do czyszczenia stanu autentykacji
  const clearAuthState = useCallback(() => {
    if (!mountedRef.current) return;

    setIsAuthenticated(false);
    setUser(null);
    setUserRole('');
    setUserBranch('');
    setUserFullName('');
    setUserLongitude(null);
    setUserLatitude(null);
    setStoredAuthState(null);

    // Usuwamy ciasteczka
    removeCookie('userRole');
    removeCookie('userName');
    removeCookie('userLocale');
    removeCookie('userFullName');
    removeCookie('userBranch');
    removeCookie('userLongitude');
    removeCookie('userLatitude');
  }, []);

  // Funkcja do sprawdzania i odświeżania stanu autentykacji
  const checkAuthState = useCallback(async () => {
    // Blokada przed wielokrotnym wywołaniem
    if (isGlobalCheckingAuth) {
      return isAuthenticated;
    }

    // Sprawdzanie, czy komponent jest zamontowany
    if (!mountedRef.current) {
      return false;
    }

    try {
      isGlobalCheckingAuth = true;
      setLoading(true);

      const session = await fetchAuthSession();

      if (!session?.tokens) {
        clearAuthState();
        return false;
      }

      const currentUser = await getCurrentUser();

      // Równoległe wykonanie zapytań o grupę użytkownika i dane z API
      const [userGroup, userDetails] = await Promise.all([
        getUserGroup(),
        fetchUserDetails(currentUser.username)
      ]);

      // Pobieramy atrybuty synchronicznie
      const attributes = getUserAttributes(currentUser);

      // Sprawdzamy, czy komponent jest nadal zamontowany
      if (!mountedRef.current) {
        return false;
      }

      const userLocale = attributes?.locale || attributes?.['custom:locale'] || '';
      const userName = userDetails?.name || currentUser.username;
      const userFullNameValue = userDetails?.full_name || '';
      const userBranchValue = userDetails?.branch || '';
      const userLongitudeValue = userDetails?.longitude || null;
      const userLatitudeValue = userDetails?.latitude || null;

      const newUser: UserAttributes = {
        username: currentUser.username,
        name: userName,
        'custom:role': userGroup,
        email: attributes?.email,
        locale: userLocale,
        fullName: userFullNameValue,
        branch: userBranchValue,
        longitude: userLongitudeValue,
        latitude: userLatitudeValue
      };

      // Aktualizacja stanów React
      setUser(newUser);
      setIsAuthenticated(true);
      setUserRole(userGroup);
      setUserBranch(userBranchValue);
      setUserFullName(userFullNameValue);
      setUserLongitude(userLongitudeValue);
      setUserLatitude(userLatitudeValue);

      // Zapisujemy dane w localStorage
      setStoredAuthState({
        isAuthenticated: true,
        userRole: userGroup,
        username: currentUser.username,
        locale: userLocale,
        fullName: userFullNameValue,
        branch: userBranchValue,
        longitude: userLongitudeValue,
        latitude: userLatitudeValue
      });

      // Ustawiamy ciasteczka jako kopię zapasową
      setCookie('userRole', userGroup);
      setCookie('userName', userName);
      setCookie('userLocale', userLocale);
      setCookie('userFullName', userFullNameValue);
      setCookie('userBranch', userBranchValue);
      if (userLongitudeValue !== null) {
        setCookie('userLongitude', userLongitudeValue.toString());
      }
      if (userLatitudeValue !== null) {
        setCookie('userLatitude', userLatitudeValue.toString());
      }

      return true;
    } catch (err) {
      if (mountedRef.current) {
        clearAuthState();
      }
      return false;
    } finally {
      isGlobalCheckingAuth = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [clearAuthState, isAuthenticated]);

  // Funkcja do odświeżania danych użytkownika w tle (z debounce)
  const refreshUserData = useCallback(async () => {
    // Sprawdzamy czy powinniśmy odświeżać (min. czas między odświeżeniami: 30s)
    const now = Date.now();
    if (now - lastRefreshRef.current < 30000) {
      return;
    }

    // Sprawdzamy, czy trwa już odświeżanie
    if (isRefreshingRef.current || !user?.username || !mountedRef.current) {
      return;
    }

    try {
      isRefreshingRef.current = true;
      lastRefreshRef.current = now;

      const userDetails = await fetchUserDetails(user.username);

      if (!mountedRef.current) {
        return;
      }

      if (userDetails && (
          userDetails.full_name !== userFullName ||
          userDetails.branch !== userBranch ||
          userDetails.longitude !== userLongitude ||
          userDetails.latitude !== userLatitude
        )) {
        // Aktualizacja stanów
        setUserFullName(userDetails.full_name);
        setUserBranch(userDetails.branch || '');
        setUserLongitude(userDetails.longitude || null);
        setUserLatitude(userDetails.latitude || null);

        // Aktualizujemy localStorage
        const currentStoredState = getStoredAuthState();
        if (currentStoredState) {
          setStoredAuthState({
            ...currentStoredState,
            fullName: userDetails.full_name,
            branch: userDetails.branch,
            longitude: userDetails.longitude,
            latitude: userDetails.latitude
          });
        }

        // Aktualizujemy cookies
        setCookie('userFullName', userDetails.full_name);
        setCookie('userBranch', userDetails.branch || '');
        if (userDetails.longitude !== null && userDetails.longitude !== undefined) {
          setCookie('userLongitude', userDetails.longitude.toString());
        }
        if (userDetails.latitude !== null && userDetails.latitude !== undefined) {
          setCookie('userLatitude', userDetails.latitude.toString());
        }
      }
    } catch (error) {
      // Cicha obsługa błędów odświeżania w tle
    } finally {
      isRefreshingRef.current = false;
    }
  }, [user, userFullName, userBranch, userLongitude, userLatitude]);

  // Efekt dla inicjalizacji i czyszczenia
  useEffect(() => {
    mountedRef.current = true;

    // Funkcja inicjująca - wykonywana tylko raz
    const initAuth = async () => {
      if (!storedState && !isAuthenticated) {
        await checkAuthState();
      } else if (storedState && user?.username) {
        // Odświeżanie danych w tle, ale tylko jeśli minęło wystarczająco dużo czasu
        refreshUserData();
      }
    };

    // Wykonajmy inicjalizację bez blokowania renderowania
    initAuth();

    // Funkcja czyszcząca
    return () => {
      mountedRef.current = false;
    };
  }, [storedState, checkAuthState, refreshUserData, isAuthenticated, user]);

  // Funkcja logowania
  const handleSignIn = useCallback(async (username: string, password: string): Promise<{ success: boolean; role?: string } | boolean> => {
    if (!mountedRef.current) return false;

    setLoading(true);
    setError(null);

    try {
      const signInResult = await signIn({
        username,
        password,
        options: { authFlowType: "USER_PASSWORD_AUTH" }
      });

      if (!mountedRef.current) return false;

      if (signInResult?.isSignedIn) {
        // Proaktywne pobieranie danych
        const currentUser = await getCurrentUser();

        // Proaktywnie zacznij pobierać dane z API, ale nie czekaj
        fetchUserDetails(currentUser.username).catch(() => {});

        // Aktualizujemy datę w config_current_date - TYLKO TUTAJ
        updateConfigCurrentDate().catch(e =>
          console.error('Błąd podczas aktualizacji daty konfiguracyjnej:', e)
        );

        // Sprawdź pełny stan autentykacji
        const authStateResult = await checkAuthState();

        if (!mountedRef.current) return false;

        // Pobierz grupę użytkownika dla routingu
        const userGroup = await getUserGroup();

        if (!mountedRef.current) return false;

        if (!userGroup) {
          setError('Brak uprawnień dostępu');
          return false;
        }

        return { success: true, role: userGroup };
      }

      setError('Błąd logowania');
      return false;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(errorMessages[err.name] || 'Błąd logowania');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [checkAuthState, router]);

  // Funkcja wylogowania
  const handleSignOut = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    try {
      await amplifySignOut({ global: true });

      if (mountedRef.current) {
        clearAuthState();
        router.replace('/login');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Błąd wylogowania');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [clearAuthState, router]);

  // Funkcja resetowania hasła
  const handleResetPassword = useCallback(async (username: string) => {
    if (!mountedRef.current) return false;

    setLoading(true);
    setError(null);
    try {
      await amplifyResetPassword({ username });
      return true;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(errorMessages[err.name] || 'Błąd resetowania hasła');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Funkcja potwierdzania resetowania hasła
  const handleConfirmResetPassword = useCallback(async (
    username: string,
    code: string,
    newPassword: string
  ) => {
    if (!mountedRef.current) return false;

    setLoading(true);
    setError(null);
    try {
      await amplifyConfirmResetPassword({
        username,
        confirmationCode: code,
        newPassword
      });
      return true;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(errorMessages[err.name] || 'Błąd potwierdzania resetu hasła');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return {
    signIn: handleSignIn,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    confirmResetPassword: handleConfirmResetPassword,
    checkAuthState,
    loading,
    error,
    isAuthenticated,
    user,
    userRole,
    userBranch,
    userFullName,
    userLongitude,
    userLatitude
  };
};