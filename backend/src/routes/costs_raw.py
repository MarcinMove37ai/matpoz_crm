# routes/costs_raw.py
"""
Router dla modułu "Koszty ILUO (beta)" — surowe koszty z ERP (tabela costs_raw).

Strategia (skala: tysiące dokumentów):
- LISTA: GET /costs-iluo  -> tylko NAGŁÓWKI, paginowane (limit/offset).
         Lekki payload, szybkie renderowanie listy dokumentów.
- SZCZEGÓŁY: GET /costs-iluo/{id} -> POZYCJE jednego dokumentu, na żądanie
         (po kliknięciu wiersza). Modal dociąga tylko to, co potrzebne.

Dane w costs_raw są surowe (JSONB): naglowek + pozycje. Na liście rozbijamy
naglowek na płaskie pola (front nie parsuje JSON), pozycje oddajemy dopiero
w endpoincie szczegółów.

UWAGA: 'etykieta' jest na ten moment pusta — w przyszłości zdecyduje
o przynależności kosztu. Tu jej nie przetwarzamy, tylko przekazujemy.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, Numeric, case, or_
import logging
from typing import List, Optional, Any

from models.costs_raw import CostsRaw
from database import get_db
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# Słownik oddziałów — ŹRÓDŁO PRAWDY: prefiks numeru dokumentu.
# Musi byc zgodny z frontendowym src/lib/branchDictionary.ts
# (te same prefiksy -> te same nazwy cost_branch).
# ============================================================
BRANCH_PREFIX_MAP = {
    "RZG": "Rzgów",
    "MAL": "Malbork",
    "PCI": "Pcim",
    "LOM": "Łomża",
    "MYS": "Myślibórz",
    "LUB": "Lublin",
    "MG": "Centrala",   # MG w dokumencie = centrala (HQ)
    "STH": "Serwis",    # STH w dokumencie = serwis
}


def _branch_expr():
    """
    Wyrażenie SQL wyznaczające nazwę oddziału dokumentu.
    1. Prefiks z numeru (regex, obsługuje FZ i korekty KFZ) -> nazwa ze słownika.
    2. Fallback: surowy punkt_handlowy (gdy prefiks nieznany/brak).
    3. Ostatecznie '-'.
    Jedno źródło prawdy — używane w SELECT, WHERE, ORDER BY i dystynktnych wartościach.
    """
    # prefiks wyciągnięty z numeru, np. "FZ RZG/..." -> "RZG"
    prefix = func.substring(
        CostsRaw.naglowek["numer"].astext,
        r"^K?FZ\s+([A-ZŁ]+)/"
    )
    fallback = func.coalesce(
        func.nullif(func.trim(CostsRaw.naglowek["punkt_handlowy"].astext), ""),
        "-",
    )
    # CASE prefiks -> nazwa, else fallback
    whens = {pfx: name for pfx, name in BRANCH_PREFIX_MAP.items()}
    return case(whens, value=func.upper(prefix), else_=fallback)


# ============================================================
# Modele Pydantic (lokalne — zgodnie z wzorcem z costs.py)
# ============================================================

class CostRawHeader(BaseModel):
    """Płaski nagłówek dokumentu na potrzeby listy."""
    id: int
    numer: Optional[str] = None
    data: Optional[str] = None
    nip: Optional[str] = None
    nazwa_skrocona: Optional[str] = None
    netto: Optional[float] = None
    vat: Optional[float] = None
    brutto: Optional[float] = None
    etykieta: Optional[str] = None
    punkt_handlowy: Optional[str] = None
    oddzial: Optional[str] = None          # oddział rozwiązany z prefiksu numeru (źródło prawdy)
    numer_obcy: Optional[str] = None
    liczba_pozycji: int = 0

    class Config:
        from_attributes = True


class CostRawListResponse(BaseModel):
    """Odpowiedź listy — wzorzec jak PaginatedZeroMarginResponse."""
    data: List[CostRawHeader]
    total: int
    total_sum: float
    total_sum_netto: float
    limit: int
    offset: int


class CostRawPosition(BaseModel):
    """Pojedyncza pozycja dokumentu (do modala szczegółów)."""
    indeks: Optional[str] = None
    nazwa: Optional[str] = None
    ilosc: Optional[float] = None
    cena: Optional[float] = None
    vat: Optional[float] = None


class CostRawDetail(BaseModel):
    """Pełne szczegóły jednego dokumentu: nagłówek + pozycje."""
    header: CostRawHeader
    pozycje: List[CostRawPosition]


# ============================================================
# Helpers
# ============================================================

def _to_float(value: Any) -> Optional[float]:
    """Bezpieczna konwersja wartości z JSON na float (None gdy się nie da)."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _resolve_branch(numer: Optional[str], punkt_handlowy: Optional[str]) -> str:
    """
    Pythonowy odpowiednik _branch_expr() — dla budowy nagłówka.
    Prefiks z numeru -> nazwa ze słownika; fallback na punkt_handlowy; '-'.
    """
    import re
    prefix = None
    if numer:
        m = re.match(r"^K?FZ\s+([A-ZŁ]+)/", numer)
        if m:
            prefix = m.group(1).upper()
    if prefix and prefix in BRANCH_PREFIX_MAP:
        return BRANCH_PREFIX_MAP[prefix]
    fallback = (punkt_handlowy or "").strip()
    return fallback if fallback != "" else "-"


def _build_header(row: CostsRaw) -> CostRawHeader:
    """Rozbija surowy naglowek (JSONB) na płaski nagłówek."""
    n = row.naglowek if isinstance(row.naglowek, dict) else {}
    pozycje = row.pozycje if isinstance(row.pozycje, list) else []
    return CostRawHeader(
        id=row.id,
        numer=n.get("numer"),
        data=n.get("data"),
        nip=n.get("nip"),
        nazwa_skrocona=n.get("nazwa_skrocona"),
        netto=_to_float(n.get("netto")),
        vat=_to_float(n.get("vat")),
        brutto=_to_float(n.get("brutto")),
        etykieta=n.get("etykieta"),
        punkt_handlowy=n.get("punkt_handlowy"),
        oddzial=_resolve_branch(n.get("numer"), n.get("punkt_handlowy")),
        numer_obcy=n.get("numer_obcy"),
        liczba_pozycji=len(pozycje),
    )


# ============================================================
# Endpointy
# ============================================================

# Sortowanie listy: białolista pól z naglowek (klucz API -> ścieżka JSON)
_SORTABLE = {
    "data": "data",
    "numer": "numer",
    "nazwa_skrocona": "nazwa_skrocona",
    "netto": "netto",
    "brutto": "brutto",
    "punkt_handlowy": "punkt_handlowy",
}


@router.get("/costs-iluo", response_model=CostRawListResponse)
async def get_costs_iluo(
        db: Session = Depends(get_db),
        # --- filtry (po polach JSON naglowek) ---
        oddzial: Optional[str] = None,         # filtr po oddziale (rozwiązanym z prefiksu)
        szukaj: Optional[str] = None,          # wspólne wyszukiwanie: dostawca LUB numer dokumentu
        nazwa_like: Optional[str] = None,      # wyszukiwanie dostawcy (ILIKE)
        numer_like: Optional[str] = None,      # wyszukiwanie po numerze dokumentu
        ma_etykiete: Optional[bool] = None,    # True=tylko z etykieta, False=tylko bez
        data_od: Optional[str] = None,         # YYYY-MM-DD (włącznie)
        data_do: Optional[str] = None,         # YYYY-MM-DD (włącznie)
        # --- sortowanie ---
        sort_by: str = Query("data", description="Pole sortowania (białolista)"),
        sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
        # --- paginacja ---
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0),
):
    """
    Lista dokumentów kosztowych ILUO (same nagłówki, paginowane).
    Pozycje NIE są zwracane tutaj — dociąga je GET /costs-iluo/{id}.
    """
    try:
        query = db.query(CostsRaw)

        # --- Filtry po polach JSON (naglowek->>'pole') ---
        if oddzial:
            query = query.filter(_branch_expr() == oddzial)
        # Wspólne wyszukiwanie: dostawca LUB numer LUB numer obcy LUB NIP (OR)
        if szukaj:
            wzor = f"%{szukaj}%"
            query = query.filter(
                or_(
                    CostsRaw.naglowek["nazwa_skrocona"].astext.ilike(wzor),
                    CostsRaw.naglowek["numer"].astext.ilike(wzor),
                    CostsRaw.naglowek["numer_obcy"].astext.ilike(wzor),
                    CostsRaw.naglowek["nip"].astext.ilike(wzor),
                )
            )
        if nazwa_like:
            query = query.filter(CostsRaw.naglowek["nazwa_skrocona"].astext.ilike(f"%{nazwa_like}%"))
        if numer_like:
            query = query.filter(CostsRaw.naglowek["numer"].astext.ilike(f"%{numer_like}%"))
        # Filtr przypisania etykiety: niepusta (po przycieciu) = "z etykieta"
        if ma_etykiete is True:
            query = query.filter(func.trim(CostsRaw.naglowek["etykieta"].astext) != "")
        elif ma_etykiete is False:
            query = query.filter(
                func.coalesce(func.trim(CostsRaw.naglowek["etykieta"].astext), "") == ""
            )
        if data_od:
            query = query.filter(CostsRaw.naglowek["data"].astext >= data_od)
        if data_do:
            # porównanie tekstowe dat ISO działa leksykograficznie;
            # dla zakresu "do włącznie" bierzemy granicę dnia
            query = query.filter(CostsRaw.naglowek["data"].astext <= f"{data_do}T23:59:59")

        # --- Łączna liczba rekordów dla filtra ---
        total_count = query.count()

        # --- Sumy brutto i netto wszystkich filtrowanych dokumentów ---
        # rzutujemy JSON->numeric po stronie bazy; obie sumy jednym zapytaniem
        sums = query.with_entities(
            func.sum(CostsRaw.naglowek["brutto"].astext.cast(Numeric)),
            func.sum(CostsRaw.naglowek["netto"].astext.cast(Numeric)),
        ).first()
        total_sum = float(sums[0] or 0)
        total_sum_netto = float(sums[1] or 0)

        # --- Sortowanie (białolista) ---
        if sort_by == "oddzial":
            sort_col = _branch_expr()
        else:
            sort_path = _SORTABLE.get(sort_by, "data")
            sort_col = CostsRaw.naglowek[sort_path].astext
            # pola kwotowe sortujemy numerycznie
            if sort_path in ("netto", "brutto"):
                sort_col = CostsRaw.naglowek[sort_path].astext.cast(Numeric)
        query = query.order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col))

        # --- Paginacja ---
        rows = query.offset(offset).limit(limit).all()

        data = [_build_header(row) for row in rows]

        logger.info(
            f"ILUO lista: filtr oddzial={oddzial}, nazwa_like={nazwa_like}, "
            f"znaleziono {total_count}, zwracam {len(data)}"
        )

        return CostRawListResponse(
            data=data,
            total=total_count,
            total_sum=float(total_sum),
            total_sum_netto=float(total_sum_netto),
            limit=limit,
            offset=offset,
        )

    except Exception as e:
        logger.error(f"Błąd podczas pobierania listy kosztów ILUO: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs-iluo/branches")
async def get_costs_iluo_branches(db: Session = Depends(get_db)):
    """
    Lista unikalnych oddziałów (rozwiązanych z prefiksu numeru) — do dropdownu filtra.
    Zwraca te same nazwy, które widnieją w kolumnie Oddział.
    WAŻNE: ta trasa MUSI być przed /costs-iluo/{cost_id}, inaczej 'branches'
    zostanie potraktowane jako cost_id.
    """
    try:
        branch = _branch_expr()
        rows = (
            db.query(branch)
            .distinct()
            .order_by(branch)
            .all()
        )
        # odfiltruj puste/'-' i posortuj alfabetycznie
        names = sorted({r[0] for r in rows if r[0] and r[0] != "-"})
        return names
    except Exception as e:
        logger.error(f"Błąd podczas pobierania oddziałów ILUO: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs-iluo/{cost_id}", response_model=CostRawDetail)
async def get_cost_iluo_detail(cost_id: int, db: Session = Depends(get_db)):
    """
    Szczegóły jednego dokumentu ILUO: nagłówek + pozycje.
    Wołane po kliknięciu wiersza (dociąga pozycje do modala).
    """
    try:
        row = db.query(CostsRaw).filter(CostsRaw.id == cost_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Nie znaleziono dokumentu o podanym ID")

        header = _build_header(row)
        raw_positions = row.pozycje if isinstance(row.pozycje, list) else []

        pozycje = [
            CostRawPosition(
                indeks=p.get("indeks"),
                nazwa=p.get("nazwa"),
                ilosc=_to_float(p.get("ilosc")),
                cena=_to_float(p.get("cena")),
                vat=_to_float(p.get("vat")),
            )
            for p in raw_positions
            if isinstance(p, dict)
        ]

        return CostRawDetail(header=header, pozycje=pozycje)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Błąd podczas pobierania szczegółów kosztu ILUO {cost_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")