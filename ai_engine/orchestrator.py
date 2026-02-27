import asyncio
import json
import logging
import os
import sys
import traceback
import warnings
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import pytz
import yfinance as yf
from dotenv import load_dotenv

# Ensure project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, "backend")

if project_root not in sys.path:
    sys.path.append(project_root)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

warnings.filterwarnings("ignore", category=ResourceWarning)
os.environ["PYTHONWARNINGS"] = "ignore::ResourceWarning"

# Load env
load_dotenv(os.path.join(backend_dir, ".env"))

# Import Agents
import agents.chartist  # noqa: E402
import agents.executioner  # noqa: E402
import agents.fundamentalist  # noqa: E402
import agents.quant  # noqa: E402
import agents.risk_officer  # noqa: E402
import agents.scout  # noqa: E402
import agents.analyst  # noqa: E402
from agents.base import BaseAgent  # noqa: E402
from services.analysis_history import (  # noqa: E402
    format_history_for_prompt,
    get_history,
    save_analysis,
)
from services.document_service import get_content_hash, get_document_text  # noqa: E402
from services.news import get_general_news_rss, get_multi_source_ticker_news, get_ticker_news  # noqa: E402
from services.paper_trading import execute_order, get_portfolio  # noqa: E402

# Import Utilities
from ai_engine.utils.plotting import generate_candlestick_chart
from ai_engine.utils.web_search import (
    format_news_for_context,
    get_current_datetime_context,
    search_general,
    search_stock_news,
)

# Tool Imports
from ai_engine.tool_manager import ToolManager
from ai_engine.tools.technical_tools import get_indicators, GET_INDICATORS_SCHEMA
from ai_engine.tools.market_tools import fetch_ticker_stats, FETCH_TICKER_STATS_SCHEMA
from ai_engine.tools.document_tools import fetch_financial_docs, FETCH_FINANCIAL_DOCS_SCHEMA
from ai_engine.tools.peer_tools import get_peer_group, GET_PEER_GROUP_SCHEMA
from ai_engine.tools.insider_tools import fetch_insider_activity, FETCH_INSIDER_ACTIVITY_SCHEMA
from ai_engine.tools.earnings_tools import get_earnings_forecast, GET_EARNINGS_FORECAST_SCHEMA
from ai_engine.tools.macro_tools import get_macro_events, GET_MACRO_EVENTS_SCHEMA
from ai_engine.tools.social_tools import get_social_sentiment, GET_SOCIAL_SENTIMENT_SCHEMA
from ai_engine.tools.ml_tools import predict_price_direction, PREDICT_PRICE_DIRECTION_SCHEMA

# Configure logging
logger = logging.getLogger(__name__)


def sf(val: Any, default: float = 0.0) -> float:
    """Sanitize float values, converting NaN/None to default."""
    if pd.isna(val):
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


class Orchestrator:
    def __init__(self):
        self.chartist = agents.chartist.Chartist()
        self.quant = agents.quant.Quant()
        self.scout = agents.scout.Scout()
        self.fundamentalist = agents.fundamentalist.Fundamentalist()
        self.risk_officer = agents.risk_officer.RiskOfficer()
        self.executioner = agents.executioner.Executioner()
        self.analyst = agents.analyst.Analyst()
        self.demo_mode = False
        
        # Concurrency control for LLM calls (increased to 5 for full squad parallelization)
        self.semaphore = asyncio.Semaphore(5) 

        # Link agents for inter-agent communication
        all_agents = {
            "chartist": self.chartist,
            "quant": self.quant,
            "scout": self.scout,
            "fundamentalist": self.fundamentalist,
            "risk_officer": self.risk_officer,
            "executioner": self.executioner,
            "analyst": self.analyst
        }
        
        # One shared ToolManager — all tools registered, shared cache.
        # Each agent gets an AgentToolView that limits which tools it can see,
        # but all tool calls share the same cache so yfinance isn't hit twice for
        # the same ticker across different agents within one analysis run.
        self.tool_manager = ToolManager()
        self.tool_manager.register_tool("get_indicators",        get_indicators,        GET_INDICATORS_SCHEMA,        ttl=60)
        self.tool_manager.register_tool("fetch_ticker_stats",    fetch_ticker_stats,    FETCH_TICKER_STATS_SCHEMA,    ttl=3600)
        self.tool_manager.register_tool("fetch_financial_docs",  fetch_financial_docs,  FETCH_FINANCIAL_DOCS_SCHEMA,  ttl=86400)
        self.tool_manager.register_tool("get_peer_group",        get_peer_group,        GET_PEER_GROUP_SCHEMA,        ttl=86400)
        self.tool_manager.register_tool("fetch_insider_activity",fetch_insider_activity,FETCH_INSIDER_ACTIVITY_SCHEMA,ttl=43200)
        self.tool_manager.register_tool("get_earnings_forecast", get_earnings_forecast, GET_EARNINGS_FORECAST_SCHEMA, ttl=86400)
        self.tool_manager.register_tool("get_macro_events",      get_macro_events,      GET_MACRO_EVENTS_SCHEMA,      ttl=43200)
        self.tool_manager.register_tool("get_social_sentiment",  get_social_sentiment,  GET_SOCIAL_SENTIMENT_SCHEMA,  ttl=1800)
        self.tool_manager.register_tool(
            "predict_price_direction", predict_price_direction, PREDICT_PRICE_DIRECTION_SCHEMA, ttl=3600
        )

        # Give each agent a view of only its relevant tools
        # Chartist, Executioner, and Risk Officer do pure reasoning — no tools
        self.quant.tool_manager          = self.tool_manager.view("get_indicators", "predict_price_direction")
        self.scout.tool_manager          = self.tool_manager.view("get_social_sentiment", "get_macro_events")
        self.fundamentalist.tool_manager = self.tool_manager.view("fetch_ticker_stats", "get_earnings_forecast", "get_peer_group")
        self.analyst.tool_manager        = self.tool_manager.view("fetch_financial_docs", "fetch_insider_activity")

        for agent in all_agents.values():
            agent.registry = all_agents  # Wire inter-agent comms for all

    def calculate_position_size(self, current_price: float, cash: float) -> int:
        """
        Simple position sizing: Use 5% of available cash or $5000 max, whichever is lower.
        Ensures we don't blow the account on one trade.
        """
        if cash <= 0 or current_price <= 0:
            return 0

        # Risk 5% of cash
        cash_to_risk = min(cash * 0.05, 5000)
        qty = int(cash_to_risk / current_price)
        return max(qty, 1) if qty > 0 else 0

    async def analyze_ticker(
        self,
        ticker: str,
        horizon: str = "Swing",
        autonomous: bool = False,
        use_portfolio: bool = True,
        api_config: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Orchestrate the analysis for a single ticker.
        """
        print(f"Orchestrating analysis for {ticker} (Provider: {api_config.get('provider') if api_config else 'Default'})...")

        # Initialize default info to prevent scoping issues
        info = {}

        # 1. Gather Data (Market, News, Fundamentals)
        try:
            print(f"  - Gathering data for {ticker}...")

            # Helper for thread-safe blocking calls
            async def fetch_history():
                stock = yf.Ticker(ticker)
                p = "1mo" if horizon == "Swing" else "6mo" if horizon == "Invest" else "5d"
                i = "1d" if horizon != "Scalp" else "5m"
                return await asyncio.to_thread(stock.history, period=p, interval=i)

            async def fetch_news():
                return await get_multi_source_ticker_news(ticker)

            async def fetch_market_news():
                return await asyncio.to_thread(get_ticker_news, "SPY")

            async def fetch_general_news():
                return await asyncio.to_thread(get_general_news_rss)

            async def fetch_fundamentals():
                # We still fetch basic info for Orchestrator logic, 
                # but Fundamentalist will pull deeper stats via tool
                stock = yf.Ticker(ticker)
                info = await asyncio.to_thread(lambda: stock.info)
                return info

            async def fetch_portfolio():
                return await asyncio.to_thread(get_portfolio)
                
            async def fetch_past_analyses():
                return await asyncio.to_thread(get_history, ticker, 5)

            # Run data gathering in parallel.
            # Note: get_multi_source_ticker_news already calls search_stock_news internally,
            # so we do NOT call it again here — that would duplicate the DuckDuckGo request.
            history_task = fetch_history()
            news_task = fetch_news()
            m_news_task = fetch_market_news()
            g_news_task = fetch_general_news()
            fund_task = fetch_fundamentals()
            port_task = fetch_portfolio()
            hist_task = fetch_past_analyses()

            history, ticker_news, market_news, world_news, info, portfolio, past_analyses = (
                await asyncio.gather(
                    history_task, news_task, m_news_task, g_news_task, fund_task, port_task, hist_task
                )
            )

            # Extract the web search results that news.py already fetched (source == "Web Search")
            web_news = [
                n for n in ticker_news
                if n.get("source") == "Web Search"
            ]

            if history.empty:
                return {"error": f"No data found for {ticker}"}

            current_price = sf(history["Close"].iloc[-1])

            # Technical indicators (ATR/RSI) are now handled by Quant via tools
            # We skip calculating them here to reduce payload

            # Combine news
            general_news = market_news + world_news
            news_package = {"ticker_news": ticker_news, "general_news": general_news}

            # Generate Chart Image in thread
            print("  - Generating chart...")
            chart_bytes = await asyncio.to_thread(
                generate_candlestick_chart, history, title=f"{ticker} - {horizon}"
            )

            # Format web search results for context.
            # news.py uses "headline" key; format_news_for_context expects "title" — normalise.
            web_news_normalised = [
                {**n, "title": n.get("title") or n.get("headline", ""), "body": n.get("body") or n.get("summary", "")}
                for n in web_news
            ]
            web_news_context = format_news_for_context(web_news_normalised)
            datetime_context = get_current_datetime_context()

            data_package = {
                "ticker": ticker,
                "current_price": current_price,
                "history": history,
                "chart_image": chart_bytes,
                "web_news": web_news_context,  # Fresh news from web search
                "datetime_context": datetime_context,  # Current date/time for grounding
                "market_context": {
                    "exchange": info.get("exchange", "Unknown"),
                    "timezone": info.get("exchangeTimezoneName", "UTC"),
                    "market_state": info.get("marketState", "Unknown"),
                    "local_market_time": datetime.now(pytz.utc)
                    .astimezone(pytz.timezone(info.get("exchangeTimezoneName", "UTC")))
                    .strftime("%Y-%m-%d %H:%M:%S"),
                },
                "api_config": api_config,  # Dynamic credentials
                "horizon_context": {
                    "Scalp": "Target duration: 15 minutes to 4 hours.",
                    "Swing": "Target duration: 4 hours to 5 days.",
                    "Invest": "Target duration: 3 to 12 months.",
                }.get(horizon, ""),
            }

            print(
                f"Data gathered. Price: {current_price:.2f}. Ticker News: {len(ticker_news)}. Web News: {len(web_news)}. General News: {len(general_news)}"
            )
            
            # Note: Quantitative and Fundamental data will be pulled by agents via tools.

            # 1.5 Fetch Portfolio Data (already fetched in gather)
            position = portfolio.get("holdings", {}).get(ticker) if use_portfolio else None
            cash = portfolio.get("cash", 0.0)
            
            portfolio_context = {
                "position": position,
                "cash": cash,
                "use_portfolio": use_portfolio
            }

            if not use_portfolio:
                print(f"  - Portfolio Awareness DISABLED. Analyzing {ticker} in isolation.")

            # 1.6 Fetch Analysis History (already fetched in gather)
            history_context = format_history_for_prompt(past_analyses)
            data_package["analysis_history"] = history_context

            # Document retrieval is now handled by Analyst via tools
            data_package["document_text"] = "" 
            data_package["document_hash"] = ""

            # 2. Resilient Sequential Analysis
            analysis_results = {}

            # 2. Resilient Parallel Analysis
            print("  - Deploying agents in parallel...")

            # Helper to run agent with resilience
            async def run_resilient(agent, name):
                async with self.semaphore:
                    try:
                        res = await agent.analyze(ticker, horizon, data_package)
                        return res
                    except Exception as e:
                        print(f"    [!] {name} failed: {e}")
                        return {"error": str(e), "signal": "NEUTRAL"}

            # Run all primary agents in parallel
            agent_tasks = [
                run_resilient(self.chartist, "Chartist"),
                run_resilient(self.quant, "Quant"),
                run_resilient(self.scout, "Scout"),
                run_resilient(self.fundamentalist, "Fundamentalist"),
                run_resilient(self.analyst, "Analyst"),
            ]

            try:
                raw_results = await asyncio.gather(*agent_tasks, return_exceptions=True)
                results = []
                # Expecting 5 results now
                expected_results = 5
                
                for i, res in enumerate(raw_results):
                    if isinstance(res, Exception):
                        print(f"    [!] Agent {i} crashed: {res}")
                        results.append({"error": str(res), "signal": "NEUTRAL"})
                    else:
                        results.append(res)
            except Exception as e:
                print(f"    [!] Parallel execution failed: {e}")
                results = [{"error": "Parallel execution failed", "signal": "NEUTRAL"}] * 5

            # Map results back
            # Map results back and Normalize
            def normalize(res):
                if res is None: return {"summary": "None", "signal": "NEUTRAL", "confidence": 0.0}
                if not isinstance(res, dict): return {"summary": str(res)}
                
                # Signal logic
                # Use 'approved' for Risk Officer mapping if present
                approved = res.get("approved")
                if approved is True:
                    res["signal"] = "BULLISH" # Approved
                elif approved is False:
                    res["signal"] = "BEARISH" # Vetoed
                else:
                    # Prefer "signal" key (all agents are prompted to produce it).
                    # Fall back to other common keys only if "signal" is absent.
                    sig = res.get("signal") or res.get("action") or res.get("outlook") or "NEUTRAL"
                    if isinstance(sig, dict):
                        sig = sig.get("status") or sig.get("action") or str(sig)
                    raw_signal = str(sig).upper()
                    if any(kw in raw_signal for kw in ("BULLISH", "BUY", "POSITIVE", "APPROVE")):
                        res["signal"] = "BULLISH"
                    elif any(kw in raw_signal for kw in ("BEARISH", "SELL", "NEGATIVE", "VETO", "REJECT")):
                        res["signal"] = "BEARISH"
                    else:
                        res["signal"] = "NEUTRAL"

                # Clamp numeric fields
                if "confidence" in res and res["confidence"] is not None:
                    try:
                        res["confidence"] = max(0.0, min(1.0, float(res["confidence"])))
                    except (ValueError, TypeError):
                        pass
                if "sentiment_score" in res and res["sentiment_score"] is not None:
                    try:
                        res["sentiment_score"] = max(-1.0, min(1.0, float(res["sentiment_score"])))
                    except (ValueError, TypeError):
                        pass

                # Summary logic
                # Check a wide range of possible "summary-like" keys
                raw_summary = (
                    res.get("summary") or 
                    res.get("analysis_summary") or 
                    res.get("analysis") or 
                    res.get("reasoning") or 
                    res.get("rationale") or 
                    res.get("veto_reason") or
                    res.get("reason") or # Added 'reason'
                    res.get("commentary") or
                    res.get("details")
                )
                
                # If the retrieved summary is a dictionary, try to pick a good text field
                if isinstance(raw_summary, dict):
                    raw_summary = (
                        raw_summary.get("text") or 
                        raw_summary.get("summary") or 
                        raw_summary.get("reasoning") or
                        raw_summary.get("technical_summary") or
                        raw_summary.get("fundamental_outlook") or
                        next(iter(raw_summary.values())) # fallback to first value
                    )

                summary = str(raw_summary or "Analysis complete.")
                
                # Smart enrichment: append findings or red flags if summary is too short (< 50 chars)
                if len(summary) < 50:
                    findings = res.get("key_findings") or res.get("red_flags") or res.get("key_points")
                    if isinstance(findings, list) and findings:
                        summary = f"{summary} Key points: {'; '.join(findings[:2])}"
                    elif isinstance(findings, str) and findings:
                        summary = f"{summary} {findings}"
                
                res["summary"] = summary
                return res

            analysis_results["chartist"] = normalize(results[0])
            analysis_results["quant"] = normalize(results[1])
            analysis_results["scout"] = normalize(results[2])
            analysis_results["fundamentalist"] = normalize(results[3])
            analysis_results["analyst"] = normalize(results[4])

            # Directly attach full Chronos result to quant ml_signal.
            # LLMs truncate large arrays (forecast_steps_data, history_snapshot) when
            # copying tool results — bypassing that by re-fetching from cache (instant).
            try:
                chronos_result = await self.tool_manager.execute_tool(
                    "predict_price_direction",
                    {"ticker": ticker, "horizon": horizon},
                    context=data_package,
                )
                if chronos_result and not chronos_result.get("skipped"):
                    analysis_results["quant"]["ml_signal"] = chronos_result
            except Exception as _ce:
                print(f"  [!] Chronos direct attach failed: {_ce}")

            print("Agents completed analysis. Synthesizing...")

            # 3. Executioner Synthesis
            raw_agent_map = {
                "chartist": results[0],
                "quant": results[1],
                "scout": results[2],
                "fundamentalist": results[3],
                "analyst": results[4],
            }
            execution_context = {
                "ticker": ticker,
                "horizon": horizon,
                "current_price": current_price,
                "squad_analysis": analysis_results,
                "raw_squad_analysis": raw_agent_map,
                "portfolio": portfolio_context,
                "analysis_history": data_package.get("analysis_history", ""),
                "api_config": api_config,
            }

            final_decision = await self.executioner.decide(execution_context)

            # Risk Officer Validation
            print("Validating with Risk Officer...")
            # If use_portfolio is False, we tell the Risk Officer to ignore concentration
            risk_context = {
                "trade_plan": final_decision,
                "portfolio": portfolio if use_portfolio else {"cash": 1000000.0, "holdings": {}},
                "use_portfolio": use_portfolio,
                "api_config": api_config,
            }
            risk_validation = await self.risk_officer.validate(risk_context)
            
            # CRITICAL: Map Risk Officer back to analysis_results so it shows on UI
            # Ensure key is 'risk_officer' to match frontend AgentAnalysisView.tsx ID
            analysis_results["risk_officer"] = normalize(risk_validation)

            # The Executioner now provides the timeframe based on synthesis.
            # No more hardcoded overrides here.

            # 4. Autonomous Trading Logic
            execution_status = None
            if autonomous and final_decision.get("action") in ["BUY", "SELL"]:
                if risk_validation.get("approved"):
                    try:
                        print(f"  [AUTONOMOUS] Risk Officer approved. Executing {final_decision['action']} for {ticker}...")
                        
                        # Get current cash for sizing
                        qty = self.calculate_position_size(current_price, portfolio.get("cash", 0))
                        
                        if qty > 0:
                            trade_result = await asyncio.to_thread(
                                execute_order,
                                symbol=ticker,
                                side=final_decision["action"],
                                qty=qty,
                                price=current_price,
                                stop_loss=final_decision.get("stop_loss"),
                                sl_type=final_decision.get("sl_type", "fixed"),
                                take_profit=final_decision.get("target"),
                                tp_config=final_decision.get("tp_config")
                            )
                            execution_status = f"Successfully executed autonomous {final_decision['action']} order for {qty} shares."
                            print(f"  - {execution_status}")
                        else:
                            execution_status = "Skipped autonomous trade: Insufficient cash for position sizing."
                            print(f"  - {execution_status}")
                            
                    except Exception as e:
                        execution_status = f"Autonomous execution failed: {str(e)}"
                        print(f"  [!] {execution_status}")
                else:
                    execution_status = f"Autonomous trade VETOED by Risk Officer: {risk_validation.get('veto_reason', 'No reason given')}"
                    print(f"  - {execution_status}")

            final_output = {
                "ticker": ticker,
                "timestamp": datetime.now().isoformat(),
                "horizon": horizon,
                "action": final_decision.get("action", "HOLD"),
                "decision": final_decision,
                "risk_validation": risk_validation,
                "squad_details": analysis_results,
                "execution_status": execution_status,
            }

            # Persist analysis for future memory
            try:
                await asyncio.to_thread(save_analysis, ticker, horizon, final_output)
                print(f"  - Analysis saved to history for {ticker}")
            except Exception as e:
                print(f"  - Warning: Failed to save analysis history: {e}")

            # Final top-level sanitization to be absolutely sure
            return BaseAgent.sanitize_data(final_output)

        except Exception as e:
            print(f"Orchestration Error: {e}")
            traceback.print_exc()
            return {"error": str(e)}


if __name__ == "__main__":
    orch = Orchestrator()
    # Test run
    result = asyncio.run(orch.analyze_ticker("AAPL", "Swing"))
    print(json.dumps(result, indent=2, default=str))
