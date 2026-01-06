import asyncio
import os
import sys
import traceback

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from models import (
    AIAnalysis,
    AlertRequest,
    AlertResponse,
    CashUpdate,
    OrderRequest,
    PortfolioResponse,
    StopLossUpdateRequest,
    TickerResponse,
)
from pydantic import BaseModel
from services.ai_service import generate_analysis
from services.alerts import add_alert, delete_alert, get_alerts
from services.jobs import job_manager
from services.market_data import (
    get_economic_calendar,
    get_global_context,
    get_market_overview,
    get_order_book,
    get_sales_tape,
    get_ticker_data,
    get_top_gainers,
)
from services.news import get_multi_source_ticker_news, get_ticker_news
from services.paper_trading import (
    clear_history,
    execute_order,
    remove_history_item,
    remove_position,
    reset_portfolio,
    set_cash,
    sync_portfolio_stops,
    update_stop_loss,
)
from services.sector_data import get_sector_correlation

# Add parent directory to path to allow importing ai_engine
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(os.path.join(parent_dir, "ai_engine"))

try:
    from orchestrator import Orchestrator

    # Initialize global orchestrator
    orchestrator = Orchestrator()
except Exception as e:
    print(f"Warning: AI Engine not found or failed to load: {e}")
    orchestrator = None

app = FastAPI()

# --- Background Task for Portfolio Monitoring ---


async def monitor_portfolio_stops():
    """
    Background loop that runs every 60s to check for SL/TP triggers.
    Ensures automation works even when the user is offline.
    """
    print("Background Monitor: Started")
    while True:
        try:
            # We use the existing sync function which fetches prices and executes triggers
            await sync_portfolio_stops()
        except Exception as e:
            print(f"Background Monitor Error: {e}")
        
        # Interval: 60 seconds
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event():
    # Start the monitor in the background
    asyncio.create_task(monitor_portfolio_stops())


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Handle HTTP Exceptions specifically to preserve their status code
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # Handle ValueErrors (e.g. invalid tickers) as 404
    if isinstance(exc, ValueError):
        return JSONResponse(
            status_code=404,
            content={"detail": str(exc)},
        )

    error_detail = f"Internal Server Error: {str(exc)}"
    print(f"Global Exception: {error_detail}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": error_detail, "error": str(exc)},
    )


@app.get("/api/config")
def get_config():
    if orchestrator:
        return {"demo_mode": orchestrator.demo_mode}
    return {"demo_mode": os.getenv("DEMO_MODE") == "true"}


@app.post("/api/config/toggle-demo")
def toggle_demo_mode():
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")
    orchestrator.demo_mode = not orchestrator.demo_mode
    return {"demo_mode": orchestrator.demo_mode}


@app.get("/api/debug/crash")
def debug_crash():
    raise ValueError("Intentional Crash for Debugging")


# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ticker/{symbol}", response_model=TickerResponse)
def get_ticker(symbol: str, period: str = "1mo", interval: str = "1d"):
    symbol = symbol.upper()
    try:
        data = get_ticker_data(symbol, period, interval)

        # News is now fetched on-demand via /api/news/{symbol}
        news = []

        # AI Analysis is now on-demand via /analyze endpoint to save tokens
        ai_analysis = None

        return {**data, "news": news, "ai_analysis": ai_analysis}
    except Exception as e:
        error_msg = str(e)
        status_code = 500

        if "Upstream service may be down" in error_msg:
            status_code = 503  # Service Unavailable

        raise HTTPException(
            status_code=status_code,
            detail={"message": "Market data unavailable", "error": error_msg, "symbol": symbol},
        )


@app.post("/api/ticker/{symbol}/analyze", response_model=AIAnalysis)
def analyze_ticker(symbol: str):
    symbol = symbol.upper()
    try:
        # Fetch fresh data for the analysis
        data = get_ticker_data(symbol)
        news = get_ticker_news(symbol)

        return generate_analysis(
            symbol=symbol, price_data=data["price"], fundamentals=data["fundamentals"], news=news
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/news/{symbol}")
async def get_news(symbol: str):
    """
    Fetch news for a ticker on-demand.
    Called when NEWS tab is clicked or by AI agents.
    """
    symbol = symbol.upper()
    try:

        news = await get_multi_source_ticker_news(symbol, max_per_source=3)
        return {"news": news}
    except Exception as e:
        print(f"Error fetching news: {e}")
        return {"news": []}


@app.get("/api/market/active")
def get_active_market_movers(market: str = "US"):
    """
    Returns the top gaining stocks from specified market.
    Markets: US, SE (Sweden), EU (Europe)
    """
    try:
        return get_top_gainers(market=market, limit=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/market/calendar")
def get_market_calendar():
    """
    Returns upcoming economic events.
    """
    try:

        return get_economic_calendar()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/market/overview")
def get_overview():
    """
    Returns indices and sector performance for the heatmap.
    """
    try:

        return get_market_overview()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/market/global")
def get_global_context_endpoint():
    """
    Returns global macro context (Crypto, Bonds, VIX).
    """
    try:

        return get_global_context()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/search")
async def search_tickers(q: str):
    if not q:
        return {"matches": []}

    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {
        "q": q,
        "quotesCount": 10,
        "newsCount": 0,
        "enableFuzzyQuery": "false",
        "quotesQueryId": "tss_match_phrase_query",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()

            quotes = data.get("quotes", [])
            matches = []

            for quote in quotes:
                # Filter for relevant types if needed, but let's be permissive for now
                if "symbol" in quote:
                    matches.append(
                        {
                            "symbol": quote["symbol"],
                            # Prefer longname, fallback to shortname, fallback to symbol
                            "name": quote.get("longname", quote.get("shortname", quote["symbol"])),
                        }
                    )

            return {"matches": matches}

    except Exception as e:
        print(f"Search API Error: {e}")
        return {"matches": []}


# --- Paper Trading Endpoints ---


@app.get("/api/paper/portfolio", response_model=PortfolioResponse)
async def get_paper_portfolio():
    # Lazy sync stops whenever portfolio is requested
    return await sync_portfolio_stops()


@app.post("/api/paper/order", response_model=PortfolioResponse)
def place_order(order: OrderRequest):
    try:
        return execute_order(
            order.symbol,
            order.side,
            order.qty,
            order.price,
            order.stop_loss,
            order.sl_type,
            order.take_profit,
            order.tp_config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.patch("/api/paper/stop-loss", response_model=PortfolioResponse)
def update_paper_stop_loss(req: StopLossUpdateRequest):
    return update_stop_loss(req.symbol, req.stop_loss, req.take_profit, req.tp_config)


@app.delete("/api/paper/position/{symbol}", response_model=PortfolioResponse)
def delete_paper_position(symbol: str):
    """Removes a position without selling (Correction/Edit)."""
    return remove_position(symbol)


@app.post("/api/paper/reset", response_model=PortfolioResponse)
def reset_paper_account():
    return reset_portfolio()


@app.delete("/api/paper/history", response_model=PortfolioResponse)
def clear_paper_history():
    return clear_history()


@app.delete("/api/paper/history/{item_id}", response_model=PortfolioResponse)
def delete_history_item(item_id: str):
    return remove_history_item(item_id)


@app.post("/api/paper/cash", response_model=PortfolioResponse)
def update_cash(update: CashUpdate):
    return set_cash(update.amount)


@app.get("/api/market/orderbook/{symbol}")
def get_orderbook(symbol: str):
    try:

        # We need current price to generate the book
        # Optimized: Just fetch minimal price data or use what we have.
        # For simulation, just calling get_ticker_data is fine as it caches mostly.
        # But to be faster, let's just use yfinance directly or reuse get_ticker_data lightly.

        data = get_ticker_data(symbol, period="1d", interval="1m")
        current_price = data["price"]["current"]

        return get_order_book(symbol, current_price)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/market/tape/{symbol}")
def get_tape(symbol: str):
    try:

        data = get_ticker_data(symbol, period="1d", interval="1m")
        current_price = data["price"]["current"]

        return get_sales_tape(symbol, current_price)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Alert Endpoints ---


@app.get("/api/alerts", response_model=list[AlertResponse])
def get_params_alerts(symbol: str | None = None):
    return get_alerts(symbol)


@app.post("/api/alerts", response_model=AlertResponse)
def create_alert(alert: AlertRequest):
    return add_alert(alert.symbol, alert.target_price, alert.condition)


@app.delete("/api/alerts/{id}")
def remove_alert(id: str):
    return delete_alert(id)


@app.get("/api/analysis/sector/{symbol}")
def get_sector_analysis(symbol: str):

    return get_sector_correlation(symbol)


# --- Agent Endpoints ---


class AgentAnalyzeRequest(BaseModel):
    symbol: str
    horizon: str = "Swing"


class AgentChatRequest(BaseModel):
    agent_name: str
    message: str
    context: dict | None = {}


async def run_analysis_task(job_id: str, symbol: str, horizon: str):
    """Background task wrapper"""
    try:
        if not orchestrator:
            raise ValueError("Orchestrator not initialized")

        result = await orchestrator.analyze_ticker(symbol, horizon)

        # Check if result has error key
        if isinstance(result, dict) and "error" in result:
            job_manager.update_job(job_id, "failed", error=result["error"])
        else:
            job_manager.update_job(job_id, "completed", result=result)

    except Exception as e:
        print(f"Job {job_id} Failed: {e}")
        job_manager.update_job(job_id, "failed", error=str(e))


@app.post("/api/agent/analyze")
async def run_agent_analysis(req: AgentAnalyzeRequest, background_tasks: BackgroundTasks):
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI Engine not available")

    # Create Job
    job_id = job_manager.create_job()

    # Start Background Task
    background_tasks.add_task(run_analysis_task, job_id, req.symbol, req.horizon)

    return {"job_id": job_id, "status": "pending"}


@app.get("/api/agent/status/{job_id}")
def get_analysis_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/agent/chat")
async def chat_with_agent(req: AgentChatRequest):
    """
    Chat with a specific agent.
    """
    if not orchestrator:
        raise HTTPException(status_code=503, detail="AI Engine not available")

    # Map name to instance
    agent_map = {
        "chartist": orchestrator.chartist,
        "quant": orchestrator.quant,
        "scout": orchestrator.scout,
        "fundamentalist": orchestrator.fundamentalist,
        "risk_officer": orchestrator.risk_officer,
        "executioner": orchestrator.executioner,
    }

    agent = agent_map.get(req.agent_name.lower())
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{req.agent_name}' not found")

    try:
        if hasattr(agent, "chat"):
            response = await agent.chat(req.message, req.context)
            return {"response": response}
        else:
            return {
                "response": f"The {req.agent_name} is busy calculating and cannot chat right now."
            }

    except Exception as e:
        print(f"Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
