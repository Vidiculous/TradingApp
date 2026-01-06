"use client";

import { AlertCircle, Loader2, Maximize2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

const TradingViewChart = dynamic(
  () => import("@/components/TradingViewChart").then((mod) => mod.TradingViewChart),
  { ssr: false },
);

interface GridDashboardProps {
  initialTickers: string[];
  onMaximize: (symbol: string) => void;
}

export const GridDashboard = ({ initialTickers, onMaximize }: GridDashboardProps) => {
  // Ensure we have exactly 4 tickers for the 2x2 grid
  const [tickers, setTickers] = useState<string[]>(
    initialTickers.length >= 4
      ? initialTickers.slice(0, 4)
      : [...initialTickers, "SPY", "QQQ", "NVDA", "BTC-USD"].slice(0, 4),
  );

  return (
    <div className="grid h-[calc(100vh-140px)] grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2">
      {tickers.map((symbol, index) => (
        <GridCell
          key={`${symbol}-${index}`}
          symbol={symbol}
          onMaximize={() => onMaximize(symbol)}
          onSearch={(newSymbol) => {
            const newTickers = [...tickers];
            newTickers[index] = newSymbol;
            setTickers(newTickers);
          }}
        />
      ))}
    </div>
  );
};

const GridCell = ({
  symbol,
  onMaximize,
  onSearch,
}: {
  symbol: string;
  onMaximize: () => void;
  onSearch: (s: string) => void;
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const timeframes = { "5M": { period: "1d", interval: "5m" } }; // Simplified for Grid

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/ticker/${symbol}?period=1d&interval=5m`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Failed");
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Poll every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [symbol]);

  return (
    <div className="glass-panel group relative flex h-full flex-col rounded-2xl border-white/5 bg-black/40 p-4">
      {/* Header / Toolbar */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchTerm.trim()) {
                onSearch(searchTerm.toUpperCase());
                setSearchTerm("");
              }
            }}
            className="relative"
          >
            <Search className="absolute left-2 top-1.5 text-gray-500" size={12} />
            <input
              type="text"
              className="w-24 rounded-lg border border-white/10 bg-white/5 py-1 pl-6 pr-2 text-xs text-white outline-none transition-all focus:w-32 focus:border-emerald-500/50"
              placeholder={symbol}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>

          {data && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">{data.meta.symbol}</span>
              <div
                className={`font-mono text-[10px] ${data.price.change >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {data.price.current.toFixed(2)} ({data.price.changePercent}%)
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onMaximize}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Chart Area */}
      <div className="relative min-h-0 w-full flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400">
            <AlertCircle size={24} className="mb-2 opacity-50" />
            <span className="text-xs">Unavailable</span>
          </div>
        )}

        {data && !loading && (
          <TradingViewChart data={data.price.history} symbol={data.meta.symbol} />
        )}
      </div>
    </div>
  );
};
