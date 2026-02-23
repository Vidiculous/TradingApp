import yfinance as yf
import asyncio
from typing import Dict, Any, List

async def get_earnings_forecast(ticker: str) -> Dict[str, Any]:
    """
    Retrieve historical earnings performance and future estimates for a ticker.
    Includes EPS Estimate, EPS Actual, Surprise %, and next earnings date.
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Earnings History (Actual vs Estimate)
        earnings_history = await asyncio.to_thread(lambda: stock.earnings_dates)
        
        # Next Earnings Date
        calendar = await asyncio.to_thread(lambda: stock.calendar)
        
        history_data = []
        if earnings_history is not None and not earnings_history.empty:
            # Drop rows with NaN (future dates usually don't have actuals yet)
            past_earnings = earnings_history.dropna(subset=['EPS Actual']).head(5)
            for date, row in past_earnings.iterrows():
                history_data.append({
                    "date": str(date),
                    "eps_estimate": row.get("EPS Estimate", "N/A"),
                    "eps_actual": row.get("EPS Actual", "N/A"),
                    "surprise_pct": row.get("Surprise %", "N/A")
                })
        
        next_date = "N/A"
        if calendar is not None and not calendar.empty:
            next_date = str(calendar.iloc[0, 0]) # Usually first row, first column
                
        return {
            "ticker": ticker,
            "next_earnings_date": next_date,
            "earnings_surprise_history": history_data
        }
    except Exception as e:
        return {"error": f"Failed to fetch earnings for {ticker}: {str(e)}"}

# JSON Schema
GET_EARNINGS_FORECAST_SCHEMA = {
    "name": "get_earnings_forecast",
    "description": "Retrieve earnings history (estimates vs actuals) and the next expected earnings date.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"]
    }
}
