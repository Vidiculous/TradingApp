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
from agents.base import BaseAgent  # noqa: E402
from services.news import get_general_news_rss, get_ticker_news  # noqa: E402
from services.paper_trading import get_portfolio  # noqa: E402

# Import Utilities
from ai_engine.utils.plotting import generate_candlestick_chart
from ai_engine.utils.web_search import (
    format_news_for_context,
    get_current_datetime_context,
    search_stock_news,
)

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
        self.demo_mode = False

    async def analyze_ticker(self, ticker: str, horizon: str = "Swing") -> Dict[str, Any]:
        """
        Orchestrate the analysis for a single ticker.
        """
        print(f"Orchestrating analysis for {ticker} with horizon {horizon}...")

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
                return await asyncio.to_thread(get_ticker_news, ticker)

            async def fetch_market_news():
                return await asyncio.to_thread(get_ticker_news, "SPY")

            async def fetch_general_news():
                return await asyncio.to_thread(get_general_news_rss)

            async def fetch_fundamentals():
                stock = yf.Ticker(ticker)
                info = await asyncio.to_thread(lambda: stock.info)
                fund_data = {
                    "market_cap": sf(info.get("marketCap"), 0),
                    "pe_ratio": sf(info.get("trailingPE"), None),
                    "sector": info.get("sector", "N/A"),
                    "summary": info.get("longBusinessSummary", "No summary available"),
                    "roe": sf(info.get("returnOnEquity"), None),
                    "debt_to_equity": sf(info.get("debtToEquity"), None),
                    "target_price": sf(info.get("targetMeanPrice"), None),
                    "analyst_rating": info.get("recommendationKey", "N/A")
                    .replace("_", " ")
                    .title(),
                }
                return fund_data, info

            # Run data gathering in parallel (including web search)
            history_task = fetch_history()
            news_task = fetch_news()
            m_news_task = fetch_market_news()
            g_news_task = fetch_general_news()
            fund_task = fetch_fundamentals()
            web_search_task = search_stock_news(ticker)  # New web search

            history, ticker_news, market_news, world_news, fund_results, web_news = (
                await asyncio.gather(
                    history_task, news_task, m_news_task, g_news_task, fund_task, web_search_task
                )
            )
            fundamentals, info = fund_results

            if history.empty:
                return {"error": f"No data found for {ticker}"}

            current_price = sf(history["Close"].iloc[-1])

            # Calculate Volatility (ATR) for Quant
            high_low = history["High"] - history["Low"]
            high_close = (history["High"] - history["Close"].shift()).abs()
            low_close = (history["Low"] - history["Close"].shift()).abs()
            ranges = pd.concat([high_low, high_close, low_close], axis=1)
            true_range = ranges.max(axis=1)
            history["ATR"] = true_range.rolling(14).mean()

            # Combine news
            general_news = market_news + world_news
            news_package = {"ticker_news": ticker_news, "general_news": general_news}

            # Generate Chart Image in thread
            print("  - Generating chart...")
            chart_bytes = await asyncio.to_thread(
                generate_candlestick_chart, history, title=f"{ticker} - {horizon}"
            )

            # Format web search results for context
            web_news_context = format_news_for_context(web_news)
            datetime_context = get_current_datetime_context()

            data_package = {
                "ticker": ticker,
                "current_price": current_price,
                "history": history,
                "news": news_package,
                "fundamentals": fundamentals,
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
                "horizon_context": {
                    "Scalp": "Target duration: 15 minutes to 4 hours.",
                    "Swing": "Target duration: 2 to 5 days.",
                    "Invest": "Target duration: 3 to 12 months.",
                }.get(horizon, ""),
            }

            print(
                f"Data gathered. Price: {current_price:.2f}. Ticker News: {len(ticker_news)}. Web News: {len(web_news)}. General News: {len(general_news)}"
            )

            # 1.5 Fetch Portfolio Data
            portfolio = await asyncio.to_thread(get_portfolio)
            position = portfolio.get("holdings", {}).get(ticker)
            cash = portfolio.get("cash", 0.0)
            
            portfolio_context = {
                "position": position,
                "cash": cash
            }

            # 2. Resilient Sequential Analysis
            analysis_results = {}

            # 2. Resilient Parallel Analysis
            print("  - Deploying agents in parallel...")

            # Helper to run agent with resilience
            async def run_resilient(agent, name):
                try:
                    res = await agent.analyze(ticker, horizon, data_package)
                    return res
                except Exception as e:
                    print(f"    [!] {name} failed: {e}")
                    return {"error": "Quota limit or service error", "signal": "NEUTRAL"}

            # Run all primary agents in parallel
            agent_tasks = [
                run_resilient(self.chartist, "Chartist"),
                run_resilient(self.quant, "Quant"),
                run_resilient(self.scout, "Scout"),
                run_resilient(self.fundamentalist, "Fundamentalist"),
            ]

            try:
                raw_results = await asyncio.gather(*agent_tasks, return_exceptions=True)
                results = []
                for i, res in enumerate(raw_results):
                    if isinstance(res, Exception):
                        print(f"    [!] Agent {i} crashed: {res}")
                        results.append({"error": str(res), "signal": "NEUTRAL"})
                    else:
                        results.append(res)
            except Exception as e:
                print(f"    [!] Parallel execution failed: {e}")
                results = [{"error": "Parallel execution failed", "signal": "NEUTRAL"}] * 4

            # Map results back
            analysis_results["chartist"] = results[0]
            analysis_results["quant"] = results[1]
            analysis_results["scout"] = results[2]
            analysis_results["fundamentalist"] = results[3]

            print("Agents completed analysis. Synthesizing...")

            # 3. Executioner Synthesis
            execution_context = {
                "ticker": ticker,
                "horizon": horizon,
                "current_price": current_price,
                "squad_analysis": analysis_results,
                "portfolio": portfolio_context,
            }

            final_decision = await self.executioner.decide(execution_context)

            # Risk Officer Validation
            print("Validating with Risk Officer...")
            risk_context = {"trade_plan": final_decision, "portfolio": portfolio}  # Real portfolio
            risk_validation = await self.risk_officer.validate(risk_context)

            # The Executioner now provides the timeframe based on synthesis.
            # No more hardcoded overrides here.

            final_output = {
                "ticker": ticker,
                "timestamp": datetime.now().isoformat(),
                "horizon": horizon,
                "action": final_decision.get("action", "HOLD"),
                "decision": final_decision,
                "risk_validation": risk_validation,
                "squad_details": analysis_results,
            }

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
