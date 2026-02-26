import logging
import time
from typing import Any

import pandas as pd
import yfinance as yf

from services.market_data import MARKET_INDICES

logger = logging.getLogger(__name__)

# Simple TTL cache: {key: (timestamp, data)}
_screener_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600  # 10 minutes


def _calculate_rsi(closes: pd.Series, period: int = 14) -> float:
    """Calculate RSI for a price series, returns the last value."""
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, float("inf"))
    rsi = 100 - (100 / (1 + rs))
    last = rsi.iloc[-1]
    if pd.isna(last):
        return 50.0
    return round(float(last), 1)


def _macd_crossover(closes: pd.Series) -> str:
    """Returns 'bullish', 'bearish', or 'none' based on MACD crossover in last 3 bars."""
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    diff = macd - signal

    if len(diff) < 4:
        return "none"

    recent = diff.iloc[-3:]
    prev = diff.iloc[-4]

    # Bullish: crossed above signal (diff went from negative to positive)
    if prev < 0 and any(v > 0 for v in recent):
        return "bullish"
    # Bearish: crossed below signal
    if prev > 0 and any(v < 0 for v in recent):
        return "bearish"
    return "none"


async def run_screener(market: str, limit: int = 15) -> list[dict[str, Any]]:
    """
    Scans a market's index components and ranks them by technical interest score.
    Results are cached for 10 minutes.
    """
    cache_key = f"{market.upper()}_{limit}"
    if cache_key in _screener_cache:
        ts, data = _screener_cache[cache_key]
        if time.time() - ts < _CACHE_TTL_SECONDS:
            return data

    market_info = MARKET_INDICES.get(market.upper(), MARKET_INDICES["US"])
    symbols = market_info["symbols"]

    try:
        # Batch-fetch 3 months of daily OHLCV
        raw = yf.download(
            symbols,
            period="3mo",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
        )

        if raw.empty:
            logger.warning(f"Screener: no data for market {market}")
            return []

        results: list[dict[str, Any]] = []

        # Handle single vs multi-ticker DataFrames
        is_multi = isinstance(raw.columns, pd.MultiIndex)

        for symbol in symbols:
            try:
                if is_multi:
                    if symbol not in raw.columns.get_level_values(0):
                        continue
                    df = raw[symbol].dropna(subset=["Close"])
                else:
                    # Single symbol — raw is already a flat DataFrame
                    df = raw.dropna(subset=["Close"])

                if len(df) < 30:
                    continue

                closes = df["Close"]
                volumes = df["Volume"] if "Volume" in df.columns else pd.Series(dtype=float)

                # --- Compute indicators ---
                rsi = _calculate_rsi(closes)
                crossover = _macd_crossover(closes)

                # Volume spike vs 20-day avg
                vol_ratio = 0.0
                if not volumes.empty and len(volumes) >= 20:
                    avg_vol = volumes.iloc[-20:].mean()
                    today_vol = volumes.iloc[-1]
                    if avg_vol > 0:
                        vol_ratio = float(today_vol / avg_vol)

                # 52-week position
                high_52 = float(closes.max())
                low_52 = float(closes.min())
                current_price = float(closes.iloc[-1])
                near_high = high_52 > 0 and current_price >= high_52 * 0.95
                near_low = low_52 > 0 and current_price <= low_52 * 1.05

                # --- Score ---
                score = 0
                signals: list[str] = []

                # RSI scoring
                if rsi < 30:
                    score += 3
                    signals.append("OVERSOLD")
                elif rsi <= 40:
                    score += 1
                    signals.append("RSI LOW")
                elif rsi > 70:
                    score += 2
                    signals.append("OVERBOUGHT")

                # MACD crossover
                if crossover == "bullish":
                    score += 3
                    signals.append("MACD ↑")
                elif crossover == "bearish":
                    score += 2
                    signals.append("MACD ↓")

                # Volume spike
                if vol_ratio >= 2.0:
                    score += 2
                    signals.append("VOL SPIKE")
                elif vol_ratio >= 1.5:
                    score += 1
                    signals.append("VOL HIGH")

                # 52-week extremes
                if near_low:
                    score += 1
                    signals.append("52W LOW")
                if near_high:
                    score += 1
                    signals.append("52W HIGH")

                # Calculate price change
                prev_price = float(closes.iloc[-2]) if len(closes) > 1 else current_price
                change_pct = ((current_price - prev_price) / prev_price * 100) if prev_price > 0 else 0.0

                name = symbol

                results.append({
                    "symbol": symbol,
                    "name": name,
                    "price": round(current_price, 2),
                    "change_percent": round(change_pct, 2),
                    "rsi": rsi,
                    "score": score,
                    "signals": signals,
                })

            except Exception as e:
                logger.debug(f"Screener: skipping {symbol}: {e}")
                continue

        # Sort by score descending, take top limit
        results.sort(key=lambda x: x["score"], reverse=True)
        top = results[:limit]

        _screener_cache[cache_key] = (time.time(), top)
        return top

    except Exception as e:
        logger.error(f"Screener failed for market {market}: {e}")
        return []
