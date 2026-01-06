"use client";

import { Bot, Minus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

interface AIAnalysis {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  model_name?: string;
}

interface AnalysisCardProps {
  analysis: AIAnalysis;
  symbol: string;
}

export function AnalysisCard({ analysis: initialAnalysis, symbol }: AnalysisCardProps) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/ticker/${symbol}/analyze`, { method: "POST" });
      if (res.ok) {
        const newAnalysis = await res.json();
        setAnalysis(newAnalysis);
      }
    } catch (error) {
      console.error("Failed to refresh analysis", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case "bullish":
        return {
          container:
            "border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]",
          icon: <TrendingUp size={18} className="text-emerald-400" />,
          label: "Bullish",
          labelClass: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
          progress: "bg-gradient-to-r from-emerald-500 to-emerald-400",
        };
      case "bearish":
        return {
          container: "border-red-500/20 bg-red-500/5 shadow-[0_0_20px_-5px_rgba(239,68,68,0.15)]",
          icon: <TrendingDown size={18} className="text-red-400" />,
          label: "Bearish",
          labelClass: "text-red-300 bg-red-500/10 border-red-500/20",
          progress: "bg-gradient-to-r from-red-500 to-red-400",
        };
      default:
        return {
          container: "border-gray-500/20 bg-gray-500/5",
          icon: <Minus size={18} className="text-gray-400" />,
          label: "Neutral",
          labelClass: "text-gray-300 bg-gray-500/10 border-gray-500/20",
          progress: "bg-gradient-to-r from-gray-500 to-gray-400",
        };
    }
  };

  const config = getSentimentConfig(analysis.sentiment);

  return (
    <div
      className={`glass-card-subtle mt-4 rounded-2xl border p-6 transition-all ${config.container}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1">
            <Bot size={14} className="text-blue-400" />
            <div className="font-mono text-xs uppercase tracking-wider text-blue-200/80">
              {analysis.model_name || "Gemini AI"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${config.labelClass}`}
          >
            {config.icon}
            {config.label}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`rounded-xl border border-transparent p-2 text-gray-500 transition-all duration-300 hover:border-white/10 hover:bg-white/10 hover:text-white ${isRefreshing ? "animate-spin" : ""}`}
            title="Reload Analysis"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <p className="mb-6 text-base font-light leading-7 text-gray-300">{analysis.summary}</p>

      {/* Confidence Bar */}
      <div className="mt-auto flex items-center gap-3">
        <span className="min-w-[80px] text-xs font-medium uppercase tracking-widest text-gray-500">
          Confidence
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full ${config.progress} rounded-full transition-all duration-1000`}
            style={{ width: `${analysis.confidence * 100}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs font-bold text-gray-400">
          {(analysis.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
