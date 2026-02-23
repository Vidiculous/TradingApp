import { Star, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency } from "../utils/format";
import { AlertsManager } from "./AlertsManager";
import { toggleWatchlist } from "./Watchlist";

interface TickerHeaderProps {
  tickerData: any;
}

export const TickerHeader = ({ tickerData }: TickerHeaderProps) => {
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/watchlist");
        if (res.ok) {
          const list = await res.json();
          setIsStarred(list.includes(tickerData.meta.symbol));
        }
      } catch (e) {
        console.error("Failed to check watchlist status", e);
      }
    };
    check();
    window.addEventListener("watchlistUpdated", check);
    return () => window.removeEventListener("watchlistUpdated", check);
  }, [tickerData.meta.symbol]);

  const handleStar = () => {
    toggleWatchlist(tickerData.meta.symbol, isStarred);
  };

  return (
    <div className="glass-panel group relative flex items-center justify-between overflow-hidden rounded-2xl p-4">
      {/* Background Accent - Subtle */}
      <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5">
        <h1 className="text-6xl font-black tracking-tighter text-white">
          {tickerData.meta.symbol}
        </h1>
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <button
          onClick={handleStar}
          className={`rounded-lg p-1.5 transition-all ${isStarred ? "bg-yellow-400/10 text-yellow-400" : "text-gray-500 hover:bg-white/5 hover:text-yellow-400"}`}
        >
          <Star size={20} fill={isStarred ? "currentColor" : "none"} />
        </button>
        <div>
          <h2 className="text-3xl font-bold leading-none tracking-tight text-white">
            {tickerData.meta.symbol}
          </h2>
          <span className="text-xs font-medium text-gray-400">{tickerData.meta.exchange}</span>
        </div>
        <div className="mx-2 h-8 w-[1px] bg-white/10"></div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold leading-none text-white">
            {formatCurrency(tickerData.price.current, tickerData.meta.currency)}
          </span>
          <span
            className={`flex items-center text-xs font-bold ${tickerData.price.change >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {tickerData.price.change >= 0 ? "+" : ""}
            {formatCurrency(tickerData.price.change, tickerData.meta.currency)}
            <span className="ml-1 opacity-70">({tickerData.price.changePercent.toFixed(2)}%)</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        <AlertsManager currentPrice={tickerData.price.current} symbol={tickerData.meta.symbol} />
      </div>
    </div>
  );
};
