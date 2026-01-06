"use client";

import { Activity, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface PeerCorrelation {
  symbol: string;
  correlation: number;
  relative_perf_5d: number;
}

interface SectorData {
  symbol: string;
  peers: PeerCorrelation[];
  ai_analysis: string;
}

export const SectorCorrelation = ({ symbol }: { symbol: string }) => {
  const [data, setData] = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSector = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analysis/sector/${symbol}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSector();
  }, [symbol]);

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;
  if (!data || !data.peers)
    return <div className="py-10 text-center text-gray-500">No sector data available</div>;

  return (
    <div className="flex h-full flex-col">
      {/* AI Vibe Check */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
        <Zap className="mt-1 shrink-0 text-purple-400" size={16} />
        <div>
          <div className="mb-1 text-xs font-bold text-purple-400">SECTOR VIBE</div>
          <div className="text-sm leading-snug text-gray-200">{data.ai_analysis}</div>
        </div>
      </div>

      {/* Matrix / List */}
      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2">
        {data.peers.map((peer) => {
          // Color Logic
          let colorClass = "bg-gray-500";
          let textColor = "text-gray-400";

          if (peer.correlation > 0.8) {
            colorClass = "bg-emerald-500";
            textColor = "text-emerald-400";
          } else if (peer.correlation > 0.5) {
            colorClass = "bg-yellow-500";
            textColor = "text-yellow-400";
          } else if (peer.correlation < -0.5) {
            colorClass = "bg-red-500";
            textColor = "text-red-400";
          }

          return (
            <div
              key={peer.symbol}
              className="group flex items-center justify-between rounded-lg bg-white/5 p-3"
            >
              <div className="flex w-1/3 items-center gap-3">
                <span className="font-bold text-white">{peer.symbol}</span>
              </div>

              <div className="flex-1 px-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500">Correlation</span>
                  <span className={textColor}>{peer.correlation}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${Math.abs(peer.correlation) * 100}%` }}
                  />
                </div>
              </div>

              <div className="w-1/4 text-right">
                <div className="text-[10px] uppercase text-gray-500">Alpha (5d)</div>
                <div
                  className={`text-xs font-bold ${peer.relative_perf_5d > 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {peer.relative_perf_5d > 0 ? "+" : ""}
                  {peer.relative_perf_5d}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
