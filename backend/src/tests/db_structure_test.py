import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv
from pathlib import Path
import logging
from typing import Dict, List, Optional

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_env_variables() -> Optional[Dict[str, str]]:
    """Ładuje zmienne środowiskowe z pliku .env"""
    try:
        current_dir = Path(__file__).parent.parent
        env_path = current_dir / '.env'

        logger.info(f"Szukam pliku .env w: {env_path}")
        if not env_path.exists():
            logger.error("❌ Nie znaleziono pliku .env!")
            return None

        load_dotenv(env_path)

        db_config = {
            'host': os.getenv('DB_HOST'),
            'dbname': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'port': os.getenv('DB_PORT', '5432')
        }

        # Sprawdzanie czy wszystkie wymagane zmienne są dostępne
        missing_vars = [key for key, value in db_config.items() if not value]
        if missing_vars:
            logger.error(f"❌ Brakujące zmienne środowiskowe: {', '.join(missing_vars)}")
            return None

        return db_config

    except Exception as e:
        logger.error(f"❌ Błąd podczas ładowania zmiennych środowiskowych: {str(e)}")
        return None


def test_db_structure():
    """Test połączenia z bazą i weryfikacja struktury tabel"""

    # Lista oczekiwanych tabel i ich kolumn
    expected_tables = {
        'transactions': [
            'id', 'document_number', 'created_at', 'branch_name',
            'representative_name', 'customer_nip', 'net_value',
            'gross_value', 'to_pay', 'profit', 'year', 'month'
        ],
        'net_sales_branch_total': ['year', 'month', 'branch_name', 'net_sales'],
        'profit_total': ['year', 'month', 'branch_name', 'profit'],
        'profit_payd': ['year', 'month', 'branch_name', 'profit_paid'],
        'net_sales_branch_payd': ['year', 'month', 'branch_name', 'net_sales_paid'],
        'net_sales_representative_total': ['year', 'month', 'representative_name', 'net_sales'],
        'net_sales_representative_payd': ['year', 'month', 'representative_name', 'net_sales_paid'],
        'profit_representative_total': ['year', 'month', 'representative_name', 'profit'],
        'profit_representative_payd': ['year', 'month', 'representative_name', 'profit_paid']
    }

    # 1. Ładowanie konfiguracji
    logger.info("1. Ładowanie konfiguracji bazy danych...")
    db_config = load_env_variables()
    if not db_config:
        return

    try:
        # 2. Test połączenia
        logger.info("2. Próba połączenia z bazą danych...")
        conn = psycopg2.connect(**db_config)
        logger.info("✅ Połączenie z bazą udane!")

        # 3. Pobranie listy tabel
        logger.info("\n3. Pobieranie listy tabel...")
        cursor = conn.cursor()

        # Pobierz wszystkie tabele ze schematu public
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        existing_tables = {table[0] for table in cursor.fetchall()}

        # 4. Sprawdzenie brakujących tabel
        missing_tables = set(expected_tables.keys()) - existing_tables
        if missing_tables:
            logger.error(f"\n❌ Brakujące tabele: {missing_tables}")
        else:
            logger.info("✅ Wszystkie wymagane tabele istnieją!")

        # 5. Sprawdzenie struktury każdej tabeli
        logger.info("\n5. Sprawdzanie struktury tabel:")
        for table_name in existing_tables:
            if table_name in expected_tables:
                cursor.execute(sql.SQL("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = 'public' 
                    AND table_name = {}
                    ORDER BY ordinal_position
                """).format(sql.Literal(table_name)))

                columns = cursor.fetchall()
                logger.info(f"\nTabela: {table_name}")
                for col in columns:
                    logger.info(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")

                # Sprawdź czy wszystkie wymagane kolumny istnieją
                existing_columns = {col[0] for col in columns}
                missing_columns = set(expected_tables[table_name]) - existing_columns
                if missing_columns:
                    logger.error(f"  ❌ Brakujące kolumny: {missing_columns}")
                else:
                    logger.info("  ✅ Wszystkie wymagane kolumny istnieją!")

        # 6. Dodatkowe informacje o bazie
        logger.info("\n6. Informacje o bazie danych:")
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        logger.info(f"Wersja PostgreSQL: {version[0]}")

        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()
        logger.info(f"Nazwa bazy danych: {db_name[0]}")

    except Exception as e:
        logger.error(f"❌ Błąd podczas testowania bazy: {str(e)}")

    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
            logger.info("\nPołączenie z bazą zakończone.")


if __name__ == "__main__":
    test_db_structure()