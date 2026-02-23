"use client";

import { List } from "lucide-react";
import { useEffect, useState } from "react";

interface Trade {
  id: string;
  time: string;
  price: number;
  size: number;
  side: "buy" | "sell";
}

export const TimeAndSales = ({ symbol }: { symbol: string }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTape = async () => {
    try {
      const res = await fetch(`/api/market/tape/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setTrades(data?.trades || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch tape", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTape();
    const interval = setInterval(fetchTape, 1000); // 1s polling for "Tape" feel
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading || !trades.length)
    return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <table className="w-full border-collapse text-left font-mono text-xs">
        <thead className="sticky top-0 z-10 bg-[#09090b] font-bold text-gray-500">
          <tr>
            <th className="pb-2 pl-2">Time</th>
            <th className="pb-2 text-right">Price</th>
            <th className="pb-2 pr-2 text-right">Size</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="transition-colors hover:bg-white/5">
              <td className="py-1 pl-2 text-gray-400">{trade.time}</td>
              <td
                className={`py-1 text-right font-bold ${trade.side === "buy" ? "text-emerald-400" : "text-red-400"}`}
              >
                {trade.price.toFixed(2)}
              </td>
              <td
                className={`py-1 pr-2 text-right ${trade.size > 1000 ? "font-bold text-yellow-400" : "text-gray-300"}`}
              >
                {trade.size}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-gray-600">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
        Real-time Prints
      </div>
    </div>
  );
};
