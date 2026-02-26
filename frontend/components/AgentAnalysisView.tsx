"use client";

import {
  BarChart3,
  Clock,
  HelpCircle,
  MessageSquare,
  Play,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

import type { AIAnalysis, AgentResult } from "@/types/api";
import { AgentChatModal } from "./AgentChatModal";
import { LLMSettingsModal } from "./LLMSettingsModal";

interface AgentAnalysisViewProps {
  symbol: string;
  analysis: AIAnalysis | null;
  loading: boolean;
  onRunAnalysis: (horizon: string, autonomous: boolean, usePortfolio: boolean) => void;
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
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; icon: any; color: string; bg?: string; result?: any } | null>(null); // For chat
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [usePortfolio, setUsePortfolio] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const handleRun = () => {
    onRunAnalysis(horizon, autonomousMode, usePortfolio);
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
    {
      id: "analyst",
      name: "Analyst",
      icon: Sparkles,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      id: "risk_officer",
      name: "Risk Officer",
      icon: ShieldAlert,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
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

        <div className="flex items-center gap-4">
          {/* Autonomous Toggle */}
          <div className="flex items-center gap-2 border-r border-white/10 pr-4">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={autonomousMode}
                onChange={(e) => setAutonomousMode(e.target.checked)}
              />
              <div className="peer h-5 w-9 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Auto-Trader</span>
            </label>
          </div>

          {/* Portfolio Awareness Toggle */}
          <div className="flex items-center gap-2 border-r border-white/10 pr-4">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={usePortfolio}
                onChange={(e) => setUsePortfolio(e.target.checked)}
              />
              <div className="peer h-5 w-9 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
              <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Portfolio Context
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
              title="AI Engine Settings"
            >
              <Settings size={18} />
            </button>

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
        </div>
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

            {analysis.execution_status && (
              <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <Play size={14} />
                  <span className="text-xs font-bold uppercase tracking-widest">Auto-Trade System</span>
                </div>
                <p className="mt-1 text-sm font-medium text-white">{analysis.execution_status}</p>
              </div>
            )}

            {/* Error / Partial Report Warning */}
            {(analysis.decision?.error ||
              (analysis.squad_details &&
                Object.values(analysis.squad_details).some((s: any) => s.error))) && (
                <div className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-orange-400">
                    <ShieldAlert size={16} />
                    <span className="text-sm font-bold uppercase tracking-widest">Partial Report Warning</span>
                  </div>
                  <div className="space-y-1">
                    {analysis.decision?.error && (
                      <p className="text-xs text-orange-300/80">
                        <span className="font-bold">Executioner:</span> {analysis.decision.error}
                      </p>
                    )}
                    {Object.entries(analysis.squad_details || {}).map(([id, result]: [string, any]) =>
                      result.error ? (
                        <p key={id} className="text-xs text-orange-300/80">
                          <span className="font-bold uppercase">{id}:</span> {result.error}
                        </p>
                      ) : null
                    )}
                  </div>
                </div>
              )}

            <div className="max-w-3xl space-y-4 text-base leading-relaxed text-gray-300">
              {analysis.decision?.conclusion && (
                <p className="text-lg font-bold text-white">{analysis.decision.conclusion}</p>
              )}
              <p>
                {analysis.decision?.reasoning || "Synthesis generated based on available squad data."}
              </p>

              {/* Trade Details */}
              <div className="flex flex-wrap gap-6 pt-2">
                {analysis.decision?.target && (
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Target Price
                    </span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      ${analysis.decision.target}
                    </span>
                  </div>
                )}
                {analysis.decision?.stop_loss && (
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      Stop Loss
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-lg font-bold text-red-400">
                        ${analysis.decision.stop_loss}
                      </span>
                      {analysis.decision?.sl_type && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${analysis.decision.sl_type === "trailing"
                          ? "bg-orange-500/20 text-orange-400"
                          : analysis.decision.sl_type === "scaled"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-gray-500/20 text-gray-400"
                          }`}>
                          {analysis.decision.sl_type}
                        </span>
                      )}
                    </div>
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
                {(() => {
                  const holdTime = analysis.decision?.intended_timeframe
                    || (analysis.decision as any)?.hold_time;
                  return holdTime ? (
                    <div className="flex flex-col">
                      <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Hold Time
                      </span>
                      <span className="text-lg font-bold text-orange-400">{holdTime}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Stop-loss mode explanation + Scaled exit levels */}
              {analysis.decision?.sl_type && analysis.decision.sl_type !== "fixed" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* SL mode pill */}
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${analysis.decision.sl_type === "trailing"
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                      : "border-purple-500/30 bg-purple-500/10 text-purple-300"
                    }`}>
                    <span className="font-bold uppercase tracking-wider opacity-70 text-[9px]">
                      {analysis.decision.sl_type === "trailing" ? "Trailing SL" : "Scaled SL"}
                    </span>
                    <span>
                      {analysis.decision.sl_type === "trailing"
                        ? "Stop trails price — locks in gains as trade moves in your favour"
                        : `SL moves to breakeven once TP1 ($${analysis.decision.target ?? "—"}) is hit`
                      }
                    </span>
                  </div>

                  {/* Scaled exit pills (only when multiple targets exist) */}
                  {(analysis.decision.target_2 || analysis.decision.target_3) && (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">›› exits:</span>
                      {analysis.decision.target && (
                        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                          TP1 $ {analysis.decision.target}
                          {analysis.decision.target_2 && (
                            <span className="ml-1 font-normal text-emerald-600">
                              · {Math.round((1 - (analysis.decision.target_2_pct ?? 0) - (analysis.decision.target_3_pct ?? 0)) * 100)}%
                            </span>
                          )}
                        </span>
                      )}
                      {analysis.decision.target_2 && (
                        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                          TP2 $ {analysis.decision.target_2}
                          {analysis.decision.target_2_pct && (
                            <span className="ml-1 font-normal text-emerald-600">
                              · {Math.round(analysis.decision.target_2_pct * 100)}%
                            </span>
                          )}
                        </span>
                      )}
                      {analysis.decision.target_3 && (
                        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                          TP3 $ {analysis.decision.target_3}
                          {analysis.decision.target_3_pct && (
                            <span className="ml-1 font-normal text-emerald-600">
                              · {Math.round(analysis.decision.target_3_pct * 100)}%
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
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

                  <div className="line-clamp-6 text-xs leading-relaxed text-gray-400">
                    {result ? (
                      <>
                        <span className="mb-1.5 block text-sm font-bold text-white">
                          {String(result.conclusion || result.signal || "Analysis Complete")}
                        </span>
                        {String(
                          result.summary ||
                          result.reasoning ||
                          result.rationale ||
                          "View details..."
                        )}
                      </>
                    ) : (
                      "Waiting for input..."
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chronos ML Signal Card */}
          {(() => {
            const ml = analysis.squad_details?.quant?.ml_signal as Record<string, unknown> | undefined;
            if (!ml || (ml.skipped as boolean)) return null;

            const dir = ml.direction as string;
            const prob = ml.probability as number;
            const conf = ml.confidence as string;
            const median = ml.median_forecast as number | undefined;
            const range = ml.range_q10_q90 as [number, number] | undefined;
            const steps = ml.forecast_steps as number | undefined;
            const horizonLabel =
              steps === 1  ? "~intraday" :
              steps === 5  ? "~1 week ahead" :
              steps === 20 ? "~1 month ahead" :
              steps !== undefined ? `${steps} bars ahead` : "probabilistic forecast";

            const isUp = dir === "UP";
            const confColor =
              conf === "HIGH" ? "text-emerald-400" :
              conf === "MEDIUM" ? "text-yellow-400" :
              "text-gray-400";
            const confBg =
              conf === "HIGH" ? "bg-emerald-500/10 border-emerald-500/20" :
              conf === "MEDIUM" ? "bg-yellow-500/10 border-yellow-500/20" :
              "bg-gray-500/10 border-gray-500/20";
            const dirColor = isUp ? "text-emerald-400" : "text-red-400";
            const dirBg = isUp ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20";

            return (
              <div className="glass-panel overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-violet-500/15 p-2">
                      <Sparkles size={18} className="text-violet-400" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-violet-300">Chronos-T5 ML Signal</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Zero-shot time series model · {horizonLabel}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-violet-400">
                    Pattern Momentum
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Direction pill */}
                  <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${dirBg}`}>
                    {isUp
                      ? <TrendingUp size={16} className={dirColor} />
                      : <TrendingDown size={16} className={dirColor} />
                    }
                    <span className={`text-sm font-bold ${dirColor}`}>{dir}</span>
                  </div>

                  {/* Probability */}
                  <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Probability</span>
                    <span className="font-mono text-lg font-bold text-white">{(prob * 100).toFixed(1)}%</span>
                  </div>

                  {/* Confidence */}
                  <div className={`flex flex-col rounded-xl border px-4 py-2 ${confBg}`}>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Confidence</span>
                    <span className={`text-sm font-bold ${confColor}`}>{conf}</span>
                  </div>

                  {/* Median forecast */}
                  {median !== undefined && (
                    <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Median Target</span>
                      <span className="font-mono text-sm font-bold text-white">${median.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Q10–Q90 range */}
                  {range && (
                    <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Q10–Q90 Range</span>
                      <span className="font-mono text-sm font-bold text-white">
                        ${range[0].toFixed(2)} – ${range[1].toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
                  General-purpose time series model — no news or macro awareness. Use as a momentum/pattern signal alongside indicator confluence.
                </p>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-gray-600">
          <Users size={48} className="mx-auto mb-4 opacity-20" />
          <p>Select a horizon and deploy your AI Squad.</p>
        </div>
      )}

      {/* Settings Modal */}
      <LLMSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

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
