from typing import Any, Literal

from pydantic import BaseModel, field_validator


class MetaData(BaseModel):
    symbol: str
    name: str
    currency: str
    marketState: str


class PricePoint(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None
    ema9: float | None = None
    ema21: float | None = None
    rsi: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None


class PriceData(BaseModel):
    current: float
    change: float
    changePercent: float
    history: list[PricePoint]


class Fundamentals(BaseModel):
    marketCap: float
    peRatio: float | None
    week52High: float
    week52Low: float


class NewsItem(BaseModel):
    source: str
    headline: str
    url: str
    publishedAt: str


class AIAnalysis(BaseModel):
    # New Squad Architecture Fields
    ticker: str | None = None
    timestamp: str | None = None
    horizon: str | None = None
    action: str | None = None
    decision: dict[str, Any] | None = None
    risk_validation: dict[str, Any] | None = None
    squad_details: dict[str, Any] | None = None

    # Legacy fields (optional) for compatibility
    sentiment: str | None = None
    confidence: float | None = None
    summary: str | None = None
    model_name: str | None = None
    signal: str | None = None


class TickerResponse(BaseModel):
    meta: MetaData
    price: PriceData
    fundamentals: Fundamentals
    news: list[NewsItem]
    ai_analysis: AIAnalysis | None = None


class OrderRequest(BaseModel):
    symbol: str
    side: Literal["BUY", "SELL"]
    qty: int
    price: float
    stop_loss: float | None = None
    sl_type: Literal["fixed", "trailing_fixed", "trailing_pct"] = "fixed"
    take_profit: float | None = None
    tp_config: dict | None = None  # For advanced TP

    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("qty must be greater than 0")
        return v

    @field_validator("price")
    @classmethod
    def price_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be greater than 0")
        return v

    @field_validator("symbol")
    @classmethod
    def symbol_must_be_valid(cls, v: str) -> str:
        import re
        v = v.upper().strip()
        if not re.match(r"^[A-Z0-9.\-]{1,20}$", v):
            raise ValueError("Invalid ticker symbol format")
        return v


class StopLossUpdateRequest(BaseModel):
    symbol: str
    stop_loss: dict | None = (
        None  # {type, value, high_water_mark, initial_value, initial_distance}
    )
    take_profit: float | None = None
    tp_config: dict | None = None


class CashUpdate(BaseModel):
    amount: float


class PortfolioResponse(BaseModel):
    cash: float
    holdings: dict  # dict mapping symbol to {qty, avg_price, current_price, etc}
    positions: list[dict] # for legacy compatibility
    total_value: float
    history: list[dict]


class AlertRequest(BaseModel):
    symbol: str
    target_price: float
    condition: str  # "ABOVE" or "BELOW"


class AlertResponse(BaseModel):
    id: str
    symbol: str
    target_price: float
    condition: str
