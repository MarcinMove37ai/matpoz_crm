# routes/transactions.py
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import text, func, or_, and_
from sqlalchemy.orm import Session
from datetime import datetime, date
import logging
import time

from models.transaction import (
    Transaction,
    NetSalesBranchTotal, ProfitTotal, ProfitPayd,
    NetSalesBranchPayd, CostKind,
    NetSalesRepresentativeTotal, ProfitRepresentativeTotal, ConfigCurrentDate, AggregatedSalesData,
    ProfitRepresentativePayd, NetSalesRepresentativePayd, AggregatedData, AggregatedDataHist, AggregatedDataSums
)
from database import get_db
import schemas
from sqlalchemy import case, literal_column

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/aggregated_profits")
def get_aggregated_profits(
        db: Session = Depends(get_db),
        branch: str = Query(None),
        year: int = Query(None),
        month: int = Query(None),
        aggregate_company: bool = Query(False),
        measure_timings: bool = Query(False),
        columns: list[str] = Query(
            None,
            description="Lista kolumn do pobrania. Jeśli nie podano, zwracane są wszystkie kolumny."
        )
):
    """
    Zwraca zagregowane dane o zyskach pobrane z tabeli transactions.
    Dane można filtrować po roku, miesiącu i oddziale.
    Można również wybrać konkretne kolumny do pobrania i zagregować dane dla całej firmy.
    """
    try:
        overall_start = time.perf_counter()

        # Przygotowujemy kolumny z agregatami dla wszystkich wartości
        # Używamy wyrażenia is_paid zdefiniowanego w modelu Transaction
        base_columns = {
            "hq_profit": func.sum(Transaction.hq_profit).label("hq_profit"),
            "branch_profit": func.sum(Transaction.branch_profit).label("branch_profit"),
            "rep_profit": func.sum(Transaction.rep_profit).label("rep_profit"),
            "found": func.sum(Transaction.found).label("found"),
            "profit": func.sum(Transaction.profit).label("profit"),
            "hq_profit_paid": func.sum(Transaction.hq_profit).filter(
                Transaction.is_paid
            ).label("hq_profit_paid"),
            "branch_profit_paid": func.sum(Transaction.branch_profit).filter(
                Transaction.is_paid
            ).label("branch_profit_paid"),
            "rep_profit_paid": func.sum(Transaction.rep_profit).filter(
                Transaction.is_paid
            ).label("rep_profit_paid"),
            "found_paid": func.sum(Transaction.found).filter(
                Transaction.is_paid
            ).label("found_paid"),
            "profit_paid": func.sum(Transaction.profit).filter(
                Transaction.is_paid
            ).label("profit_paid")
        }

        # Przygotowujemy kolumny do zapytania
        query_columns = []

        # Sprawdzamy, czy powinniśmy agregować dane (roczne lub dla całej firmy)
        aggregate_yearly = (year is not None and month is None)

        if not aggregate_yearly and not aggregate_company:
            # Standardowe grupowanie po roku, miesiącu i oddziale
            query_columns.extend([
                Transaction.year,
                Transaction.month,
                Transaction.branch_name
            ])

        # Dodajemy wybrane kolumny lub wszystkie jeśli nie wybrano
        if columns:
            for col in columns:
                if col in base_columns:
                    query_columns.append(base_columns[col])
        else:
            for col_name, col in base_columns.items():
                query_columns.append(col)

        # Budujemy zapytanie podstawowe z wybranymi kolumnami
        query = db.query(*query_columns)

        # Dodajemy filtry
        if branch:
            query = query.filter(Transaction.branch_name == branch)
        if year:
            query = query.filter(Transaction.year == year)
        if month:
            query = query.filter(Transaction.month == month)

        # Grupujemy wyniki
        if aggregate_company or aggregate_yearly:
            # Jeśli agregujemy dane dla całej firmy lub za cały rok, nie dodajemy grupowania
            pass
        else:
            # Grupujemy standardowo po roku, miesiącu i oddziale
            query = query.group_by(Transaction.year, Transaction.month, Transaction.branch_name)

        # Wykonanie zapytania z pomiarem czasu
        t = time.perf_counter()
        results = query.all()
        execution_time = time.perf_counter() - t

        # Przetwarzanie wyników do formatu JSON
        def process_row(row):
            if not row:
                return None

            # Inicjalizujemy z kluczami
            result = {}

            if not aggregate_yearly and not aggregate_company:
                result = {
                    "year": getattr(row, "year", year),
                    "month": getattr(row, "month", month),
                    "branch": getattr(row, "branch_name", "ALL" if aggregate_company else branch)
                }
            else:
                # Dla danych zagregowanych
                result = {
                    "year": year,
                    "month": month if not aggregate_yearly else None,
                    "branch": "ALL" if aggregate_company else branch
                }

            # Dodajemy wartości dla kolumn, które są w wynikach
            for col_name in base_columns.keys():
                if columns is None or col_name in columns:
                    # Próbujemy uzyskać wartość bezpośrednio z nazwy lub z klucza kolumny
                    value = getattr(row, col_name, None)
                    if value is not None:
                        result[col_name] = float(value or 0)
                    else:
                        # Jeśli wartość nie jest dostępna, ustawiamy 0
                        result[col_name] = 0.0

            return result

        processed_data = [
            row for row in (process_row(row) for row in results)
            if row is not None
        ]

        # Jeśli brak wyników, ale są filtry, zwracamy pustą strukturę
        if not processed_data and (year or month or branch):
            empty_result = {
                "year": year,
                "month": month if not aggregate_yearly else None,
                "branch": branch if not aggregate_company else "ALL"
            }

            # Dodajemy zerowe wartości dla wszystkich wybranych kolumn
            for col_name in base_columns.keys():
                if columns is None or col_name in columns:
                    empty_result[col_name] = 0.0

            processed_data.append(empty_result)

        result = {"data": processed_data}

        # Jeśli poproszono o pomiar czasu, dodajemy statystyki
        if measure_timings:
            result["timings"] = {
                "query": execution_time,
                "total": time.perf_counter() - overall_start
            }

        return result

    except Exception as e:
        logger.error(f"Error in /aggregated_profits endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.put("/config/update-date")
def update_config_date(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    start_time = time.time()
    try:
        # Pobierz bieżącą datę
        current_date = datetime.now().date()

        try:
            # 1. NAJPIERW TYLKO AKTUALIZACJA DATY (SZYBKA OPERACJA)
            # Dezaktywuj tymczasowo triggery związane z agregatami
            db.execute(text("ALTER TABLE config_current_date DISABLE TRIGGER trg_update_aggregated_data_config"))
            db.execute(text("ALTER TABLE config_current_date DISABLE TRIGGER trg_update_historical_data"))
            db.execute(text("ALTER TABLE config_current_date DISABLE TRIGGER trg_update_summary_from_config"))
            db.execute(
                text("ALTER TABLE config_current_date DISABLE TRIGGER trg_update_summary_after_config_date_change"))

            # Aktualizuj samą datę - szybka operacja
            query = text("UPDATE config_current_date SET config_date = :date WHERE id = 1")
            db.execute(query, {"date": current_date})

            # Sprawdź, czy istnieje rekord do aktualizacji
            count = db.execute(text("SELECT COUNT(*) FROM config_current_date WHERE id = 1")).scalar()

            # Jeśli nie ma rekordu, wstaw nowy
            if count == 0:
                insert_query = text("INSERT INTO config_current_date (id, config_date) VALUES (1, :date)")
                db.execute(insert_query, {"date": current_date})

            db.commit()

            # 2. ZAPLANUJ ODŚWIEŻENIE AGREGATÓW W TLE
            background_tasks.add_task(refresh_aggregate_data, db)

            execution_time = time.time() - start_time

            return {
                "success": True,
                "date": current_date.isoformat(),
                "execution_time_seconds": round(execution_time, 4),
                "message": "Data została zaktualizowana. Agregaty zostaną odświeżone w tle."
            }
        finally:
            pass  # Nie zamykamy sesji db, ponieważ jest zarządzana przez FastAPI Depends
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Błąd podczas aktualizacji daty: {e}, czas: {execution_time:.4f}s")
        raise HTTPException(status_code=500, detail=f"Błąd aktualizacji daty: {str(e)}")


# Funkcja odświeżająca agregaty w tle
def refresh_aggregate_data(db: Session):
    """Funkcja uruchamiana w tle do odświeżenia zagregowanych danych"""
    try:
        # Włącz z powrotem triggery
        db.execute(text("ALTER TABLE config_current_date ENABLE TRIGGER ALL"))

        # Ręcznie wywołaj odświeżenie agregatów
        db.execute(text("SELECT populate_aggregated_data()"))
        db.execute(text("SELECT populate_aggregated_data_hist()"))
        db.execute(text("SELECT populate_aggregated_data_sums()"))
        db.execute(text("SELECT refresh_aggregated_sales_data()"))
        db.execute(text("SELECT refresh_representative_aggregated_data()"))

        db.commit()
        logger.info("Pomyślnie odświeżono agregaty w tle")
    except Exception as e:
        logger.error(f"Błąd podczas odświeżania agregatów w tle: {e}")


@router.get("/representatives")
def get_representatives(
        db: Session = Depends(get_db),
        branch: str = Query(None, description="Nazwa oddziału do filtrowania przedstawicieli")
):
    """
    Zwraca listę unikalnych przedstawicieli z tabeli transactions.
    Jeśli podano parametr branch, zwraca tylko przedstawicieli powiązanych z danym oddziałem.
    """
    try:
        # Podstawowe zapytanie pobierające unikalne representative_name
        query = db.query(Transaction.representative_name, Transaction.id)

        # Filtrowanie niepustych wartości
        query = query.filter(
            Transaction.representative_name.isnot(None),
            Transaction.representative_name != "",
            Transaction.representative_name != "0"
        )

        # Jeśli podano oddział, filtruj po branch_name
        if branch:
            # Normalizacja nazwy oddziału (uwzględnienie różnic w pisowni)
            branch_mapping = {
                "LUBLIN": "Lublin",
                "PCIM": "Pcim",
                "RZGOW": "Rzgów",
                "RZGÓW": "Rzgów",
                "MALBORK": "Malbork",
                "LOMZA": "Łomża",
                "ŁOMŻA": "Łomża",
                "LOMŻA": "Łomża",
                "MYSLIBORZ": "Myślibórz",
                "MYŚLIBÓRZ": "Myślibórz",
                "MG": "MG",
                "STH": "STH",
                "BHP": "BHP"
            }

            normalized_branch = branch_mapping.get(branch.upper(), branch)
            query = query.filter(Transaction.branch_name == normalized_branch)

        # Pobierz unikalne rekordy i posortuj alfabetycznie
        representatives = query.distinct(Transaction.representative_name).order_by(
            Transaction.representative_name).all()

        # Przygotuj dane w formacie przyjaznym dla API
        result = [
            {
                "id": str(rep.id),
                "representative_name": rep.representative_name
            }
            for rep in representatives
        ]

        return result

    except Exception as e:
        logger.error(f"Error in /representatives endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/cost_kinds", response_model=schemas.CostKind)
def create_cost_kind(cost_kind: schemas.CostKindCreate, db: Session = Depends(get_db)):
    db_cost_kind = CostKind(kind=cost_kind.kind)
    db.add(db_cost_kind)
    db.commit()
    db.refresh(db_cost_kind)
    return db_cost_kind


@router.get("/cost_kinds/{cost_kind_id}", response_model=schemas.CostKind)
def read_cost_kind(cost_kind_id: int, db: Session = Depends(get_db)):
    cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
    if not cost_kind:
        raise HTTPException(status_code=404, detail="Cost kind not found")
    return cost_kind


@router.put("/cost_kinds/{cost_kind_id}", response_model=schemas.CostKind)
def update_cost_kind(cost_kind_id: int, cost_kind: schemas.CostKindUpdate, db: Session = Depends(get_db)):
    db_cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
    if not db_cost_kind:
        raise HTTPException(status_code=404, detail="Cost kind not found")
    db_cost_kind.kind = cost_kind.kind
    db.commit()
    db.refresh(db_cost_kind)
    return db_cost_kind


@router.delete("/cost_kinds/{cost_kind_id}")
def delete_cost_kind(cost_kind_id: int, db: Session = Depends(get_db)):
    db_cost_kind = db.query(CostKind).filter(CostKind.id == cost_kind_id).first()
    if not db_cost_kind:
        raise HTTPException(status_code=404, detail="Cost kind not found")
    db.delete(db_cost_kind)
    db.commit()
    return {"ok": True}


# --- NOWY ENDPOINT DLA ZEROWEJ MARŻY (KROK 1) ---
@router.get("/transactions/zero-margin", response_model=schemas.PaginatedZeroMarginResponse)
def get_zero_margin_transactions(
        db: Session = Depends(get_db),
        year: int = Query(None),
        branch: str = Query(None),
        representative: str = Query(None),
        date_from: str = Query(None),
        date_to: str = Query(None),
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0)
):
    """
    Pobiera transakcje, które mają 100% marży (Zysk == Netto).
    Dopuszczamy minimalną różnicę 0.02 PLN na błędy zaokrągleń.
    """
    try:
        query = db.query(Transaction)

        # 1. Główny warunek: Netto > 0 ORAZ |Netto - Zysk| < 0.02
        # Używamy func.abs() dla bezpiecznego porównania liczb zmiennoprzecinkowych
        query = query.filter(
            Transaction.net_value > 0,
            func.abs(Transaction.net_value - Transaction.profit) < 0.02
        )

        # 2. Filtrowanie dynamiczne
        if year:
            query = query.filter(Transaction.year == year)

        if branch and branch != 'all':
            query = query.filter(Transaction.branch_name == branch)

        if representative and representative != 'all':
            query = query.filter(Transaction.representative_name == representative)

        if date_from:
            query = query.filter(Transaction.created_at >= date_from)

        if date_to:
            # Dodajemy czas 23:59:59 dla daty końcowej, aby objąć cały dzień
            query = query.filter(Transaction.created_at <= f"{date_to} 23:59:59")

        # 3. Liczenie całkowitej ilości (dla paginacji)
        total = query.count()

        # 4. Pobieranie danych z limitem i offsetem
        transactions = query.order_by(Transaction.created_at.desc()) \
            .offset(offset) \
            .limit(limit) \
            .all()

        # 5. Mapowanie modelu DB na schemat Pydantic
        # Zauważ mapowanie: document_number -> doc_no, customer_nip -> nip
        mapped_data = []
        for t in transactions:
            mapped_data.append(schemas.ZeroMarginTransaction(
                id=t.id,
                date=t.created_at,
                doc_no=t.document_number,
                nip=t.customer_nip,  # W bazie jest NIP, nie nazwa kontrahenta
                net_value=float(t.net_value or 0),
                profit=float(t.profit or 0),
                representative=t.representative_name,
                branch=t.branch_name
            ))

        return {
            "data": mapped_data,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Error in /transactions/zero-margin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------


@router.get("/years")
async def get_transaction_years(db: Session = Depends(get_db)):
    """
    Returns unique years from transactions table and current year from config
    """
    try:
        # Get current year from config
        config = db.query(ConfigCurrentDate).filter(ConfigCurrentDate.id == 1).first()
        current_year = config.year_value if config else None

        # Get unique years from transactions
        years = db.query(Transaction.year).distinct().order_by(Transaction.year.desc()).all()
        years = [year[0] for year in years if year[0] is not None]

        return {
            "years": years,
            "currentYear": current_year
        }

    except Exception as e:
        logger.error(f"Error in /years endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/date")
async def get_current_date(db: Session = Depends(get_db)):
    """
    Returns the current configured date from the config_current_date table.
    This date is used as the reference point for all calculations and aggregations.
    """
    try:
        config = db.query(ConfigCurrentDate).filter(ConfigCurrentDate.id == 1).first()

        if not config:
            raise HTTPException(
                status_code=404,
                detail="Configuration not found"
            )

        return {
            "date": config.config_date.isoformat(),
            "year": config.year_value,
            "month": config.month_value,
            "day": config.day_value
        }

    except Exception as e:
        logger.error(f"Error in /date endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/health", include_in_schema=False)
def health_check():
    """
    Prosty endpoint health check, który zwraca status 'ok'.
    Ustawienie include_in_schema na False powoduje, że endpoint nie pojawi się w dokumentacji OpenAPI.
    """
    return {"status": "ok"}


@router.get("/first_stats")
def get_first_stats(
        db: Session = Depends(get_db),
        measure_timings: bool = Query(False, description="If true - add execution times for sequences")
):
    """
    Returns statistics from AggregatedData table for current day and month.
    Data is pre-aggregated and stored in a dedicated table for fast access.
    """
    try:
        def process_aggregated_row(row):
            """Helper function to process an aggregated data row"""
            if not row:
                return None

            return {
                "branches": {
                    "total": {
                        "net_sales": float(row.net_sale_total_all_branch or 0),
                        "profit": float(row.net_profit_total_all_branch or 0),
                        "net_sales_paid": float(row.net_sale_payd_all_branch or 0),
                        "profit_paid": float(row.net_profit_payd_all_branch or 0)
                    },
                    "details": {
                        "Rzgów": {
                            "net_sales": float(row.net_sale_total_rzgow or 0),
                            "profit": float(row.net_profit_total_rzgow or 0)
                        },
                        "Malbork": {
                            "net_sales": float(row.net_sale_total_malbork or 0),
                            "profit": float(row.net_profit_total_malbork or 0)
                        },
                        "Pcim": {
                            "net_sales": float(row.net_sale_total_pcim or 0),
                            "profit": float(row.net_profit_total_pcim or 0)
                        },
                        "Lublin": {
                            "net_sales": float(row.net_sale_total_lublin or 0),
                            "profit": float(row.net_profit_total_lublin or 0)
                        },
                        "Łomża": {
                            "net_sales": float(row.net_sale_total_lomza or 0),
                            "profit": float(row.net_profit_total_lomza or 0)
                        },
                        "Myślibórz": {
                            "net_sales": float(row.net_sale_total_mysliborz or 0),
                            "profit": float(row.net_profit_total_mysliborz or 0)
                        },
                        "MG": {
                            "net_sales": float(row.net_sale_total_mg or 0),
                            "profit": float(row.net_profit_total_mg or 0)
                        },
                        "STH": {
                            "net_sales": float(row.net_sale_total_sth or 0),
                            "profit": float(row.net_profit_total_sth or 0)
                        },
                        "BHP": {
                            "net_sales": float(row.net_sale_total_bhp or 0),
                            "profit": float(row.net_profit_total_bhp or 0)
                        }
                    }
                },
                "representatives": {
                    "total": {
                        "net_sales": float(row.net_sale_total_all_representative or 0),
                        "profit": float(row.net_profit_total_all_representative or 0)
                    }
                }
            }

        overall_start = time.perf_counter()
        timings = {}

        # Get daily stats
        t = time.perf_counter()
        daily_data = db.query(AggregatedData).filter(
            AggregatedData.aggregation_type == 'today'
        ).first()
        daily_stats = process_aggregated_row(daily_data)
        if measure_timings:
            timings["daily"] = time.perf_counter() - t

        # Get monthly stats
        t = time.perf_counter()
        monthly_data = db.query(AggregatedData).filter(
            AggregatedData.aggregation_type == 'current_month'
        ).first()
        monthly_stats = process_aggregated_row(monthly_data)
        if measure_timings:
            timings["monthly"] = time.perf_counter() - t

        overall_time = time.perf_counter() - overall_start

        result = {
            "daily": daily_stats,
            "monthly": monthly_stats
        }

        if measure_timings:
            result["timings"] = {
                "daily": timings.get("daily"),
                "monthly": timings.get("monthly"),
                "total": overall_time
            }

        return result

    except Exception as e:
        logger.error(f"Error in /first_stats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/sum_stats")
def get_sum_stats(
        db: Session = Depends(get_db),
        measure_timings: bool = Query(False, description="If true - add execution times for sequences")
):
    """
    Returns yearly aggregated statistics from AggregatedDataSums table.
    Data is pre-aggregated and stored in a dedicated table for fast access.
    """
    try:
        def process_sums_row(row):
            """Helper function to process aggregated sums data row"""
            if not row:
                return None

            return {
                "total": {
                    "net_sales": float(row.net_sales_total_year or 0),
                    "profit": float(row.profit_total_year or 0),
                    "net_sales_paid": float(row.net_sales_payd_year or 0),
                    "profit_paid": float(row.profit_payd_year or 0)
                },
                "representatives": {
                    "net_sales": float(row.net_sales_ph_year or 0),
                    "profit": float(row.profit_ph_year or 0)
                },
                "branches": {
                    "Rzgów": {
                        "net_sales": float(row.net_sales_rzgow_year or 0),
                        "profit": float(row.profit_rzgow_year or 0)
                    },
                    "Malbork": {
                        "net_sales": float(row.net_sales_malbork_year or 0),
                        "profit": float(row.profit_malbork_year or 0)
                    },
                    "Pcim": {
                        "net_sales": float(row.net_sales_pcim_year or 0),
                        "profit": float(row.profit_pcim_year or 0)
                    },
                    "Lublin": {
                        "net_sales": float(row.net_sales_lublin_year or 0),
                        "profit": float(row.profit_lublin_year or 0)
                    },
                    "Łomża": {
                        "net_sales": float(row.net_sales_lomza_year or 0),
                        "profit": float(row.profit_lomza_year or 0)
                    },
                    "Myślibórz": {
                        "net_sales": float(row.net_sales_mysliborz_year or 0),
                        "profit": float(row.profit_mysliborz_year or 0)
                    },
                    "MG": {
                        "net_sales": float(row.net_sales_mg_year or 0),
                        "profit": float(row.profit_mg_year or 0)
                    },
                    "STH": {
                        "net_sales": float(row.net_sales_sth_year or 0),
                        "profit": float(row.profit_sth_year or 0)
                    },
                    "BHP": {
                        "net_sales": float(row.net_sales_bhp_year or 0),
                        "profit": float(row.profit_bhp_year or 0)
                    }
                }
            }

        overall_start = time.perf_counter()

        # Get sums data
        t = time.perf_counter()
        sums_data = db.query(AggregatedDataSums).filter(
            AggregatedDataSums.id == 1
        ).first()
        execution_time = time.perf_counter() - t

        if not sums_data:
            raise HTTPException(
                status_code=404,
                detail="Aggregated sums data not found"
            )

        stats = process_sums_row(sums_data)
        overall_time = time.perf_counter() - overall_start

        result = {
            "year_totals": stats
        }

        if measure_timings:
            result["timings"] = {
                "query": execution_time,
                "total": overall_time
            }

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in /sum_stats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/second_stats")
def get_second_stats(
        db: Session = Depends(get_db),
        measure_timings: bool = Query(False, description="If true - add execution times for sequences")
):
    """
    Returns historical statistics from AggregatedDataHist table.
    Contains pre-aggregated data for the last 3 months.
    """
    try:
        def process_historical_row(row):
            """Helper function to process a historical data row"""
            if not row:
                return None

            return {
                "month": row.aggregation_month,
                "branches": {
                    "total": {
                        "net_sales": float(row.net_sale_total_all_branch or 0),
                        "profit": float(row.net_profit_total_all_branch or 0),
                        "net_sales_paid": float(row.net_sale_payd_all_branch or 0),
                        "profit_paid": float(row.net_profit_payd_all_branch or 0)
                    },
                    "details": {
                        "Rzgów": {
                            "net_sales": float(row.net_sale_total_rzgow or 0),
                            "profit": float(row.net_profit_total_rzgow or 0)
                        },
                        "Malbork": {
                            "net_sales": float(row.net_sale_total_malbork or 0),
                            "profit": float(row.net_profit_total_malbork or 0)
                        },
                        "Pcim": {
                            "net_sales": float(row.net_sale_total_pcim or 0),
                            "profit": float(row.net_profit_total_pcim or 0)
                        },
                        "Lublin": {
                            "net_sales": float(row.net_sale_total_lublin or 0),
                            "profit": float(row.net_profit_total_lublin or 0)
                        },
                        "Łomża": {
                            "net_sales": float(row.net_sale_total_lomza or 0),
                            "profit": float(row.net_profit_total_lomza or 0)
                        },
                        "Myślibórz": {
                            "net_sales": float(row.net_sale_total_mysliborz or 0),
                            "profit": float(row.net_profit_total_mysliborz or 0)
                        },
                        "MG": {
                            "net_sales": float(row.net_sale_total_mg or 0),
                            "profit": float(row.net_profit_total_mg or 0)
                        },
                        "STH": {
                            "net_sales": float(row.net_sale_total_sth or 0),
                            "profit": float(row.net_profit_total_sth or 0)
                        },
                        "BHP": {
                            "net_sales": float(row.net_sale_total_bhp or 0),
                            "profit": float(row.net_profit_total_bhp or 0)
                        }
                    }
                },
                "representatives": {
                    "total": {
                        "net_sales": float(row.net_sale_total_all_representative or 0),
                        "profit": float(row.net_profit_total_all_representative or 0)
                    }
                }
            }

        overall_start = time.perf_counter()

        # Get historical data
        t = time.perf_counter()
        historical_data = db.query(AggregatedDataHist).order_by(
            AggregatedDataHist.aggregation_month.desc()
        ).all()

        historical_stats = [process_historical_row(row) for row in historical_data]

        execution_time = time.perf_counter() - t
        overall_time = time.perf_counter() - overall_start

        result = {
            "historical": historical_stats
        }

        if measure_timings:
            result["timings"] = {
                "historical": execution_time,
                "total": overall_time
            }

        return result

    except Exception as e:
        logger.error(f"Error in /second_stats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/aggregated_sales_data")
def get_aggregated_sales_data(
        db: Session = Depends(get_db),
        branch: str = Query(None),
        year: int = Query(None),
        month: int = Query(None),
        aggregate_company: bool = Query(False),
        measure_timings: bool = Query(False),
        columns: list[str] = Query(
            None,
            description="Lista kolumn do pobrania. Jeśli nie podano, zwracane są wszystkie kolumny."
        )
):
    try:
        # Definiujemy mapowanie kolumn
        available_columns = {
            "sales_net": AggregatedSalesData.asd_sales_net,
            "profit_net": AggregatedSalesData.asd_profit_net,
            "sales_payd": AggregatedSalesData.asd_sales_payd,
            "profit_payd": AggregatedSalesData.asd_profit_payd,
            "sales_payd_percent": AggregatedSalesData.asd_sales_payd_percent,
            "sales_ph": AggregatedSalesData.asd_sales_ph,
            "profit_ph": AggregatedSalesData.asd_profit_ph,
            "sales_ph_percent": AggregatedSalesData.asd_sales_ph_percent,
            "marg_branch": AggregatedSalesData.asd_marg_branch,
            "marg_ph": AggregatedSalesData.asd_marg_ph,
            "marg_total": AggregatedSalesData.asd_marg_total
        }

        # Zawsze potrzebujemy kolumny klucza głównego
        selected_columns = [
            AggregatedSalesData.asd_year,
            AggregatedSalesData.asd_month,
            AggregatedSalesData.asd_branch
        ]

        # Dodajemy wybrane kolumny lub wszystkie jeśli nie wybrano
        if columns:
            selected_columns.extend(
                available_columns[col] for col in columns
                if col in available_columns
            )
        else:
            selected_columns.extend(available_columns.values())

        # Budujemy zapytanie podstawowe z wybranymi kolumnami
        query = db.query(*selected_columns)

        # Dodajemy filtry
        if branch:
            query = query.filter(AggregatedSalesData.asd_branch == branch)
        if year:
            query = query.filter(AggregatedSalesData.asd_year == year)
        if month:
            query = query.filter(AggregatedSalesData.asd_month == month)

        # Jeśli aggregate_company=True, agregujemy dane dla całej firmy
        if aggregate_company:
            aggregated_columns = []
            for col in selected_columns[3:]:  # Pomijamy kolumny klucza
                if col in [
                    AggregatedSalesData.asd_sales_payd_percent,
                    AggregatedSalesData.asd_sales_ph_percent,
                    AggregatedSalesData.asd_marg_branch,
                    AggregatedSalesData.asd_marg_ph,
                    AggregatedSalesData.asd_marg_total
                ]:
                    # Dla kolumn procentowych obliczamy na podstawie sum
                    continue
                aggregated_columns.append(func.sum(col).label(col.key))

            # Dodajemy wyliczane kolumny procentowe jeśli są potrzebne
            if AggregatedSalesData.asd_sales_payd_percent in selected_columns:
                aggregated_columns.append(
                    (100.0 * func.sum(AggregatedSalesData.asd_sales_payd) /
                     func.nullif(func.sum(AggregatedSalesData.asd_sales_net), 0)
                     ).label('asd_sales_payd_percent')
                )
            if AggregatedSalesData.asd_sales_ph_percent in selected_columns:
                aggregated_columns.append(
                    (100.0 * func.sum(AggregatedSalesData.asd_sales_ph) /
                     func.nullif(func.sum(AggregatedSalesData.asd_sales_net), 0)
                     ).label('asd_sales_ph_percent')
                )
            if AggregatedSalesData.asd_marg_total in selected_columns:
                aggregated_columns.append(
                    (100.0 * func.sum(AggregatedSalesData.asd_profit_net) /
                     func.nullif(func.sum(AggregatedSalesData.asd_sales_net), 0)
                     ).label('asd_marg_total')
                )
            if AggregatedSalesData.asd_marg_ph in selected_columns:
                aggregated_columns.append(
                    (100.0 * func.sum(AggregatedSalesData.asd_profit_ph) /
                     func.nullif(func.sum(AggregatedSalesData.asd_sales_ph), 0)
                     ).label('asd_marg_ph')
                )
            if AggregatedSalesData.asd_marg_branch in selected_columns:
                aggregated_columns.append(
                    (100.0 * (func.sum(AggregatedSalesData.asd_profit_net) - func.sum(
                        AggregatedSalesData.asd_profit_ph)) /
                     func.nullif(
                         func.sum(AggregatedSalesData.asd_sales_net) - func.sum(AggregatedSalesData.asd_sales_ph), 0)
                     ).label('asd_marg_branch')
                )

            query = query.with_entities(*aggregated_columns)

        # Wykonanie zapytania z pomiarem czasu
        t = time.perf_counter()
        if aggregate_company:
            aggregated_rows = [query.first()]
        else:
            aggregated_rows = query.all()
        execution_time = time.perf_counter() - t

        # Przetwarzanie wyników do formatu JSON
        def process_row(row):
            if not row:
                return None

            result = {
                "year": getattr(row, "asd_year", year),
                "month": getattr(row, "asd_month", month),
                "branch": getattr(row, "asd_branch", "ALL")
            }

            # Dodajemy tylko wybrane kolumny
            for api_name, db_col in available_columns.items():
                if db_col in selected_columns:
                    result[api_name] = float(getattr(row, db_col.key, 0) or 0)

            return result

        processed_data = [
            row for row in (process_row(row) for row in aggregated_rows)
            if row is not None
        ]

        result = {"data": processed_data}
        if measure_timings:
            result["timings"] = {
                "query": execution_time,
                "total": time.perf_counter() - overall_start
            }

        return result

    except Exception as e:
        logger.error(f"Error in /aggregated_sales_data endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/all_stats")
def get_all_stats(
        db: Session = Depends(get_db),
        measure_timings: bool = Query(False, description="Jeśli true – dodaj czasy wykonania poszczególnych sekwencji")
):
    """
    Zwraca statystyki dla:
      - Bloku SUMA: globalne dane (wszystkie transakcje) z tabel:
          • transactions (dla dzisiejszych danych),
          • net_sales_branch_total, profit_total, net_sales_branch_payd, profit_payd (dla miesięcznych danych)
      - Bloku przedstawicieli: statystyki dla **każdego unikatowego przedstawiciela**,
          • dzisiaj: dane z tabeli transactions (filtrowane po representative_name),
          • miesięcznie: dane z tabel net_sales_representative_total, profit_representative_total,
                     net_sales_representative_payd, profit_representative_payd.
      - Bloków oddziałowych: dla każdego oddziału (Rzgów, Malbork, Pcim, Lublin, Łomża, Myślibórz)
          • dzisiaj: dane z tabeli transactions (filtrowane po branch_name),
          • miesięcznie: dane z tabel net_sales_branch_total, profit_total, net_sales_branch_payd, profit_payd.
    Dla danych miesięcznych pobieramy także historyczne dane z 3 poprzednich miesięcy.

    Jeśli parametr measure_timings=true, w wyniku zostanie dodana sekcja "timings" z czasami wykonania.
    """
    try:
        today = date(2024, 12, 31)
        current_year = today.year
        current_month = today.month

        # -------------------------------
        # Funkcje pomocnicze - DZIŚ (dane z tabeli transactions)
        # -------------------------------
        def get_daily_stats_transactions(filter_condition=None):
            """Dane globalne – wszystkie transakcje dla dzisiejszej daty."""
            start = datetime.combine(today, datetime.min.time())
            end = datetime.combine(today, datetime.max.time())
            query = db.query(
                func.coalesce(func.sum(Transaction.net_value), 0).label("net_sales"),
                func.coalesce(func.sum(Transaction.profit), 0).label("profit"),
                func.coalesce(
                    func.sum(Transaction.net_value).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("net_sales_paid"),
                func.coalesce(
                    func.sum(Transaction.profit).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("profit_paid")
            ).filter(Transaction.created_at.between(start, end))
            if filter_condition is not None:
                query = query.filter(filter_condition)
            result = query.first()
            return {
                "net_sales": float(result.net_sales or 0),
                "profit": float(result.profit or 0),
                "net_sales_paid": float(result.net_sales_paid or 0),
                "profit_paid": float(result.profit_paid or 0)
            }

        def get_daily_stats_branch(branch_name: str):
            """Dane dla danego oddziału – transakcje z filtrem branch_name."""
            start = datetime.combine(today, datetime.min.time())
            end = datetime.combine(today, datetime.max.time())
            branch_filter = (Transaction.branch_name == branch_name)
            query = db.query(
                func.coalesce(func.sum(Transaction.net_value), 0).label("net_sales"),
                func.coalesce(func.sum(Transaction.profit), 0).label("profit"),
                func.coalesce(
                    func.sum(Transaction.net_value).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("net_sales_paid"),
                func.coalesce(
                    func.sum(Transaction.profit).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("profit_paid")
            ).filter(Transaction.created_at.between(start, end)).filter(branch_filter)
            result = query.first()
            return {
                "net_sales": float(result.net_sales or 0),
                "profit": float(result.profit or 0),
                "net_sales_paid": float(result.net_sales_paid or 0),
                "profit_paid": float(result.profit_paid or 0)
            }

        def get_daily_stats_representative(representative_name: str):
            """Dane dla danego przedstawiciela – transakcje z filtrem representative_name."""
            start = datetime.combine(today, datetime.min.time())
            end = datetime.combine(today, datetime.max.time())
            rep_filter = (Transaction.representative_name == representative_name)
            query = db.query(
                func.coalesce(func.sum(Transaction.net_value), 0).label("net_sales"),
                func.coalesce(func.sum(Transaction.profit), 0).label("profit"),
                func.coalesce(
                    func.sum(Transaction.net_value).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("net_sales_paid"),
                func.coalesce(
                    func.sum(Transaction.profit).filter(
                        or_(
                            Transaction.to_pay == 0,
                            Transaction.to_pay.is_(None)
                        )
                    ), 0
                ).label("profit_paid")
            ).filter(Transaction.created_at.between(start, end)).filter(rep_filter)
            result = query.first()
            return {
                "net_sales": float(result.net_sales or 0),
                "profit": float(result.profit or 0),
                "net_sales_paid": float(result.net_sales_paid or 0),
                "profit_paid": float(result.profit_paid or 0)
            }

        # -------------------------------
        # Funkcje pomocnicze - MIESIĘCZNE (dane z tabel miesięcznych)
        # -------------------------------
        def get_monthly_stats_summary(year: int, month: int):
            """Miesięczne dane dla SUMA – agregacja po wszystkich oddziałach."""
            net_sales = db.query(
                func.coalesce(func.sum(NetSalesBranchTotal.net_sales), 0)
            ).filter(
                NetSalesBranchTotal.year == year,
                NetSalesBranchTotal.month == month
            ).scalar() or 0

            profit = db.query(
                func.coalesce(func.sum(ProfitTotal.profit), 0)
            ).filter(
                ProfitTotal.year == year,
                ProfitTotal.month == month
            ).scalar() or 0

            net_sales_paid = db.query(
                func.coalesce(func.sum(NetSalesBranchPayd.net_sales_paid), 0)
            ).filter(
                NetSalesBranchPayd.year == year,
                NetSalesBranchPayd.month == month
            ).scalar() or 0

            profit_paid = db.query(
                func.coalesce(func.sum(ProfitPayd.profit_paid), 0)
            ).filter(
                ProfitPayd.year == year,
                ProfitPayd.month == month
            ).scalar() or 0

            return {
                "net_sales": float(net_sales),
                "profit": float(profit),
                "net_sales_paid": float(net_sales_paid),
                "profit_paid": float(profit_paid)
            }

        def get_monthly_stats_branch(year: int, month: int, branch_name: str):
            """Miesięczne dane dla danego oddziału – filtrowane po branch_name."""
            net_sales = db.query(
                func.coalesce(NetSalesBranchTotal.net_sales, 0)
            ).filter(
                NetSalesBranchTotal.year == year,
                NetSalesBranchTotal.month == month,
                NetSalesBranchTotal.branch_name == branch_name
            ).scalar() or 0

            profit = db.query(
                func.coalesce(ProfitTotal.profit, 0)
            ).filter(
                ProfitTotal.year == year,
                ProfitTotal.month == month,
                ProfitTotal.branch_name == branch_name
            ).scalar() or 0

            net_sales_paid = db.query(
                func.coalesce(NetSalesBranchPayd.net_sales_paid, 0)
            ).filter(
                NetSalesBranchPayd.year == year,
                NetSalesBranchPayd.month == month,
                NetSalesBranchPayd.branch_name == branch_name
            ).scalar() or 0

            profit_paid = db.query(
                func.coalesce(ProfitPayd.profit_paid, 0)
            ).filter(
                ProfitPayd.year == year,
                ProfitPayd.month == month,
                ProfitPayd.branch_name == branch_name
            ).scalar() or 0

            return {
                "net_sales": float(net_sales),
                "profit": float(profit),
                "net_sales_paid": float(net_sales_paid),
                "profit_paid": float(profit_paid)
            }

        def get_monthly_stats_representative(year: int, month: int, representative_name: str):
            """Miesięczne dane dla danego przedstawiciela – filtrowane po representative_name."""
            net_sales = db.query(
                func.coalesce(NetSalesRepresentativeTotal.net_sales, 0)
            ).filter(
                NetSalesRepresentativeTotal.year == year,
                NetSalesRepresentativeTotal.month == month,
                NetSalesRepresentativeTotal.representative_name == representative_name
            ).scalar() or 0

            profit = db.query(
                func.coalesce(ProfitRepresentativeTotal.profit, 0)
            ).filter(
                ProfitRepresentativeTotal.year == year,
                ProfitRepresentativeTotal.month == month,
                ProfitRepresentativeTotal.representative_name == representative_name
            ).scalar() or 0

            net_sales_paid = db.query(
                func.coalesce(NetSalesRepresentativePayd.net_sales_paid, 0)
            ).filter(
                NetSalesRepresentativePayd.year == year,
                NetSalesRepresentativePayd.month == month,
                NetSalesRepresentativePayd.representative_name == representative_name
            ).scalar() or 0

            profit_paid = db.query(
                func.coalesce(ProfitRepresentativePayd.profit_paid, 0)
            ).filter(
                ProfitRepresentativePayd.year == year,
                ProfitRepresentativePayd.month == month,
                ProfitRepresentativePayd.representative_name == representative_name
            ).scalar() or 0

            return {
                "net_sales": float(net_sales),
                "profit": float(profit),
                "net_sales_paid": float(net_sales_paid),
                "profit_paid": float(profit_paid)
            }

        # -------------------------------
        # Funkcje łączące - KOMPUTACJA statystyk dla danej grupy
        # -------------------------------
        def compute_summary_stats():
            daily = get_daily_stats_transactions()
            monthly = get_monthly_stats_summary(current_year, current_month)
            historical = []
            for i in range(1, 4):
                m = current_month - i
                y = current_year
                if m <= 0:
                    m += 12
                    y -= 1
                hist = get_monthly_stats_summary(y, m)
                hist["year"] = y
                hist["month"] = m
                historical.append(hist)
            return {"daily": daily, "monthly": monthly, "historical": historical}

        def compute_branch_stats(branch_name: str):
            daily = get_daily_stats_branch(branch_name)
            monthly = get_monthly_stats_branch(current_year, current_month, branch_name)
            historical = []
            for i in range(1, 4):
                m = current_month - i
                y = current_year
                if m <= 0:
                    m += 12
                    y -= 1
                hist = get_monthly_stats_branch(y, m, branch_name)
                hist["year"] = y
                hist["month"] = m
                historical.append(hist)
            return {"daily": daily, "monthly": monthly, "historical": historical}

        def compute_representative_stats():
            """Oblicza statystyki dla każdego unikatowego przedstawiciela."""
            reps = db.query(Transaction.representative_name).filter(
                Transaction.representative_name.isnot(None),
                Transaction.representative_name != "",
                Transaction.representative_name != "0"
            ).distinct().all()
            rep_stats = {}
            for rep_tuple in reps:
                rep = rep_tuple[0]
                daily = get_daily_stats_representative(rep)
                monthly = get_monthly_stats_representative(current_year, current_month, rep)
                historical = []
                for i in range(1, 4):
                    m = current_month - i
                    y = current_year
                    if m <= 0:
                        m += 12
                        y -= 1
                    hist = get_monthly_stats_representative(y, m, rep)
                    hist["year"] = y
                    hist["month"] = m
                    historical.append(hist)
                rep_stats[rep] = {
                    "daily": daily,
                    "monthly": monthly,
                    "historical": historical
                }
            return rep_stats

        # -------------------------------
        # Obliczanie statystyk dla poszczególnych bloków z pomiarem czasu
        # -------------------------------
        overall_start = time.perf_counter()
        timings = {}

        t = time.perf_counter()
        summary_stats = compute_summary_stats()
        if measure_timings:
            timings["summary"] = time.perf_counter() - t

        t = time.perf_counter()
        representative_stats = compute_representative_stats()
        if measure_timings:
            timings["representatives"] = time.perf_counter() - t

        branch_names = ["Rzgów", "Malbork", "Pcim", "Lublin", "Łomża", "Myślibórz"]
        branches_stats = {}
        branch_timings = {}
        for branch in branch_names:
            t = time.perf_counter()
            branches_stats[branch] = compute_branch_stats(branch)
            if measure_timings:
                branch_timings[branch] = time.perf_counter() - t

        overall_time = time.perf_counter() - overall_start

        result = {
            "summary": summary_stats,
            "representatives": representative_stats,
            "branches": branches_stats,
        }
        if measure_timings:
            result["timings"] = {
                "summary": timings.get("summary"),
                "representatives": timings.get("representatives"),
                "branches": branch_timings,
                "total": overall_time
            }
        return result

    except Exception as e:
        logger.error(f"Error in /all_stats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")