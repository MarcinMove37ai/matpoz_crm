# models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text, func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    cognito_user_name = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    full_name = Column(String(200), nullable=False)
    position = Column(String(100))
    branch = Column(String(100), index=True)
    # Dodane pola dla współrzędnych geograficznych
    longitude = Column(Numeric(15, 10))
    latitude = Column(Numeric(15, 10))
    # created_at zostaje w tabeli, ale nie będziemy go używać w API
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, cognito_user_name='{self.cognito_user_name}', name='{self.name}')>"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    nip = Column(String(20), unique=True, index=True)
    nazwa = Column(String(255), nullable=False)
    kod_pocztowy = Column(Text)
    miejscowosc = Column(String(255))
    ulica = Column(String(255))
    nr_nieruchomosci = Column(Text)
    longitude = Column(Numeric(15, 10))
    latitude = Column(Numeric(15, 10))
    status_free = Column(Boolean, default=False)
    branch = Column(String(30), index=True)  # powiązanie z oddziałem
    rep = Column(String(30))  # przedstawiciel/opiekun klienta

    def __repr__(self):
        return f"<Client(id={self.id}, nazwa='{self.nazwa}', nip='{self.nip}')>"