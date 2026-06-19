# models/costs_raw.py
"""
Model dla tabeli costs_raw — surowe koszty z ERP (ILUO).
Źródło prawdy dla modułu "Koszty ILUO (beta)".

Struktura odpowiada DDL:
    CREATE TABLE costs_raw (
        id          BIGSERIAL    PRIMARY KEY,
        naglowek    JSONB        NOT NULL,
        pozycje     JSONB        NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

UWAGA: kolumny JSON-owe są surowe (raw) — nie rozbijamy ich na pola.
- naglowek: numer, data, nip, nazwa_skrocona, brutto, netto, vat,
            etykieta, punkt_handlowy, numer_obcy
- pozycje:  tablica obiektów { indeks, nazwa, ilosc, cena, vat }

Pole 'etykieta' (w naglowek) jest na ten moment puste — w przyszłości
zdecyduje o przynależności kosztu. Tutaj jej nie przetwarzamy.
"""

from sqlalchemy import Column, BigInteger, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB

from database import Base


class CostsRaw(Base):
    __tablename__ = "costs_raw"

    id = Column(BigInteger, primary_key=True, index=True)
    naglowek = Column(JSONB, nullable=False)
    pozycje = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        numer = None
        if isinstance(self.naglowek, dict):
            numer = self.naglowek.get("numer")
        return f"<CostsRaw(id={self.id}, numer='{numer}')>"