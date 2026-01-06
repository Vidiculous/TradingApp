import logging

import pandas as pd
import yfinance as yf

from .ai_service import analyze_sector_correlations

logger = logging.getLogger(__name__)

# predefined peers for high fidelity
PEERS_MAP = {
    "MSFT": ["AAPL", "GOOGL", "NVDA", "AMZN"],
    "AAPL": ["MSFT", "GOOGL", "NVDA", "AMZN"],
    "NVDA": ["AMD", "INTC", "TSM", "AVGO"],
    "TSLA": ["RIVN", "LCID", "F", "GM"],
    "AMD": ["NVDA", "INTC", "QCOM", "AVGO"],
    "GOOGL": ["MSFT", "META", "AMZN", "AAPL"],
    "META": ["GOOGL", "SNAP", "PINS", "AMZN"],
    "AMZN": ["WMT", "TGT", "GOOGL", "MSFT"],
}


def get_peers(symbol: str):
    return PEERS_MAP.get(
        symbol.upper(), ["SPY", "QQQ", "DIA", "IWM"]
    )  # Default to indices if unknown


def get_sector_correlation(symbol: str):
    symbol = symbol.upper()
    peers = get_peers(symbol)
    tickers_list = [symbol] + peers

    try:
        # Batch fetch 1 month of data
        data = yf.download(tickers_list, period="1mo", interval="1d", progress=False)["Close"]

        if data.empty:
            raise Exception("No data returned")

        # Calculate correlations
        # data is a DataFrame where columns are Tickers

        target_series = data[symbol]
        correlations = []

        for peer in peers:
            if peer in data.columns:
                # Calculate correlation (0 to 1)
                corr = target_series.corr(data[peer])

                # Calculate recent performance comparison (last 5 days)
                # handle if missing data
                try:
                    target_perf = (
                        target_series.iloc[-1] - target_series.iloc[-5]
                    ) / target_series.iloc[-5]
                    peer_perf = (data[peer].iloc[-1] - data[peer].iloc[-5]) / data[peer].iloc[-5]
                except Exception:
                    target_perf = 0
                    peer_perf = 0

                correlations.append(
                    {
                        "symbol": peer,
                        "correlation": round(corr, 2) if not pd.isna(corr) else 0.0,
                        "relative_perf_5d": round(
                            (target_perf - peer_perf) * 100, 2
                        ),  # Alpha vs Peer
                    }
                )

        # Sort by correlation strength
        correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        # AI Analysis
        ai_summary = analyze_sector_correlations(symbol, correlations)

        return {"symbol": symbol, "peers": correlations, "ai_analysis": ai_summary}

    except Exception as e:
        logger.error(f"Sector analysis failed: {e}")
        return {"symbol": symbol, "peers": [], "error": str(e)}
