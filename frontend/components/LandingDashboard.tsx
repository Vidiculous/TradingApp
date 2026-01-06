"use client";

import { Check, Edit2, Sparkles, TrendingUp, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCurrency } from "../utils/format";
import { FavoritesGrid } from "./FavoritesGrid";
import { MarketHeatmap } from "./MarketHeatmap";
import { MarketMovers } from "./MarketMovers";

interface LandingDashboardProps {
  onSelect: (symbol: string) => void;
}

export const LandingDashboard = ({ onSelect }: LandingDashboardProps) => {
  const [cash, setCash] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/paper/portfolio");
      const data = await res.json();
      setCash(data.cash);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleUpdateCash = async () => {
    const val = parseFloat(editValue);
    if (isNaN(val)) return;

    try {
      await fetch("/api/paper/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val }),
      });
      setCash(val);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-700">
      {/* Account Status / Buying Power */}
      <section className="glass-panel group relative overflow-hidden rounded-3xl border border-emerald-500/10 p-6">
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-emerald-500/5 blur-[80px]"></div>

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/20 p-3">
              <Wallet className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                Available Buying Power
              </h2>
              {isEditing ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold text-white">$</span>
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    className="w-48 rounded-lg border border-emerald-500/30 bg-white/5 px-3 py-1 font-mono text-2xl font-bold text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleUpdateCash}
                    className="rounded-lg bg-emerald-500 p-2 text-white transition-colors hover:bg-emerald-600"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg bg-white/5 p-2 text-gray-400 transition-colors hover:bg-white/10"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-4xl font-bold leading-none text-white">
                    {formatCurrency(cash, "USD")}
                  </span>
                  <button
                    onClick={() => {
                      setEditValue(cash?.toString() || "");
                      setIsEditing(true);
                    }}
                    className="p-2 text-gray-500 opacity-0 transition-colors hover:text-emerald-400 group-hover:opacity-100"
                    title="Adjust Buying Power"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1000, 10000, 50000, 100000].map((amt) => (
              <button
                key={amt}
                onClick={async () => {
                  await fetch("/api/paper/cash", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: amt }),
                  });
                  setCash(amt);
                }}
                className="rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-400 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
              >
                Set ${amt / 1000}k
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Watchlist Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">Your Watchlist</h2>
        </div>
        <FavoritesGrid onSelect={onSelect} />
      </section>

      {/* Separator */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Top Gainers Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="text-emerald-400" size={18} />
          <h2 className="text-xl font-bold text-white">Market Movers</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MarketMovers onSelect={onSelect} fixedMarket="US" />
          <MarketMovers onSelect={onSelect} fixedMarket="SE" />
          <MarketMovers onSelect={onSelect} fixedMarket="EU" />
        </div>
      </section>

      {/* Separator */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Market Context Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="text-amber-400" size={18} />
          <h2 className="text-xl font-bold text-white">Global Market Pulse</h2>
        </div>
        <MarketHeatmap />
      </section>
    </div>
  );
};
