import yfinance as yf
import asyncio
from typing import Dict, Any

async def fetch_ticker_stats(ticker: str) -> Dict[str, Any]:
    """
    Fetch fundamental statistics for a ticker using yfinance.
    Returns Market Cap, PE Ratio, Dividend Yield, and Sector.
    """
    try:
        stock = yf.Ticker(ticker)
        # Run potentially blocking property access in thread
        info = await asyncio.to_thread(lambda: stock.info)
        
        return {
            "symbol": ticker,
            "market_cap": info.get("marketCap", "N/A"),
            "pe_ratio": info.get("trailingPE", "N/A"),
            "forward_pe": info.get("forwardPE", "N/A"),
            "dividend_yield": info.get("dividendYield", "N/A"),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "summary": info.get("longBusinessSummary", "No summary available.")[:500] + "..."
        }
    except Exception as e:
        return {"error": f"Failed to fetch stats for {ticker}: {str(e)}"}

# JSON Schema for the tool
FETCH_TICKER_STATS_SCHEMA = {
    "name": "fetch_ticker_stats",
    "description": "Retrieve fundamental metrics (PE, Market Cap, Sector) for a stock ticker.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"]
    }
}
