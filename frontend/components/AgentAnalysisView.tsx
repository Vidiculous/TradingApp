"use client";

import {
  BarChart3,
  Clock,
  HelpCircle,
  MessageSquare,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

import { AgentChatModal } from "./AgentChatModal";

interface AgentAnalysisViewProps {
  symbol: string;
  analysis: any;
  loading: boolean;
  onRunAnalysis: (horizon: string) => void;
  onHorizonChange?: (horizon: string) => void;
}

export const AgentAnalysisView = ({
  symbol,
  analysis,
  loading,
  onRunAnalysis,
  onHorizonChange,
}: AgentAnalysisViewProps) => {
  const [horizon, setHorizon] = useState("Swing");
  const [selectedAgent, setSelectedAgent] = useState<any>(null); // For chat

  const handleRun = () => {
    onRunAnalysis(horizon);
  };

  const agents = [
    {
      id: "chartist",
      name: "Chartist",
      icon: BarChart3,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      id: "quant",
      name: "Quant",
      icon: Clock,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      id: "scout",
      name: "Scout",
      icon: Search,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      id: "fundamentalist",
      name: "Fundamentalist",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
        <div className="flex gap-2 rounded-lg bg-black/20 p-1.5">
          {[
            {
              id: "Scalp",
              desc: "Intraday (1m-5m charts). Focus on rapid price fluctuations and immediate execution.",
            },
            {
              id: "Swing",
              desc: "Intermediate (1H-1D charts). Focus on multi-day trends and structural movements.",
            },
            {
              id: "Invest",
              desc: "Long-term (Daily/Weekly charts). Focus on fundamental value and multi-month growth.",
            },
          ].map((h) => (
            <div key={h.id} className="group/tooltip relative">
              <button
                onClick={() => {
                  setHorizon(h.id);
                  if (onHorizonChange) onHorizonChange(h.id);
                }}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-all ${horizon === h.id
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
                  }`}
              >
                {h.id}
                <HelpCircle
                  size={10}
                  className="opacity-40 transition-opacity group-hover/tooltip:opacity-100"
                />
              </button>

              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 translate-y-2 rounded-lg border border-white/10 bg-gray-900 p-2 text-[10px] text-gray-300 opacity-0 shadow-2xl transition-all group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100">
                {h.desc}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Sparkles size={16} className="animate-spin" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          {loading ? "Analyzing..." : "Run Squad"}
        </button>
      </div>

      {/* Results Area */}
      {analysis ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
          {/* Executioner Summary */}
          <div className="glass-panel group relative overflow-hidden rounded-3xl border-l-4 border-l-emerald-500 p-6 shadow-xl">
            <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl transition-all group-hover:bg-emerald-500/10"></div>
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/20 p-2">
                  <Users size={20} className="text-emerald-400" />
                </div>
                <h4 className="text-lg font-bold text-white">Executioner's Verdict</h4>
              </div>
              <span
                className={`rounded-lg border px-3 py-1 text-xs font-bold ${analysis.action === "BUY"
                  ? "border-emerald-500/20 bg-emerald-500/20 text-emerald-400"
                  : analysis.action === "SELL"
                    ? "border-red-500/20 bg-red-500/20 text-red-400"
                    : "border-gray-500/20 bg-gray-500/20 text-gray-400"
                  }`}
              >
                {analysis.action}
              </span>
            </div>
            <div className="max-w-3xl space-y-4 text-base leading-relaxed text-gray-300">
              {analysis.decision?.error ||
                (analysis.squad_details &&
                  Object.values(analysis.squad_details).some((s: any) => s.error)) ? (
                <div className="space-y-1">
                  <span className="mb-2 flex items-center gap-1.5 text-sm font-bold text-orange-400">
                    <ShieldAlert size={14} /> Partial Report: Quota limits reached.
                  </span>
                  {analysis.decision?.conclusion && (
                    <p className="text-lg font-bold text-white">{analysis.decision.conclusion}</p>
                  )}
                  <p>
                    {analysis.decision?.rationale ||
                      analysis.decision?.reasoning ||
                      "Synthesis generated based on available squad data."}
                  </p>
                </div>
              ) : (
                <>
                  {analysis.decision?.conclusion && (
                    <p className="text-lg font-bold text-white">{analysis.decision.conclusion}</p>
                  )}
                  <p>
                    {analysis.decision?.rationale ||
                      analysis.decision?.reasoning ||
                      "Consolidating analysis..."}
                  </p>

                  {/* Trade Details (Target/Stop) */}
                  <div className="flex gap-6 pt-2">
                    {(analysis.decision?.target || analysis.target) && (
                      <div className="flex flex-col">
                        <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Target Price
                        </span>
                        <span className="font-mono text-lg font-bold text-emerald-400">
                          ${analysis.decision?.target || analysis.target}
                        </span>
                      </div>
                    )}
                    {(analysis.decision?.stop_loss || analysis.stop_loss) && (
                      <div className="flex flex-col">
                        <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Stop Loss
                        </span>
                        <span className="font-mono text-lg font-bold text-red-400">
                          ${analysis.decision?.stop_loss || analysis.stop_loss}
                        </span>
                      </div>
                    )}
                    {analysis.decision?.trade_type && (
                      <div className="flex flex-col">
                        <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Strategy
                        </span>
                        <span className="text-lg font-bold text-blue-400">
                          {analysis.decision?.trade_type}
                        </span>
                      </div>
                    )}
                    {(analysis.decision?.intended_timeframe || analysis.intended_timeframe) && (
                      <div className="flex flex-col">
                        <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Intended Timeframe
                        </span>
                        <span className="text-lg font-bold text-orange-400">
                          {analysis.decision?.intended_timeframe || analysis.intended_timeframe}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Executioner Chat Button */}
                  <div className="pt-2">
                    <button
                      onClick={() =>
                        setSelectedAgent({
                          id: "executioner",
                          name: "Executioner",
                          icon: Users,
                          color: "text-emerald-400",
                          result: analysis,
                        })
                      }
                      className="group flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
                    >
                      <MessageSquare
                        size={14}
                        className="transition-transform group-hover:scale-110"
                      />
                      Chat with Executioner
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Agent Grid */}
          <div className="grid grid-cols-2 gap-4">
            {agents.map((agent) => {
              const result = analysis.squad_details?.[agent.id.toLowerCase()];
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent({ ...agent, result })}
                  className={`glass-panel group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all hover:border-white/20 ${agent.border} hover:shadow-lg`}
                >
                  <div
                    className={`absolute right-0 top-0 p-3 opacity-0 transition-opacity group-hover:opacity-100`}
                  >
                    <MessageSquare size={16} className={agent.color} />
                  </div>

                  <div className="mb-3 flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${agent.bg}`}>
                      <agent.icon size={18} className={agent.color} />
                    </div>
                    <span className={`text-sm font-bold ${agent.color}`}>{agent.name}</span>
                  </div>

                  <div className="line-clamp-3 text-xs leading-relaxed text-gray-400">
                    {result ? (
                      <>
                        <span className="mb-1.5 block text-sm font-bold text-white">
                          {result.conclusion || result.signal || "Analysis Complete"}
                        </span>
                        {result.summary ||
                          result.reasoning ||
                          result.rationale ||
                          "View details..."}
                      </>
                    ) : (
                      "Waiting for input..."
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-gray-600">
          <Users size={48} className="mx-auto mb-4 opacity-20" />
          <p>Select a horizon and deploy your AI Squad.</p>
        </div>
      )}

      {/* Chat Modal */}
      {selectedAgent && (
        <AgentChatModal
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
          agent={selectedAgent}
          initialContext={analysis}
        />
      )}
    </div>
  );
};
