import yfinance as yf
import asyncio
from typing import Dict, Any, List

async def fetch_insider_activity(ticker: str) -> Dict[str, Any]:
    """
    Fetch recent insider transactions and institutional holdings for a ticker.
    Provides signals on management conviction and institutional 'whale' positions.
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Insider Transactions
        insider = await asyncio.to_thread(lambda: stock.insider_transactions)
        
        # Institutional Holders
        inst_holders = await asyncio.to_thread(lambda: stock.institutional_holders)
        
        insider_data = []
        if insider is not None and not insider.empty:
            # Get latest 10 transactions
            latest = insider.head(10)
            for _, row in latest.iterrows():
                insider_data.append({
                    "date": str(row.get("Start Date", row.get("Date", "N/A"))),
                    "insider": row.get("Insider", "N/A"),
                    "position": row.get("Position", "N/A"),
                    "transaction": row.get("Transaction", "N/A"),
                    "shares": row.get("Shares", "N/A"),
                    "value": row.get("Value", "N/A")
                })
        
        holder_data = []
        if inst_holders is not None and not inst_holders.empty:
            for _, row in inst_holders.head(5).iterrows():
                holder_data.append({
                    "holder": row.get("Holder", "N/A"),
                    "shares": row.get("Shares", "N/A"),
                    "date_reported": str(row.get("Date Reported", "N/A")),
                    "percent_out": row.get("% Out", row.get("Value", "N/A"))
                })
                
        return {
            "ticker": ticker,
            "recent_insider_activity": insider_data,
            "top_institutional_holders": holder_data
        }
    except Exception as e:
        return {"error": f"Failed to fetch insider activity for {ticker}: {str(e)}"}

# JSON Schema
FETCH_INSIDER_ACTIVITY_SCHEMA = {
    "name": "fetch_insider_activity",
    "description": "Retrieve recent insider buying/selling and top institutional holder data.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"]
    }
}
