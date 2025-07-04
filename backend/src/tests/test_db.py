import psycopg2
from dotenv import load_dotenv
import os
from pathlib import Path


def test_db_connection():
    # Poprawiona ścieżka - idziemy dwa poziomy wyżej od obecnego pliku
    current_dir = Path(__file__).parent.parent.parent  # jeden parent więcej
    env_path = current_dir / '.env'

    print(f"Szukam pliku .env w: {env_path}")
    print(f"Czy plik istnieje? {env_path.exists()}\n")

    # Ładujemy zmienne środowiskowe
    load_dotenv(env_path)

    # Pobieramy i wyświetlamy wszystkie potrzebne zmienne środowiskowe
    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_port = os.getenv("DB_PORT", "5432")

    print("Znalezione zmienne środowiskowe:")
    print(f"DB_HOST: {db_host}")
    print(f"DB_NAME: {db_name}")
    print(f"DB_USER: {db_user}")
    print(f"DB_PORT: {db_port}")
    print(f"DB_PASSWORD: {'[UKRYTE]' if db_password else 'Nie znaleziono'}\n")

    if not all([db_host, db_name, db_user, db_password]):
        print("❌ Błąd: Nie wszystkie wymagane zmienne środowiskowe zostały znalezione!")
        return

    # Parametry połączenia
    db_params = {
        "host": db_host,
        "database": db_name,
        "user": db_user,
        "password": db_password,
        "port": db_port
    }

    print("Próba połączenia z bazą danych...")

    try:
        conn = psycopg2.connect(**db_params)
        print("\n✅ Połączenie z bazą danych udane!")

        # Test połączenia - sprawdzamy wersję PostgreSQL
        cur = conn.cursor()
        cur.execute('SELECT version();')
        version = cur.fetchone()
        print(f"\nWersja PostgreSQL: {version[0]}")

        # Listujemy wszystkie tabele
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        tables = cur.fetchall()

        print("\nDostępne tabele:")
        for table in tables:
            print(f"- {table[0]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n❌ Błąd połączenia: {str(e)}")


if __name__ == "__main__":
    test_db_connection()