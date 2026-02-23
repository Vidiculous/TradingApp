from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, JSON, Column

class AnalysisResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    horizon: str = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    signal: str
    confidence: float
    summary: str
    action: str  # BULLISH, BEARISH, NEUTRAL
    reasoning: str
    price_at_analysis: float
    # Store the full JSON results from multiple agents
    squad_results: dict = Field(default={}, sa_column=Column(JSON))

class Position(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(unique=True, index=True)
    qty: float
    avg_price: float
    current_price: float
    stop_loss: Optional[float] = None
    sl_type: str = "fixed"  # fixed, trailing
    take_profit: Optional[float] = None
    tp_config: dict = Field(default={}, sa_column=Column(JSON))
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class WatchlistItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(unique=True, index=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class Alert(SQLModel, table=True):
    id: Optional[str] = Field(primary_key=True)  # Using existing string IDs for compatibility
    symbol: str = Field(index=True)
    target_price: float
    condition: str  # above, below
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)


class Account(SQLModel, table=True):
    id: str = Field(default="default", primary_key=True)
    cash_balance: float = Field(default=100000.0)
    initial_balance: float = Field(default=100000.0)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class OrderHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    side: str  # BUY or SELL
    qty: float
    price: float
    total_value: float
    realized_pnl: Optional[float] = None  # Only for SELL orders
    reason: Optional[str] = None  # manual, stop_loss, take_profit
    timestamp: datetime = Field(default_factory=datetime.utcnow)
