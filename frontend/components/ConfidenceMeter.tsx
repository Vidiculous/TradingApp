"use client";

import { AlertCircle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

interface ConfidenceMeterProps {
  analysis: any;
  loading: boolean;
  onRunAnalysis: () => void;
}

export const ConfidenceMeter = ({ analysis, loading, onRunAnalysis }: ConfidenceMeterProps) => {
  // Determine sentiment and color
  let sentiment = "NEUTRAL";
  let color = "text-gray-400";
  let bgColor = "bg-gray-500";
  let score = 0;

  if (analysis?.action === "BUY") {
    sentiment = "BULLISH";
    color = "text-emerald-400";
    bgColor = "bg-emerald-500";
    score = 85; // Hardcoded high confidence for visual impact if not provided
    if (analysis.decision?.confidence) {
      // Parse "85%" -> 85 if available
      const parsed = parseInt(analysis.decision.confidence);
      if (!isNaN(parsed)) score = parsed;
    }
  } else if (analysis?.action === "SELL") {
    sentiment = "BEARISH";
    color = "text-red-400";
    bgColor = "bg-red-500";
    score = 85;
    if (analysis.decision?.confidence) {
      const parsed = parseInt(analysis.decision.confidence);
      if (!isNaN(parsed)) score = parsed;
    }
  } else if (analysis?.action === "WAIT") {
    sentiment = "NEUTRAL";
    color = "text-amber-400";
    bgColor = "bg-amber-500";
    score = 50;
  }

  if (!analysis && !loading) {
    return (
      <div className="glass-panel rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
            <Sparkles size={12} />
            AI INSIGHT
          </span>
          <span className="font-mono text-[10px] text-blue-400/60">OFFLINE</span>
        </div>
        <button
          onClick={onRunAnalysis}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 active:bg-blue-700"
        >
          <Sparkles size={14} />
          Run Squad
        </button>
      </div>
    );
  }

  return (
    <div
      className={`glass-panel rounded-xl border p-3 transition-all duration-500 ${analysis ? "border-white/10 bg-white/5" : "border-white/5"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`flex items-center gap-1.5 text-xs font-bold ${loading ? "animate-pulse text-gray-400" : color}`}
        >
          {loading ? (
            <>
              <Sparkles size={12} className="animate-spin" />
              ANALYZING...
            </>
          ) : (
            <>
              {sentiment === "BULLISH" ? (
                <TrendingUp size={12} />
              ) : sentiment === "BEARISH" ? (
                <TrendingDown size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
              {sentiment}
            </>
          )}
        </span>
        {analysis && !loading && (
          <span className="font-mono text-xs font-black text-white">{score}%</span>
        )}
      </div>

      {/* Meter Bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-black/40">
        {loading ? (
          <div className="animate-indeterminate-bar absolute inset-0 rounded-full bg-blue-500/50"></div>
        ) : (
          <div
            className={`h-full ${bgColor} shadow-[0_0_10px_currentColor] transition-all duration-1000 ease-out`}
            style={{ width: `${score}%` }}
          />
        )}
      </div>

      {/* Rationale Snippet */}
      {analysis && !loading && (
        <div className="mt-2 line-clamp-2 text-[10px] leading-snug text-gray-400">
          {analysis.decision?.conclusion || "Detailed analysis available below."}
        </div>
      )}
    </div>
  );
};
