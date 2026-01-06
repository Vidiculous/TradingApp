"use client";

import { ArrowDownRight, ArrowUpRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatCurrency } from "../utils/format";

interface FavoriteItem {
  symbol: string;
  price: number;
  changePercent: number;
  currency: string;
}

export const FavoritesGrid = ({ onSelect }: { onSelect: (symbol: string) => void }) => {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load and Fetch
  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem("user_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
      else setLoading(false);
    };
    load();
    window.addEventListener("watchlistUpdated", load);
    return () => window.removeEventListener("watchlistUpdated", load);
  }, []);

  useEffect(() => {
    const fetchPrices = async () => {
      if (watchlist.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const promises = watchlist.map(async (sym) => {
        try {
          const res = await fetch(`/api/ticker/${sym}?interval=1d&period=1d`);
          if (res.ok) {
            const data = await res.json();
            return {
              symbol: sym,
              price: data.price.current,
              changePercent: data.price.changePercent,
              currency: data.meta.currency,
            };
          }
        } catch (e) {
          console.error(e);
        }
        return null;
      });

      const results = await Promise.all(promises);
      setItems(results.filter((i) => i !== null) as FavoriteItem[]);
      setLoading(false);
    };

    if (watchlist.length > 0) {
      fetchPrices();
    }
  }, [watchlist]);

  const removeFromWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const updated = watchlist.filter((s) => s !== symbol);
    localStorage.setItem("user_watchlist", JSON.stringify(updated));
    window.dispatchEvent(new Event("watchlistUpdated"));
    setWatchlist(updated);
  };

  if (watchlist.length === 0 && !loading) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {loading && items.length === 0
        ? // Skeletons
          Array.from({ length: watchlist.length || 4 }).map((_, i) => (
            <div key={i} className="glass-panel h-28 animate-pulse rounded-2xl bg-white/5" />
          ))
        : items.map((item) => (
            <div
              key={item.symbol}
              onClick={() => onSelect(item.symbol)}
              className="glass-panel group relative cursor-pointer overflow-hidden rounded-3xl p-5 transition-all hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.98]"
            >
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => removeFromWatchlist(e, item.symbol)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-400/10 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black tracking-tighter text-white">
                    {item.symbol}
                  </span>
                  <div
                    className={`flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-black ${item.changePercent >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
                  >
                    {item.changePercent >= 0 ? "+" : ""}
                    {item.changePercent.toFixed(2)}%
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="font-mono text-2xl font-bold leading-none text-white">
                    {formatCurrency(item.price, item.currency)}
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Live Price
                  </span>
                </div>

                <div
                  className={`mt-2 h-1 w-full rounded-full ${item.changePercent >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}
                >
                  <div
                    className={`h-full rounded-full ${item.changePercent >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(Math.abs(item.changePercent) * 10, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
    </div>
  );
};
