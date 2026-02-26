"use client";

import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

import type { ScreenerResult } from "@/types/api";

const MARKETS = ["US", "SE", "EU"] as const;
type Market = (typeof MARKETS)[number];

const MAX_SCORE = 8;

interface MarketScreenerProps {
  onSelect: (symbol: string) => void;
}

const SignalPill = ({ label }: { label: string }) => {
  const colorMap: Record<string, string> = {
    OVERSOLD: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "RSI LOW": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    OVERBOUGHT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "MACD ↑": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "MACD ↓": "bg-red-500/20 text-red-400 border-red-500/30",
    "VOL SPIKE": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "VOL HIGH": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "52W LOW": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "52W HIGH": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  const cls = colorMap[label] ?? "bg-white/10 text-gray-400 border-white/10";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
};

const ScoreDots = ({ score }: { score: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: MAX_SCORE }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 w-1.5 rounded-full transition-colors ${i < score ? "bg-emerald-400" : "bg-white/10"}`}
      />
    ))}
  </div>
);

const SkeletonRow = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
    <div className="flex-1 space-y-1.5">
      <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
      <div className="h-2.5 w-32 animate-pulse rounded bg-white/5" />
    </div>
    <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
    <div className="flex gap-0.5">
      {Array.from({ length: MAX_SCORE }).map((_, i) => (
        <div key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/10" />
      ))}
    </div>
  </div>
);

export const MarketScreener = ({ onSelect }: MarketScreenerProps) => {
  const [market, setMarket] = useState<Market>("SE");
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scan = async (m: Market) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/market/screener?market=${m}&limit=15`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScreenerResult[] = await res.json();
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount with default market
  useEffect(() => {
    scan(market);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarketChange = (m: Market) => {
    setMarket(m);
    scan(m);
  };

  return (
    <section className="glass-panel relative overflow-hidden rounded-3xl border border-emerald-500/10 p-6">
      <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-emerald-500/5 blur-[80px]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/20 p-2.5">
              <Zap className="text-emerald-400" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-widest text-gray-400">
                Signal Scanner
              </h2>
              <p className="text-xs text-gray-600">Top technical setups</p>
            </div>
          </div>

          {/* Market tabs + scan button */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/5 bg-white/5 p-1">
              {MARKETS.map((m) => (
                <button
                  key={m}
                  onClick={() => handleMarketChange(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    market === m
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => scan(market)}
              disabled={loading}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Scanning…" : "Scan"}
            </button>
          </div>
        </div>

        {/* Column headers */}
        {!loading && results.length > 0 && (
          <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 text-[9px] font-black uppercase tracking-widest text-gray-600">
            <span>Ticker</span>
            <span className="w-20 text-right">Price / RSI</span>
            <span>Signals</span>
            <span>Score</span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-2">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-6 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm italic text-gray-600">
              No results. Click Scan to run the screener.
            </div>
          )}

          {!loading &&
            results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => onSelect(r.symbol)}
                className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-left transition-all hover:border-emerald-500/20 hover:bg-emerald-500/5"
              >
                {/* Symbol + name */}
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold text-white">{r.symbol}</p>
                  <p className="truncate text-xs text-gray-500">{r.name}</p>
                </div>

                {/* Price + change + RSI */}
                <div className="w-20 text-right">
                  <p className="font-mono text-xs font-bold text-white">
                    {r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p
                    className={`text-[10px] font-bold ${r.change_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {r.change_percent >= 0 ? "+" : ""}
                    {r.change_percent.toFixed(2)}%
                  </p>
                  <p className="text-[9px] text-gray-600">RSI {r.rsi}</p>
                </div>

                {/* Signal pills */}
                <div className="flex flex-wrap gap-1">
                  {r.signals.map((s) => (
                    <SignalPill key={s} label={s} />
                  ))}
                  {r.signals.length === 0 && (
                    <span className="text-[10px] italic text-gray-700">—</span>
                  )}
                </div>

                {/* Score dots */}
                <ScoreDots score={r.score} />
              </button>
            ))}
        </div>
      </div>
    </section>
  );
};
