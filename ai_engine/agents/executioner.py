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

            # Build a confidence-weighted consensus header before the full squad dump.
            # This gives the LLM a quick signal-strength summary so it doesn't have to
            # weight signals itself from raw JSON.
            signal_weights = {"BULLISH": 0, "BEARISH": 0, "NEUTRAL": 0}
            agent_summary_lines = []
            for agent_name, report in squad_analysis.items():
                if not isinstance(report, dict):
                    continue
                sig = str(report.get("signal", "NEUTRAL")).upper()
                conf = float(report.get("confidence", 0.5) or 0.5)
                conf = max(0.0, min(1.0, conf))
                canonical = "BULLISH" if "BULL" in sig or "BUY" in sig else (
                    "BEARISH" if "BEAR" in sig or "SELL" in sig else "NEUTRAL"
                )
                signal_weights[canonical] += conf
                agent_summary_lines.append(
                    f"  {agent_name:<16} {canonical:<8}  confidence={conf:.0%}"
                )

            total_weight = sum(signal_weights.values()) or 1.0
            consensus_signal = max(signal_weights, key=lambda k: signal_weights[k])
            consensus_strength = signal_weights[consensus_signal] / total_weight

            consensus_header = (
                "SQUAD CONSENSUS SUMMARY\n"
                + "\n".join(agent_summary_lines)
                + f"\n\n  Weighted consensus: {consensus_signal}  "
                + f"(bull={signal_weights['BULLISH']/total_weight:.0%}  "
                + f"bear={signal_weights['BEARISH']/total_weight:.0%}  "
                + f"neutral={signal_weights['NEUTRAL']/total_weight:.0%}  "
                + f"overall_strength={consensus_strength:.0%})\n"
            )

            squad_text = consensus_header + "\nFULL AGENT REPORTS:\n" + json.dumps(squad_analysis, indent=2)

            portfolio_context = context.get("portfolio", {})
            position = portfolio_context.get("position")
            cash = portfolio_context.get("cash", 0.0)

            position_text = "No current position."
            if position:
                qty = position.get("quantity", 0)
                avg = position.get("average_cost", 0.0)
                pnl = (current_price - avg) * qty if current_price else 0
                position_text = f"Current Holding: {qty} shares @ ${avg:.2f} (Unrealized PnL: ${pnl:.2f})"

            # Get analysis history if available
            analysis_history = context.get("analysis_history", "No previous analyses available.")

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
            
            {analysis_history}
            
            Squad Analysis Reports:
            {squad_text}
            
            Based on the Council's reports AND our current portfolio status, synthesize a final trading decision.
            If we have a position, consider whether to ADD, REDUCE, or HOLD based on conviction.
            
            DECISION CONTINUITY: If previous analyses exist above, compare your current assessment with prior decisions.
            - If your signal CHANGED direction (e.g. was BULLISH, now BEARISH), explain WHAT changed.
            - If your signal STAYED the same, note whether conviction strengthened or weakened and why.
            - Reference specific price movements since the last analysis if available.
            
            REQUIRED OUTPUT FIELDS — you MUST include ALL of these in the JSON:
            - action: BUY / SELL / HOLD
            - trade_type: LONG / SHORT / NEUTRAL
            - confidence: 0.0–1.0
            - entry_zone: price range string (e.g. "200.00 - 201.50")
            - target: numeric primary take-profit price
            - target_2: numeric second TP price (or null if single-exit)
            - target_2_pct: fraction of position to close at target_2 (e.g. 0.5 for 50%), or null
            - target_3: numeric third TP price (or null)
            - target_3_pct: fraction of position to close at target_3 (e.g. 0.25), or null
              (For single-exit: set target_2, target_3 and their _pct fields to null)
            - stop_loss: numeric stop-loss price (required even for HOLD — price at which you cut)
            - sl_type: "fixed" | "trailing" | "scaled"
                * fixed    — static stop, never moves. Best for choppy/uncertain setups.
                * trailing — trail price as it advances (locks in profits). Use for strong trends.
                * scaled   — move SL to breakeven once target_2 is hit. Requires target_2.
            - intended_timeframe: how long to hold — plain string calibrated to {horizon}:
                * Scalp  → "15-60 minutes" / "2-4 hours"
                * Swing  → "1-3 days" / "3-5 days" / "1-2 weeks"
                * Invest → "1-3 months" / "3-6 months" / "6-12 months"
                (For HOLD: how long before you re-evaluate the position)
            - reasoning: detailed synthesis explaining how you resolved conflicts between sub-agents
            - conclusion: one-sentence executive summary of the trade decision
            """



            response = await self.call_model(prompt_content, api_config=context.get("api_config"))
            return response

        except Exception as e:
            print(f"  [Executioner] Error: {e}")
            return {"action": "HOLD", "error": str(e)}

    async def chat(self, message, context=None, api_config=None):
        """
        Custom chat for Executioner with Agent-to-Agent communication support.
        Supports a reasoning loop with [QUERY: agent, question] tags.
        """
        print(f"  [Executioner] Reasoning about: {message[:50]}...")

        from datetime import datetime
        now = datetime.now()
        datetime_context = f"CURRENT DATE: {now.strftime('%Y-%m-%d %H:%M:%S')}"

        # Context construction
        context_str = ""
        if context:
            mini_context = {
                "ticker": context.get("ticker"),
                "analysis_time": context.get("timestamp"),
                "decision": context.get("decision"),
                "squad_details": context.get("squad_details"),
            }
            context_str = f"\nYOUR RECENT ANALYSIS:\n{json.dumps(mini_context, indent=2)}\n"

        max_hops = 3
        current_prompt = f"""
{datetime_context}
{context_str}

USER QUESTION:
{message}

INSTRUCTIONS:
1. You are The Executioner, the Lead Trader.
2. You can query your sub-agents if you need more detail to answer the user.
3. AVAILABLE AGENTS: {', '.join(self.registry.keys())}
4. TO QUERY AN AGENT: Use the format [QUERY: agent_id, your question]. 
   Example: [QUERY: chartist, what is the current RSI trend?]
5. If you have enough info, provide your final answer in plain text with bullet points.
6. Skip all introductory fluff. Start directly with the reasoning or the answer.
"""

        for hop in range(max_hops):
            print(f"    [Executioner] Hop {hop+1}/{max_hops}...")
            # Use call_model with is_json=False because we want the raw text/tags
            response = await self.call_model(current_prompt, api_config=api_config, is_json=False)
            
            # Detect [QUERY: agent, question]
            import re
            query_match = re.search(r"\[QUERY:\s*(\w+),\s*(.*?)\]", response)
            
            if query_match:
                agent_id = query_match.group(1).lower()
                question = query_match.group(2)
                
                print(f"    [Executioner] Dispatched query to {agent_id}...")
                answer = await self.ask_agent(agent_id, question, context=context, api_config=api_config)
                
                # Feed back to LLM
                current_prompt += f"\n\nTHOUGHT: {response}\n\nRESPONSE FROM {agent_id}: {answer}\n\nContinue your reasoning or provide final answer."
            else:
                # No more queries, this is the final answer
                return response

        return await self.call_model(current_prompt + "\n\nProvide your best final answer now based on the conversation above.", api_config=api_config, is_json=False)
