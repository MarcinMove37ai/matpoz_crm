# routes/costs.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from datetime import datetime
import logging
from typing import List, Optional

from models.transaction import AllCosts, ConfigCurrentDate, CostKind, CostAuditLog
from database import get_db
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# Models Pydantic
class CostCreate(BaseModel):
    cost_year: int
    cost_contrahent: str
    cost_nip: str
    cost_mo: int
    cost_doc_no: str
    cost_value: float
    cost_kind: str
    cost_4what: str
    cost_own: str
    cost_ph: Optional[str] = None
    cost_author: str
    cost_branch: str
    branch_payout: Optional[float] = None
    rep_payout: Optional[float] = None
    current_user: Optional[str] = None  # Dodane dla audit log

    class Config:
        from_attributes = True


class CostKindBase(BaseModel):
    kind: str

    class Config:
        from_attributes = True


class CostKindCreate(CostKindBase):
    pass


class CostKindResponse(CostKindBase):
    id: int


# Dodaj poniższy kod do pliku costs.py, po innych endpointach kosztów

# Endpoint do pobierania wypłat dla oddziałów
@router.get("/costs/branch_payouts")
async def get_branch_payouts(
        db: Session = Depends(get_db),
        year: Optional[int] = None,
        month: Optional[int] = None,
        branch: Optional[str] = None
):
    """
    Pobiera sumy wypłat dla oddziałów z możliwością filtrowania.
    """
    try:
        query = db.query(AllCosts)

        # Zastosuj filtry
        if year is not None:
            query = query.filter(AllCosts.cost_year == year)
        if month is not None:
            query = query.filter(AllCosts.cost_mo == month)
        if branch:
            query = query.filter(AllCosts.cost_branch == branch)

        # Pobierz dane zagregowane według oddziałów
        branch_payouts = db.query(
            AllCosts.cost_branch.label("branch"),
            func.sum(AllCosts.branch_payout).label("total_payout")
        ).filter(query.whereclause).group_by(AllCosts.cost_branch).all()

        # Formatowanie wyniku
        result = [
            {
                "branch": item.branch,
                "total_payout": float(item.total_payout or 0)
            }
            for item in branch_payouts
        ]

        return result
    except Exception as e:
        logger.error(f"Błąd podczas pobierania wypłat dla oddziałów: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


# Endpoint do pobierania wypłat dla przedstawicieli
# Zaktualizowany endpoint do pobierania wypłat dla przedstawicieli
@router.get("/costs/representative_payouts")
async def get_representative_payouts(
        db: Session = Depends(get_db),
        year: Optional[int] = None,
        month: Optional[int] = None,
        rep: Optional[str] = None,
        branch: Optional[str] = None
):
    """
    Pobiera sumy wypłat dla przedstawicieli handlowych z możliwością filtrowania.
    """
    try:
        query = db.query(AllCosts)

        # Zastosuj filtry
        if year is not None:
            query = query.filter(AllCosts.cost_year == year)
        if month is not None:
            query = query.filter(AllCosts.cost_mo == month)
        if rep:
            query = query.filter(AllCosts.cost_ph == rep)
        if branch:
            query = query.filter(AllCosts.cost_branch == branch)

        # Pobierz dane zagregowane według przedstawicieli
        rep_payouts = db.query(
            AllCosts.cost_ph.label("representative"),
            AllCosts.cost_branch.label("branch"),
            AllCosts.cost_year.label("year"),
            AllCosts.cost_mo.label("month"),
            func.sum(AllCosts.rep_payout).label("total_payout")
        ).filter(
            query.whereclause,
            AllCosts.cost_ph.isnot(None),
            AllCosts.cost_ph != ""
        ).group_by(
            AllCosts.cost_ph,
            AllCosts.cost_branch,
            AllCosts.cost_year,
            AllCosts.cost_mo
        ).all()

        # Formatowanie wyniku
        result = [
            {
                "representative": item.representative,
                "branch": item.branch,
                "year": item.year,
                "month": item.month,
                "total_payout": float(item.total_payout or 0)
            }
            for item in rep_payouts
        ]

        return result
    except Exception as e:
        logger.error(f"Błąd podczas pobierania wypłat dla przedstawicieli: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.put("/costs/{cost_id}", response_model=CostCreate)
async def update_cost(cost_id: int, cost: CostCreate, db: Session = Depends(get_db)):
    """
    Aktualizuje istniejący koszt.
    """
    try:
        db_cost = db.query(AllCosts).filter(AllCosts.cost_id == cost_id).first()
        if not db_cost:
            raise HTTPException(status_code=404, detail="Nie znaleziono kosztu o podanym ID")

        # Sprawdź czy istnieje podany rodzaj kosztu
        cost_kind = db.query(CostKind).filter(CostKind.kind == cost.cost_kind).first()
        if not cost_kind:
            raise HTTPException(
                status_code=400,
                detail="Podany rodzaj kosztu nie istnieje"
            )

        # --- AUDIT LOG: Zapisz zmiany ---
        new_values = cost.model_dump()
        current_user = new_values.pop('current_user', None)  # Wyciągnij current_user

        # TYLKO pola edytowalne przez użytkownika w formularzu
        editable_fields = {
            'cost_contrahent',  # Nazwa kontrahenta
            'cost_nip',  # NIP
            'cost_doc_no',  # Numer faktury
            'cost_value',  # Kwota
            'cost_mo',  # Miesiąc
            'cost_year',  # Rok
            'cost_kind',  # Rodzaj kosztu
            'cost_4what',  # Za co?
            'cost_own',  # Właściciel kosztu
            'cost_branch',  # Oddział
            'cost_ph'  # Przedstawiciel
        }

        changes = {}

        for key, new_value in new_values.items():
            # Rejestruj TYLKO pola edytowalne
            if key not in editable_fields:
                continue

            old_value = getattr(db_cost, key, None)
            if old_value != new_value:
                changes[key] = {
                    "old": str(old_value) if old_value is not None else None,
                    "new": str(new_value) if new_value is not None else None
                }

        # Tylko jeśli są zmiany
        if changes:
            audit_entry = CostAuditLog(
                event_type='UPDATE',
                cost_id=cost_id,
                user_name=current_user or "Nieznany użytkownik",
                changes=changes
            )
            db.add(audit_entry)
        # --- KONIEC AUDIT LOG ---

        # Aktualizuj dane kosztu (bez current_user)
        for key, value in new_values.items():
            setattr(db_cost, key, value)

        db.commit()
        db.refresh(db_cost)
        return db_cost

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Błąd podczas aktualizacji kosztu: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs/authors")
async def get_cost_authors(db: Session = Depends(get_db)):
    """
    Pobiera listę unikalnych autorów kosztów.
    """
    try:
        # Pobieranie unikalnych autorów kosztów
        authors = db.query(AllCosts.cost_author) \
            .distinct() \
            .order_by(AllCosts.cost_author) \
            .all()

        # Konwersja wyników zapytania do listy
        author_list = [author[0] for author in authors]

        return author_list
    except Exception as e:
        logger.error(f"Błąd podczas pobierania autorów kosztów: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


# Nowy endpoint do pobierania przedstawicieli handlowych
@router.get("/costs/representatives")
async def get_cost_representatives(db: Session = Depends(get_db)):
    """
    Pobiera listę unikalnych przedstawicieli handlowych z kosztów.
    """
    try:
        # Pobieranie unikalnych przedstawicieli, ignorując wartości null i puste
        representatives = db.query(AllCosts.cost_ph) \
            .filter(AllCosts.cost_ph.isnot(None)) \
            .filter(AllCosts.cost_ph != '') \
            .distinct() \
            .order_by(AllCosts.cost_ph) \
            .all()

        # Konwersja wyników zapytania do listy
        representatives_list = [rep[0] for rep in representatives]

        return representatives_list
    except Exception as e:
        logger.error(f"Błąd podczas pobierania przedstawicieli: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


# Cost Kinds endpoints
@router.get("/cost_kinds", response_model=List[CostKindResponse])
async def get_cost_kinds(db: Session = Depends(get_db)):
    """
    Pobiera listę wszystkich rodzajów kosztów.
    """
    try:
        cost_kinds = db.query(CostKind).order_by(CostKind.kind).all()
        return cost_kinds
    except Exception as e:
        logger.error(f"Błąd podczas pobierania rodzajów kosztów: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas pobierania rodzajów kosztów"
        )


@router.post("/cost_kinds", response_model=CostKindResponse)
async def create_cost_kind(cost_kind: CostKindCreate, db: Session = Depends(get_db)):
    """
    Tworzy nowy rodzaj kosztu.
    """
    try:
        if not cost_kind.kind.strip():
            raise HTTPException(
                status_code=400,
                detail="Nazwa rodzaju kosztu nie może być pusta"
            )

        existing = db.query(CostKind).filter(CostKind.kind == cost_kind.kind).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Rodzaj kosztu o takiej nazwie już istnieje"
            )

        db_cost_kind = CostKind(kind=cost_kind.kind)
        db.add(db_cost_kind)
        db.commit()
        db.refresh(db_cost_kind)
        return db_cost_kind
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas tworzenia rodzaju kosztu: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas tworzenia rodzaju kosztu"
        )


@router.get("/cost_kinds/{cost_kind_id}", response_model=CostKindResponse)
async def get_cost_kind(cost_kind_id: int, db: Session = Depends(get_db)):
    """
    Pobiera szczegóły konkretnego rodzaju kosztu.
    """
    try:
        cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
        if not cost_kind:
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono rodzaju kosztu"
            )
        return cost_kind
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Błąd podczas pobierania rodzaju kosztu: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas pobierania rodzaju kosztu"
        )


@router.put("/cost_kinds/{cost_kind_id}", response_model=CostKindResponse)
async def update_cost_kind(
        cost_kind_id: int,
        cost_kind: CostKindCreate,
        db: Session = Depends(get_db)
):
    """
    Aktualizuje istniejący rodzaj kosztu.
    """
    try:
        if not cost_kind.kind.strip():
            raise HTTPException(
                status_code=400,
                detail="Nazwa rodzaju kosztu nie może być pusta"
            )

        db_cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
        if not db_cost_kind:
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono rodzaju kosztu"
            )

        existing = db.query(CostKind).filter(
            and_(
                CostKind.kind == cost_kind.kind,
                CostKind.id != cost_kind_id
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Rodzaj kosztu o takiej nazwie już istnieje"
            )

        db_cost_kind.kind = cost_kind.kind
        db.commit()
        db.refresh(db_cost_kind)
        return db_cost_kind
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas aktualizacji rodzaju kosztu: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas aktualizacji rodzaju kosztu"
        )


@router.delete("/cost_kinds/{cost_kind_id}")
async def delete_cost_kind(cost_kind_id: int, db: Session = Depends(get_db)):
    """
    Usuwa rodzaj kosztu jeśli nie jest używany.
    """
    try:
        db_cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
        if not db_cost_kind:
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono rodzaju kosztu"
            )

        # Sprawdź czy nie ma powiązanych kosztów
        related_costs = db.query(AllCosts).filter(
            AllCosts.cost_kind == db_cost_kind.kind
        ).first()
        if related_costs:
            raise HTTPException(
                status_code=400,
                detail="Nie można usunąć rodzaju kosztu, który jest używany"
            )

        db.delete(db_cost_kind)
        db.commit()
        return {"ok": True, "message": "Rodzaj kosztu został usunięty"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas usuwania rodzaju kosztu: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas usuwania rodzaju kosztu"
        )


# Existing cost endpoints
@router.post("/costs", response_model=CostCreate)
async def create_cost(cost: CostCreate, db: Session = Depends(get_db)):
    """
    Dodaje nowy koszt do bazy danych.
    Wartości cost_branch_value, cost_hq_value i cost_ph_value są obliczane automatycznie przez triggery bazodanowe.
    """
    try:
        # Sprawdź czy istnieje podany rodzaj kosztu
        cost_kind = db.query(CostKind).filter(CostKind.kind == cost.cost_kind).first()
        if not cost_kind:
            raise HTTPException(
                status_code=400,
                detail="Podany rodzaj kosztu nie istnieje"
            )

        # Pobierz aktualne wartości z config_current_date
        config = db.query(ConfigCurrentDate).filter(ConfigCurrentDate.id == 1).first()
        if not config:
            raise HTTPException(status_code=404, detail="Nie znaleziono konfiguracji daty")

        # Usuń current_user z danych (nie jest polem w AllCosts)
        cost_data = cost.model_dump()
        cost_data.pop('current_user', None)

        # Utwórz nowy rekord kosztu
        db_cost = AllCosts(
            cur_day=config.day_value,
            cur_mo=config.month_value,
            cur_yr=config.year_value,
            **cost_data
        )

        db.add(db_cost)
        db.commit()
        db.refresh(db_cost)
        return db_cost

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kosztu: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


# ZAKTUALIZOWANY ENDPOINT Z OBSŁUGĄ WYSZUKIWANIA
@router.get("/costs")
async def get_costs(
        db: Session = Depends(get_db),
        year: Optional[int] = None,
        month: Optional[int] = None,
        branch: Optional[str] = None,
        cost_own: Optional[str] = None,
        cost_kind: Optional[str] = None,
        cost_author: Optional[str] = None,
        cost_ph: Optional[str] = None,
        # --- DODANE PARAMETRY DLA WYSZUKIWANIA ---
        contrahent_like: Optional[str] = None,  # Wyszukiwanie kontrahenta
        amount_gte: Optional[float] = None,  # Minimalna kwota
        amount_lte: Optional[float] = None,  # Maksymalna kwota
        # ----------------------------------------
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0)
):
    """
    Pobiera listę kosztów z możliwością filtrowania po różnych parametrach.

    Nowe parametry:
    - contrahent_like: Wyszukiwanie kontrahenta (LIKE '%text%')
    - amount_gte: Minimalna kwota kosztu
    - amount_lte: Maksymalna kwota kosztu
    """
    try:
        query = db.query(AllCosts)

        # Istniejące filtry
        if year is not None:
            query = query.filter(AllCosts.cost_year == year)
        if month is not None:
            query = query.filter(AllCosts.cost_mo == month)
        if branch:
            query = query.filter(AllCosts.cost_branch == branch)
        if cost_own:
            query = query.filter(AllCosts.cost_own == cost_own)
        if cost_kind:
            query = query.filter(AllCosts.cost_kind == cost_kind)
        if cost_author:
            query = query.filter(AllCosts.cost_author == cost_author)
        if cost_ph:
            query = query.filter(AllCosts.cost_ph == cost_ph)

        # --- DODANE FILTRY WYSZUKIWANIA ---
        # Wyszukiwanie kontrahenta (case-insensitive)
        if contrahent_like:
            query = query.filter(
                AllCosts.cost_contrahent.ilike(f"%{contrahent_like}%")
            )

        # Filtrowanie po kwocie
        if amount_gte is not None:
            query = query.filter(AllCosts.cost_value >= amount_gte)

        if amount_lte is not None:
            query = query.filter(AllCosts.cost_value <= amount_lte)
        # ------------------------------------

        # Pobierz całkowitą liczbę rekordów dla danego filtra
        total_count = query.count()

        # Oblicz sumę cost_value dla wszystkich filtrowanych rekordów
        total_sum = query.with_entities(func.sum(AllCosts.cost_value)).scalar() or 0

        # Zastosuj paginację
        costs = query.order_by(AllCosts.cost_id.desc()).offset(offset).limit(limit).all()

        # Debug info (można usunąć w produkcji)
        logger.info(
            f"Filtry wyszukiwania: contrahent_like={contrahent_like}, amount_gte={amount_gte}, amount_lte={amount_lte}")
        logger.info(f"Znaleziono {total_count} kosztów, zwracam {len(costs)} rekordów")

        return {
            "total": total_count,
            "total_sum": float(total_sum),
            "costs": costs,
            "offset": offset,
            "limit": limit
        }

    except Exception as e:
        logger.error(f"Błąd podczas pobierania kosztów: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs/summary")
async def get_costs_summary(
        db: Session = Depends(get_db),
        year: Optional[int] = None,
        month: Optional[int] = None,
        branch: Optional[str] = None,
        cost_ph: Optional[str] = None  # Dodane filtrowanie po przedstawicielu
):
    """
    Zwraca podsumowanie kosztów z podziałem na różne kategorie.
    Możliwość filtrowania po roku, miesiącu, oddziale i przedstawicielu.
    """
    try:
        query = db.query(AllCosts)

        if year is not None:
            query = query.filter(AllCosts.cost_year == year)
        if month is not None:
            query = query.filter(AllCosts.cost_mo == month)
        if branch:
            query = query.filter(AllCosts.cost_branch == branch)
        if cost_ph:
            query = query.filter(AllCosts.cost_ph == cost_ph)  # Dodany filtr po przedstawicielu

        # Jeśli podano przedstawiciela, zwracamy tylko jego koszty
        if cost_ph:
            summary = db.query(
                func.sum(AllCosts.cost_value).label("total_cost"),
                func.sum(AllCosts.cost_ph_value).label("total_ph_cost")
            ).filter(query.whereclause).first()

            # Podsumowanie według kategorii kosztów dla przedstawiciela
            cost_types = db.query(
                AllCosts.cost_kind,
                func.sum(AllCosts.cost_value).label("total")
            ).filter(query.whereclause).group_by(AllCosts.cost_kind).all()

            return {
                "total_summary": {
                    "total_cost": float(summary.total_cost or 0),
                    "total_ph_cost": float(summary.total_ph_cost or 0)
                },
                "by_cost_type": {
                    item.cost_kind: float(item.total or 0)
                    for item in cost_types
                }
            }
        else:
            # Standardowe podsumowanie dla wszystkich
            summary = db.query(
                func.sum(AllCosts.cost_value).label("total_cost"),
                func.sum(AllCosts.cost_branch_value).label("total_branch_cost"),
                func.sum(AllCosts.cost_hq_value).label("total_hq_cost"),
                func.sum(AllCosts.cost_ph_value).label("total_ph_cost")
            ).filter(query.whereclause).first()

            # Podsumowanie według kategorii kosztów
            cost_types = db.query(
                AllCosts.cost_kind,
                func.sum(AllCosts.cost_value).label("total")
            ).filter(query.whereclause).group_by(AllCosts.cost_kind).all()

            return {
                "total_summary": {
                    "total_cost": float(summary.total_cost or 0),
                    "total_branch_cost": float(summary.total_branch_cost or 0),
                    "total_hq_cost": float(summary.total_hq_cost or 0),
                    "total_ph_cost": float(summary.total_ph_cost or 0)
                },
                "by_cost_type": {
                    item.cost_kind: float(item.total or 0)
                    for item in cost_types
                }
            }

    except Exception as e:
        logger.error(f"Błąd podczas pobierania podsumowania kosztów: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/costs/representatives-summary")
async def get_representatives_costs_summary(
        db: Session = Depends(get_db),
        year: Optional[int] = None,
        month: Optional[int] = None,
        branch: Optional[str] = None,
        representative: Optional[str] = None
):
    """
    Zwraca zagregowane koszty przedstawicieli z podziałem na rok/miesiąc/oddział.
    WAŻNE: Ten endpoint musi być PRZED /costs/{cost_id} w kolejności!
    """
    try:
        # Podstawowe zapytanie z agregacją
        query = db.query(
            AllCosts.cost_ph.label("representative"),
            AllCosts.cost_year.label("year"),
            AllCosts.cost_mo.label("month"),
            AllCosts.cost_branch.label("branch"),
            func.sum(AllCosts.cost_ph_value).label("total_ph_cost")
        ).filter(
            AllCosts.cost_ph.isnot(None),
            AllCosts.cost_ph != "",
            AllCosts.cost_ph_value.isnot(None),
            AllCosts.cost_ph_value > 0
        )

        # Zastosuj filtry opcjonalne
        if year is not None:
            query = query.filter(AllCosts.cost_year == year)
        if month is not None:
            query = query.filter(AllCosts.cost_mo == month)
        if branch:
            query = query.filter(AllCosts.cost_branch == branch)
        if representative:
            query = query.filter(AllCosts.cost_ph == representative)

        # Grupowanie po wszystkich wymiarach
        query = query.group_by(
            AllCosts.cost_ph,
            AllCosts.cost_year,
            AllCosts.cost_mo,
            AllCosts.cost_branch
        ).order_by(
            AllCosts.cost_year.desc(),
            AllCosts.cost_mo.desc(),
            AllCosts.cost_ph,
            AllCosts.cost_branch
        )

        # Wykonaj zapytanie
        results = query.all()

        # Formatuj wyniki
        data = []
        total_cost = 0
        unique_representatives = set()
        unique_branches = set()

        for item in results:
            cost_value = float(item.total_ph_cost or 0)
            total_cost += cost_value
            unique_representatives.add(item.representative)
            unique_branches.add(item.branch)

            data.append({
                "representative": item.representative,
                "year": item.year,
                "month": item.month,
                "branch": item.branch,
                "total_ph_cost": cost_value
            })

        # Przygotuj podsumowanie
        summary = {
            "total_records": len(data),
            "total_cost": total_cost,
            "unique_representatives": len(unique_representatives),
            "unique_branches": len(unique_branches),
            "filters_applied": {
                "year": year,
                "month": month,
                "branch": branch,
                "representative": representative
            }
        }

        return {
            "data": data,
            "summary": summary
        }

    except Exception as e:
        logger.error(f"Błąd podczas pobierania zagregowanych kosztów przedstawicieli: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Błąd wewnętrzny serwera: {str(e)}"
        )


@router.get("/costs/{cost_id}")
async def get_cost_by_id(cost_id: int, db: Session = Depends(get_db)):
    """
    Pobiera szczegóły konkretnego kosztu na podstawie jego ID.
    """
    try:
        cost = db.query(AllCosts).filter(AllCosts.cost_id == cost_id).first()
        if not cost:
            raise HTTPException(status_code=404, detail="Nie znaleziono kosztu o podanym ID")
        return cost
    except Exception as e:
        logger.error(f"Błąd podczas pobierania kosztu: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.delete("/costs/{cost_id}")
async def delete_cost(
        cost_id: int,
        current_user: str = Query(..., description="Nazwa użytkownika usuwającego koszt"),
        db: Session = Depends(get_db)
):
    """
    Usuwa koszt o podanym ID z bazy danych.
    """
    try:
        cost = db.query(AllCosts).filter(AllCosts.cost_id == cost_id).first()
        if not cost:
            raise HTTPException(status_code=404, detail="Nie znaleziono kosztu o podanym ID")

        # --- AUDIT LOG: Zarejestruj usunięcie ze stanem kosztu ---
        # Zapisz wszystkieważne pola kosztu przed usunięciem
        deleted_cost_snapshot = {
            "cost_contrahent": str(cost.cost_contrahent),
            "cost_nip": str(cost.cost_nip),
            "cost_doc_no": str(cost.cost_doc_no),
            "cost_value": str(cost.cost_value),
            "cost_mo": str(cost.cost_mo),
            "cost_year": str(cost.cost_year),
            "cost_kind": str(cost.cost_kind),
            "cost_4what": str(cost.cost_4what),
            "cost_own": str(cost.cost_own),
            "cost_branch": str(cost.cost_branch),
            "cost_ph": str(cost.cost_ph) if cost.cost_ph else None,
            "cost_author": str(cost.cost_author)
        }

        audit_entry = CostAuditLog(
            event_type='DELETE',
            cost_id=cost_id,
            user_name=current_user,
            changes=deleted_cost_snapshot  # Zapisz stan kosztu w momencie usunięcia
        )
        db.add(audit_entry)
        # --- KONIEC AUDIT LOG ---

        db.delete(cost)
        db.commit()
        return {"status": "success", "message": f"Koszt o ID {cost_id} został usunięty"}
    except Exception as e:
        logger.error(f"Błąd podczas usuwania kosztu: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")