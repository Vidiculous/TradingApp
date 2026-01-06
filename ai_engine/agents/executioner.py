import json

from .base import BaseAgent


class Executioner(BaseAgent):
    def __init__(self):
        super().__init__("Executioner", "executioner.md")

    async def decide(self, context):
        print("  [Executioner] Synthesizing decision...")
        try:
            ticker = context.get("ticker")
            horizon = context.get("horizon")
            current_price = context.get("current_price")
            squad_analysis = context.get("squad_analysis", {})

            # Format squad analysis for LLM
            squad_text = json.dumps(squad_analysis, indent=2)

            portfolio_context = context.get("portfolio", {})
            position = portfolio_context.get("position")
            cash = portfolio_context.get("cash", 0.0)

            position_text = "No current position."
            if position:
                qty = position.get("quantity", 0)
                avg = position.get("average_cost", 0.0)
                pnl = (current_price - avg) * qty if current_price else 0
                position_text = f"Current Holding: {qty} shares @ ${avg:.2f} (Unrealized PnL: ${pnl:.2f})"

            prompt_content = f"""
            Ticker: {ticker}
            Horizon: {horizon}
            Current Price: {current_price}
            
            PORTFOLIO CONTEXT:
            Cash Available: ${cash:.2f}
            {position_text}
            
            MARKET CONTEXT:
            Exchange: {context.get("market_context", {}).get("exchange")}
            Session Status: {context.get("market_context", {}).get("market_state")}
            Local Market Time: {context.get("market_context", {}).get("local_market_time")}
            
            Squad Analysis Reports:
            {squad_text}
            
            Based on the Council's reports AND our current portfolio status, synthesize a final trading decision.
            If we have a position, consider whether to ADD, REDUCE, or HOLD based on conviction.
            You MUST provide a clear Action (BUY/SELL/HOLD), Trade Type (LONG/SHORT), Target Price, and Stop Loss.
            """

            response = await self.call_gemini(prompt_content)
            return response

        except Exception as e:
            print(f"  [Executioner] Error: {e}")
            return {"action": "HOLD", "error": str(e)}

    async def chat(self, message, context=None):
        """
        Custom chat for Executioner to handle final synthesis questions.
        """
        print("  [Executioner] Thinking about your question...")

        # Get current datetime for grounding
        from datetime import datetime

        now = datetime.now()
        datetime_context = f"""
CURRENT DATE AND TIME: {now.strftime('%Y-%m-%d %H:%M:%S')}
TODAY IS: {now.strftime('%A, %B %d, %Y')}
"""

        # Enrich context if it's the full analysis object
        context_str = ""
        if context:
            # If context is the whole analysis dict, just pass the decision and squad details
            mini_context = {
                "ticker": context.get("ticker"),
                "analysis_time": context.get("timestamp"),
                "decision": context.get("decision"),
                "squad_details": context.get("squad_details"),
            }
            context_str = f"\nYOUR RECENT ANALYSIS (Generated at {mini_context['analysis_time']}):\n{json.dumps(mini_context, indent=2)}\n"

        prompt = f"""
        {datetime_context}
        
        {context_str}
        
        USER QUESTION:
        {message}
        
        INSTRUCTIONS FOR ANSWER:
        1. Role: You are The Executioner, a Professional Senior Trader. 
        2. Format: Use Markdown bullet points (-) for key ideas. Keep paragraphs very short.
        3. Tone: Direct, professional, and decisive.
        4. Content: Focus ONLY on answering the user's question. Use the provided analysis context if available.
        5. CRITICAL: Skip all introductory fluff (e.g., "Hello", "Understood", "As your Senior Trader..."). Start DIRECTLY with the answer or the analysis relevant to the question.
        
        IMPORTANT: Reply in PLAIN TEXT. NO JSON. Use Bullet Points.
        """

        return await self.call_gemini_text(
            prompt,
            system_instruction=f"You are The Executioner, a Senior Trader. Today is {now.strftime('%B %d, %Y')}. You provide direct, concise, and professional trading insights. Skip all introductions and standard AI filler. Use bullet points.",
        )
