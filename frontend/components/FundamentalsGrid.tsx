"use client";

import { useState } from "react";

import { formatCompactNumber, formatCurrency } from "../utils/format";
import { SectorCorrelation } from "./SectorCorrelation";

interface FundamentalsGridProps {
  fundamentals: {
    marketCap: number;
    peRatio?: number;
    week52High: number;
    week52Low: number;
  };
  symbol: string;
  currency: string;
}

export const FundamentalsGrid = ({ fundamentals, symbol, currency }: FundamentalsGridProps) => {
  const [activeTab, setActiveTab] = useState<"FUNDAMENTALS" | "SECTOR">("FUNDAMENTALS");

  const items = [
    { label: "Market Cap", value: formatCompactNumber(fundamentals.marketCap, currency) },
    { label: "P/E Ratio", value: fundamentals.peRatio?.toFixed(2) || "-" },
    { label: "52W High", value: formatCurrency(fundamentals.week52High, currency) },
    { label: "52W Low", value: formatCurrency(fundamentals.week52Low, currency) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab("FUNDAMENTALS")}
          className={`pb-1 text-sm font-bold transition-colors ${activeTab === "FUNDAMENTALS" ? "border-b-2 border-emerald-400 text-emerald-400" : "text-gray-500 hover:text-white"}`}
        >
          Key Stats
        </button>
        <button
          onClick={() => setActiveTab("SECTOR")}
          className={`pb-1 text-sm font-bold transition-colors ${activeTab === "SECTOR" ? "border-b-2 border-purple-400 text-purple-400" : "text-gray-500 hover:text-white"}`}
        >
          Sector Matrix
        </button>
      </div>

      {activeTab === "FUNDAMENTALS" && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="glass-panel group flex flex-col items-center justify-center rounded-2xl p-6 text-center transition-transform duration-300 hover:scale-[1.02]"
            >
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition-colors group-hover:text-emerald-400">
                {item.label}
              </div>
              <div className="text-xl font-bold text-gray-200 transition-colors group-hover:text-white">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "SECTOR" && (
        <div className="glass-panel h-[250px] rounded-2xl p-4">
          <SectorCorrelation symbol={symbol} />
        </div>
      )}
    </div>
  );
};
