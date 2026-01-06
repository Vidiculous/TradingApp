"use client";

import { ArrowDownRight, ArrowUpRight, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface WatchlistItem {
  symbol: string;
  price: number;
  changePercent: number;
}

export const Watchlist = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const router = useRouter();

  // Load list
  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem("user_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
    };
    load();
    window.addEventListener("watchlistUpdated", load);
    return () => window.removeEventListener("watchlistUpdated", load);
  }, []);

  // Fetch prices (Poll)
  useEffect(() => {
    const fetchPrices = async () => {
      if (watchlist.length === 0) {
        setItems([]);
        return;
      }

      // In a real app we'd use a batch endpoint.
      // Here we parallel fetch.
      const promises = watchlist.map(async (sym) => {
        try {
          const res = await fetch(`/api/ticker/${sym}?interval=1d&period=1d`);
          if (res.ok) {
            const data = await res.json();
            return {
              symbol: sym,
              price: data.price.current,
              changePercent: data.price.changePercent,
            };
          }
        } catch (e) {
          console.error(e);
        }
        return null;
      });

      const results = await Promise.all(promises);
      setItems(results.filter((i) => i !== null) as WatchlistItem[]);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [watchlist]);

  const removeFromWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const updated = watchlist.filter((s) => s !== symbol);
    localStorage.setItem("user_watchlist", JSON.stringify(updated));
    window.dispatchEvent(new Event("watchlistUpdated"));
    setWatchlist(updated);
  };

  return (
    <div className="custom-scrollbar max-h-[400px] space-y-2 overflow-y-auto">
      {items.length === 0 && (
        <div className="py-8 text-center text-sm italic text-gray-500">
          No favorites yet.
          <br />
          Click the Star icon to add.
        </div>
      )}
      {items.map((item) => (
        <div
          key={item.symbol}
          onClick={() => router.push(`/?ticker=${item.symbol}`)}
          className="glass-panel group flex cursor-pointer items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5"
        >
          <div>
            <div className="font-bold text-white">{item.symbol}</div>
            <div className="text-xs text-gray-400">Vol: --</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-gray-200">${item.price.toFixed(2)}</div>
            <div
              className={`flex items-center justify-end gap-0.5 text-xs font-bold ${item.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {item.changePercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {item.changePercent}%
            </div>
          </div>
          <button
            onClick={(e) => removeFromWatchlist(e, item.symbol)}
            className="p-1 text-gray-600 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// Helper for TickerHeader
export const toggleWatchlist = (symbol: string) => {
  const saved = localStorage.getItem("user_watchlist");
  let current = saved ? JSON.parse(saved) : [];

  if (current.includes(symbol)) {
    current = current.filter((s: string) => s !== symbol);
  } else {
    current.push(symbol);
  }

  localStorage.setItem("user_watchlist", JSON.stringify(current));
  window.dispatchEvent(new Event("watchlistUpdated"));
};

export const isInWatchlist = (symbol: string) => {
  // Only works client-side, need useEffect in component
  return false;
};
