# routes/costs_raw.py
"""
Router dla modułu "Koszty ILUO (beta)" — surowe koszty z ERP (tabela costs_raw).

Strategia (skala: tysiące dokumentów):
- LISTA: GET /costs-iluo  -> tylko NAGŁÓWKI, paginowane (limit/offset).
- SZCZEGÓŁY: GET /costs-iluo/{id} -> POZYCJE jednego dokumentu, na żądanie.
- PRZYPISANIE: POST /costs-iluo/{id}/assign -> tworzy rekord w all_costs
  (pełna logika legacy: cur_* z config_current_date, walidacja cost_kind,
  triggery bazy liczą podziały kwot) i oznacza dokument jako przypisany.

KROK 2a: słownik oddziałów na KODACH legacy (all_costs.cost_branch),
regex uogólniony (FZ/KFZ/PZ/WNT/...), bez fallbacku na punkt_handlowy.
KROK 3: flagi produkcyjne (data graniczna, wymóg etykiety).
KROK 4b: endpoint przypisania + status przypisania na liście.
"""

import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, Numeric, Date, case, or_
import logging
from typing import List, Optional, Any, Tuple

from models.costs_raw import CostsRaw
from models.transaction import AllCosts, ConfigCurrentDate
from database import get_db
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# KONFIGURACJA WIDOKU PRODUKCYJNEGO — JEDYNE MIEJSCE PRZEŁĄCZANIA
# ============================================================
ILUO_MIN_DATE = "2026-07-01"          # YYYY-MM-DD, dokumenty >= tej daty
ILUO_DATE_FILTER_ENABLED = True      # przed produkcją -> True
ILUO_REQUIRE_LABEL = True            # przed produkcją -> True

# Kwota przenoszona do all_costs.cost_value przy przypisaniu: "netto" | "brutto"
ILUO_ASSIGN_AMOUNT = "netto"

# Stałe zapisu do all_costs dla kosztów z ILUO:
# - cost_kind = nazwa pozycji dokumentu (wszystkie pozycje muszą mieć tę samą
#   nazwę; różne => "Konflikt pozycji"; brak nazw => fallback "ILUO"),
# - cost_4what = 'ILUO' — ZNACZNIK SYSTEMOWY kosztu z ILUO (blokada edycji 4e).
ILUO_COST_KIND_FALLBACK = "ILUO"
ILUO_COST_KIND_CONFLICT = "Konflikt pozycji"
ILUO_COST_4WHAT = "ILUO"

# Prowizja z ILUO (krok 6): dokument, którego WSZYSTKIE pozycje nazywają się
# "Prowizja - KOSZT" (porównanie po trim, bez wielkości liter). W bazie
# zapisujemy cost_kind='Wypłata' — na tym markerze działa mechanika liczenia
# i agregacji; w UI wyświetlamy "Prowizja - KOSZT" (front). Właściciel kosztu
# wyłącznie Oddział lub Przedstawiciel. Dokumenty mieszane = zwykły
# "Konflikt pozycji", bez mechaniki prowizji.
COMMISSION_POSITION_NAME = "prowizja - koszt"
COMMISSION_DB_KIND = "Wypłata"
COMMISSION_ALLOWED_OWNERS = {"Oddział", "Przedstawiciel"}


# ============================================================
# Słownik oddziałów — ŹRÓDŁO PRAWDY: prefiks numeru dokumentu.
# Wartości = KODY z all_costs.cost_branch (nie nazwy wyświetlane!).
# ============================================================
BRANCH_PREFIX_MAP = {
    "PCI": "Pcim",
    "RZG": "Rzgów",
    "MAL": "Malbork",
    "LOM": "Łomża",
    "LUB": "Lublin",
    "MYS": "Myślibórz",
    "STH": "STH",
    "BHP": "BHP",
    "MG":  "HQ",
    "IIM": "Private",
    "INT": "MG",
}

BRANCH_DISPLAY_MAP = {
    "PCI": "Pcim",
    "RZG": "Rzgów",
    "MAL": "Malbork",
    "LOM": "Łomża",
    "LUB": "Lublin",
    "MYS": "Myślibórz",
    "STH": "Serwis",
    "BHP": "BHP",
    "MG":  "Centrala",
    "IIM": "Prywatny",
    "INT": "Sklep internetowy",
}

# Regex: dowolny typ dokumentu (FZ, KFZ, PZ, WNT, ...) + prefiks oddziału.
BRANCH_NUMBER_REGEX = r"^[A-Z]+\s+([A-ZŁ]+)/"

# Regex miesiąca/roku z numeru dokumentu: "FZ PCI/26/07/0126" -> rok 26, mies. 07.
# Numer jest wiarygodniejszy niż pole 'data' (bywa timestampem importu).
DOC_YEAR_MONTH_REGEX = r"^[A-Z]+\s+[A-ZŁ]+/(\d{2})/(\d{2})/"

# Dozwoleni właściciele kosztu przy przypisaniu (jak AddCostDialog, bez "Prywatny")
ALLOWED_COST_OWNERS = {"Wspólny", "Oddział", "Centrala", "Przedstawiciel"}
# Właściciele, przy których przedstawiciel jest zabroniony
OWNERS_WITHOUT_PH = {"Oddział", "Centrala"}


def _prefix_expr():
    """Prefiks oddziału wyciągnięty z numeru dokumentu (upper), np. 'RZG'."""
    return func.upper(func.substring(
        CostsRaw.naglowek["numer"].astext,
        BRANCH_NUMBER_REGEX
    ))


def _branch_expr():
    """
    Wyrażenie SQL: kod oddziału legacy (all_costs.cost_branch) z prefiksu numeru.
    Nierozpoznany prefiks => NULL (dokument poza widokiem — filtr w liście).
    """
    return case(BRANCH_PREFIX_MAP, value=_prefix_expr(), else_=None)


def _branch_display_expr():
    """Wyrażenie SQL: nazwa wyświetlana oddziału; NULL gdy nierozpoznany."""
    return case(BRANCH_DISPLAY_MAP, value=_prefix_expr(), else_=None)


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
    oddzial: Optional[str] = None           # KOD legacy (all_costs.cost_branch)
    oddzial_display: Optional[str] = None   # nazwa wyświetlana (front nie mapuje)
    numer_obcy: Optional[str] = None
    liczba_pozycji: int = 0
    # Prowizja z ILUO (krok 6): dokument prowizyjny — modal ogranicza właścicieli
    prowizja: bool = False
    # Status przypisania (krok 4)
    assigned_cost_id: Optional[int] = None  # cost_id w all_costs; None = nieprzypisany
    assigned_at: Optional[str] = None
    assigned_by: Optional[str] = None

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
    # Stan flag produkcyjnych — front dostosowuje UI
    require_label: bool = False
    date_filter_enabled: bool = False
    min_date: Optional[str] = None


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


class CostRawAssignRequest(BaseModel):
    """Body przypisania własności kosztu (modal jest minimalistyczny)."""
    cost_own: str                    # Wspólny | Oddział | Centrala | Przedstawiciel
    cost_ph: Optional[str] = None    # wymagany dla "Przedstawiciel", zabroniony dla Oddział/Centrala
    author: str                      # kto przypisał (=> all_costs.cost_author)


class CostRawAssignResponse(BaseModel):
    """Wynik przypisania."""
    cost_id: int
    assigned_at: str
    cost_branch: str
    cost_mo: int
    cost_year: int
    cost_value: float


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


def _resolve_branch(numer: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Pythonowy odpowiednik _branch_expr/_branch_display_expr.
    Zwraca (kod_legacy, nazwa_wyswietlana) lub (None, None) gdy nierozpoznany.
    """
    if numer:
        m = re.match(BRANCH_NUMBER_REGEX, numer)
        if m:
            prefix = m.group(1).upper()
            if prefix in BRANCH_PREFIX_MAP:
                return BRANCH_PREFIX_MAP[prefix], BRANCH_DISPLAY_MAP[prefix]
    return None, None


def _resolve_doc_month_year(numer: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    """
    Miesiąc i rok kosztu z numeru dokumentu: "FZ PCI/26/07/0126" -> (7, 2026).
    Zwraca (None, None) gdy numer nie pasuje lub miesiąc poza 1..12.
    """
    if numer:
        m = re.match(DOC_YEAR_MONTH_REGEX, numer)
        if m:
            year = 2000 + int(m.group(1))
            month = int(m.group(2))
            if 1 <= month <= 12:
                return month, year
    return None, None


def _resolve_cost_kind_from_positions(pozycje: Any) -> str:
    """
    Rodzaj kosztu z nazw pozycji dokumentu (krok 4f):
    - wszystkie pozycje mają tę samą nazwę (po trim) -> ta nazwa (max 100 znaków),
    - nazwy się różnią -> "Konflikt pozycji",
    - brak pozycji / brak nazw -> fallback "ILUO".
    """
    items = pozycje if isinstance(pozycje, list) else []
    nazwy = {
        (p.get("nazwa") or "").strip()
        for p in items
        if isinstance(p, dict) and (p.get("nazwa") or "").strip()
    }
    if len(nazwy) == 1:
        return nazwy.pop()[:100]
    if len(nazwy) > 1:
        return ILUO_COST_KIND_CONFLICT
    return ILUO_COST_KIND_FALLBACK


def _is_commission_document(pozycje: Any) -> bool:
    """
    True, gdy WSZYSTKIE pozycje dokumentu nazywają się "Prowizja - KOSZT"
    (po trim, bez wielkości liter). Dokument mieszany => False.
    """
    items = pozycje if isinstance(pozycje, list) else []
    nazwy = {
        (p.get("nazwa") or "").strip()
        for p in items
        if isinstance(p, dict) and (p.get("nazwa") or "").strip()
    }
    return len(nazwy) == 1 and nazwy.pop().casefold() == COMMISSION_POSITION_NAME


def _build_header(row: CostsRaw) -> CostRawHeader:
    """Rozbija surowy naglowek (JSONB) na płaski nagłówek + status przypisania."""
    n = row.naglowek if isinstance(row.naglowek, dict) else {}
    pozycje = row.pozycje if isinstance(row.pozycje, list) else []
    oddzial_kod, oddzial_disp = _resolve_branch(n.get("numer"))
    assigned_at = getattr(row, "assigned_at", None)
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
        oddzial=oddzial_kod,
        oddzial_display=oddzial_disp,
        numer_obcy=n.get("numer_obcy"),
        liczba_pozycji=len(pozycje),
        prowizja=_is_commission_document(pozycje),
        assigned_cost_id=getattr(row, "assigned_cost_id", None),
        assigned_at=assigned_at.isoformat() if assigned_at else None,
        assigned_by=getattr(row, "assigned_by", None),
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
        oddzial: Optional[str] = None,         # filtr po KODZIE oddziału legacy
        wyklucz_oddzialy: Optional[str] = None,  # kody po przecinku do WYKLUCZENIA (np. "HQ" dla BOARD)
        szukaj: Optional[str] = None,
        nazwa_like: Optional[str] = None,
        numer_like: Optional[str] = None,
        ma_etykiete: Optional[bool] = None,
        przypisane: Optional[bool] = None,     # True=tylko przypisane, False=tylko do przypisania
        data_od: Optional[str] = None,
        data_do: Optional[str] = None,
        # --- sortowanie ---
        sort_by: str = Query("data", description="Pole sortowania (białolista)"),
        sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
        # --- paginacja ---
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0),
):
    """
    Lista dokumentów kosztowych ILUO (same nagłówki, paginowane).
    Widoczne są wyłącznie dokumenty z rozpoznanym oddziałem; dodatkowo
    obowiązują flagi produkcyjne (data graniczna, wymóg etykiety).
    """
    try:
        query = db.query(CostsRaw)

        # --- Tylko dokumenty z rozpoznanym oddziałem ---
        query = query.filter(_branch_expr().isnot(None))

        # --- FLAGA: data graniczna (rzutowanie ::date, odporne na timestampy) ---
        if ILUO_DATE_FILTER_ENABLED:
            query = query.filter(
                func.cast(CostsRaw.naglowek["data"].astext, Date) >= ILUO_MIN_DATE
            )

        # --- FLAGA: wymóg etykiety (nadpisuje parametr ma_etykiete z frontu) ---
        if ILUO_REQUIRE_LABEL:
            query = query.filter(func.trim(CostsRaw.naglowek["etykieta"].astext) != "")
        else:
            if ma_etykiete is True:
                query = query.filter(func.trim(CostsRaw.naglowek["etykieta"].astext) != "")
            elif ma_etykiete is False:
                query = query.filter(
                    func.coalesce(func.trim(CostsRaw.naglowek["etykieta"].astext), "") == ""
                )

        # --- Filtr statusu przypisania ---
        if przypisane is True:
            query = query.filter(CostsRaw.assigned_cost_id.isnot(None))
        elif przypisane is False:
            query = query.filter(CostsRaw.assigned_cost_id.is_(None))

        # --- Filtry po polach JSON (naglowek->>'pole') ---
        if oddzial:
            query = query.filter(_branch_expr() == oddzial)
        # KROK 5: wykluczenie kodów oddziałów (uprawnienia — np. BOARD bez HQ)
        if wyklucz_oddzialy:
            excluded = [code.strip() for code in wyklucz_oddzialy.split(",") if code.strip()]
            if excluded:
                query = query.filter(_branch_expr().notin_(excluded))
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
        if data_od:
            query = query.filter(CostsRaw.naglowek["data"].astext >= data_od)
        if data_do:
            query = query.filter(CostsRaw.naglowek["data"].astext <= f"{data_do}T23:59:59")

        # --- Łączna liczba rekordów dla filtra ---
        total_count = query.count()

        # --- Sumy brutto i netto wszystkich filtrowanych dokumentów ---
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
            if sort_path in ("netto", "brutto"):
                sort_col = CostsRaw.naglowek[sort_path].astext.cast(Numeric)
        query = query.order_by(asc(sort_col) if sort_dir == "asc" else desc(sort_col))

        # --- Paginacja ---
        rows = query.offset(offset).limit(limit).all()

        data = [_build_header(row) for row in rows]

        logger.info(
            f"ILUO lista: oddzial={oddzial}, szukaj={szukaj}, przypisane={przypisane}, "
            f"flagi: data>={ILUO_MIN_DATE if ILUO_DATE_FILTER_ENABLED else 'OFF'}, "
            f"etykieta={'WYMAGANA' if ILUO_REQUIRE_LABEL else 'dowolna'}, "
            f"znaleziono {total_count}, zwracam {len(data)}"
        )

        return CostRawListResponse(
            data=data,
            total=total_count,
            total_sum=float(total_sum),
            total_sum_netto=float(total_sum_netto),
            limit=limit,
            offset=offset,
            require_label=ILUO_REQUIRE_LABEL,
            date_filter_enabled=ILUO_DATE_FILTER_ENABLED,
            min_date=ILUO_MIN_DATE if ILUO_DATE_FILTER_ENABLED else None,
        )

    except Exception as e:
        logger.error(f"Błąd podczas pobierania listy kosztów ILUO: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs-iluo/branches")
async def get_costs_iluo_branches(db: Session = Depends(get_db)):
    """
    Lista unikalnych KODÓW oddziałów — do dropdownu filtra.
    WAŻNE: ta trasa MUSI być przed /costs-iluo/{cost_id}.
    """
    try:
        branch = _branch_expr()
        rows = (
            db.query(branch)
            .distinct()
            .order_by(branch)
            .all()
        )
        names = sorted({r[0] for r in rows if r[0]})
        return names
    except Exception as e:
        logger.error(f"Błąd podczas pobierania oddziałów ILUO: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.post("/costs-iluo/{cost_id}/assign", response_model=CostRawAssignResponse)
async def assign_cost_iluo(
        cost_id: int,
        body: CostRawAssignRequest,
        db: Session = Depends(get_db),
):
    """
    Przypisuje własność kosztu ILUO: tworzy rekord w all_costs (ścieżka zapisu
    identyczna z legacy POST /costs — cur_* z config_current_date, walidacja
    cost_kind; podziały kwot liczą triggery bazy) i oznacza dokument jako
    przypisany. Całość w JEDNEJ transakcji — commit dopiero po obu zapisach.

    Reguły (ustalenia audytu):
    - oddział NIEedytowalny: zawsze z prefiksu numeru dokumentu,
    - cost_mo/cost_year z numeru dokumentu (pole 'data' bywa błędne),
    - kwota wg flagi ILUO_ASSIGN_AMOUNT (netto/brutto),
    - cost_kind = cost_4what = 'ILUO' (wpis w cost_kinds tworzony automatycznie),
    - bez reguły dnia 20.
    """
    try:
        # --- Dokument źródłowy ---
        row = db.query(CostsRaw).filter(CostsRaw.id == cost_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Nie znaleziono dokumentu o podanym ID")

        if getattr(row, "assigned_cost_id", None) is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Dokument jest już przypisany (cost_id={row.assigned_cost_id})"
            )

        n = row.naglowek if isinstance(row.naglowek, dict) else {}
        numer = n.get("numer")

        # --- Oddział z prefiksu (nieedytowalny) ---
        cost_branch, _ = _resolve_branch(numer)
        if not cost_branch:
            raise HTTPException(
                status_code=422,
                detail="Dokument nie ma rozpoznanego oddziału — nie można przypisać"
            )

        # --- Miesiąc/rok z numeru dokumentu ---
        cost_mo, cost_year = _resolve_doc_month_year(numer)
        if cost_mo is None or cost_year is None:
            raise HTTPException(
                status_code=422,
                detail="Nie można odczytać miesiąca/roku z numeru dokumentu"
            )

        # --- Walidacja własności i przedstawiciela (reguły z AddCostDialog) ---
        cost_own = (body.cost_own or "").strip()
        if cost_own not in ALLOWED_COST_OWNERS:
            raise HTTPException(
                status_code=422,
                detail=f"Niedozwolony właściciel kosztu: '{cost_own}'"
            )

        cost_ph = (body.cost_ph or "").strip() or None
        if cost_own == "Przedstawiciel" and not cost_ph:
            raise HTTPException(
                status_code=422,
                detail="Dla właściciela 'Przedstawiciel' wymagane jest wskazanie przedstawiciela"
            )
        if cost_own in OWNERS_WITHOUT_PH and cost_ph:
            raise HTTPException(
                status_code=422,
                detail=f"Dla właściciela '{cost_own}' nie przypisuje się przedstawiciela"
            )

        author = (body.author or "").strip()
        if not author:
            raise HTTPException(status_code=422, detail="Brak autora przypisania")

        # --- Kwota wg flagi ---
        amount = _to_float(n.get(ILUO_ASSIGN_AMOUNT))
        if amount is None:
            raise HTTPException(
                status_code=422,
                detail=f"Dokument nie ma kwoty '{ILUO_ASSIGN_AMOUNT}' — nie można przypisać"
            )

        # --- Prowizja z ILUO (krok 6): rozpoznanie + ograniczenie właścicieli ---
        is_commission = _is_commission_document(row.pozycje)
        if is_commission and cost_own not in COMMISSION_ALLOWED_OWNERS:
            raise HTTPException(
                status_code=422,
                detail="Dokument prowizyjny (Prowizja - KOSZT) — właścicielem kosztu "
                       "może być wyłącznie Oddział lub Przedstawiciel"
            )

        # --- Rodzaj kosztu z nazw pozycji dokumentu (krok 4f) ---
        # Prowizja: w bazie 'Wypłata' (mechanika liczenia), w UI "Prowizja - KOSZT".
        # Nazwy pozycji nie trafiają do słownika cost_kinds — to wartości
        # opisowe z ERP; słownik pozostaje dla kosztów wpisywanych ręcznie.
        cost_kind_value = (
            COMMISSION_DB_KIND if is_commission
            else _resolve_cost_kind_from_positions(row.pozycje)
        )

        # --- Data wpisu: z config_current_date, identycznie jak legacy POST /costs ---
        config = db.query(ConfigCurrentDate).filter(ConfigCurrentDate.id == 1).first()
        if not config:
            raise HTTPException(status_code=404, detail="Nie znaleziono konfiguracji daty")

        # --- INSERT do all_costs (podziały kwot liczą triggery bazy) ---
        db_cost = AllCosts(
            cur_day=config.day_value,
            cur_mo=config.month_value,
            cur_yr=config.year_value,
            cost_year=cost_year,
            cost_mo=cost_mo,
            cost_contrahent=(n.get("nazwa_skrocona") or "").strip() or "-",
            cost_nip=(n.get("nip") or "").strip() or "-",
            cost_doc_no=(numer or "").strip(),
            cost_value=amount,
            cost_kind=cost_kind_value,
            cost_4what=ILUO_COST_4WHAT,
            cost_own=cost_own,
            cost_ph=cost_ph,
            cost_author=author,
            cost_branch=cost_branch,
        )
        db.add(db_cost)
        db.flush()  # nadaje cost_id bez commitu

        # --- Oznaczenie dokumentu jako przypisany (ta sama transakcja) ---
        assigned_at = datetime.now(timezone.utc)
        row.assigned_cost_id = db_cost.cost_id
        row.assigned_at = assigned_at
        row.assigned_by = author

        db.commit()
        db.refresh(db_cost)

        logger.info(
            f"ILUO assign: dokument {cost_id} ({numer}) -> all_costs.cost_id={db_cost.cost_id}, "
            f"branch={cost_branch}, own={cost_own}, ph={cost_ph}, "
            f"{cost_mo:02d}.{cost_year}, kwota={amount} ({ILUO_ASSIGN_AMOUNT}), autor={author}"
        )

        return CostRawAssignResponse(
            cost_id=db_cost.cost_id,
            assigned_at=assigned_at.isoformat(),
            cost_branch=cost_branch,
            cost_mo=cost_mo,
            cost_year=cost_year,
            cost_value=float(amount),
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Błąd podczas przypisywania kosztu ILUO {cost_id}: {str(e)}")
        db.rollback()
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