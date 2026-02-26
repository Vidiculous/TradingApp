
from .base import BaseAgent


class Quant(BaseAgent):
    def __init__(self):
        super().__init__("Quant", "quant.md")

    async def analyze(self, ticker, horizon, data):
        print(f"  [Quant] Analyzing {ticker} ({horizon})...")
        self._tool_context = data
        try:
            history = data.get("history")
            if history is None or history.empty:
                return {"signal": "NEUTRAL", "reason": "No data"}

            # 1. Calculate Technicals (Simple for V1)
            # RSI
            delta = history["Close"].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss.replace(0, float("inf"))
            history["RSI"] = 100 - (100 / (1 + rs))

            # MACD
            exp1 = history["Close"].ewm(span=12, adjust=False).mean()
            exp2 = history["Close"].ewm(span=26, adjust=False).mean()
            history["MACD"] = exp1 - exp2
            history["Signal"] = history["MACD"].ewm(span=9, adjust=False).mean()

            # Prepare data summary for LLM
            last_10 = history.tail(10).copy()
            # Format datetime index to string
            last_10.index = last_10.index.strftime("%Y-%m-%d")

            data_str = last_10[["Close", "Volume", "RSI", "MACD", "Signal"]].to_string()

            current_rsi = history["RSI"].iloc[-1]

            # Get ATR
            current_atr = history["ATR"].iloc[-1] if "ATR" in history else 0.0

            # Get datetime context
            datetime_context = data.get("datetime_context", "")

            prompt_content = f"""
            {datetime_context}
            
            Ticker: {ticker}
            Horizon: {horizon} ({data.get("horizon_context", "")})
            
            MARKET CONTEXT:
            Exchange: {data.get("market_context", {}).get("exchange")}
            Session Status: {data.get("market_context", {}).get("market_state")}
            Local Market Time: {data.get("market_context", {}).get("local_market_time")}
            
            Recent Data (Last 10 intervals):
            {data_str}
            
            Current RSI: {current_rsi:.2f}
            Current ATR (Volatility): {current_atr:.2f}
            
            TIMEFRAME SPECIFICITY: Based on the technical indicators, volatility, and current session status, estimate a SPECIFIC expected duration for this signal within the {horizon} bounds.
            
            SESSION AWARENESS: If the Market State is NOT 'REGULAR', explicitly mention this and how it impacts the technical validity (e.g. "Indicators are stagnant due to CLOSED market").
            
            IMPORTANT: Focus on the provided data table for price analysis. 
            Use the CURRENT DATE and LOCAL MARKET TIME above as the truth.
            """

            response = await self.call_model(prompt_content, api_config=data.get("api_config"))
            return response

        except Exception as e:
            print(f"  [Quant] Error: {e}")
            return {"signal": "NEUTRAL", "error": str(e)}
