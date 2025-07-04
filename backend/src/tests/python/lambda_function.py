import os
import psycopg2
import datetime
import logging
import json

# Konfiguracja loggera
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Pobierz parametry połączenia ze zmiennych środowiskowych
# Zmienne te będą skonfigurowane w ustawieniach funkcji Lambda
connection_params = {
    'host': os.environ['DB_HOST'],
    'dbname': os.environ['DB_NAME'],
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'port': os.environ.get('DB_PORT', '5432')
}


def lambda_handler(event, context):
    """
    Funkcja obsługująca wywołanie Lambda.

    Args:
        event: Dane wejściowe zdarzenia (nieużywane w tym przypadku)
        context: Kontekst wykonania Lambda (nieużywane w tym przypadku)

    Returns:
        Słownik zawierający status wykonania
    """

    logger.info(f"Rozpoczęcie wykonania funkcji Lambda: {datetime.datetime.now()}")
    logger.info(f"Używane parametry połączenia: host={connection_params['host']}, "
                f"dbname={connection_params['dbname']}, user={connection_params['user']}, "
                f"port={connection_params['port']}")

    try:
        # Nawiązanie połączenia z bazą danych
        logger.info("Próba połączenia z bazą danych...")
        conn = psycopg2.connect(**connection_params)
        conn.autocommit = True

        # Testowanie prostego zapytania
        logger.info("Połączenie ustanowione. Wykonywanie prostego zapytania SELECT...")
        cur = conn.cursor()
        cur.execute("SELECT current_timestamp, current_database(), current_user")
        result = cur.fetchone()
        logger.info(
            f"Wynik zapytania: Czas bazy danych: {result[0]}, Baza danych: {result[1]}, Użytkownik: {result[2]}")

        # Sprawdzenie obecności funkcji update_daily_date_and_aggregates
        logger.info("Sprawdzanie istnienia funkcji update_daily_date_and_aggregates()...")
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_proc 
                WHERE proname = 'update_daily_date_and_aggregates'
            )
        """)
        function_exists = cur.fetchone()[0]

        if function_exists:
            logger.info("Funkcja update_daily_date_and_aggregates() istnieje.")

            # Wykonanie funkcji aktualizującej
            logger.info("Wykonywanie funkcji update_daily_date_and_aggregates()...")
            cur.execute("SELECT update_daily_date_and_aggregates()")
            logger.info("Funkcja wykonana pomyślnie.")

            # Sprawdzenie aktualizacji daty
            logger.info("Sprawdzanie czy data została zaktualizowana...")
            cur.execute("SELECT config_date FROM config_current_date WHERE id = 1")
            date_result = cur.fetchone()
            if date_result:
                logger.info(f"Aktualna data w tabeli config_current_date: {date_result[0]}")
            else:
                logger.warning("Nie znaleziono rekordu z id=1 w tabeli config_current_date")

            # Sprawdzenie agregacji
            logger.info("Sprawdzanie ostatniej aktualizacji agregatów...")
            cur.execute("SELECT id, net_sales_total_year FROM aggregated_data_sums LIMIT 1")
            agg_result = cur.fetchone()
            if agg_result:
                logger.info(f"Dane w aggregated_data_sums: id={agg_result[0]}, net_sales_total_year={agg_result[1]}")
            else:
                logger.warning("Brak danych w tabeli aggregated_data_sums!")
        else:
            logger.warning("Funkcja update_daily_date_and_aggregates() nie istnieje w bazie danych!")

            # Tworzenie funkcji update_daily_date_and_aggregates (automatycznie, bez pytania użytkownika)
            logger.info("Tworzenie funkcji update_daily_date_and_aggregates()...")

            # Definicja funkcji update_daily_date_and_aggregates
            create_function_sql = """
            CREATE OR REPLACE FUNCTION public.update_daily_date_and_aggregates()
            RETURNS void
            LANGUAGE plpgsql
            AS $$
            BEGIN
                -- Aktualizacja daty w tabeli config_current_date
                UPDATE config_current_date 
                SET 
                    config_date = CURRENT_DATE
                WHERE id = 1;

                -- Przeliczenie danych zagregowanych
                PERFORM populate_aggregated_data();
                PERFORM populate_aggregated_data_hist();
                PERFORM populate_aggregated_data_sums();
                PERFORM refresh_aggregated_sales_data();
                PERFORM refresh_representative_aggregated_data();

                RAISE NOTICE 'Aktualizacja daty i danych zagregowanych zakończona: %', CURRENT_TIMESTAMP;
            END;
            $$;
            """

            try:
                cur.execute(create_function_sql)
                logger.info("Funkcja utworzona pomyślnie.")

                # Teraz wykonaj nowo utworzoną funkcję
                logger.info("Wykonywanie utworzonej funkcji...")
                cur.execute("SELECT update_daily_date_and_aggregates()")
                logger.info("Funkcja wykonana pomyślnie.")

                # Sprawdź wyniki
                cur.execute("SELECT config_date FROM config_current_date WHERE id = 1")
                date_result = cur.fetchone()
                logger.info(f"Aktualna data w tabeli config_current_date: {date_result[0]}")

            except Exception as function_error:
                logger.error(f"Błąd podczas tworzenia lub wykonywania funkcji: {str(function_error)}")
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'message': f'Błąd podczas tworzenia lub wykonywania funkcji: {str(function_error)}'
                    })
                }

        # Zamknięcie połączenia
        cur.close()
        conn.close()
        logger.info("Wykonanie funkcji Lambda zakończone pomyślnie.")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Aktualizacja daty i agregatów zakończona pomyślnie.',
                'timestamp': str(datetime.datetime.now())
            })
        }

    except Exception as e:
        logger.error(f"Wystąpił błąd: {str(e)}")

        # Diagnostyka problemów z połączeniem
        error_message = ""
        if "timeout" in str(e).lower():
            error_message = "Błąd połączenia - timeout. Sprawdź grupy bezpieczeństwa i reguły sieciowe VPC."
            logger.error(error_message)
        elif "password authentication failed" in str(e).lower():
            error_message = "Błąd uwierzytelniania - nieprawidłowe hasło lub nazwa użytkownika."
            logger.error(error_message)
        elif "database" in str(e).lower() and "does not exist" in str(e).lower():
            error_message = "Podana baza danych nie istnieje."
            logger.error(error_message)
        elif "could not connect to server" in str(e).lower():
            error_message = "Nie można połączyć się z serwerem. Sprawdź adres hosta i port."
            logger.error(error_message)
        elif "undefined environment variable" in str(e).lower():
            missing_var = str(e).split("'")[1]
            error_message = f"Brak zmiennej środowiskowej: {missing_var}. Sprawdź konfigurację Lambda."
            logger.error(error_message)
        else:
            error_message = str(e)

        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f'Błąd: {error_message}',
                'timestamp': str(datetime.datetime.now())
            })
        }