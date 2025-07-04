import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Odczytanie parametrów zapytania
    const branch = searchParams.get('branch');
    const status_free = searchParams.get('status_free');
    
    // Przygotowanie parametrów do przekazania do backendu
    const params = new URLSearchParams();
    if (branch && branch !== "all") params.append('branch', branch);
    if (status_free) params.append('status_free', status_free);
    
    // Adres backendu FastAPI (ustaw właściwy URL)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    
    // Logowanie dla debugowania
    console.log(`Próba połączenia z backendem pod adresem: ${backendUrl}`);
    console.log(`Wysyłanie zapytania do ${backendUrl}/clients/map?${params.toString()}`);

    // Wykonanie zapytania do backendu z dodatkowym timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 sekund timeout

    const response = await fetch(`${backendUrl}/clients/map?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Pełniejsze logowanie odpowiedzi
    console.log('Status odpowiedzi:', response.status);
    console.log('Nagłówki odpowiedzi:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Próba odczytania tekstu błędu
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (error) {
        errorText = "Nie udało się odczytać treści błędu";
        console.error("Błąd odczytu treści błędu:", error);
      }

      console.error(`Błąd backendu (${response.status}): ${errorText}`);

      return NextResponse.json(
        { error: `Błąd serwera: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    // Próba parsowania JSON
    let data;
    try {
      data = await response.json();
      console.log('Odebrano dane:', data.length ? `${data.length} rekordów` : 'brak danych');
    } catch (error) {
      console.error('Nie udało się sparsować odpowiedzi jako JSON:', error);

      // Spróbuj odczytać surową odpowiedź
      try {
        const rawResponse = await response.text();
        console.error('Surowa odpowiedź:', rawResponse);
      } catch {}

      return NextResponse.json(
        { error: 'Nieprawidłowy format odpowiedzi z serwera' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Nieoczekiwany błąd API:', error);
    return NextResponse.json(
      {
        error: `Wystąpił błąd: ${error.message || 'Nieznany błąd'}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}