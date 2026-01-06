"use client";

import { Globe, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface GlobalItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

import { API_BASE_URL } from "@/utils/config";

export const GlobalContextBar = () => {
  const [data, setData] = useState<GlobalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market/global`);
        const json = await res.json();
        if (Array.isArray(json)) {
          setData(json);
        }
      } catch (e) {
        console.error("Failed to load global context", e);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobal();

    // Refresh every 2 minutes
    const interval = setInterval(fetchGlobal, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading || data.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden border-b border-white/5 bg-[#0a0a0a] py-1.5">
      <div className="animate-infinite-scroll flex w-full items-center gap-8 whitespace-nowrap px-4 md:px-8">
        <div className="mr-4 flex items-center gap-2 text-xs font-bold text-blue-500">
          <Globe size={12} />
          GLOBAL
        </div>

        {/* Double the data for seamless loop */}
        {[...data, ...data].map((item, i) => (
          <div key={`${item.symbol}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-400">{item.name}</span>
            <span className="font-mono text-gray-200">
              {item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span
              className={`flex items-center ${item.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {item.changePercent >= 0 ? (
                <TrendingUp size={10} className="mr-0.5" />
              ) : (
                <TrendingDown size={10} className="mr-0.5" />
              )}
              {Math.abs(item.changePercent)}%
            </span>
            <div className="ml-4 h-1 w-1 rounded-full bg-white/10"></div>
          </div>
        ))}
      </div>

      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-32 bg-gradient-to-r from-[#09090b] via-[#09090b]/50 to-transparent"></div>
      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-32 bg-gradient-to-l from-[#09090b] via-[#09090b]/50 to-transparent"></div>
    </div>
  );
};
