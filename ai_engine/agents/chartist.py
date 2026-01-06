from google import genai

from .base import BaseAgent


class Chartist(BaseAgent):
    def __init__(self):
        super().__init__("Chartist", "chartist.md")

    async def analyze(self, ticker, horizon, data):
        print(f"  [Chartist] Analyzing {ticker} ({horizon})...")
        try:
            chart_image = data.get("chart_image")

            # Get context data
            current_price = data.get("current_price", "Unknown")
            datetime_context = data.get("datetime_context", "")
            web_news = data.get("web_news", "No recent news available.")

            # Prepare prompt text with datetime context
            prompt_text = f"""
            {datetime_context}
            
            Ticker: {ticker}
            Horizon: {horizon} ({data.get("horizon_context", "")})
            Current Price: {current_price}
            
            MARKET CONTEXT:
            Exchange: {data.get("market_context", {}).get("exchange")}
            Session Status: {data.get("market_context", {}).get("market_state")}
            Local Market Time: {data.get("market_context", {}).get("local_market_time")}
            
            {web_news}
            
            Analyze the attached chart image.
            Identify any potential patterns, key levels, and candlestick psychology.
            
            TIMEFRAME SPECIFICITY: Based on the price action and current session status, estimate a SPECIFIC expected duration for this setup within the {horizon} bounds. (e.g. "Expected hold: 30-45 minutes" or "Expected duration: 3 days"). 
            Consider if the market is opening soon or closing shortly.
            
            SESSION AWARENESS: If the Market State is NOT 'REGULAR', explicitly mention this in your analysis and explain how it affects the setup (e.g. "Setup valid but market is CLOSED; wait for open volatility").
            
            IMPORTANT: Use the provided Current Price, CURRENT DATE, and LOCAL MARKET TIME as the absolute truth. 
            Ignore any internal training data about this stock's price or historical events.
            """

            if chart_image:
                print("  [Chartist] Vision Mode: Analysing image...")
                # Construct multimodal content
                content = [
                    prompt_text,
                    genai.types.Part.from_bytes(data=chart_image, mime_type="image/png"),
                ]
                response = await self.call_gemini(content)
                return response
            else:
                # Fallback to Blind Mode
                print("  [Chartist] Blind Mode: Analysing text...")
                history = data.get("history")
                if history is None or history.empty:
                    return {"signal": "NEUTRAL", "reason": "No data"}

                last_20 = history.tail(20)
                chart_description = ""
                for date, row in last_20.iterrows():
                    date_str = date.strftime("%Y-%m-%d")
                    candle_type = "Green" if row["Close"] > row["Open"] else "Red"
                    range_pct = (row["High"] - row["Low"]) / row["Low"] * 100
                    chart_description += f"{date_str}: {candle_type} candle. Close: {row['Close']:.2f}. Range: {range_pct:.2f}%. Vol: {row['Volume']}\n"

                text_prompt = f"""
                {datetime_context}
                
                Ticker: {ticker}
                Horizon: {horizon}
                Current Price: {current_price}
                
                {web_news}
                
                Note: You are currently operating in 'Blind Mode' receiving text descriptions of candles instead of images.
                
                Recent Price Action (Last 20 candles):
                {chart_description}
                
                Identify any potential patterns or key levels based on this data.
                IMPORTANT: Use the provided Current Price and CURRENT DATE as the absolute truth.
                Ignore any internal training data about this stock's price or historical events.
                """
                response = await self.call_gemini(text_prompt)
                return response

        except Exception as e:
            print(f"  [Chartist] Error: {e}")
            return {"signal": "NEUTRAL", "error": str(e)}
