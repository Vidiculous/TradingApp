import pandas as pd
from typing import Dict, Any, List, Optional

def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, float("inf"))
    return 100 - (100 / (1 + rs))

async def get_indicators(ticker: str, indicators: List[str], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Calculate and return specific technical indicators for a ticker.
    Valid indicators: 'rsi', 'atr', 'ema9', 'ema21'.
    """
    results = {}
    
    # Use history from context if available, otherwise return error
    # (In a more advanced version, it could fetch history here)
    history = context.get("history") if context else None
    
    if history is None or history.empty:
        return {"error": "No price history available in context to calculate indicators."}
    
    for ind in indicators:
        ind = ind.lower()
        if ind == "rsi":
            rsi_series = calculate_rsi(history["Close"])
            results["rsi"] = rsi_series.iloc[-1]
        elif ind == "atr":
            high_low = history["High"] - history["Low"]
            high_close = (history["High"] - history["Close"].shift()).abs()
            low_close = (history["Low"] - history["Close"].shift()).abs()
            true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            atr = true_range.rolling(14).mean().iloc[-1]
            results["atr"] = atr
        elif ind == "ema9":
            results["ema9"] = history["Close"].ewm(span=9, adjust=False).mean().iloc[-1]
        elif ind == "ema21":
            results["ema21"] = history["Close"].ewm(span=21, adjust=False).mean().iloc[-1]
        else:
            results[ind] = f"Error: Indicator '{ind}' not supported."
            
    return results

# JSON Schema for the tool
GET_INDICATORS_SCHEMA = {
    "name": "get_indicators",
    "description": "Calculate technical indicators like RSI, ATR, and EMAs for a given stock.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."},
            "indicators": {
                "type": "array", 
                "items": {"type": "string", "enum": ["rsi", "atr", "ema9", "ema21"]},
                "description": "List of indicators to calculate."
            }
        },
        "required": ["ticker", "indicators"]
    }
}
