# routes/representatives.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, distinct
from datetime import datetime, date
import logging
import time
import traceback
import sys

from models.transaction import (
    NetSalesRepresentativeTotal,
    NetSalesRepresentativePayd,
    ProfitRepresentativeTotal,
    ProfitRepresentativePayd,
    ConfigCurrentDate,
    RepresentativeAggregatedData  # Dodano nowy model
)
from database import get_db
import schemas

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/representatives")
def get_representatives(
        db: Session = Depends(get_db),
        year: int = Query(None),
        branch: str = Query(None)
):
    """
    Zwraca listę unikalnych przedstawicieli handlowych dla danego roku,
    którzy faktycznie mają sprzedaż w tym roku.

    Parametry:
    - year: rok do filtrowania (domyślnie bieżący rok)
    - branch: oddział do filtrowania (opcjonalnie)
    """
    try:
        logger.info(f"Rozpoczęcie pobierania przedstawicieli dla roku: {year}, oddział: {branch}")

        # Jeśli rok nie został podany, użyj bieżącego roku z konfiguracji
        if not year:
            current_date = db.query(ConfigCurrentDate).first()
            if current_date:
                year = current_date.year_value
                logger.info(f"Pobrano rok z konfiguracji: {year}")
            else:
                # Jeśli nie ma konfiguracji, użyj bieżącego roku z systemu
                year = datetime.now().year
                logger.info(f"Brak konfiguracji daty, użyto roku systemowego: {year}")

        logger.info(f"Budowanie zapytania o przedstawicieli z aktywną sprzedażą dla roku {year}")

        # Tworzenie zapytania, które filtruje przedstawicieli z faktyczną sprzedażą/zyskiem
        # Używamy func.coalesce aby bezpiecznie obsłużyć wartości NULL
        query = db.query(
            distinct(RepresentativeAggregatedData.representative_name)
        ).filter(
            RepresentativeAggregatedData.year == year,
            and_(
                func.coalesce(RepresentativeAggregatedData.net_sales_total, 0) > 0,
                func.coalesce(RepresentativeAggregatedData.profit_total, 0) > 0
            )
        )

        # Dodajemy filtr oddziału, jeśli podano
        if branch:
            query = query.filter(RepresentativeAggregatedData.branch_name == branch)
            logger.info(f"Dodano filtr oddziału: {branch}")

        # Pobierz wyniki i zaloguj
        try:
            raw_results = query.all()
            logger.info(f"Surowe wyniki zapytania: {raw_results}")

            representatives = [row[0] for row in raw_results]
            logger.info(f"Znaleziono {len(representatives)} przedstawicieli z aktywną sprzedażą: {representatives}")

            return {"representatives": representatives, "year": year}
        except Exception as e:
            logger.error(f"Błąd podczas przetwarzania wyników zapytania: {str(e)}")
            raise

    except Exception as e:
        logger.error(f"Error in /representatives endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/representative_data")
def get_representative_data(
        db: Session = Depends(get_db),
        representative: str = Query(...),
        year: int = Query(None),
        measure_timings: bool = Query(False)
):
    """
    Zwraca dane dla konkretnego przedstawiciela handlowego z podziałem
    na miesiąc bieżący i historyczne miesiące.

    Parametry:
    - representative: nazwa przedstawiciela (wymagane)
    - year: rok do filtrowania (domyślnie bieżący rok)
    - measure_timings: czy mierzyć czas wykonania zapytań
    """
    try:
        # Bezpieczne domyślne wartości na wypadek braku danych
        default_result = {
            "representative": representative,
            "year": year or datetime.now().year,
            "current_month": datetime.now().month,
            "current_month_data": None,
            "historical_data": [],
            "debug_info": {
                "message": "Zwracam puste dane z powodu braku rekordów lub błędu"
            }
        }

        logger.info(f"Rozpoczęcie pobierania danych dla przedstawiciela: {representative}, rok: {year}")
        overall_start = time.perf_counter()

        # Pobierz bieżącą datę z konfiguracji
        try:
            current_date = db.query(ConfigCurrentDate).first()
            if not current_date:
                logger.warning("Nie znaleziono konfiguracji daty, używam domyślnych wartości")
                current_date = type('obj', (object,), {
                    'year_value': datetime.now().year,
                    'month_value': datetime.now().month
                })
        except Exception as date_error:
            logger.error(f"Błąd podczas pobierania bieżącej daty: {str(date_error)}")
            current_date = type('obj', (object,), {
                'year_value': datetime.now().year,
                'month_value': datetime.now().month
            })

        # Jeśli rok nie został podany, użyj bieżącego roku z konfiguracji
        if not year:
            year = current_date.year_value
            logger.info(f"Użyto roku z konfiguracji: {year}")

        current_month = current_date.month_value
        logger.info(f"Bieżący miesiąc: {current_month}")

        # SPRAWDŹ CZY ISTNIEJĄ DANE DLA WYBRANEGO ROKU I PRZEDSTAWICIELA
        # Używamy nowej tabeli zagregowanej
        check_count = db.query(func.count(RepresentativeAggregatedData.representative_name)).filter(
            RepresentativeAggregatedData.representative_name == representative,
            RepresentativeAggregatedData.year == year
        ).scalar()

        logger.info(f"Liczba rekordów dla przedstawiciela {representative} w roku {year}: {check_count}")

        if check_count == 0:
            logger.warning(f"Brak danych dla przedstawiciela {representative} w roku {year}")
            default_result["debug_info"]["data_exists"] = False
            return default_result

        # Wykonanie zapytania z pomiarem czasu
        try:
            t = time.perf_counter()

            # Używamy nowej tabeli zagregowanej zamiast łączenia czterech tabel
            query = db.query(RepresentativeAggregatedData).filter(
                RepresentativeAggregatedData.representative_name == representative,
                RepresentativeAggregatedData.year == year
            ).order_by(RepresentativeAggregatedData.month)

            results = query.all()
            execution_time = time.perf_counter() - t

            logger.info(f"Wykonano zapytanie w czasie {execution_time:.4f}s, znaleziono {len(results)} wyników")

            if len(results) == 0:
                logger.warning(f"Zapytanie nie zwróciło żadnych wyników dla {representative} w roku {year}")
                default_result["debug_info"]["query_returned_no_results"] = True
                return default_result

        except Exception as query_exec_error:
            logger.error(f"Błąd podczas wykonywania zapytania: {str(query_exec_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["query_execution_error"] = str(query_exec_error)
            return default_result

        # Przetwarzanie wyników
        try:
            processed_data = []
            current_month_data = None
            historical_data = []

            for row in results:
                # Logowanie wartości dla debugowania
                logger.info(f"Przetwarzanie wiersza: {row}")

                try:
                    # Upewnij się, że wartości nie są None i konwertuj na float
                    sales_net = float(row.net_sales_total or 0)
                    profit_net = float(row.profit_total or 0)
                    sales_payd = float(row.net_sales_paid or 0)
                    profit_payd = float(row.profit_paid or 0)

                    # Korzystamy z już wyliczonych wartości procentowych z tabeli zagregowanej
                    sales_payd_percent = float(row.sales_paid_percentage or 0)
                    marg_total = float(row.profit_margin_percentage or 0)

                    data_item = {
                        "representative_name": row.representative_name,
                        "year": row.year,
                        "month": row.month,
                        "sales_net": sales_net,
                        "profit_net": profit_net,
                        "sales_payd": sales_payd,
                        "profit_payd": profit_payd,
                        "sales_payd_percent": sales_payd_percent,
                        "marg_total": marg_total
                    }

                    # Podział na bieżący miesiąc i historyczne
                    if row.month == current_month:
                        current_month_data = data_item
                        logger.info(f"Dane dla bieżącego miesiąca ({current_month}): {data_item}")
                    else:
                        historical_data.append(data_item)
                        logger.info(f"Dane historyczne dla miesiąca {row.month}: {data_item}")

                except Exception as row_process_error:
                    logger.error(f"Błąd podczas przetwarzania wiersza: {str(row_process_error)}")
                    logger.error(traceback.format_exc())
                    # Kontynuuj przetwarzanie następnych wierszy

            result = {
                "representative": representative,
                "year": year,
                "current_month": current_month,
                "current_month_data": current_month_data,
                "historical_data": historical_data
            }

            if measure_timings:
                result["timings"] = {
                    "query": execution_time,
                    "total": time.perf_counter() - overall_start
                }

            logger.info(f"Zwracam dane dla przedstawiciela {representative}, rok {year}")
            return result

        except Exception as process_error:
            logger.error(f"Błąd podczas przetwarzania wyników: {str(process_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["processing_error"] = str(process_error)
            return default_result

    except Exception as e:
        logger.error(f"Ogólny błąd w /representative_data endpoint: {str(e)}")
        logger.error(traceback.format_exc())

        # Zwróć komunikat błędu z pełnym traceback
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

        return {
            "representative": representative,
            "year": year,
            "error": True,
            "error_details": error_info
        }


@router.get("/aggregated_representative_data")
def get_aggregated_representative_data(
        db: Session = Depends(get_db),
        representative: str = Query(None),
        year: int = Query(None),
        month: int = Query(None),
        branch_name: str = Query(None),  # Dodano parametr branch_name
        measure_timings: bool = Query(False)
):
    """
    Zwraca zagregowane dane dla przedstawicieli handlowych z tabeli representative_aggregated_data.

    Parametry:
    - representative: nazwa przedstawiciela (opcjonalnie)
    - year: rok do filtrowania
    - month: miesiąc do filtrowania (opcjonalnie)
    - branch_name: nazwa oddziału do filtrowania (opcjonalnie)
    - measure_timings: czy mierzyć czas wykonania zapytań
    """
    try:
        # Domyślny wynik na wypadek błędu
        default_result = {
            "data": [],
            "debug_info": {
                "message": "Zwracam puste dane z powodu błędu"
            }
        }

        logger.info(
            f"Pobieranie zagregowanych danych dla przedstawiciela: {representative}, rok: {year}, miesiąc: {month}, oddział: {branch_name}")
        overall_start = time.perf_counter()

        # Sprawdzamy czy tabela zawiera dane dla podanych parametrów
        try:
            count_query = db.query(func.count(RepresentativeAggregatedData.representative_name))

            if representative:
                count_query = count_query.filter(RepresentativeAggregatedData.representative_name == representative)
            if year:
                count_query = count_query.filter(RepresentativeAggregatedData.year == year)
            if month:
                count_query = count_query.filter(RepresentativeAggregatedData.month == month)
            if branch_name:
                count_query = count_query.filter(RepresentativeAggregatedData.branch_name == branch_name)

            record_count = count_query.scalar()
            logger.info(f"Liczba rekordów dla zapytania: {record_count}")

            if record_count == 0:
                logger.warning(
                    f"Brak danych dla parametrów: przedstawiciel={representative}, rok={year}, miesiąc={month}, oddział={branch_name}")
                default_result["debug_info"]["data_exists"] = False
                return default_result

        except Exception as count_error:
            logger.error(f"Błąd podczas sprawdzania liczby rekordów: {str(count_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["count_error"] = str(count_error)
            return default_result

        # Wykonanie zapytania z pomiarem czasu
        try:
            t = time.perf_counter()

            # Tworzymy zapytanie do nowej tabeli zagregowanej
            query = db.query(RepresentativeAggregatedData)

            # Dodajemy filtry
            if representative:
                query = query.filter(RepresentativeAggregatedData.representative_name == representative)
                logger.info(f"Filtrowanie po przedstawicielu: {representative}")
            if year:
                query = query.filter(RepresentativeAggregatedData.year == year)
                logger.info(f"Filtrowanie po roku: {year}")
            if month:
                query = query.filter(RepresentativeAggregatedData.month == month)
                logger.info(f"Filtrowanie po miesiącu: {month}")
            if branch_name:
                query = query.filter(RepresentativeAggregatedData.branch_name == branch_name)
                logger.info(f"Filtrowanie po oddziale: {branch_name}")

            # Sortowanie wyników
            query = query.order_by(
                RepresentativeAggregatedData.year.desc(),
                RepresentativeAggregatedData.month.desc(),
                RepresentativeAggregatedData.branch_name,
                RepresentativeAggregatedData.representative_name
            )

            results = query.all()
            execution_time = time.perf_counter() - t

            logger.info(f"Wykonano zapytanie w czasie {execution_time:.4f}s, znaleziono {len(results)} wyników")

            if len(results) == 0:
                logger.warning("Zapytanie nie zwróciło żadnych wyników")
                default_result["debug_info"]["query_returned_no_results"] = True
                return default_result

        except Exception as query_exec_error:
            logger.error(f"Błąd podczas wykonywania zapytania: {str(query_exec_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["query_execution_error"] = str(query_exec_error)
            return default_result

        # Przetwarzanie wyników
        try:
            processed_data = []
            for row in results:
                # Bezpieczna konwersja wartości
                try:
                    # Mapowanie kolumn z nowej tabeli na nazwy używane w API
                    item = {
                        "representative_name": row.representative_name,
                        "year": row.year,
                        "month": row.month,
                        "branch_name": row.branch_name,  # Dodajemy branch_name
                        "sales_net": float(row.net_sales_total or 0),
                        "profit_net": float(row.profit_total or 0),
                        "sales_payd": float(row.net_sales_paid or 0),
                        "profit_payd": float(row.profit_paid or 0),
                        "sales_payd_percent": float(row.sales_paid_percentage or 0),
                        "marg_total": float(row.profit_margin_percentage or 0),
                        # Dodatkowe kolumny dostępne w nowej tabeli
                        "paid_profit_margin_percentage": float(row.paid_profit_margin_percentage or 0)
                    }

                    processed_data.append(item)
                    logger.info(
                        f"Przygotowano dane dla {row.representative_name}, {row.branch_name}, {row.year}-{row.month}")

                except Exception as row_process_error:
                    logger.error(f"Błąd podczas przetwarzania wiersza: {str(row_process_error)}")
                    logger.error(traceback.format_exc())
                    # Kontynuuj przetwarzanie następnych wierszy

            result = {"data": processed_data}

            if measure_timings:
                result["timings"] = {
                    "query": execution_time,
                    "total": time.perf_counter() - overall_start
                }

            return result

        except Exception as process_error:
            logger.error(f"Błąd podczas przetwarzania wyników: {str(process_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["processing_error"] = str(process_error)
            return default_result

    except Exception as e:
        logger.error(f"Ogólny błąd w /aggregated_representative_data endpoint: {str(e)}")
        logger.error(traceback.format_exc())

        # Zwróć komunikat błędu z pełnym traceback
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

        return {
            "data": [],
            "error": True,
            "error_details": error_info
        }

# Dodaj nowy endpoint bezpośrednio po istniejącym endpoint aggregated_representative_data
@router.get("/aggregated_representative_ind_data")
def get_aggregated_representative_ind_data(
        db: Session = Depends(get_db),
        representative: str = Query(None),
        year: int = Query(None),
        month: int = Query(None),
        branch_name: str = Query(None),
        # Nowe parametry:
        limit: int = Query(3000),  # Limit ustawiony na 3000 rekordów
        fields_set: str = Query("full"),  # Domyślnie pełny zestaw pól
        measure_timings: bool = Query(False)
):
    """
    Zwraca zagregowane dane dla przedstawicieli handlowych z tabeli representative_aggregated_data,
    używając kolumn rep_profit_total i rep_profit_payd zamiast profit_total i profit_paid.

    Parametry:
    - representative: nazwa przedstawiciela (opcjonalnie)
    - year: rok do filtrowania
    - month: miesiąc do filtrowania (opcjonalnie)
    - branch_name: nazwa oddziału do filtrowania (opcjonalnie)
    - limit: maksymalna liczba zwracanych rekordów (domyślnie 3000)
    - fields_set: zestaw pól do zwrócenia ('full' lub 'minimal')
    - measure_timings: czy mierzyć czas wykonania zapytań
    """
    try:
        # Domyślny wynik na wypadek błędu
        default_result = {
            "data": [],
            "debug_info": {
                "message": "Zwracam puste dane z powodu błędu"
            }
        }

        logger.info(
            f"Pobieranie zagregowanych danych IND dla przedstawiciela: {representative}, rok: {year}, "
            f"miesiąc: {month}, oddział: {branch_name}, zestaw pól: {fields_set}, limit: {limit}")
        overall_start = time.perf_counter()

        # Sprawdzamy czy tabela zawiera dane dla podanych parametrów
        try:
            count_query = db.query(func.count(RepresentativeAggregatedData.representative_name))

            if representative:
                count_query = count_query.filter(RepresentativeAggregatedData.representative_name == representative)
            if year:
                count_query = count_query.filter(RepresentativeAggregatedData.year == year)
            if month:
                count_query = count_query.filter(RepresentativeAggregatedData.month == month)
            if branch_name:
                count_query = count_query.filter(RepresentativeAggregatedData.branch_name == branch_name)

            record_count = count_query.scalar()
            logger.info(f"Liczba rekordów dla zapytania IND: {record_count}")

            if record_count == 0:
                logger.warning(
                    f"Brak danych IND dla parametrów: przedstawiciel={representative}, rok={year}, "
                    f"miesiąc={month}, oddział={branch_name}")
                default_result["debug_info"]["data_exists"] = False
                return default_result

        except Exception as count_error:
            logger.error(f"Błąd podczas sprawdzania liczby rekordów IND: {str(count_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["count_error"] = str(count_error)
            return default_result

        # Wykonanie zapytania z pomiarem czasu
        try:
            t = time.perf_counter()

            # Wybór kolumn w zależności od parametru fields_set
            if fields_set == "minimal":
                # Wybieramy tylko niezbędne kolumny dla widoku ProfitsPHView
                query = db.query(
                    RepresentativeAggregatedData.representative_name,
                    RepresentativeAggregatedData.year,
                    RepresentativeAggregatedData.month,
                    RepresentativeAggregatedData.branch_name,
                    RepresentativeAggregatedData.rep_profit_total,
                    RepresentativeAggregatedData.rep_profit_payd
                )
            else:
                # Domyślnie pobieramy wszystkie kolumny (kompatybilność wsteczna)
                query = db.query(RepresentativeAggregatedData)

            # Dodajemy filtry
            if representative:
                query = query.filter(RepresentativeAggregatedData.representative_name == representative)
                logger.info(f"Filtrowanie po przedstawicielu: {representative}")
            if year:
                query = query.filter(RepresentativeAggregatedData.year == year)
                logger.info(f"Filtrowanie po roku: {year}")
            if month:
                query = query.filter(RepresentativeAggregatedData.month == month)
                logger.info(f"Filtrowanie po miesiącu: {month}")
            if branch_name:
                query = query.filter(RepresentativeAggregatedData.branch_name == branch_name)
                logger.info(f"Filtrowanie po oddziale: {branch_name}")

            # Sortowanie wyników
            query = query.order_by(
                RepresentativeAggregatedData.year.desc(),
                RepresentativeAggregatedData.month.desc(),
                RepresentativeAggregatedData.branch_name,
                RepresentativeAggregatedData.representative_name
            )

            # Dodajemy limit dla liczby rekordów
            query = query.limit(limit)

            results = query.all()
            execution_time = time.perf_counter() - t

            logger.info(f"Wykonano zapytanie IND w czasie {execution_time:.4f}s, znaleziono {len(results)} wyników")

            if len(results) == 0:
                logger.warning("Zapytanie IND nie zwróciło żadnych wyników")
                default_result["debug_info"]["query_returned_no_results"] = True
                return default_result

        except Exception as query_exec_error:
            logger.error(f"Błąd podczas wykonywania zapytania IND: {str(query_exec_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["query_execution_error"] = str(query_exec_error)
            return default_result

        # Przetwarzanie wyników
        try:
            processed_data = []
            for row in results:
                # Bezpieczna konwersja wartości
                try:
                    # Mapowanie kolumn z nowej tabeli na nazwy używane w API,
                    # dostosowane do wybranego zestawu pól
                    if fields_set == "minimal":
                        # Tylko niezbędne pola dla widoku ProfitsPHView
                        item = {
                            "representative_name": row.representative_name,
                            "year": row.year,
                            "month": row.month,
                            "branch_name": row.branch_name,
                            "profit_net": float(row.rep_profit_total or 0),
                            "profit_payd": float(row.rep_profit_payd or 0),
                            # Dodajemy puste pola wymagane przez API
                            "sales_net": 0,
                            "sales_payd": 0,
                            "sales_payd_percent": 0,
                            "marg_total": 0,
                            "paid_profit_margin_percentage": 0
                        }
                    else:
                        # Standardowe mapowanie dla pełnego zestawu pól
                        item = {
                            "representative_name": row.representative_name,
                            "year": row.year,
                            "month": row.month,
                            "branch_name": row.branch_name,
                            "sales_net": float(row.net_sales_total or 0),
                            "profit_net": float(row.rep_profit_total or 0),
                            "sales_payd": float(row.net_sales_paid or 0),
                            "profit_payd": float(row.rep_profit_payd or 0),
                            "sales_payd_percent": float(row.sales_paid_percentage or 0),
                            "marg_total": float(row.profit_margin_percentage or 0),
                            "paid_profit_margin_percentage": float(row.paid_profit_margin_percentage or 0)
                        }

                    processed_data.append(item)
                    logger.info(
                        f"Przygotowano dane IND dla {row.representative_name}, {row.branch_name}, {row.year}-{row.month}")

                except Exception as row_process_error:
                    logger.error(f"Błąd podczas przetwarzania wiersza IND: {str(row_process_error)}")
                    logger.error(traceback.format_exc())
                    # Kontynuuj przetwarzanie następnych wierszy

            result = {"data": processed_data}

            if measure_timings:
                result["timings"] = {
                    "query": execution_time,
                    "total": time.perf_counter() - overall_start
                }

            return result

        except Exception as process_error:
            logger.error(f"Błąd podczas przetwarzania wyników IND: {str(process_error)}")
            logger.error(traceback.format_exc())
            default_result["debug_info"]["processing_error"] = str(process_error)
            return default_result

    except Exception as e:
        logger.error(f"Ogólny błąd w /aggregated_representative_ind_data endpoint: {str(e)}")
        logger.error(traceback.format_exc())

        # Zwróć komunikat błędu z pełnym traceback
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }

        return {
            "data": [],
            "error": True,
            "error_details": error_info
        }

# Zaktualizowany endpoint do pobierania szczegółowych danych z tabeli representative_aggregated_data
@router.get("/representative_performance")
def get_representative_performance(
        db: Session = Depends(get_db),
        year: int = Query(None),
        include_branches: bool = Query(False, description="Czy grupować wyniki po oddziałach"),
        measure_timings: bool = Query(False)
):
    """
    Zwraca zagregowane dane o wydajności przedstawicieli handlowych w danym roku.

    Parametry:
    - year: rok do filtrowania (opcjonalnie, domyślnie bieżący rok)
    - include_branches: czy grupować wyniki po oddziałach
    - measure_timings: czy mierzyć czas wykonania zapytań
    """
    try:
        overall_start = time.perf_counter()

        # Pobierz bieżący rok, jeśli nie podano
        if not year:
            current_date = db.query(ConfigCurrentDate).first()
            if current_date:
                year = current_date.year_value
            else:
                year = datetime.now().year

        logger.info(f"Pobieranie danych o wydajności przedstawicieli za rok: {year}")

        # Wykonanie zapytania z pomiarem czasu
        t = time.perf_counter()

        # Przygotuj różne zapytania w zależności od parametru include_branches
        if include_branches:
            # Grupuj po przedstawicielu i oddziale, użyj rep_profit_total i rep_profit_payd zamiast profit_total i profit_paid
            representatives_data = db.query(
                RepresentativeAggregatedData.representative_name,
                RepresentativeAggregatedData.branch_name,
                func.sum(RepresentativeAggregatedData.net_sales_total).label("total_sales"),
                func.sum(RepresentativeAggregatedData.rep_profit_total).label("total_profit"),  # Zmieniono na rep_profit_total
                func.sum(RepresentativeAggregatedData.net_sales_paid).label("paid_sales"),
                func.sum(RepresentativeAggregatedData.rep_profit_payd).label("paid_profit"),  # Zmieniono na rep_profit_payd
                (func.sum(RepresentativeAggregatedData.profit_total) / func.nullif(
                    func.sum(RepresentativeAggregatedData.net_sales_total), 0) * 100).label("margin_percentage"),
                (func.sum(RepresentativeAggregatedData.net_sales_paid) / func.nullif(
                    func.sum(RepresentativeAggregatedData.net_sales_total), 0) * 100).label("paid_percentage")
            ).filter(
                RepresentativeAggregatedData.year == year
            ).group_by(
                RepresentativeAggregatedData.representative_name,
                RepresentativeAggregatedData.branch_name
            ).order_by(
                func.sum(RepresentativeAggregatedData.net_sales_total).desc()
            ).all()

            # Przygotuj dane zagregowane
            results = []
            for row in representatives_data:
                results.append({
                    "representative_name": row.representative_name,
                    "branch_name": row.branch_name,
                    "total_sales": float(row.total_sales or 0),
                    "total_profit": float(row.total_profit or 0),
                    "paid_sales": float(row.paid_sales or 0),
                    "paid_profit": float(row.paid_profit or 0),
                    "margin_percentage": float(row.margin_percentage or 0),
                    "paid_percentage": float(row.paid_percentage or 0)
                })

        else:
            # Grupuj tylko po przedstawicielu (sumuj po wszystkich oddziałach), użyj rep_profit_total i rep_profit_payd
            representatives_data = db.query(
                RepresentativeAggregatedData.representative_name,
                func.sum(RepresentativeAggregatedData.net_sales_total).label("total_sales"),
                func.sum(RepresentativeAggregatedData.rep_profit_total).label("total_profit"),  # Zmieniono na rep_profit_total
                func.sum(RepresentativeAggregatedData.net_sales_paid).label("paid_sales"),
                func.sum(RepresentativeAggregatedData.rep_profit_payd).label("paid_profit"),  # Zmieniono na rep_profit_payd
                (func.sum(RepresentativeAggregatedData.profit_total) / func.nullif(
                    func.sum(RepresentativeAggregatedData.net_sales_total), 0) * 100).label("margin_percentage"),
                (func.sum(RepresentativeAggregatedData.net_sales_paid) / func.nullif(
                    func.sum(RepresentativeAggregatedData.net_sales_total), 0) * 100).label("paid_percentage")
            ).filter(
                RepresentativeAggregatedData.year == year
            ).group_by(
                RepresentativeAggregatedData.representative_name
            ).order_by(
                func.sum(RepresentativeAggregatedData.net_sales_total).desc()
            ).all()

            # Przygotuj dane zagregowane
            results = []
            for row in representatives_data:
                results.append({
                    "representative_name": row.representative_name,
                    "total_sales": float(row.total_sales or 0),
                    "total_profit": float(row.total_profit or 0),
                    "paid_sales": float(row.paid_sales or 0),
                    "paid_profit": float(row.paid_profit or 0),
                    "margin_percentage": float(row.margin_percentage or 0),
                    "paid_percentage": float(row.paid_percentage or 0)
                })

        execution_time = time.perf_counter() - t

        # Zwróć wyniki
        response = {
            "year": year,
            "representatives": results
        }

        if measure_timings:
            response["timings"] = {
                "query": execution_time,
                "total": time.perf_counter() - overall_start
            }

        return response

    except Exception as e:
        logger.error(f"Błąd w endpoint /representative_performance: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")