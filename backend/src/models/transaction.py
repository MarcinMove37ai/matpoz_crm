from sqlalchemy import Column, Integer, String, DateTime, Numeric, func, cast, or_, Date, Text
from sqlalchemy.ext.hybrid import hybrid_property
from database import Base

# Dodaj to do istniejącego pliku models/transaction.py

class RepresentativeAggregatedData(Base):
    __tablename__ = "representative_aggregated_data"

    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    branch_name = Column(String(100), primary_key=True)
    representative_name = Column(String(100), primary_key=True)
    net_sales_total = Column(Numeric, default=0)
    net_sales_paid = Column(Numeric, default=0)
    profit_total = Column(Numeric, default=0)
    profit_paid = Column(Numeric, default=0)
    sales_paid_percentage = Column(Numeric, default=0)
    profit_margin_percentage = Column(Numeric, default=0)
    paid_profit_margin_percentage = Column(Numeric, default=0)
    rep_profit_total = Column(Numeric, default=0)  # Dodana kolumna
    rep_profit_payd = Column(Numeric, default=0)   # Dodana kolumna


class CostKind(Base):
    __tablename__ = 'cost_kinds'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(50), nullable=False)

    def __repr__(self):
        return f"<CostKind(id={self.id}, kind='{self.kind}')>"

class ConfigCurrentDate(Base):
    __tablename__ = "config_current_date"

    id = Column(Integer, primary_key=True)
    config_date = Column(Date, nullable=False, server_default="2024-12-31")
    year_value = Column(Integer)
    month_value = Column(Integer)
    day_value = Column(Integer)
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    document_number = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    branch_name = Column(String(100), nullable=False)
    representative_name = Column(String(100))
    customer_nip = Column(String(100))
    net_value = Column(Numeric(12, 2), nullable=False)
    gross_value = Column(Numeric(12, 2), nullable=False)
    to_pay = Column(Numeric(12, 2))
    profit = Column(Numeric(12, 2), nullable=False)
    year = Column(Integer)
    month = Column(Integer)
    # Dodane brakujące kolumny
    rep_profit_factor = Column(Numeric(5, 2))
    rep_profit = Column(Numeric(12, 2))
    branch_profit = Column(Numeric(12, 2))
    hq_profit = Column(Numeric(12, 2))
    found = Column(Numeric(12, 2))

    @hybrid_property
    def is_paid(self):
        """
        Sprawdza czy transakcja jest opłacona.
        Transakcja jest uznana za opłaconą gdy:
        - to_pay jest NULL
        - to_pay jest 0
        - to_pay jest pustym stringiem
        """
        return (self.to_pay.is_(None) | (cast(self.to_pay, Numeric) == 0))

    @is_paid.expression
    def is_paid(cls):
        """
        Wersja wyrażenia SQL dla właściwości is_paid.
        Używana w zapytaniach filtrujących.
        """
        return or_(
            cls.to_pay.is_(None),
            cast(cls.to_pay, Numeric) == 0
        )

class AllCosts(Base):
    __tablename__ = "all_costs"

    cost_id = Column(Integer, primary_key=True, index=True)
    cur_day = Column(Integer)
    cur_mo = Column(Integer)
    cur_yr = Column(Integer)
    cost_year = Column(Integer, nullable=False)
    cost_contrahent = Column(String(200), nullable=False)
    cost_nip = Column(String(20), nullable=False)
    cost_mo = Column(Integer, nullable=False)
    cost_doc_no = Column(String(50), nullable=False)
    cost_value = Column(Numeric(12, 2), nullable=False)
    cost_kind = Column(String(100), nullable=False)
    cost_4what = Column(Text, nullable=False)
    cost_own = Column(String(20), nullable=False)
    cost_ph = Column(String(100))
    cost_author = Column(String(100), nullable=False)
    cost_branch = Column(String(100), nullable=False)
    cost_branch_value = Column(Numeric(12, 2))
    cost_hq_value = Column(Numeric(12, 2))
    cost_ph_value = Column(Numeric(12, 2))
    branch_payout = Column(Numeric(12, 2))
    rep_payout = Column(Numeric(12, 2))

    def __init__(self, **kwargs):
        super(AllCosts, self).__init__(**kwargs)
        # Wartości cost_branch_value, cost_hq_value i cost_ph_value
        # oraz branch_payout i rep_payout są obliczane przez triggery w bazie danych

    def __repr__(self):
        return f"<AllCosts(cost_id={self.cost_id}, cost_contrahent='{self.cost_contrahent}', cost_doc_no='{self.cost_doc_no}')>"
class AggregatedDataSums(Base):
    __tablename__ = "aggregated_data_sums"

    id = Column("id", Integer, primary_key=True, default=1)
    net_sales_total_year = Column("net_sales_total_year", Numeric(12, 2), default=0)
    profit_total_year = Column("profit_total_year", Numeric(12, 2), default=0)
    net_sales_payd_year = Column("net_sales_payd_year", Numeric(12, 2), default=0)
    profit_payd_year = Column("profit_payd_year", Numeric(12, 2), default=0)
    net_sales_ph_year = Column("net_sales_ph_year", Numeric(12, 2), default=0)
    profit_ph_year = Column("profit_ph_year", Numeric(12, 2), default=0)
    net_sales_rzgow_year = Column("net_sales_rzgow_year", Numeric(12, 2), default=0)
    profit_rzgow_year = Column("profit_rzgow_year", Numeric(12, 2), default=0)
    net_sales_malbork_year = Column("net_sales_malbork_year", Numeric(12, 2), default=0)
    profit_malbork_year = Column("profit_malbork_year", Numeric(12, 2), default=0)
    net_sales_pcim_year = Column("net_sales_pcim_year", Numeric(12, 2), default=0)
    profit_pcim_year = Column("profit_pcim_year", Numeric(12, 2), default=0)
    net_sales_lublin_year = Column("net_sales_lublin_year", Numeric(12, 2), default=0)
    profit_lublin_year = Column("profit_lublin_year", Numeric(12, 2), default=0)
    net_sales_lomza_year = Column("net_sales_lomza_year", Numeric(12, 2), default=0)
    profit_lomza_year = Column("profit_lomza_year", Numeric(12, 2), default=0)
    net_sales_mysliborz_year = Column("net_sales_mysliborz_year", Numeric(12, 2), default=0)
    profit_mysliborz_year = Column("profit_mysliborz_year", Numeric(12, 2), default=0)
    net_sales_mg_year = Column("net_sales_mg_year", Numeric(12, 2), default=0)
    profit_mg_year = Column("profit_mg_year", Numeric(12, 2), default=0)
    net_sales_sth_year = Column("net_sales_sth_year", Numeric(12, 2), default=0)
    profit_sth_year = Column("profit_sth_year", Numeric(12, 2), default=0)
    net_sales_bhp_year = Column("net_sales_bhp_year", Numeric(12, 2), default=0)
    profit_bhp_year = Column("profit_bhp_year", Numeric(12, 2), default=0)
class AggregatedData(Base):
    __tablename__ = "aggregated_data"

    aggregation_type = Column(String(20), primary_key=True)  # 'today' lub 'current_month'
    net_sale_total_all_branch = Column("net_sale_total_all_branch", Numeric, default=0)
    net_profit_total_all_branch = Column("net_profit_total_all_branch", Numeric, default=0)
    net_sale_payd_all_branch = Column("net_sale_payd_all_branch", Numeric, default=0)
    net_profit_payd_all_branch = Column("net_profit_payd_all_branch", Numeric, default=0)
    net_sale_total_all_representative = Column("net_sale_total_all_representative", Numeric, default=0)
    net_profit_total_all_representative = Column("net_profit_total_all_representative", Numeric, default=0)
    net_sale_total_rzgow = Column("net_sale_total_rzgow", Numeric, default=0)
    net_profit_total_rzgow = Column("net_profit_total_rzgow", Numeric, default=0)
    net_sale_total_malbork = Column("net_sale_total_malbork", Numeric, default=0)
    net_profit_total_malbork = Column("net_profit_total_malbork", Numeric, default=0)
    net_sale_total_pcim = Column("net_sale_total_pcim", Numeric, default=0)
    net_profit_total_pcim = Column("net_profit_total_pcim", Numeric, default=0)
    net_sale_total_lublin = Column("net_sale_total_lublin", Numeric, default=0)
    net_profit_total_lublin = Column("net_profit_total_lublin", Numeric, default=0)
    net_sale_total_lomza = Column("net_sale_total_lomza", Numeric, default=0)
    net_profit_total_lomza = Column("net_profit_total_lomza", Numeric, default=0)
    net_sale_total_mysliborz = Column("net_sale_total_mysliborz", Numeric, default=0)
    net_profit_total_mysliborz = Column("net_profit_total_mysliborz", Numeric, default=0)
    net_sale_total_mg = Column("net_sale_total_mg", Numeric, default=0)
    net_profit_total_mg = Column("net_profit_total_mg", Numeric, default=0)
    net_sale_total_sth = Column("net_sale_total_sth", Numeric, default=0)
    net_profit_total_sth = Column("net_profit_total_sth", Numeric, default=0)
    net_sale_total_bhp = Column("net_sale_total_bhp", Numeric, default=0)
    net_profit_total_bhp = Column("net_profit_total_bhp", Numeric, default=0)

class AggregatedDataHist(Base):
    __tablename__ = "aggregated_data_hist"

    aggregation_month = Column("aggregation_month", String(20), primary_key=True)  # Format: 'YYYY-MM'
    net_sale_total_all_branch = Column("net_sale_total_all_branch", Numeric, default=0)
    net_profit_total_all_branch = Column("net_profit_total_all_branch", Numeric, default=0)
    net_sale_payd_all_branch = Column("net_sale_payd_all_branch", Numeric, default=0)
    net_profit_payd_all_branch = Column("net_profit_payd_all_branch", Numeric, default=0)
    net_sale_total_all_representative = Column("net_sale_total_all_representative", Numeric, default=0)
    net_profit_total_all_representative = Column("net_profit_total_all_representative", Numeric, default=0)
    net_sale_total_rzgow = Column("net_sale_total_rzgow", Numeric, default=0)
    net_profit_total_rzgow = Column("net_profit_total_rzgow", Numeric, default=0)
    net_sale_total_malbork = Column("net_sale_total_malbork", Numeric, default=0)
    net_profit_total_malbork = Column("net_profit_total_malbork", Numeric, default=0)
    net_sale_total_pcim = Column("net_sale_total_pcim", Numeric, default=0)
    net_profit_total_pcim = Column("net_profit_total_pcim", Numeric, default=0)
    net_sale_total_lublin = Column("net_sale_total_lublin", Numeric, default=0)
    net_profit_total_lublin = Column("net_profit_total_lublin", Numeric, default=0)
    net_sale_total_lomza = Column("net_sale_total_lomza", Numeric, default=0)
    net_profit_total_lomza = Column("net_profit_total_lomza", Numeric, default=0)
    net_sale_total_mysliborz = Column("net_sale_total_mysliborz", Numeric, default=0)
    net_profit_total_mysliborz = Column("net_profit_total_mysliborz", Numeric, default=0)
    net_sale_total_mg = Column("net_sale_total_mg", Numeric, default=0)
    net_profit_total_mg = Column("net_profit_total_mg", Numeric, default=0)
    net_sale_total_sth = Column("net_sale_total_sth", Numeric, default=0)
    net_profit_total_sth = Column("net_profit_total_sth", Numeric, default=0)
    net_sale_total_bhp = Column("net_sale_total_bhp", Numeric, default=0)
    net_profit_total_bhp = Column("net_profit_total_bhp", Numeric, default=0)

class NetSalesBranchTotal(Base):
    __tablename__ = "net_sales_branch_total"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    branch_name = Column(String(100), primary_key=True)
    net_sales = Column(Numeric)


class ProfitTotal(Base):
    __tablename__ = "profit_total"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    branch_name = Column(String(100), primary_key=True)
    profit = Column(Numeric)


class ProfitPayd(Base):
    __tablename__ = "profit_payd"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    branch_name = Column(String(100), primary_key=True)
    profit_paid = Column(Numeric)


class NetSalesBranchPayd(Base):
    __tablename__ = "net_sales_branch_payd"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    branch_name = Column(String(100), primary_key=True)
    net_sales_paid = Column(Numeric)


class NetSalesRepresentativeTotal(Base):
    __tablename__ = "net_sales_representative_total"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    representative_name = Column(String(100), primary_key=True)
    net_sales = Column(Numeric)


class NetSalesRepresentativePayd(Base):
    __tablename__ = "net_sales_representative_payd"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    representative_name = Column(String(100), primary_key=True)
    net_sales_paid = Column(Numeric)


class ProfitRepresentativeTotal(Base):
    __tablename__ = "profit_representative_total"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    representative_name = Column(String(100), primary_key=True)
    profit = Column(Numeric)


class ProfitRepresentativePayd(Base):
    __tablename__ = "profit_representative_payd"
    year = Column(Integer, primary_key=True)
    month = Column(Integer, primary_key=True)
    representative_name = Column(String(100), primary_key=True)
    profit_paid = Column(Numeric)


class AggregatedSalesData(Base):
    __tablename__ = "aggregated_sales_data"
    # Klucz główny stanowią kombinacja roku, miesiąca i nazwy oddziału
    asd_year = Column(Integer, primary_key=True)
    asd_month = Column(Integer, primary_key=True)
    asd_branch = Column(String(100), primary_key=True)

    asd_sales_net = Column(Numeric(12, 2), default=0)
    asd_profit_net = Column(Numeric(12, 2), default=0)
    asd_sales_payd = Column(Numeric(12, 2), default=0)
    asd_profit_payd = Column(Numeric(12, 2), default=0)
    asd_sales_payd_percent = Column(Numeric(12, 2), default=0)
    asd_sales_ph = Column(Numeric(12, 2), default=0)
    asd_profit_ph = Column(Numeric(12, 2), default=0)
    asd_sales_ph_percent = Column(Numeric(12, 2), default=0)
    asd_marg_branch = Column(Numeric(12, 2), default=0)
    asd_marg_ph = Column(Numeric(12, 2), default=0)
    asd_marg_total = Column(Numeric(12, 2), default=0)