import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import React from "react";

interface SignalCardProps {
  analysis: {
    signal: string;
    confidence: number;
    entry_zone?: string;
    stop_loss?: string;
    take_profit?: string;
    reasoning: string[];
    summary: string;
    model_name: string;
  };
  symbol: string;
}

export function SignalCard({ analysis, symbol }: SignalCardProps) {
  const isLong = analysis.signal === "LONG";
  const isShort = analysis.signal === "SHORT";

  // Theme logic
  const themeColor = isLong ? "emerald" : isShort ? "red" : "gray";
  const bgGradient = isLong
    ? "from-emerald-500/20 to-emerald-900/5"
    : isShort
      ? "from-red-500/20 to-red-900/5"
      : "from-gray-500/20 to-gray-900/5";

  const borderColor = isLong
    ? "border-emerald-500/20"
    : isShort
      ? "border-red-500/20"
      : "border-gray-500/20";
  const glowColor = isLong ? "bg-emerald-500/20" : isShort ? "bg-red-500/20" : "bg-gray-500/20";
  const textColor = isLong ? "text-emerald-400" : isShort ? "text-red-400" : "text-gray-400";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${borderColor} bg-gradient-to-br ${bgGradient} backdrop-blur-xl transition-all duration-300 hover:shadow-xl`}
    >
      {/* Header Badge */}
      <div className="absolute right-0 top-0 p-4">
        <div
          className={`rounded-full border px-4 py-1.5 ${borderColor} flex items-center gap-2 bg-black/40 shadow-lg backdrop-blur-md`}
        >
          <div
            className={`h-2 w-2 rounded-full ${isLong ? "bg-emerald-400" : isShort ? "bg-red-500" : "bg-gray-400"}`}
          />
          <span className={`text-sm font-bold tracking-wider ${textColor}`}>{analysis.signal}</span>
          <span className="border-l border-gray-700 pl-2 text-xs text-gray-500">
            {(analysis.confidence * 100).toFixed(0)}% Conf.
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Title Section */}
        <div className="mb-6">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gray-400">
            <BadgeCheck size={16} className={textColor} />
            AI Trade Setup
          </h3>
          <p className="max-w-[85%] text-sm font-medium leading-relaxed text-white opacity-90">
            {analysis.summary}
          </p>
        </div>

        {/* Trade Zones Grid */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3">
            <div
              className={`absolute left-0 top-0 h-full w-1 ${isLong ? "bg-emerald-500" : "bg-blue-500"} opacity-50`}
            />
            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Target size={10} /> Entry
            </div>
            <div className="font-bold tracking-tight text-white">
              {analysis.entry_zone || "N/A"}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3">
            <div className="absolute left-0 top-0 h-full w-1 bg-red-500 opacity-50" />
            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <ShieldAlert size={10} /> Stop
            </div>
            <div className="font-bold tracking-tight text-white">{analysis.stop_loss || "N/A"}</div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3">
            <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500 opacity-50" />
            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <TrendingUp size={10} /> Target
            </div>
            <div className="font-bold tracking-tight text-white">
              {analysis.take_profit || "N/A"}
            </div>
          </div>
        </div>

        {/* Reasoning List */}
        <div className="space-y-2">
          {analysis.reasoning.map((reason, i) => (
            <div key={i} className="group flex items-start gap-3 text-sm text-gray-300">
              <CheckCircle2
                size={16}
                className={`mt-0.5 ${textColor} opacity-60 transition-opacity group-hover:opacity-100`}
              />
              <span>{reason}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-[10px] text-gray-600">
          <span>Model: {analysis.model_name}</span>
          <span className="flex items-center gap-1">
            <AlertTriangle size={10} /> Not financial advice
          </span>
        </div>
      </div>
    </div>
  );
}
