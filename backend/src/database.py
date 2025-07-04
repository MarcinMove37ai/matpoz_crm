from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
from pathlib import Path

# Poprawiona ścieżka do pliku .env - idziemy jeden katalog wyżej
current_dir = Path(__file__).parent.parent
env_path = current_dir / '.env'

# Dodajemy debug, aby zobaczyć ścieżkę
print(f"Szukam pliku .env w: {env_path}")
print(f"Czy plik istnieje? {env_path.exists()}")

# Ładowanie zmiennych środowiskowych
load_dotenv(env_path)

# Wyświetlamy znalezione zmienne (ukrywając hasło)
print("\nZnalezione zmienne środowiskowe:")
print(f"DB_HOST: {os.getenv('DB_HOST')}")
print(f"DB_NAME: {os.getenv('DB_NAME')}")
print(f"DB_USER: {os.getenv('DB_USER')}")
print(f"DB_PORT: {os.getenv('DB_PORT', '5432')}")
print(f"DB_PASSWORD: {'[UKRYTE]' if os.getenv('DB_PASSWORD') else 'Nie znaleziono'}\n")

# Parametry połączenia z bazą danych
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Sprawdzanie czy wszystkie wymagane zmienne są dostępne
if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
    print("❌ BŁĄD: Brak wymaganych zmiennych środowiskowych!")
    missing_vars = []
    if not DB_HOST: missing_vars.append("DB_HOST")
    if not DB_NAME: missing_vars.append("DB_NAME")
    if not DB_USER: missing_vars.append("DB_USER")
    if not DB_PASSWORD: missing_vars.append("DB_PASSWORD")
    print(f"Brakujące zmienne: {', '.join(missing_vars)}")

# Tworzenie URL do bazy danych
SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Tworzenie silnika SQLAlchemy
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Tworzenie klasy SessionLocal
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tworzenie klasy Base
Base = declarative_base()

# Zależność do otrzymywania sesji bazy danych
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Funkcja testująca połączenie z bazą danych
def test_db_connection():
    try:
        db = SessionLocal()
        # Używamy text() do wykonania surowego zapytania SQL
        db.execute(text("SELECT 1"))
        print("✅ Połączenie z bazą danych udane!")
        return True
    except Exception as e:
        print(f"❌ Błąd połączenia z bazą danych: {str(e)}")
        return False
    finally:
        db.close()