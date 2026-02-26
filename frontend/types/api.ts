// === Market Data Types ===

export interface MetaData {
  symbol: string;
  name: string;
  currency: string;
  marketState: string;
}

export interface PricePoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  ema9?: number;
  ema21?: number;
  rsi?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
}

export interface PriceData {
  current: number;
  change: number;
  changePercent: number;
  history: PricePoint[];
}

export interface Fundamentals {
  marketCap: number;
  peRatio?: number;
  week52High: number;
  week52Low: number;
}

export interface TickerData {
  meta: MetaData;
  price: PriceData;
  fundamentals: Fundamentals;
  news: NewsItem[];
  ai_analysis?: AIAnalysis | null;
}

// === News Types ===

export interface NewsItem {
  source: string;
  headline: string;
  url: string;
  publishedAt: string;
  summary?: string;
  sentiment?: string;
  sentiment_score?: number;
  sentiment_reason?: string;
}

// === AI Analysis Types ===

export interface AgentResult {
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence?: number;
  sentiment_score?: number;
  summary: string;
  error?: string;
  [key: string]: unknown;
}

export interface TradeDecision {
  action: "BUY" | "SELL" | "HOLD";
  trade_type?: string;
  ticker?: string;
  confidence?: number;
  time_horizon?: string;
  intended_timeframe?: string;
  entry_zone?: string;
  target?: number;
  target_2?: number | null;
  target_2_pct?: number | null;
  target_3?: number | null;
  target_3_pct?: number | null;
  stop_loss?: number;
  sl_type?: string;
  reasoning?: string;
  conclusion?: string;
  squad_consensus?: Record<string, string>;
  decision_continuity?: string;
  error?: string;
}

export interface RiskValidation {
  approved: boolean;
  veto_reason?: string;
  reasoning?: string;
  conclusion?: string;
  risk_metrics?: Record<string, unknown>;
  deterministic_checks?: Array<{
    check: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface AIAnalysis {
  ticker: string;
  timestamp: string;
  horizon: string;
  action: string;
  decision: TradeDecision;
  risk_validation: RiskValidation;
  squad_details: Record<string, AgentResult>;
  execution_status?: string | null;
}

// === Portfolio Types ===

export interface Position {
  symbol: string;
  qty: number;
  avg_price: number;
  current_price: number;
  stop_loss?: number | null;
  sl_type?: string;
  take_profit?: number | null;
  tp_config?: Record<string, unknown>;
  last_updated?: string;
}

export interface OrderHistoryEntry {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  total_value: number;
  realized_pnl?: number | null;
  reason?: string | null;
  timestamp: string;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  total_value: number;
  history: OrderHistoryEntry[];
}

// === Alert Types ===

export interface Alert {
  id: string;
  symbol: string;
  target_price: number;
  condition: "ABOVE" | "BELOW";
  created_at?: string;
  is_active?: boolean;
}

// === Order Types ===

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  stop_loss?: number | null;
  sl_type?: "fixed" | "trailing_fixed" | "trailing_pct";
  take_profit?: number | null;
  tp_config?: Record<string, unknown> | null;
}

// === Portfolio Analytics Types ===

export interface EquityPoint {
  date: string;
  cumulative_pnl: number;
}

export interface PortfolioAnalytics {
  equity_curve: EquityPoint[];
  total_realized_pnl: number;
  trade_count: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
}

// === Market Screener Types ===

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  rsi: number;
  score: number;
  signals: string[];
}

// === Agent Chat Types ===

export interface AgentInfo {
  id: string;
  name: string;
  color: string;
  bg: string;
  border: string;
}
