
from .base import BaseAgent


class Scout(BaseAgent):
    def __init__(self):
        super().__init__("Scout", "scout.md")

    async def analyze(self, ticker, horizon, data):
        print(f"  [Scout] Analyzing {ticker} ({horizon})...")
        try:
            news_data = data.get("news", {})
            datetime_context = data.get("datetime_context", "")
            web_news = data.get("web_news", "No recent news from web search.")

            # Handle backward compatibility if news is just a list
            if isinstance(news_data, list):
                ticker_news = news_data
                general_news = []
            else:
                ticker_news = news_data.get("ticker_news", [])
                general_news = news_data.get("general_news", [])

            # Format news for LLM
            news_summary = ""

            # Ticker News
            if not ticker_news:
                news_summary += f"--- {ticker} News ---\nNo specific news found.\n"
            else:
                news_summary += f"--- {ticker} News ---\n"
                for item in ticker_news[:5]:
                    headline = item.get("headline", "No Headline")
                    source = item.get("source", "Unknown")
                    news_summary += f"- [{source}] {headline}\n"

            # General News
            if general_news:
                news_summary += "\n--- General Market News (SPY + RSS) ---\n"
                for item in general_news[:3]:  # Limit general news to 3
                    headline = item.get("headline", "No Headline")
                    source = item.get("source", "Unknown")
                    news_summary += f"- [{source}] {headline}\n"

            current_price = data.get("current_price", "Unknown")

            prompt_content = f"""
            {datetime_context}
            
            Ticker: {ticker}
            Horizon: {horizon} ({data.get("horizon_context", "")})
            Current Price: {current_price}
            
            MARKET CONTEXT:
            Exchange: {data.get("market_context", {}).get("exchange")}
            Session Status: {data.get("market_context", {}).get("market_state")}
            Local Market Time: {data.get("market_context", {}).get("local_market_time")}
            
            TIMEFRAME SPECIFICITY: Based on the urgency and impact of the news/catalysts and current session timing, estimate a SPECIFIC expected duration for this sentiment to play out within the {horizon} bounds.
            
            SESSION AWARENESS: If the Market State is NOT 'REGULAR', explicitly mention this and how it impacts news digestion (e.g. "News is fresh but market is CLOSED; expect gap on open").
            
            === FRESH NEWS FROM WEB SEARCH (Most Recent) ===
            {web_news}
            
            === NEWS FROM FEEDS ===
            {news_summary}
            
            Analyze the sentiment and identify any major catalysts based on the CURRENT news above.
            IMPORTANT: Use the provided Current Date and Current Price as the absolute truth. 
            Ignore any internal training data about this stock's price or past events.
            Focus on what is happening NOW based on the news provided.
            """

            response = await self.call_gemini(prompt_content)
            return response

        except Exception as e:
            print(f"  [Scout] Error: {e}")
            return {"signal": "NEUTRAL", "error": str(e)}
