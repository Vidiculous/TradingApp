import json

from .base import BaseAgent


class Fundamentalist(BaseAgent):
    def __init__(self):
        super().__init__("Fundamentalist", "fundamentalist.md")

    async def analyze(self, ticker, horizon, data):
        print(f"  [Fundamentalist] Analyzing {ticker} ({horizon})...")
        try:
            fundamentals = data.get("fundamentals", {})

            # Format fundamentals for LLM
            fund_summary = json.dumps(fundamentals, indent=2)

            # Get price from data
            current_price = data.get("current_price", "Unknown")

            # Get context
            datetime_context = data.get("datetime_context", "")
            web_news = data.get("web_news", "No recent news available.")

            prompt_content = f"""
            {datetime_context}
            
            Ticker: {ticker}
            Horizon: {horizon} ({data.get("horizon_context", "")})
            Current Price: {current_price}
            
            MARKET CONTEXT:
            Exchange: {data.get("market_context", {}).get("exchange")}
            Session Status: {data.get("market_context", {}).get("market_state")}
            Local Market Time: {data.get("market_context", {}).get("local_market_time")}
            
            TIMEFRAME SPECIFICITY: Based on the valuation gap, growth factors, and current session timing, estimate a SPECIFIC expected duration for this valuation thesis to materialize within the {horizon} bounds.
            
            SESSION AWARENESS: Mention the current local market time/status if it impacts the immediate execution of this long-term thesis (e.g. "Thesis is long-term, but market is currently CLOSED").
            
            Core Fundamental Data:
            {fund_summary}
            
            Recent News Context:
            {web_news}
            
            Determine the fair value and moat strength. Use ROE and Debt/Equity to assess financial health.
            Consider the Analyst Rating ({fundamentals.get('analyst_rating', 'N/A')}) and Target Price ({fundamentals.get('target_price', 'N/A')}).
            IMPORTANT: Use the provided Current Price and CURRENT DATE as the absolute truth for valuation ratios.
            Ignore any outdated information from your training data.
            """

            response = await self.call_model(prompt_content, api_config=data.get("api_config"))
            return response

        except Exception as e:
            print(f"  [Fundamentalist] Error: {e}")
            return {"signal": "NEUTRAL", "error": str(e)}
