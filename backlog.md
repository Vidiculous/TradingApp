# Project Backlog

## Completed
- [x] Fix critical backend 500 errors preventing data fetch (Completed in backend/services/news.py)
- [x] Overhaul frontend UI with Premium Dark Mode and Glassmorphism (Completed with Tailwind v4)
- [x] Restore and robustify AI integration (Improved backend error handling & Glassmorphism UI)
- [x] Bug: Investigate and fix persistent 500 errors on search #backend #critical #prio-0
- [x] Feature: Real-time 'Day Trader' Charts (Granular Intervals) #backend #frontend #prio-1
- [x] Feature: Chart Timeframe Selectors (1D, 5D, 1M, etc) #frontend
- [x] Feat: Technical Overlays (Volume & VWAP on Candlesticks) #frontend #alpha

## High Priority: Decision Support System (The "Why")

- [x] **Feat: AI Trade Signal Cards ("The Edge")** #ai #frontend #prio-0
    - **Context:** User cannot execute trades here, so the app must generate the *best possible idea*.
    - **Requirement:**
        - **Visual:** A prominent "Signal Card" replacing the generic analysis text.
        - **Content:**
            - **Direction:** "LONG" (Green) / "SHORT" (Red) / "WAIT" (Grey).
            - **Zones:** Entry ($XXX), Stop Loss ($XXX), Take Profit ($XXX).
            - **Confidence:** "High Confidence (85%)" based on technicals + news.
            - **Reasoning:** 3 bullet points max (e.g., "Bullish divergence on RSI", "Positive Earnings Surprise").

- [x] **Feat: Compact 'Pro Mode' Layout** #frontend #alpha #prio-0
    - **Context:** Maximize information density for analysis.
    - **Requirement:**
        - **Navbar:** Move search to top-left, reduce height.
        - **Grid:** Reduce padding to `p-3` or `p-4`.
        - **Layout:** Ensure Chart and AI Signal are visible *without scrolling* on a standard laptop screen.

- [x] **Fix: Remove Animations & Latency** #frontend #alpha #prio-1
    - **Context:** The tool must feel instant.
    - **Requirement:** Disable all CSS transitions. Remove "Thinking..." load states in favor of non-blocking updates.

## Visual Audit Findings (New)

- [ ] **Fix: Redesign Landing Page into "Market Heatmap"** #frontend #ux #prio-0
    - **Critique:** Current landing page is too generic/empty. Wasted space.
    - **Req:** Replace empty central area with a Sector Heatmap (Tech, Energy, Financials) and "Top % Gainers" list immediately visible on load.

- [ ] **Feat: Global Market Context Header** #frontend #data #prio-1
    - **Critique:** No context on overall market direction.
    - **Req:** Add a slim, scrolling ticker at the very top showing live SPX, NDX, BTC/USD, and 10Y Yield.

- [ ] **Feat: Ticker-Specific Real-Time News Side-Panel** #frontend #data #prio-1
    - **Critique:** News is currently hidden or generic.
    - **Req:** A dedicate collapsible sidebar or bottom drawer that *only* shows news for the active ticker.

- [ ] **Fix: Actionable AI Suggestions in Trade Sidebar** #frontend #ux #prio-1
    - **Critique:** "Run Squad" button is disconnected from the trade decision flow.
    - **Req:** Move the AI Trigger directly into the sidebar as a "Confidence Meter" that updates dynamically.

- [ ] **Feat: "Panic Button" (Close All Positions)** #frontend #feature #prio-1
    - **Critique:** Execution speed for exiting positions is too slow.
    - **Req:** A visible red "Close All" button in the positions panel (simulated for now).

- [ ] **Feat: Integrated VWAP & EMA Overlays** #frontend #charting #prio-2
    - **Critique:** Chart lacks trend confirmation tools.
    - **Req:** Toggle buttons for 9-EMA, 21-EMA, and VWAP directly on the chart header.

- [ ] **Feat: Economic Calendar Widget** #frontend #data #prio-2
    - **Critique:** Traders get trapped by macro events.
    - **Req:** Sidebar widget showing countdown to next High Impact event (CPI, Fed).

- [ ] **Feat: Level 2 & Tape Visualizer** #frontend #data #prio-2
    - **Critique:** Order flow visibility is zero.
    - **Req:** Populate the L2/Tape tabs with simulated depth data to show "Walls".

- [ ] **Fix: Consolidate AI Squad Panel** #frontend #ux #prio-3
    - **Critique:** Takes up too much vertical space.
    - **Req:** Condense into a "Sentiment Compass" visual.

- [ ] **Fix: Move Search to Global Header** #frontend #ux #prio-3
    - **Critique:** Massive central search bar blocks data.
    - **Req:** Move search to the persistent navbar.

## New High-Value Features (Competitor Parity)

- [ ] **Feat: Multi-Ticker Grid Layout ("Command Center")** #frontend #pro-feature #prio-1
    - **Story:** As a trader, I need to monitor SPY, QQQ, and my active ticker simultaneously to spot correlations.
    - **Comp:** TradingView Split Screen / Thinkorswim Grid.
    - **Req:** Allow user to split the view into 2x2 or 1x2 grids.

- [ ] **Feat: Real-time 'Top Gainers' Scanner** #backend #frontend #prio-1
    - **Story:** As a trader, I need to know what stocks are moving *right now* so I don't miss volatility.
    - **Comp:** Webull "Most Active" / Yahoo Finance "Top Gainers".
    - **Req:** Sidebar widget fetching top 5 volatile stocks.

- [ ] **Feat: Technical Indicator Suite (RSI, MACD)** #frontend #prio-2
    - **Story:** I need to confirm trends with RSI and MACD before entering.
    - **Comp:** Charting pane below the main candle chart.
    - **Req:** Toggleable overlays for RSI (below chart) and MACD.

- [ ] **Feat: 'Paper Trading' Simulation Mode** #frontend #backend #prio-2
    - **Story:** As a user, I want to test the AI's "Buy" signals with fake money to verify if they work.
    - **Comp:** Webull Paper Trading.
    - **Req:** Simple "Buy/Sell" buttons (Simulated only) tracking a fake $100k balance in `localStorage`.

- [ ] **Feat: Price Alerts & Push Notifications** #frontend #prio-3
    - **Story:** As a flexible trader, I want to set a price target and step away, getting notified when it hits.
    - **Comp:** TradingView Alerts.
    - **Req:** Browser Notification API triggers when `current_price > target_price`.

- [ ] **Feat: Sector Correlation Matrix** #ai #backend #prio-4
    - **Story:** As a strategist, I want to know if the current move is sector-wide or isolated.
    - **Req:** AI checks "Tech Sector" trend when analyzing AAPL and mentions "Sector Tailwinds" in the signal.

- [ ] **Feat: Chart Drawing Tools** #frontend #prio-4
    - **Story:** As a chartist, I want to draw my own trendlines to mark support levels.
    - **Comp:** TradingView Toolbar.
    - **Req:** Simple click-to-draw utility (Line, Horizontal Ray).

## Medium Priority: Data & Navigation

- [ ] **Feature: Ticker-Specific News Feed** #backend #frontend #prio-2
    - **Requirement:** Filter news strictly for the active ticker to support the trade decision.

## Low Priority (Polish)

- [ ] **Refactor: Extract components from page.tsx** #frontend #code-quality #prio-4
- [ ] **Feature: Watchlist / Recent Searches** #frontend #prio-4
- [ ] **UX: Redesign 'Error' and 'Loading' states** #frontend #ux #prio-5
