# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarketDASH PRO — a full-stack trading platform with AI-powered multi-agent analysis, paper trading, and real-time market data. Three main subsystems: Next.js frontend, FastAPI backend, and a multi-LLM agent engine (Gemini, OpenAI, or Anthropic).

## Common Commands

### Running the App

```bash
# Start both servers (Windows)
start_app.bat

# Or manually:
# Terminal 1 — Backend (port 8000)
cd backend && python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend (port 3001)
cd frontend && npm run dev
```

Frontend: http://localhost:3001 | Backend API: http://localhost:8000 | Swagger: http://localhost:8000/docs

### Backend (Python)

```bash
cd backend
pip install -r requirements.txt        # Install dependencies
python -m pytest                        # Run all tests
python -m pytest tests/test_db.py       # Run a single test file
python -m pytest tests/test_db.py::test_function_name  # Run single test
black . && ruff check . --fix           # Format + lint
mypy .                                  # Type check

# Generate a password hash for auth:
python scripts/create_password.py
```

### Frontend (Next.js/TypeScript)

```bash
cd frontend
npm install                             # Install dependencies
npm run dev                             # Dev server on port 3001
npm run build                           # Production build
npm run lint                            # ESLint
npm run lint:fix                        # ESLint autofix
npm run format                          # Prettier format
npm run format:check                    # Prettier check
```

## Architecture

### Three-Layer System

```
Frontend (Next.js 16, port 3001)
    ↕ HTTP REST (credentials: include for JWT cookies)
Backend (FastAPI, port 8000)
    ↕ Python calls
AI Engine (multi-agent orchestrator — Gemini / OpenAI / Anthropic)
    ↕ SQLModel ORM
Database (backend/database.db — SQLite)
```

### Backend (`backend/`)

- **`main.py`** — Single-file FastAPI app with all API routes (~90 endpoints). Entry point.
- **`models.py`** — Pydantic request/response schemas. `OrderRequest` uses `Literal` types with field validators.
- **`db_models/db.py`** — SQLModel table definitions: `Account`, `Position`, `AnalysisResult`, `WatchlistItem`, `Alert`, `OrderHistory`.
- **`services/`** — Business logic by domain:
  - `market_data.py` — yfinance OHLCV + technicals, order book, sales tape, economic calendar (last three are **simulated**, return `{"data": [...], "simulated": true}`)
  - `paper_trading.py` — Order execution, SL/TP background monitor (runs every 60s), order history CRUD
  - `news.py` — RSS + DuckDuckGo news aggregation
  - `sentiment.py` — LLM-based sentiment with keyword fallback; cache evicts oldest half when full
  - `alerts.py` — Price alert CRUD (in-memory, checked by `paper_trading` background loop)
  - `watchlist.py` — Watchlist management
  - `analysis_history.py` — AI analysis persistence with offset pagination
  - `document_service.py` — PDF/TXT/MD/CSV upload + PyPDF2 text extraction
  - `auth.py` — Single-user JWT auth (access 15min + refresh 7d, httpOnly cookies). Auth disabled if `APP_PASSWORD_HASH` not set.
  - `llm_provider.py` — Multi-LLM adapter (Gemini / OpenAI / Anthropic), runtime API key injection
  - `sector_data.py` — Sector correlation and peer comparison
  - `jobs.py` — In-memory background job tracker (lost on restart)
  - `db_service.py` — SQLite `create_all()` on startup

### AI Engine (`ai_engine/`)

Multi-agent framework: 5 specialist agents analyze in parallel → Executioner synthesizes → Risk Officer validates.

- **`orchestrator.py`** — Coordinates the pipeline: gathers data in parallel, spawns agents (semaphore=2), collects normalized results, runs Executioner then Risk Officer, optionally auto-executes.
- **`agents/base.py`** — `BaseAgent` wrapping `LLMProvider`. Features: retry with exponential backoff (3 attempts), tool execution via `tool_manager`, inter-agent `ask_agent()`, JSON fence stripping, data sanitization.
- **`tool_manager.py`** — Tool registry with TTL-based caching (60s–24h by type). Agents call `self.tool_manager.execute_tool(name, args)`.
- **`tools/`** — 8 data tools: `technical_tools` (RSI/MACD/ATR), `market_tools` (PE/PB/stats), `document_tools` (10-K/10-Q text), `peer_tools`, `insider_tools`, `earnings_tools`, `macro_tools`, `social_tools`.
- **Agent squad** (each in `agents/` with a matching prompt in `prompts/`):
  - `chartist.py` — Visual/pattern analysis, multimodal chart image input
  - `quant.py` — RSI, MACD, volume stats; uses `get_indicators` tool
  - `scout.py` — News catalysts & sentiment delta; uses `get_social_sentiment`, `get_macro_events` tools
  - `fundamentalist.py` — DCF/PE/Graham valuation; uses `fetch_ticker_stats`, `get_earnings_forecast`, `get_peer_group` tools
  - `analyst.py` — Forensic narrative (10-K/10-Q text, red flags); uses `fetch_financial_docs`, `fetch_insider_activity` tools; has local JSON cache
  - `executioner.py` — Synthesizes squad into BUY/SELL/HOLD + entry/SL/TP; can call `ask_agent()` to resolve disagreements
  - `risk_officer.py` — Deterministic pre-checks (SL sanity, R:R ≥ 2:1, max position 10% of portfolio) then LLM validation; auto-approves HOLD
- **`prompts/`** — Markdown system prompts for each agent.
- **`utils/web_search.py`** — DuckDuckGo search formatting for prompt ingestion.

### Frontend (`frontend/`)

- **`app/page.tsx`** — Main dashboard. All state lives here (25+ useState hooks). Handles async job polling (1s interval, 5min timeout).
- **`app/login/page.tsx`** — Login page (glassmorphic theme, uses AuthContext).
- **`app/layout.tsx`** — Root layout wrapping children with `AuthProvider > ToastProvider > ErrorBoundary`.
- **`contexts/AuthContext.tsx`** — Auth state: `isAuthenticated`, `login()`, `logout()`. Auto-checks via refresh token on mount.
- **`types/api.ts`** — TypeScript interfaces for all API types: `TickerData`, `AIAnalysis`, `Position`, `Portfolio`, `Alert`, `AgentResult`, `TradeDecision`, `RiskValidation`, etc.
- **`utils/api.ts`** — `apiFetch()` / `apiPost()` wrappers that include cookies and redirect to `/login` on 401.
- **`utils/config.ts`** — `API_BASE_URL` env override (default `http://localhost:8000`).
- **Key components**: `AgentAnalysisView.tsx`, `TradingViewChart.tsx`, `OrderEntry.tsx`, `PositionsTable.tsx`, `DashboardRightPanel.tsx`, `AlertsManager.tsx`, `AgentChatModal.tsx`, `LLMSettingsModal.tsx`, `DocumentManager.tsx`, `ErrorBoundary.tsx`, `ToastProvider.tsx`.
- UI stack: Tailwind CSS 4 (dark glassmorphic theme), Lightweight-Charts, Recharts, Lucide icons.

### Key Data Flows

1. **Analysis**: Frontend POSTs to `/api/agent/analyze` → backend creates background job → orchestrator gathers data, runs 5 agents in parallel, Executioner synthesizes, Risk Officer validates → result stored in DB → frontend polls `/api/agent/status/{job_id}`.
2. **Paper Trading**: Order via `/api/paper/order` → `Position` persisted in SQLite → background task monitors SL/TP every 60s → executes sell + records `OrderHistory` on trigger.
3. **Autonomous Mode**: Analysis with `autonomous=true` → if Risk Officer approves → `execute_order()` called automatically with 5%-of-cash position sizing.
4. **Simulated Data**: Order book (`/api/market/orderbook/{symbol}`), sales tape (`/api/market/tape/{symbol}`), and economic calendar (`/api/market/calendar`) are simulated. Responses include `"simulated": true` alongside the data array. Frontend consumers must unwrap: `data.trades`, `data.events`, `data.bids`/`data.asks`.

## Environment Setup

Copy `backend/.env.template` to `backend/.env`. Required:
- `GEMINI_API_KEY` (from https://aistudio.google.com/) — or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` if using other providers.

Optional:
- `GEMINI_MODEL` — default `gemini-1.5-pro`
- `APP_USERNAME` / `APP_PASSWORD_HASH` — enable JWT auth (generate hash with `python scripts/create_password.py`)
- `CORS_ORIGINS` — comma-separated allowed origins (default: `http://localhost:3001,http://127.0.0.1:3001`)
- `DEMO_MODE`, `SSL_VERIFY`

## Code Style

- **Python**: Black (line-length 100), Ruff, isort (black profile), MyPy. Target Python 3.10+. Config in `pyproject.toml`.
- **TypeScript**: ESLint + Prettier with Tailwind plugin. Config in `frontend/package.json` scripts.

## Key Gotchas

- **Simulated data responses**: `get_order_book`, `get_sales_tape`, `get_economic_calendar` return dicts with a nested data key + `"simulated": true`. Frontend must unwrap.
- **Analyst prompt path**: When constructing the `Analyst` agent, pass just the filename (`analyst.md`), not a full path. `BaseAgent.load_prompt()` resolves from the `prompts/` sibling directory automatically.
- **Auth is opt-in**: If `APP_PASSWORD_HASH` is not set in `.env`, all endpoints are publicly accessible (dev mode).
- **Job manager is in-memory**: Analysis jobs are lost on backend restart. Frontend will get a 404 on status poll if the server restarts during analysis.
- **`jose` module**: Auth requires `python-jose[cryptography]`. If missing, install via `pip install "python-jose[cryptography]"`.
- **Agent LLM calls**: All agents use `LLMProvider` via `BaseAgent`, not direct `google.generativeai` calls. To switch LLM, update `LLM_PROVIDER` in `.env` or use the frontend `LLMSettingsModal`.
