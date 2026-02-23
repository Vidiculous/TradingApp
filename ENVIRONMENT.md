# Development Environment & Architecture

This document serves as a guide for AI assistants working on this codebase, capturing the "ground truth" of the system's state, agent roles, and design patterns.

## 🏗️ System Architecture

- **Frontend**: Next.js 16 (App Router), Tailwind CSS 4, Lucide icons, Lightweight-Charts.
- **Backend**: FastAPI (Python 3.10+), SQLModel (SQLite).
- **AI Engine**: Custom multi-agent framework utilizing Google Gemini.

## 🤖 Agent Council (Specialized Roles)

As of February 2026, the agent squad has been specialized to eliminate overlaps:

| Agent | Specialized Focus | Key Data Source |
| :--- | :--- | :--- |
| **Fundamentalist** | Quantitative Value (DCF, Graham's Number, PE/PEG math). | `fundamentals` dict |
| **Analyst** | Forensic Narrative (10-K/10-Q text, red flags, moat, mgmt tone). | `document_text` |
| **Chartist** | Visual Psychology & Price Action (visual patterns, RSI/MACD "shape"). | `chart_image` |
| **Quant** | Statistical Math & Anomaly Detection (Volume spikes, ATR, RSI numbers). | `history` (OHLCV) |
| **Scout** | News Catalysts & Sentiment Delta (Hype factor, news grounding). | `news`, `web_news` |
| **Executioner** | **Lead Interrogator**. Synthesizes squad reports and resolves conflicts. | All reports + chat power |
| **Risk Officer** | "The No Man". Vetoes unsafe trades based on RR and SL/TP quality. | Executioner Plan |

### Inter-Agent Communication
Agents can talk to each other using the `ask_agent(agent_id, question)` method. 
- **Executioner** is the primary user of this power to cross-examine disagreeing agents.

## 📊 Data Flow: The `data_package`
The `Orchestrator` gathers all data into a `data_package` passed to agents:
- `chart_image`: Base64 bytes of the candlestick chart.
- `document_text`: Extracted text from local PDFs or online IR search results.
- `web_news`: Fresh data from general web search fallback.
- `fundamentals`: Cleaned yfinance info.

## 🎨 UI & Styling Rules
To prevent z-index "wars" and overlap issues:
- **Header**: `z-[1000]`, `sticky`, solid background (`bg-[#09090b]`).
- **Search Suggestions**: `z-[9999]`, solid black background.
- **Modals**: Higher than header, uses consistent backdrop blur.
- **Animations**: Global animations are enabled (do not disable them for "performance").

## ⚠️ Known Ticker Quirks
- **Stockholm (SIX)**: Use `.ST` suffix (e.g., `VOLV-B.ST`).
- **European Markets**: Common suffixes: `.DE` (Frankfurt), `.PA` (Paris).
- **Warrants/Mini-Futures**: Currently in research. ISIN formats (e.g. `DE000...`) are inconsistent in `yfinance`.

## 🛠️ Key Files for Quick Access
- `backend/main.py`: All API routes.
- `frontend/app/page.tsx`: Main dashboard state and polling logic.
- `ai_engine/orchestrator.py`: The data-gathering and parallelization core.
- `ai_engine/agents/base.py`: The Gemini wrapper and agent communication logic.
