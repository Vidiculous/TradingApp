import asyncio
from typing import Any, Dict, List

import yfinance as yf


async def get_peer_group(ticker: str) -> Dict[str, Any]:
    """
    Identify industry peers for a given ticker and fetch key valuation metrics.
    Uses sector-based benchmark peers derived from the ticker's sector info.
    """
    try:
        stock = yf.Ticker(ticker)
        info = await asyncio.to_thread(lambda: stock.info)
        sector = info.get("sector", "Unknown")
        industry = info.get("industry", "Unknown")

        # Use sector-based benchmark peers.
        # NOTE: yfinance's recommendations_summary is indexed by date (or a plain integer
        # RangeIndex), NOT by ticker symbols, so it cannot be used to discover peers.
        peers: List[str] = []
        peer_source = "sector_benchmark"

        sector_benchmarks = {
            "Technology": ["MSFT", "AAPL", "GOOGL", "NVDA", "META"],
            "Semiconductors": ["NVDA", "AMD", "INTC", "QCOM", "AVGO"],
            "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE"],
            "Consumer Defensive": ["WMT", "PG", "KO", "PEP", "COST"],
            "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC"],
            "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK"],
            "Energy": ["XOM", "CVX", "COP", "SLB", "EOG"],
            "Industrials": ["CAT", "BA", "GE", "HON", "UPS"],
            "Real Estate": ["AMT", "PLD", "CCI", "EQIX", "PSA"],
            "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "T"],
            "Utilities": ["NEE", "DUK", "SO", "D", "AEP"],
            "Basic Materials": ["LIN", "APD", "SHW", "FCX", "NEM"],
        }
        peers = [p for p in sector_benchmarks.get(sector, ["SPY"]) if p != ticker][:5]

        # Fetch metrics for each peer
        results = []
        for peer_ticker in peers:
            try:
                p_info = await asyncio.to_thread(lambda t=peer_ticker: yf.Ticker(t).info)
                results.append({
                    "symbol": peer_ticker,
                    "market_cap": p_info.get("marketCap", "N/A"),
                    "pe_ratio": p_info.get("trailingPE", "N/A"),
                    "forward_pe": p_info.get("forwardPE", "N/A"),
                    "div_yield": p_info.get("dividendYield", "N/A"),
                    "revenue_growth": p_info.get("revenueGrowth", "N/A"),
                })
            except Exception:
                continue


        return {
            "target": ticker,
            "sector": sector,
            "industry": industry,
            "peer_source": peer_source,
            "peers": results,
        }
    except Exception as e:
        return {"error": f"Failed to fetch peer group for {ticker}: {str(e)}"}


# JSON Schema
GET_PEER_GROUP_SCHEMA = {
    "name": "get_peer_group",
    "description": "Get a list of industry peers and their valuation metrics for a given stock.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"],
    },
}
