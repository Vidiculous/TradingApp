"use client";

import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

interface OverviewItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface OverviewData {
  indices: OverviewItem[];
  sectors: OverviewItem[];
}

import { API_BASE_URL } from "@/utils/config";

export const MarketHeatmap = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market/overview`);
        const json = await res.json();
        if (json.indices && json.sectors) {
          setData(json);
        }
      } catch (e) {
        console.error("Failed to load market overview", e);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  const getColor = (percent: number) => {
    if (percent > 0) {
      if (percent > 2) return "bg-emerald-500";
      if (percent > 1) return "bg-emerald-500/80";
      return "bg-emerald-500/40";
    } else if (percent < 0) {
      if (percent < -2) return "bg-red-500";
      if (percent < -1) return "bg-red-500/80";
      return "bg-red-500/40";
    }
    return "bg-gray-500/20";
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-2xl bg-white/5">
        <Activity className="animate-spin opacity-20" size={32} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Indices Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {data.indices.map((idx) => (
          <div
            key={idx.symbol}
            className="glass-panel group flex cursor-default items-center justify-between rounded-xl p-4 transition-all hover:bg-white/5"
          >
            <div>
              <h4 className="text-xs font-bold text-gray-400">{idx.name}</h4>
              <p className="font-mono text-lg font-bold text-white">{idx.symbol}</p>
            </div>
            <div
              className={`flex flex-col items-end ${idx.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              <span className="flex items-center font-mono text-sm font-bold">
                {idx.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(idx.changePercent)}%
              </span>
              <span className="text-[10px] opacity-70">{idx.price.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sectors Heatmap */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-white">
          <Activity size={16} className="text-blue-400" />
          Sector Heatmap
        </h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {data.sectors.map((sec) => (
            <div
              key={sec.symbol}
              className={`flex min-h-[100px] cursor-default flex-col items-center justify-center rounded-lg p-3 text-center transition-all hover:brightness-110 ${getColor(sec.changePercent)}`}
            >
              <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
                {sec.name.replace("Cons. ", "").replace("Svcs", "").replace("Real Estate", "RE")}
              </span>
              <span className="font-mono text-lg font-black text-white">{sec.symbol}</span>
              <span className="mt-1 rounded bg-black/20 px-2 py-0.5 text-sm font-bold text-white">
                {sec.changePercent > 0 ? "+" : ""}
                {sec.changePercent}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
