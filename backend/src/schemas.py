from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

# Cost Kind schemas
class CostKindBase(BaseModel):
    kind: str

    class Config:
        from_attributes = True

class CostKindCreate(CostKindBase):
    pass

class CostKindUpdate(CostKindBase):
    pass

class CostKind(CostKindBase):
    id: int

# Cost schemas
class CostBase(BaseModel):
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

    class Config:
        from_attributes = True

class CostCreate(CostBase):
    pass

class Cost(CostBase):
    cost_id: int
    cur_day: int
    cur_mo: int
    cur_yr: int
    cost_branch_value: Optional[float] = None
    cost_hq_value: Optional[float] = None
    cost_ph_value: Optional[float] = None

# Schemas for summary responses
class CostSummary(BaseModel):
    total_cost: float
    total_branch_cost: float
    total_hq_cost: float
    total_ph_cost: float

class CostSummaryResponse(BaseModel):
    total_summary: CostSummary
    by_cost_type: dict[str, float]

# Transaction schemas
class ConfigDate(BaseModel):
    date: date
    year: int
    month: int
    day: int

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    net_value: float
    profit: float
    net_sales_paid: float
    profit_paid: float

    class Config:
        from_attributes = True

class BranchDetails(BaseModel):
    net_sales: float
    profit: float

class BranchTotal(TransactionBase):
    details: dict[str, BranchDetails]

class RepresentativeTotal(BaseModel):
    net_sales: float
    profit: float

class AggregatedStats(BaseModel):
    branches: dict[str, BranchTotal]
    representatives: dict[str, RepresentativeTotal]

class HistoricalStats(AggregatedStats):
    month: str
    year: int

# --- NOWE SCHEMATY DLA ZERO MARGIN (WERYFIKACJA KOSZTÓW) ---

class ZeroMarginTransaction(BaseModel):
    id: int
    date: datetime
    doc_no: str
    nip: Optional[str] = None  # Odpowiada kolumnie customer_nip
    net_value: float
    profit: float
    representative: Optional[str] = None # Odpowiada kolumnie representative_name
    branch: str # Odpowiada kolumnie branch_name

    class Config:
        from_attributes = True

class PaginatedZeroMarginResponse(BaseModel):
    data: List[ZeroMarginTransaction]
    total: int
    limit: int
    offset: int