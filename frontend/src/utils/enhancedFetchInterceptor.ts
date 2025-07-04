'use client';

// utils/enhancedFetchInterceptor.ts
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Rozszerzony RequestManager - z obsługą anulowania zapytań przy zmianie roku
 */
class EnhancedRequestManager {
  private static instance: EnhancedRequestManager;
  private controllers: Map<string, AbortController[]> = new Map();
  private originalFetch: typeof fetch | null = null;
  private isInitialized = false;
  private debugMode = false;

  private constructor() {
    // Inicjalizacja nastąpi później
  }

  public static getInstance(): EnhancedRequestManager {
    if (!EnhancedRequestManager.instance) {
      EnhancedRequestManager.instance = new EnhancedRequestManager();
    }
    return EnhancedRequestManager.instance;
  }

  public enableDebug(enabled: boolean = true): void {
    this.debugMode = enabled;
  }

  public initialize(): boolean {
    // Inicjalizujemy tylko raz i tylko po stronie klienta
    if (this.isInitialized || typeof window === 'undefined') {
      return false;
    }

    try {
      this.originalFetch = window.fetch.bind(window);
      this.isInitialized = true;
      this.logDebug('RequestManager zainicjalizowany');
      return true;
    } catch (error) {
      console.error('Nie udało się zainicjalizować EnhancedRequestManager:', error);
      return false;
    }
  }

  public setupFetchInterceptor(requestContext: string): void {
    // Sprawdzamy czy jesteśmy zainicjalizowani
    if (!this.isInitialized || !this.originalFetch) {
      return;
    }

    // Nadpisanie globalnej funkcji fetch tylko jeśli jeszcze tego nie zrobiliśmy
    if (window.fetch !== this.interceptFetch.bind(this, requestContext)) {
      const self = this; // Zachowujemy referencję do this
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        return self.interceptFetch(requestContext, input, init);
      };
      this.logDebug(`Fetch interceptor ustawiony dla kontekstu: ${requestContext}`);
    }
  }

  private interceptFetch(requestContext: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Tworzenie nowego kontrolera dla tego zapytania
    const controller = new AbortController();
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    // Zapewnienie istnienia tablicy kontrolerów dla bieżącego kontekstu
    if (!this.controllers.has(requestContext)) {
      this.controllers.set(requestContext, []);
    }

    // Dodanie kontrolera do listy
    this.controllers.get(requestContext)?.push(controller);

    // Przygotowanie zmodyfikowanych opcji
    const modifiedInit: RequestInit = { ...(init || {}) };

    // Obsługa istniejących sygnałów anulowania
    if (init?.signal) {
      const originalSignal = init.signal;
      const onAbort = () => {
        controller.abort(originalSignal.reason);
      };

      // Jeśli oryginalny sygnał został już anulowany, anuluj nasz kontroler
      if (originalSignal.aborted) {
        controller.abort(originalSignal.reason);
      } else {
        // W przeciwnym razie nasłuchuj na jego anulowanie
        originalSignal.addEventListener('abort', onAbort);

        // Pamiętaj o usunięciu nasłuchiwania po zakończeniu
        controller.signal.addEventListener('abort', () => {
          originalSignal.removeEventListener('abort', onAbort);
        });
      }
    }

    // Dodanie naszego sygnału anulowania do zapytania
    modifiedInit.signal = controller.signal;

    return this.performFetch(input, modifiedInit, controller, requestContext, url);
  }

  private performFetch(
    input: RequestInfo | URL,
    modifiedInit: RequestInit,
    controller: AbortController,
    requestContext: string,
    url: string
  ): Promise<Response> {
    this.logDebug(`Zapytanie rozpoczęte: ${url} dla kontekstu: ${requestContext}`);

    // Wywołanie oryginalnej funkcji fetch z naszym sygnałem
    return this.originalFetch!(input, modifiedInit)
      .then(response => {
        this.logDebug(`Zapytanie zakończone pomyślnie: ${url}`);
        this.removeController(requestContext, controller);
        // Zwróć oryginalną odpowiedź
        return response;
      })
      .catch(error => {
        // Nie loguj błędów anulowania, to normalne zachowanie
        if (error.name !== 'AbortError') {
          console.error(`Błąd przy zapytaniu: ${url}`, error);
        } else {
          this.logDebug(`Zapytanie anulowane: ${url}`);
        }
        this.removeController(requestContext, controller);
        throw error;
      });
  }

  public cancelRequestsForContext(context: string): void {
    if (!this.isInitialized) {
      return;
    }

    const controllers = this.controllers.get(context) || [];
    if (controllers.length > 0) {
      this.logDebug(`Anulowanie ${controllers.length} zapytań dla kontekstu: ${context}`);
    }

    // Anuluj wszystkie kontrolery dla danego kontekstu
    for (const controller of controllers) {
      try {
        // Sprawdzamy, czy kontroler i jego sygnał istnieją oraz czy sygnał nie jest już anulowany
        if (controller && controller.signal && !controller.signal.aborted) {
          controller.abort(new DOMException("Zmiana kontekstu zapytania", "AbortError"));
        }
      } catch (error) {
        // Ignorujemy błędy związane z anulowaniem, aby nie zaśmiecać konsoli
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Błąd przy anulowaniu zapytania:', error);
        }
      }
    }

    // Wyczyść listę kontrolerów dla tego kontekstu
    this.controllers.delete(context);
  }

  private removeController(context: string, controller: AbortController): void {
    const controllers = this.controllers.get(context);
    if (controllers) {
      const index = controllers.indexOf(controller);
      if (index !== -1) {
        controllers.splice(index, 1);
        this.logDebug(`Kontroler usunięty dla kontekstu: ${context}, pozostało: ${controllers.length}`);
      }
    }
  }

  public restoreOriginalFetch(): void {
    // Przywróć oryginalną implementację fetch
    if (this.isInitialized && this.originalFetch) {
      window.fetch = this.originalFetch;
      this.isInitialized = false;
      this.logDebug('Przywrócono oryginalną funkcję fetch');
    }
  }

  private logDebug(message: string): void {
    if (this.debugMode) {
      console.log(`[EnhancedRequestManager] ${message}`);
    }
  }
}

/**
 * Hook do anulowania zapytań podczas zmiany ścieżki lub kontekstu (np. roku)
 * Kompatybilny z Next.js App Router i React Server Components
 */
export const useEnhancedRequestCancellation = (options?: {
  debug?: boolean,
  contextValue?: string | number | null // Dodatkowa wartość kontekstu (np. rok)
}) => {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const previousContextRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ten efekt oddzielnie obsługuje pierwszą inicjalizację po pierwszym renderowaniu
  // co pomaga uniknąć problemów z hydracją
  useEffect(() => {
    setMounted(true);
  }, []);

  // Główny efekt uruchomi się tylko po pierwszym renderowaniu (gdy mounted=true)
  useEffect(() => {
    if (!mounted) return;

    const requestManager = EnhancedRequestManager.getInstance();

    // Włącz tryb debugowania, jeśli podano w opcjach
    if (options?.debug) {
      requestManager.enableDebug(true);
    }

    const initialized = requestManager.initialize();

    if (!initialized) {
      return; // Nie kontynuuj, jeśli inicjalizacja się nie powiodła
    }

    // Tworzymy złożony kontekst z ścieżki i dodatkowego parametru kontekstu (np. roku)
    const contextValue = options?.contextValue ? String(options.contextValue) : '';
    const currentContext = pathname + (contextValue ? `|${contextValue}` : '');
    const previousContext = previousPathRef.current + (previousContextRef.current ? `|${previousContextRef.current}` : '');

    // Jeśli zmieniliśmy ścieżkę lub kontekst, anuluj zapytania z poprzedniego kontekstu
    if (previousPathRef.current && previousContext !== currentContext) {
      requestManager.cancelRequestsForContext(previousContext);
    }

    // Zaktualizuj referencje do bieżącej ścieżki i kontekstu
    previousPathRef.current = pathname;
    previousContextRef.current = contextValue ? String(contextValue) : null;

    // Skonfiguruj interceptor dla nowego kontekstu
    requestManager.setupFetchInterceptor(currentContext);

    // Cleanup: anuluj zapytania z bieżącego kontekstu przy odmontowaniu
    return () => {
      requestManager.cancelRequestsForContext(currentContext);
    };
  }, [pathname, options?.contextValue, mounted, options?.debug]);
};