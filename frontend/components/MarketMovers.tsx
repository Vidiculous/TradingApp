"use client";

import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface Mover {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketMoversProps {
  onSelect: (symbol: string) => void;
  fixedMarket?: "US" | "SE" | "EU"; // Optional: lock to specific market
}

export const MarketMovers = ({ onSelect, fixedMarket }: MarketMoversProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<"US" | "SE" | "EU">(fixedMarket || "US");
  const [dataFetched, setDataFetched] = useState(false);

  const fetchMovers = async (market: string = selectedMarket) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/market/active?market=${market}`);
      if (res.ok) {
        const data = await res.json();
        setMovers(data);
        setLastUpdated(new Date());
        setDataFetched(true);
      }
    } catch (error) {
      console.error("Failed to fetch market movers", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset data when market changes (only if not fixed)
  useEffect(() => {
    if (!fixedMarket) {
      setMovers([]);
      setDataFetched(false);
      setLastUpdated(null);
    }
  }, [selectedMarket, fixedMarket]);

  const markets = [
    { code: "US" as const, label: "🇺🇸 US", name: "United States" },
    { code: "SE" as const, label: "🇸🇪 SE", name: "Sweden" },
    { code: "EU" as const, label: "🇪🇺 EU", name: "Europe" },
  ];

  const currentMarket = markets.find((m) => m.code === selectedMarket);

  return (
    <div className="glass-panel flex h-full flex-col rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
          <TrendingUp className="text-emerald-400" size={20} />
          {fixedMarket ? currentMarket?.label : "Top Gainers"}
        </h3>
        <button
          onClick={() => fetchMovers(selectedMarket)}
          disabled={loading}
          className="rounded-lg p-2 transition-colors hover:bg-white/10 disabled:opacity-50"
          title="Refresh market data"
        >
          <RefreshCw className={`text-gray-500 ${loading ? "animate-spin" : ""}`} size={14} />
        </button>
      </div>

      {/* Market Selector - only show if not fixed */}
      {!fixedMarket && (
        <div className="mb-4 flex gap-2">
          {markets.map((market) => (
            <button
              key={market.code}
              onClick={() => setSelectedMarket(market.code)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                selectedMarket === market.code
                  ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm"
                  : "border border-transparent bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white"
              }`}
              title={market.name}
            >
              {market.label}
            </button>
          ))}
        </div>
      )}

      {!dataFetched && !loading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <button
            onClick={() => fetchMovers(selectedMarket)}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/20 px-6 py-3 font-bold text-emerald-400 transition-all hover:bg-emerald-500/30"
          >
            Load Market Data
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-emerald-400" size={32} />
            <p className="text-sm text-gray-400">
              Scanning {markets.find((m) => m.code === selectedMarket)?.name} market...
            </p>
          </div>
        </div>
      )}

      {dataFetched && !loading && (
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto">
          {movers.map((mover) => (
            <div
              key={mover.symbol}
              onClick={() => onSelect(mover.symbol)}
              className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 transition-all hover:scale-[1.02] hover:border-white/10 hover:bg-white/10"
            >
              <div>
                <div className="font-bold text-white transition-colors group-hover:text-emerald-400">
                  {mover.symbol}
                </div>
                <div className="text-xs text-gray-400">${mover.price.toFixed(2)}</div>
              </div>

              <div
                className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                  mover.changePercent >= 0
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }`}
              >
                {mover.changePercent >= 0 ? "+" : ""}
                {mover.changePercent.toFixed(2)}%
              </div>
            </div>
          ))}

          {movers.length === 0 && (
            <div className="py-4 text-center text-sm text-gray-500">No active movers found.</div>
          )}
        </div>
      )}

      {lastUpdated && (
        <div className="mt-3 text-center text-[10px] text-gray-600">
          Updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};
