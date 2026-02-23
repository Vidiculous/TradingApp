import warnings

warnings.filterwarnings("ignore", category=ResourceWarning)
import logging
import random
import time
import traceback
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import yfinance as yf
from fastapi import HTTPException

# Configure logging
logger = logging.getLogger(__name__)


def sf(val: Any, default: float = 0.0) -> float:
    """Sanitize float values, converting NaN/None to default."""
    if val is None or pd.isna(val):
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def get_ticker_data(
    symbol: str, period: str = "1mo", interval: str = "1d"
) -> dict[str, Any]:
    max_retries = 3
    retry_delay = 1

    # Validate interval
    valid_intervals = [
        "1m",
        "2m",
        "5m",
        "15m",
        "30m",
        "60m",
        "90m",
        "1h",
        "1d",
        "5d",
        "1wk",
        "1mo",
        "3mo",
    ]
    if interval not in valid_intervals:
        raise ValueError(f"Invalid interval: {interval}. Must be one of {valid_intervals}")

    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # Get historical data
            hist = ticker.history(period=period, interval=interval)

            if hist.empty:
                # Fallback for some ticker/interval combos that might return empty
                logger.warning(
                    f"Empty history for {symbol} with period={period}, interval={interval}"
                )

            # Process history
            history_points = []
            
            if not hist.empty:
                # Calculate VWAP if volume is available
                has_volume = "Volume" in hist.columns and (hist["Volume"] != 0).any()
                if has_volume:
                    typical_price = (hist["High"] + hist["Low"] + hist["Close"]) / 3
                    hist["VWAP"] = (typical_price * hist["Volume"]).cumsum() / hist["Volume"].cumsum()

                # Calculate EMAs
                if "Close" in hist.columns:
                    hist["EMA9"] = hist["Close"].ewm(span=9, adjust=False).mean()
                    hist["EMA21"] = hist["Close"].ewm(span=21, adjust=False).mean()

                    # Calculate RSI (14)
                    delta = hist["Close"].diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                    rs = gain / loss
                    hist["RSI"] = 100 - (100 / (1 + rs))

                    # Calculate MACD (12, 26, 9)
                    ema12 = hist["Close"].ewm(span=12, adjust=False).mean()
                    ema26 = hist["Close"].ewm(span=26, adjust=False).mean()
                    hist["MACD"] = ema12 - ema26
                    hist["MACD_Signal"] = hist["MACD"].ewm(span=9, adjust=False).mean()
                    hist["MACD_Hist"] = hist["MACD"] - hist["MACD_Signal"]

                for index, row in hist.iterrows():
                    history_points.append(
                        {
                            "timestamp": index.isoformat(),
                            "open": sf(row.get("Open")),
                            "high": sf(row.get("High")),
                            "low": sf(row.get("Low")),
                            "close": sf(row.get("Close")),
                            "volume": int(row.get("Volume", 0)) if not pd.isna(row.get("Volume")) else 0,
                            "vwap": sf(row.get("VWAP"), None) if has_volume else None,
                            "ema9": sf(row.get("EMA9"), None),
                            "ema21": sf(row.get("EMA21"), None),
                            "rsi": sf(row.get("RSI"), None),
                            "macd": sf(row.get("MACD"), None),
                            "macd_signal": sf(row.get("MACD_Signal"), None),
                            "macd_hist": sf(row.get("MACD_Hist"), None),
                        }
                    )

            # Calculate change
            current_price = info.get("currentPrice", 0.0)
            if not current_price and not hist.empty:
                current_price = hist["Close"].iloc[-1]

            previous_close = info.get("previousClose", 0.0)
            if not previous_close and len(hist) > 1:
                previous_close = hist["Close"].iloc[-2]

            change = current_price - previous_close
            change_percent = (change / previous_close) * 100 if previous_close else 0.0

            # Validate that we found data
            if current_price == 0 and hist.empty:
                # This usually means the ticker is invalid or delisted
                raise ValueError(f"No data found for symbol '{symbol}'")

            return {
                "meta": {
                    "symbol": info.get("symbol", symbol),
                    "name": info.get("longName", symbol),
                    "currency": info.get("currency", "USD"),
                    "marketState": "REGULAR",
                },
                "price": {
                    "current": sf(current_price),
                    "change": round(sf(change), 2),
                    "changePercent": round(sf(change_percent), 2),
                    "history": history_points,
                },
                "fundamentals": {
                    "marketCap": sf(info.get("marketCap"), 0),
                    "peRatio": sf(info.get("trailingPE"), None),
                    "week52High": sf(info.get("fiftyTwoWeekHigh"), 0.0),
                    "week52Low": sf(info.get("fiftyTwoWeekLow"), 0.0),
                },
            }
        except Exception as e:
            # If it's a "No data found" error, it's likely a bad ticker. Don't retry, don't log to error file.
            if "No data found" in str(e):
                raise ValueError(f"No data found for symbol '{symbol}'")

            logger.warning(f"Attempt {attempt + 1}/{max_retries} failed for {symbol}: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                # Log final failure only if it's NOT a simple data missing error
                if "No data found" not in str(e):
                    with open("error.log", "a") as f:
                        f.write(f"Final error in get_ticker_data for {symbol}: {str(e)}\n")
                        traceback.print_exc(file=f)

                raise Exception(f"Failed to fetch data for {symbol}. {str(e)}")


# Index components for market scanning
# Using top components from major indices for better coverage
MARKET_INDICES = {
    "US": {
        "name": "S&P 500 Top 50",
        "symbols": [
            # Top 50 S&P 500 by market cap for performance
            "AAPL",
            "MSFT",
            "GOOGL",
            "AMZN",
            "NVDA",
            "META",
            "TSLA",
            "BRK-B",
            "LLY",
            "V",
            "UNH",
            "XOM",
            "JPM",
            "JNJ",
            "WMT",
            "MA",
            "PG",
            "AVGO",
            "HD",
            "CVX",
            "MRK",
            "ABBV",
            "COST",
            "KO",
            "PEP",
            "ADBE",
            "CRM",
            "MCD",
            "CSCO",
            "ACN",
            "TMO",
            "NFLX",
            "ABT",
            "LIN",
            "AMD",
            "ORCL",
            "NKE",
            "DHR",
            "TXN",
            "DIS",
            "INTC",
            "VZ",
            "PM",
            "CMCSA",
            "WFC",
            "QCOM",
            "NEE",
            "UNP",
            "COP",
            "RTX",
        ],
    },
    "SE": {
        "name": "OMX Stockholm 30",
        "symbols": [
            # OMX Stockholm 30 index components
            "ABB.ST",
            "ALFA.ST",
            "ASSA-B.ST",
            "ATCO-A.ST",
            "ATCO-B.ST",
            "AZN.ST",
            "BOL.ST",
            "ELUX-B.ST",
            "ERIC-B.ST",
            "ESSITY-B.ST",
            "EVO.ST",
            "GETI-B.ST",
            "HM-B.ST",
            "HEXA-B.ST",
            "INVE-B.ST",
            "KINV-B.ST",
            "NIBE-B.ST",
            "NDA-SE.ST",
            "SAND.ST",
            "SCA-B.ST",
            "SEB-A.ST",
            "SECU-B.ST",
            "SKA-B.ST",
            "SKF-B.ST",
            "SWED-A.ST",
            "SWMA.ST",
            "TEL2-B.ST",
            "TELIA.ST",
            "VOLV-B.ST",
            "SAAB-B.ST",
        ],
    },
    "EU": {
        "name": "Euro Stoxx 50",
        "symbols": [
            # Euro Stoxx 50 index components
            "AIR.PA",
            "AI.PA",
            "CS.PA",
            "BN.PA",
            "EN.PA",
            "OR.PA",
            "MC.PA",
            "SAN.PA",
            "TTE.PA",
            "VIV.PA",
            "SAP.DE",
            "SIE.DE",
            "ALV.DE",
            "BAS.DE",
            "BAYN.DE",
            "BMW.DE",
            "DAI.DE",
            "DTE.DE",
            "EOAN.DE",
            "MUV2.DE",
            "VOW3.DE",
            "ASML.AS",
            "INGA.AS",
            "PHIA.AS",
            "SHELL.AS",
            "AD.AS",
            "SAN.MC",
            "BBVA.MC",
            "IBE.MC",
            "ITX.MC",
            "TEF.MC",
            "ENEL.MI",
            "ENI.MI",
            "ISP.MI",
            "G.MI",
            "UCG.MI",
            "NOVO-B.CO",
            "DSV.CO",
            "ORSTED.CO",
            "NOKIA.HE",
            "ADYEN.AS",
            "PRX.AS",
        ],
    },
}

# Cache for market scanner results
_market_scanner_cache: dict[str, dict] = {}
MARKET_SCANNER_CACHE_DURATION_MINUTES = 5


def get_top_gainers(market: str = "US", limit: int = 5) -> list[dict[str, Any]]:
    """
    Fetches top gainers from a specific market by scanning index components.
    Results are cached for 5 minutes to improve performance.

    Args:
        market: Market code ("US", "SE", "EU")
        limit: Number of stocks to return
    """
    # Check cache first
    cache_key = f"{market.upper()}_{limit}"
    if cache_key in _market_scanner_cache:
        cached_data = _market_scanner_cache[cache_key]
        cache_time = cached_data.get("timestamp")
        if cache_time and datetime.now() - cache_time < timedelta(
            minutes=MARKET_SCANNER_CACHE_DURATION_MINUTES
        ):
            return cached_data["results"]

    # Get market index components
    market_data = MARKET_INDICES.get(market.upper(), MARKET_INDICES["US"])
    symbols = market_data["symbols"]

    try:
        # Batch fetch for efficiency - get 2 days of data
        data = yf.download(symbols, period="2d", interval="1d", progress=False, auto_adjust=True)[
            "Close"
        ]

        if data.empty:
            logger.warning(f"No data returned for {market} market scan")
            return []

        results = []

        # Handle both single column (1 symbol) and multi-column (multiple symbols) DataFrames
        if isinstance(data, pd.Series):
            # Single symbol case
            if len(data) >= 2:
                prev_close = data.iloc[-2]
                current_close = data.iloc[-1]
                change = current_close - prev_close
                change_percent = (change / prev_close) * 100

                # Get company name from yfinance
                try:
                    ticker = yf.Ticker(symbols[0])
                    name = ticker.info.get("shortName", symbols[0])
                except:
                    name = symbols[0]

                results.append(
                    {
                        "symbol": symbols[0],
                        "name": name,
                        "price": round(sf(current_close), 2),
                        "change": round(sf(change), 2),
                        "changePercent": round(sf(change_percent), 2),
                    }
                )
        else:
            # Multiple symbols case
            for symbol in data.columns:
                try:
                    series = data[symbol]
                    if len(series) >= 2 and not series.isna().all():
                        prev_close = series.iloc[-2]
                        current_close = series.iloc[-1]

                        if pd.isna(prev_close) or pd.isna(current_close) or prev_close == 0:
                            continue

                        change = current_close - prev_close
                        change_percent = (change / prev_close) * 100

                        # Get company name from yfinance (with caching to avoid too many requests)
                        try:
                            ticker = yf.Ticker(symbol)
                            name = ticker.info.get("shortName", symbol)
                        except:
                            name = symbol

                        results.append(
                            {
                                "symbol": symbol,
                                "name": name,
                                "price": round(sf(current_close), 2),
                                "change": round(sf(change), 2),
                                "changePercent": round(sf(change_percent), 2),
                            }
                        )
                except Exception as e:
                    logger.warning(f"Failed to process {symbol}: {e}")
                    continue

        # Sort by absolute change percent (descending)
        results.sort(key=lambda x: abs(x["changePercent"]), reverse=True)

        final_results = results[:limit]

        # Cache the results
        _market_scanner_cache[cache_key] = {"results": final_results, "timestamp": datetime.now()}

        return final_results

    except Exception as e:
        logger.error(f"Error fetching top gainers for market {market}: {e}")
        return []


def get_economic_calendar() -> list[dict[str, Any]]:
    """
    Returns a list of high-impact economic events relative to the current date.
    Since real-time calendar APIs are expensive/keyed, we simulate realistic events
    to ensure the UI is always demonstrable.
    """
    today = datetime.now()
    tomorrow = today + timedelta(days=1)

    # Base mocked events
    events = [
        {
            "time": "08:30",
            "event": "CPI (MoM)",
            "impact": "HIGH",
            "actual": "0.3%",
            "forecast": "0.3%",
            "offset": 0,
        },
        {
            "time": "08:30",
            "event": "Core CPI (YoY)",
            "impact": "HIGH",
            "actual": "3.2%",
            "forecast": "3.1%",
            "offset": 0,
        },
        {
            "time": "14:00",
            "event": "FOMC Meeting Minutes",
            "impact": "HIGH",
            "actual": "-",
            "forecast": "-",
            "offset": 0,
        },
        {
            "time": "08:30",
            "event": "PPI (MoM)",
            "impact": "MEDIUM",
            "actual": "-",
            "forecast": "0.1%",
            "offset": 1,
        },
        {
            "time": "08:30",
            "event": "Retail Sales (MoM)",
            "impact": "MEDIUM",
            "actual": "-",
            "forecast": "0.4%",
            "offset": 1,
        },
        {
            "time": "10:00",
            "event": "Consumer Sentiment",
            "impact": "MEDIUM",
            "actual": "-",
            "forecast": "76.5",
            "offset": 1,
        },
        {
            "time": "14:30",
            "event": "Fed Chair Powell Speaks",
            "impact": "HIGH",
            "actual": "-",
            "forecast": "-",
            "offset": 2,
        },
    ]

    calendar = []

    for evt in events:
        event_date = today + timedelta(days=evt["offset"])
        is_today = evt["offset"] == 0

        # Determine status based on time if it's today
        status = "UPCOMING"
        if is_today:
            event_dt = datetime.strptime(evt["time"], "%H:%M").replace(
                year=today.year, month=today.month, day=today.day
            )
            if datetime.now() > event_dt:
                status = "COMPLETED"

        calendar.append(
            {
                "id": f"{evt['event']}-{evt['offset']}",
                "date": event_date.strftime("%Y-%m-%d"),
                "time": evt["time"],
                "event": evt["event"],
                "impact": evt["impact"],
                "actual": (
                    evt["actual"] if status == "COMPLETED" or not is_today else "-"
                ),  # Hide actual if upcoming
                "forecast": evt["forecast"],
                "status": status,
            }
        )

    return {"events": calendar, "simulated": True}


def get_order_book(symbol: str, current_price: float) -> dict[str, Any]:
    """
    Simulates a Level 2 Order Book.
    Generates realistic looking Bid/Ask walls around the current price.
    """

    # Simulation parameters
    spread = current_price * 0.0005  # Tight spread (0.05%)
    depth_levels = 15
    volatility = 0.02

    bids = []
    asks = []

    # Bids (Lower than price)
    for i in range(depth_levels):
        # Price decreases as we go deeper
        price_offset = spread + (i * spread * 1.5)
        price = current_price - price_offset

        # Volume increases as we go deeper (Gaussian-ish) / Random noise
        # Base size * depth factor * random noise
        size = int((100 * (i + 1)) * random.uniform(0.8, 1.5))

        # Formatting
        bids.append(
            {"price": round(price, 2), "size": size, "total": 0}  # Calculated on frontend or here
        )

    # Asks (Higher than price)
    for i in range(depth_levels):
        # Price increases as we go deeper
        price_offset = spread + (i * spread * 1.5)
        price = current_price + price_offset

        size = int((100 * (i + 1)) * random.uniform(0.8, 1.5))

        asks.append({"price": round(price, 2), "size": size, "total": 0})

    return {"symbol": symbol, "bids": bids, "asks": asks, "simulated": True}


def get_sales_tape(symbol: str, current_price: float) -> list[dict[str, Any]]:
    """
    Simulates Time & Sales (The Tape).
    Generates a list of recent executions.
    """

    tape = []

    # Generate 50 trades
    for i in range(50):
        # Time within last 5 minutes
        time_offset = random.randint(0, 300)
        trade_time = datetime.now() - timedelta(seconds=time_offset)

        # Price around current (small noise)
        price_noise = current_price * random.uniform(-0.0005, 0.0005)
        price = current_price + price_noise

        # Determine side (simple heuristic: > current = buy, < current = sell)
        side = "buy" if price >= current_price else "sell"

        # Size (skewed towards small lots, occasional block)
        if random.random() > 0.95:
            size = random.randint(1000, 5000)  # Block trade
        else:
            size = random.randint(1, 500)  # Retail trade

        tape.append(
            {
                "id": f"{i}",
                "time": trade_time.strftime("%H:%M:%S"),
                "price": round(price, 2),
                "size": size,
                "side": side,
            }
        )

    # Sort by time desc
    tape.sort(key=lambda x: x["time"], reverse=True)

    return {"trades": tape, "simulated": True}


def get_market_overview() -> dict[str, list[dict[str, Any]]]:
    """
    Fetches an overview of the market including major indices and sector performance.
    Used for the Market Heatmap.
    """
    indices = {
        "SPY": "S&P 500",
        "QQQ": "Nasdaq 100",
        "^OMX": "OMXS30",
        "^STOXX50E": "Euro Stoxx 50",
        "^GDAXI": "DAX",
        "^FTSE": "FTSE 100",
        "^N225": "Nikkei 225",
    }

    sectors = {
        "XLK": "Technology",
        "XLF": "Financials",
        "XLV": "Healthcare",
        "XLE": "Energy",
        "XLC": "Comm. Svcs",
        "XLI": "Industrials",
        "XLP": "Cons. Staples",
        "XLY": "Cons. Discret.",
        "XLB": "Materials",
        "XLU": "Utilities",
        "XLRE": "Real Estate",
    }

    all_symbols = list(indices.keys()) + list(sectors.keys())

    try:
        # Batch fetch 2 days of history to calculate change
        data = yf.download(all_symbols, period="2d", interval="1d", progress=False)["Close"]

        if data.empty:
            raise Exception("No data returned")

        overview = {"indices": [], "sectors": []}

        # Process Indices
        for symbol, name in indices.items():
            if symbol in data.columns:
                series = data[symbol]
                if len(series) >= 2:
                    curr = series.iloc[-1]
                    prev = series.iloc[-2]
                    change = curr - prev
                    pct = (change / prev) * 100

                    overview["indices"].append(
                        {
                            "symbol": symbol,
                            "name": name,
                            "price": round(sf(curr), 2),
                            "change": round(sf(change), 2),
                            "changePercent": round(sf(pct), 2),
                        }
                    )

        # Process Sectors
        for symbol, name in sectors.items():
            if symbol in data.columns:
                series = data[symbol]
                if len(series) >= 2:
                    curr = series.iloc[-1]
                    prev = series.iloc[-2]
                    change = curr - prev
                    pct = (change / prev) * 100

                    overview["sectors"].append(
                        {
                            "symbol": symbol,
                            "name": name,
                            "price": round(sf(curr), 2),
                            "change": round(sf(change), 2),
                            "changePercent": round(sf(pct), 2),
                        }
                    )

        return overview

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_exchange_rate(from_currency: str, to_currency: str = "USD") -> float:
    """
    Fetches the current exchange rate between two currencies.
    Example: from_currency="SEK", to_currency="USD" -> 0.096
    """
    if from_currency.upper() == to_currency.upper():
        return 1.0

    # formatting for yfinance: e.g. SEKUSD=X
    # common pairs: EURUSD=X, GBPUSD=X
    # for others might be USDSEK=X and we invert, but let's try direct first

    pair = f"{from_currency.upper()}{to_currency.upper()}=X"
    try:
        ticker = yf.Ticker(pair)
        # Fast generic check

        # Try to get regular market price
        hist = ticker.history(period="1d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])

        # If that fails, try the inverted pair
        inverted_pair = f"{to_currency.upper()}{from_currency.upper()}=X"
        ticker_inv = yf.Ticker(inverted_pair)
        hist_inv = ticker_inv.history(period="1d")
        if not hist_inv.empty:
            return 1.0 / float(hist_inv["Close"].iloc[-1])

        logger.warning(
            f"Could not fetch exchange rate for {from_currency}/{to_currency}. Assuming 1.0"
        )
        return 1.0

    except Exception as e:
        logger.error(f"Error fetching exchange rate for {from_currency}: {e}")
        return 1.0


def get_global_context() -> list[dict[str, Any]]:
    """
    Fetches key macro indicators: Crypto, Bond Yields, VIX, Gold.
    Also appends top movers from the watchlist.
    """
    tickers = {
        "BTC-USD": "Bitcoin",
        "ETH-USD": "Ethereum",
        "^TNX": "10Y Yield",
        "^VIX": "VIX",
        "GC=F": "Gold",
    }

    results = []

    try:
        # 1. Fetch Macro Data
        data = yf.download(
            list(tickers.keys()), period="2d", interval="1d", progress=False, auto_adjust=True
        )["Close"]

        if not data.empty:
            for symbol, name in tickers.items():
                if symbol in data.columns:
                    series = data[symbol]
                    if len(series) >= 2:
                        curr = series.iloc[-1]
                        prev = series.iloc[-2]
                        change = curr - prev
                        pct = (change / prev) * 100

                        results.append(
                            {
                                "symbol": symbol,
                                "name": name,
                                "price": round(sf(curr), 2),
                                "change": round(sf(change), 2),
                                "changePercent": round(sf(pct), 2),
                            }
                        )
    except Exception as e:
        logger.error(f"Global context fetch failed: {e}")
        # Capture partial results if any

    try:
        # 2. Fetch Top Movers
        movers = get_top_gainers(limit=5)
        results.extend(movers)
    except Exception as e:
        logger.error(f"Failed to fetch movers for global context: {e}")

    return results
