"use client";

import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";

interface AnalysisPlaceholderProps {
  symbol: string;
  onAnalysisGenerated: (analysis: any) => void;
}

export function AnalysisPlaceholder({ symbol, onAnalysisGenerated }: AnalysisPlaceholderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ticker/${symbol}/analyze`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Analysis failed");
      }
      const data = await res.json();
      onAnalysisGenerated(data);
    } catch (err) {
      setError("Failed to generate analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel relative flex flex-col items-center overflow-hidden rounded-2xl p-8 text-center">
      <div className="pointer-events-none absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-emerald-500/5 blur-[80px]"></div>

      <div className="relative mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]">
        <Bot size={32} className="text-emerald-400" />
      </div>

      <h3 className="mb-3 text-xl font-bold text-white">AI Market Analysis</h3>
      <p className="mb-8 max-w-sm leading-relaxed text-gray-400">
        Generate real-time market insights and sentiment analysis for{" "}
        <span className="font-medium text-emerald-400">{symbol}</span> using Gemini AI.
      </p>

      {error && (
        <div className="animate-fade-in mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:from-emerald-500 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0"></div>
        <div className="relative flex items-center gap-2">
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} className="group-hover:animate-pulse" />
              <span>Generate Insight</span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}
