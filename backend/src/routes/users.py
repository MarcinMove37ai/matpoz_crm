# routes/users.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
import logging
from typing import List, Optional
from decimal import Decimal

from models.user import User, Client
from database import get_db
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# Modele Pydantic dla User
class UserBase(BaseModel):
    cognito_user_name: str
    name: str
    full_name: str
    position: Optional[str] = None
    branch: Optional[str] = None
    longitude: Optional[float] = None  # Dodane pole dla współrzędnych geograficznych
    latitude: Optional[float] = None   # Dodane pole dla współrzędnych geograficznych

    class Config:
        from_attributes = True


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int


# Modele Pydantic dla Client
class ClientBase(BaseModel):
    nip: str
    nazwa: str
    kod_pocztowy: Optional[str] = None
    miejscowosc: Optional[str] = None
    ulica: Optional[str] = None
    nr_nieruchomosci: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    status_free: Optional[bool] = False
    branch: Optional[str] = None
    rep: Optional[str] = None

    class Config:
        from_attributes = True


class ClientCreate(ClientBase):
    pass


class ClientResponse(ClientBase):
    id: int


# Endpoint do pobierania klientów dla mapview
@router.get("/clients/map", response_model=List[dict])
async def get_clients_for_map(
        db: Session = Depends(get_db),
        branch: Optional[str] = None,
        status_free: Optional[bool] = None,
        rep: Optional[str] = None
):
    """
    Pobiera listę klientów do wyświetlenia na mapie.
    Zwraca tylko te rekordy, które mają współrzędne geograficzne.
    """
    try:
        # Podstawowe zapytanie - tylko klienci ze współrzędnymi
        query = db.query(
            Client.id,
            Client.nazwa,
            Client.nip,
            Client.kod_pocztowy,
            Client.miejscowosc,
            Client.ulica,
            Client.nr_nieruchomosci,
            Client.longitude,
            Client.latitude,
            Client.status_free,
            Client.branch,
            Client.rep
        ).filter(
            Client.longitude.isnot(None),
            Client.latitude.isnot(None)
        )

        # Dodatkowe filtry
        if branch:
            query = query.filter(Client.branch == branch)
        if status_free is not None:
            query = query.filter(Client.status_free == status_free)
        if rep:
            query = query.filter(Client.rep == rep)

        # Limitujemy wyniki do 1000 rekordów dla wydajności
        clients = query.limit(20000).all()

        # Przekształcamy do formatu dla mapview
        return [{
            "id": str(client.id),
            "name": client.nazwa,
            "address": f"{client.ulica or ''} {client.nr_nieruchomosci or ''}, {client.kod_pocztowy or ''} {client.miejscowosc or ''}",
            "latitude": float(client.latitude) if client.latitude else None,
            "longitude": float(client.longitude) if client.longitude else None,
            "status_free": client.status_free,
            "branch": client.branch,
            "rep": client.rep
        } for client in clients]

    except Exception as e:
        logger.error(f"Błąd podczas pobierania klientów dla mapy: {str(e)}")
        # Zwracamy prostszy format w przypadku błędów
        try:
            # Alternatywne zapytanie bez problematycznych kolumn
            simple_query = db.query(
                Client.id,
                Client.nazwa,
                Client.longitude,
                Client.latitude,
                Client.status_free,
                Client.branch,
                Client.rep
            ).filter(
                Client.longitude.isnot(None),
                Client.latitude.isnot(None)
            )

            if branch:
                simple_query = simple_query.filter(Client.branch == branch)
            if status_free is not None:
                simple_query = simple_query.filter(Client.status_free == status_free)
            if rep:
                simple_query = simple_query.filter(Client.rep == rep)

            simple_clients = simple_query.limit(1000).all()

            return [{
                "id": str(client.id),
                "name": client.nazwa,
                "address": "Adres niedostępny",  # Uproszczony adres
                "latitude": float(client.latitude) if client.latitude else None,
                "longitude": float(client.longitude) if client.longitude else None,
                "status_free": client.status_free,
                "branch": client.branch,
                "rep": client.rep
            } for client in simple_clients]
        except Exception as inner_error:
            logger.error(f"Błąd podczas alternatywnego pobierania klientów: {str(inner_error)}")
            raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


# Endpointy dla User
@router.get("/users", response_model=List[UserResponse])
async def get_users(
    db: Session = Depends(get_db),
    cognito_user_name: Optional[str] = None,
    branch: Optional[str] = None,
    position: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """
    Pobiera listę użytkowników z możliwością filtrowania.
    """
    try:
        query = db.query(User)

        # Zastosuj filtry
        if cognito_user_name:
            query = query.filter(User.cognito_user_name == cognito_user_name)
        if branch:
            query = query.filter(User.branch == branch)
        if position:
            query = query.filter(User.position == position)

        # Pobierz całkowitą liczbę rekordów dla danego filtra
        total_count = query.count()

        # Zastosuj paginację
        users = query.order_by(User.id).offset(offset).limit(limit).all()

        return users

    except Exception as e:
        logger.error(f"Błąd podczas pobierania użytkowników: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/users/{cognito_user_name}", response_model=UserResponse)
async def get_user_by_cognito_username(cognito_user_name: str, db: Session = Depends(get_db)):
    """
    Pobiera szczegóły użytkownika na podstawie jego cognito_user_name.
    """
    try:
        user = db.query(User).filter(User.cognito_user_name == cognito_user_name).first()
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono użytkownika o nazwie {cognito_user_name}"
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Błąd podczas pobierania użytkownika: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas pobierania danych użytkownika"
        )


@router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Tworzy nowego użytkownika.
    """
    try:
        # Sprawdź czy użytkownik o takiej nazwie już istnieje
        existing_user = db.query(User).filter(User.cognito_user_name == user.cognito_user_name).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"Użytkownik o nazwie {user.cognito_user_name} już istnieje"
            )

        # Utwórz nowego użytkownika
        db_user = User(**user.model_dump())
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas tworzenia użytkownika: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas tworzenia użytkownika"
        )


@router.put("/users/{cognito_user_name}", response_model=UserResponse)
async def update_user(
    cognito_user_name: str,
    user_data: UserBase,
    db: Session = Depends(get_db)
):
    """
    Aktualizuje dane istniejącego użytkownika.
    """
    try:
        # Pobierz istniejącego użytkownika
        db_user = db.query(User).filter(User.cognito_user_name == cognito_user_name).first()
        if not db_user:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono użytkownika o nazwie {cognito_user_name}"
            )

        # Aktualizuj dane
        for key, value in user_data.model_dump().items():
            if key != "cognito_user_name":  # Nie zmieniamy cognito_user_name
                setattr(db_user, key, value)

        db.commit()
        db.refresh(db_user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas aktualizacji użytkownika: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas aktualizacji użytkownika"
        )


@router.delete("/users/{cognito_user_name}")
async def delete_user(cognito_user_name: str, db: Session = Depends(get_db)):
    """
    Usuwa użytkownika na podstawie jego cognito_user_name.
    """
    try:
        db_user = db.query(User).filter(User.cognito_user_name == cognito_user_name).first()
        if not db_user:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono użytkownika o nazwie {cognito_user_name}"
            )

        db.delete(db_user)
        db.commit()
        return {"ok": True, "message": f"Użytkownik {cognito_user_name} został usunięty"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas usuwania użytkownika: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas usuwania użytkownika"
        )


# Endpointy dla Client
@router.get("/clients", response_model=List[ClientResponse])
async def get_clients(
    db: Session = Depends(get_db),
    nip: Optional[str] = None,
    nazwa: Optional[str] = None,
    branch: Optional[str] = None,
    status_free: Optional[bool] = None,
    limit: int = Query(20000, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """
    Pobiera listę klientów z możliwością filtrowania.
    """
    try:
        query = db.query(Client)

        # Zastosuj filtry
        if nip:
            query = query.filter(Client.nip == nip)
        if nazwa:
            query = query.filter(Client.nazwa.ilike(f"%{nazwa}%"))
        if branch:
            query = query.filter(Client.branch == branch)
        if status_free is not None:
            query = query.filter(Client.status_free == status_free)

        # Zastosuj paginację
        clients = query.order_by(Client.id).offset(offset).limit(limit).all()

        return clients

    except Exception as e:
        logger.error(f"Błąd podczas pobierania klientów: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Błąd wewnętrzny serwera: {str(e)}")


@router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: int, db: Session = Depends(get_db)):
    """
    Pobiera szczegóły klienta na podstawie jego ID.
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Klient nie znaleziony")
    return client


@router.post("/clients", response_model=ClientResponse)
async def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    """
    Tworzy nowego klienta.
    """
    try:
        # Sprawdź czy klient o takim NIP już istnieje
        existing_client = db.query(Client).filter(Client.nip == client.nip).first()
        if existing_client:
            raise HTTPException(
                status_code=400,
                detail=f"Klient o NIP {client.nip} już istnieje"
            )

        # Utwórz nowego klienta
        db_client = Client(**client.model_dump())
        db.add(db_client)
        db.commit()
        db.refresh(db_client)
        return db_client
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas tworzenia klienta: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas tworzenia klienta"
        )


@router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    client_data: ClientBase,
    db: Session = Depends(get_db)
):
    """
    Aktualizuje dane istniejącego klienta.
    """
    try:
        # Pobierz istniejącego klienta
        db_client = db.query(Client).filter(Client.id == client_id).first()
        if not db_client:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono klienta o ID {client_id}"
            )

        # Aktualizuj dane
        for key, value in client_data.model_dump().items():
            setattr(db_client, key, value)

        db.commit()
        db.refresh(db_client)
        return db_client
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas aktualizacji klienta: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas aktualizacji klienta"
        )


@router.delete("/clients/{client_id}")
async def delete_client(client_id: int, db: Session = Depends(get_db)):
    """
    Usuwa klienta na podstawie jego ID.
    """
    try:
        db_client = db.query(Client).filter(Client.id == client_id).first()
        if not db_client:
            raise HTTPException(
                status_code=404,
                detail=f"Nie znaleziono klienta o ID {client_id}"
            )

        db.delete(db_client)
        db.commit()
        return {"ok": True, "message": f"Klient o ID {client_id} został usunięty"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Błąd podczas usuwania klienta: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Wystąpił błąd podczas usuwania klienta"
        )


# Endpoint diagnostyczny
@router.get("/users/debug/test", include_in_schema=False)
async def debug_users_endpoint(db: Session = Depends(get_db)):
    """
    Endpoint diagnostyczny do sprawdzania połączenia z bazą danych i tabeli users.
    """
    try:
        # Sprawdź czy tabela istnieje
        users = db.query(User).limit(5).all()
        return {
            "status": "ok",
            "users_count": len(users),
            "first_user": str(users[0]) if users else None
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "type": type(e).__name__
        }