"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

interface OrderLevel {
  price: number;
  size: number;
}

interface OrderBookData {
  symbol: string;
  bids: OrderLevel[];
  asks: OrderLevel[];
}

export const OrderBook = ({ symbol, currentPrice }: { symbol: string; currentPrice?: number }) => {
  const [data, setData] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBook = async () => {
    try {
      const res = await fetch(`/api/market/orderbook/${symbol}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch order book", error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for updates to simulate liveness
  useEffect(() => {
    fetchBook();
    const interval = setInterval(fetchBook, 3000);
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading || !data) return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;

  // Calculate max size for depth bars
  const maxBidSize = Math.max(...data.bids.map((b) => b.size));
  const maxAskSize = Math.max(...data.asks.map((a) => a.size));
  const maxSize = Math.max(maxBidSize, maxAskSize);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-500">BID</span>
        <span className="text-xs font-bold text-gray-500">ASK</span>
      </div>

      <div className="flex h-full min-h-[300px] gap-1 font-mono text-xs">
        {/* BIDS SIDE (Green) */}
        <div className="flex flex-1 flex-col gap-[1px]">
          {data.bids.map((bid, i) => (
            <div
              key={i}
              className="group relative flex items-center justify-between px-2 py-1 hover:bg-emerald-500/10"
            >
              {/* Depth Bar */}
              <div
                className="absolute right-0 top-0 h-full bg-emerald-500/10 transition-all duration-500"
                style={{ width: `${(bid.size / maxSize) * 100}%` }}
              />

              <span className="relative z-10 text-gray-400">{bid.size}</span>
              <span className="relative z-10 font-bold text-emerald-400">
                {bid.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* ASKS SIDE (Red) */}
        <div className="flex flex-1 flex-col gap-[1px]">
          {data.asks.map((ask, i) => (
            <div
              key={i}
              className="group relative flex items-center justify-between px-2 py-1 hover:bg-red-500/10"
            >
              {/* Depth Bar */}
              <div
                className="absolute left-0 top-0 h-full bg-red-500/10 transition-all duration-500"
                style={{ width: `${(ask.size / maxSize) * 100}%` }}
              />

              <span className="relative z-10 font-bold text-red-400">{ask.price.toFixed(2)}</span>
              <span className="relative z-10 text-gray-400">{ask.size}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-gray-600">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></div>
        Live L2 Data Stream (Simulated)
      </div>
    </div>
  );
};
