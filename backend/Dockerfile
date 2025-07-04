FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

# Instalacja niezbędnych narzędzi
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiowanie i instalacja zależności
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tworzenie struktury katalogów
RUN mkdir -p src/routes src/models \
    && touch src/__init__.py \
        src/routes/__init__.py \
        src/models/__init__.py

# Kopiowanie kodu źródłowego i pliku .env
COPY ./src ./src
COPY .env ./src/.env

# Konfiguracja użytkownika
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app

USER appuser

# Ustawienie katalogu roboczego
WORKDIR /app/src

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Uruchomienie aplikacji bez --reload w produkcji
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]