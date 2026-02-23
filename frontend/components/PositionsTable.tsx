"use client";

import { Briefcase, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "../utils/format";

interface Position {
  symbol: string;
  quantity: number;
  average_cost: number;
  stop_loss?: any; // Object {type, value, ...}
  take_profit?: number;
  tp_config?: any; // Advanced TP
  currency?: string;
}

interface Portfolio {
  cash: number;
  holdings: Record<string, Position>;
  history: any[];
}

export const PositionsTable = ({
  onRefresh,
  currentPrice,
  activeSymbol,
}: {
  onRefresh?: number;
  currentPrice?: number;
  activeSymbol?: string;
}) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [dateFilter, setDateFilter] = useState("");

  const [editingSl, setEditingSl] = useState<{
    symbol: string;
    value: number;
    type: string;
  } | null>(null);
  const [editingTp, setEditingTp] = useState<{ symbol: string; value: number } | null>(null);
  const [lastHistoryId, setLastHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (portfolio?.history && portfolio.history.length > 0) {
      const latestAction = portfolio.history[portfolio.history.length - 1];

      // Only notify if it's a new item we haven't seen since this session started or since last update
      if (lastHistoryId && latestAction.id !== lastHistoryId) {
        // Check if it's an auto-execution (SELL with realized pnl but not manual delete)
        // We'd ideally want the backend to tag the reason, but we can infer it.
        // For now, let's assume any SELL that happens 'lazily' during a sync is what we want.
        if (latestAction.side === "SELL" && latestAction.timestamp) {
          const timeDiff = new Date().getTime() - new Date(latestAction.timestamp).getTime();
          if (timeDiff < 10000) {
            // If it happened in the last 10 seconds
            new Notification(`Trade Executed: ${latestAction.symbol}`, {
              body: `${latestAction.side} ${latestAction.qty} shares at $${latestAction.price}. P&L: $${(latestAction.realized_pnl ?? 0).toFixed(2)}`,
            });
          }
        }
      }
      setLastHistoryId(latestAction.id);
    }
  }, [portfolio?.history]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/paper/portfolio");
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (error) {
      console.error("Failed to fetch portfolio", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = async () => {
    if (!editingTp) return;
    try {
      await fetch("/api/paper/stop-loss", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: editingTp.symbol,
          take_profit: editingTp.value,
        }),
      });
      setEditingTp(null);
      fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };
  const updateStopLoss = async () => {
    if (!editingSl) return;
    try {
      await fetch("/api/paper/stop-loss", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: editingSl.symbol,
          stop_loss: {
            type: editingSl.type,
            value: editingSl.value,
            initial_value: editingSl.value,
          },
        }),
      });
      setEditingSl(null);
      fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };

  const deletePosition = async (symbol: string) => {
    try {
      await fetch(`/api/paper/position/${symbol}`, { method: "DELETE" });
      fetchPortfolio(); // Refresh
    } catch (e) {
      console.error(e);
    }
  };

  const deleteHistoryItem = async (itemId: string) => {
    try {
      await fetch(`/api/paper/history/${itemId}`, { method: "DELETE" });
      fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = async () => {
    if (!confirm("Are you sure you want to CLEAR ALL trade history? This cannot be undone."))
      return;
    try {
      await fetch("/api/paper/history", { method: "DELETE" });
      fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };

  const closeAllPositions = async () => {
    if (!confirm("Are you sure you want to CLOSE ALL positions? This cannot be undone.")) return;

    try {
      await fetch("/api/paper/reset", { method: "POST" });
      fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [onRefresh]);

  const holdingsList = useMemo(() => {
    if (!portfolio?.holdings) return [];
    return Object.entries(portfolio.holdings).map(([symbol, pos]) => ({
      ...pos,
      symbol,
    }));
  }, [portfolio?.holdings]);

  const historyList = useMemo(() => {
    if (!portfolio?.history) return [];
    return portfolio.history
      .filter((h: any) => {
        if (!dateFilter) return true;
        return h.timestamp.startsWith(dateFilter);
      })
      .reverse();
  }, [portfolio?.history, dateFilter]);

  // Calculate portfolio metrics (memoized to avoid recomputation on every render)
  const { totalUnrealizedPnL, totalEquity, equityChangePercent, winRate, bestTrade, worstTrade } =
    useMemo(() => {
      if (!portfolio) {
        return {
          totalUnrealizedPnL: 0,
          totalEquity: 0,
          equityChangePercent: 0,
          winRate: 0,
          bestTrade: 0,
          worstTrade: 0,
        };
      }

      const unrealizedPnL = holdingsList.reduce((sum, pos) => {
        const isCurrent = pos.symbol === activeSymbol;
        const marketPrice = isCurrent ? currentPrice : pos.average_cost;
        const isShort = pos.quantity < 0;
        const pnlPerShare = isShort
          ? pos.average_cost - (marketPrice || 0)
          : (marketPrice || 0) - pos.average_cost;
        return sum + pnlPerShare * Math.abs(pos.quantity);
      }, 0);

      const equity = portfolio.cash + unrealizedPnL;
      const eqPct = portfolio.cash > 0 ? (unrealizedPnL / portfolio.cash) * 100 : 0;

      const closedTrades = portfolio.history.filter(
        (h: any) => (h.side === "SELL" || h.side === "BUY") && h.realized_pnl_usd !== undefined,
      );
      const profitableTrades = closedTrades.filter((h: any) => h.realized_pnl_usd > 0);
      const wr = closedTrades.length > 0 ? (profitableTrades.length / closedTrades.length) * 100 : 0;

      const positionPnLs = holdingsList.map((pos) => {
        const isCurrent = pos.symbol === activeSymbol;
        const marketPrice = isCurrent ? currentPrice : pos.average_cost;
        const isShort = pos.quantity < 0;
        const pnlPerShare = isShort
          ? pos.average_cost - (marketPrice || 0)
          : (marketPrice || 0) - pos.average_cost;
        return pnlPerShare * Math.abs(pos.quantity);
      });

      return {
        totalUnrealizedPnL: unrealizedPnL,
        totalEquity: equity,
        equityChangePercent: eqPct,
        winRate: wr,
        bestTrade: positionPnLs.length > 0 ? Math.max(...positionPnLs, 0) : 0,
        worstTrade: positionPnLs.length > 0 ? Math.min(...positionPnLs, 0) : 0,
      };
    }, [holdingsList, activeSymbol, currentPrice, portfolio?.cash, portfolio?.history]);

  if (loading || !portfolio) return <div className="h-40 animate-pulse rounded-3xl bg-white/5" />;

  return (
    <div className="flex h-full flex-col">
      {/* Portfolio Intelligence Dashboard */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Row 1: Primary Metrics */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Buying Power
          </span>
          <span className="font-mono text-xl font-bold text-emerald-400">
            {formatCurrency(portfolio.cash, "USD")}
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Total Equity
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-white">
              {formatCurrency(totalEquity, "USD")}
            </span>
            <span
              className={`text-xs font-bold ${totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              ({totalUnrealizedPnL >= 0 ? "+" : ""}
              {equityChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Row 2: Secondary Metrics */}
        <div className="col-span-2 grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-gray-500">
              Unrealized P&L
            </span>
            <span
              className={`font-mono text-sm font-bold ${totalUnrealizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {totalUnrealizedPnL >= 0 ? "+" : ""}
              {formatCurrency(totalUnrealizedPnL, "USD")}
            </span>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-gray-500">
              Win Rate
            </span>
            <span className="font-mono text-sm font-bold text-white">{winRate.toFixed(0)}%</span>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-gray-500">
              Best Position
            </span>
            <span className="font-mono text-sm font-bold text-emerald-400">
              {bestTrade > 0 ? "+" : ""}
              {formatCurrency(bestTrade, "USD")}
            </span>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-gray-500">
              Worst Position
            </span>
            <span className="font-mono text-sm font-bold text-red-400">
              {formatCurrency(worstTrade, "USD")}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 border-b border-white/5">
        <button
          onClick={() => setActiveTab("active")}
          className={`relative pb-2 text-xs font-bold transition-all ${activeTab === "active" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}
        >
          ACTIVE
          {activeTab === "active" && (
            <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`relative pb-2 text-xs font-bold transition-all ${activeTab === "history" ? "text-white" : "text-gray-500 hover:text-gray-400"}`}
        >
          HISTORY
          {activeTab === "history" && (
            <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" />
          )}
        </button>

        <div className="flex-1" />

        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={closeAllPositions}
            className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/20"
            title="Liquidate All Positions"
          >
            Reset
          </button>
          <button
            onClick={fetchPortfolio}
            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-white/10"
            aria-label="Refresh portfolio"
          >
            <RefreshCw size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between px-2">
        <div className="flex flex-col">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-gray-500">
            Buying Power
          </span>
          <span className="font-mono text-2xl font-bold text-emerald-400">
            {formatCurrency(portfolio.cash, "USD")}
          </span>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto">
        {activeTab === "active" ? (
          holdingsList.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-sm italic text-gray-500">
              <Briefcase size={24} className="mb-2 opacity-50" />
              No open positions
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-white/5 bg-[#09090b] text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="pb-2 pl-2">Symbol</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Entry</th>
                  <th className="pb-2 text-right">Mark</th>
                  <th className="pb-2 text-right">Stop</th>
                  <th className="pb-2 text-right">Target</th>
                  <th className="pb-2 text-right">P&L</th>
                  <th className="w-8 pb-2"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {holdingsList.map((pos) => {
                  const isCurrent = pos.symbol === activeSymbol;
                  const isShort = pos.quantity < 0;
                  const marketPrice = isCurrent ? currentPrice : pos.average_cost; // Fallback if not current

                  const pnlPerShare = isShort ? pos.average_cost - (marketPrice || 0) : (marketPrice || 0) - pos.average_cost;
                  const pnlValue = pnlPerShare * Math.abs(pos.quantity);
                  const pnlPercent = pos.average_cost !== 0 ? (pnlPerShare / pos.average_cost) * 100 : 0;
                  const currency = pos.currency || "USD";

                  const sl = pos.stop_loss;
                  const isEditing = editingSl?.symbol === pos.symbol;
                  const isTpEditing = editingTp?.symbol === pos.symbol;

                  return (
                    <tr
                      key={pos.symbol}
                      className="group border-t border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="relative py-3 pl-2 font-bold text-white">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            {pos.symbol}
                            {pos.quantity < 0 && (
                              <span className="rounded bg-red-500/20 px-1 py-0.5 text-[8px] font-black uppercase leading-none tracking-tighter text-red-500">
                                Short
                              </span>
                            )}
                          </div>
                          {isCurrent && (
                            <div className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-emerald-500"></div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-gray-300">
                        {Math.abs(pos.quantity)}
                      </td>
                      <td className="py-3 text-right font-mono text-gray-400">
                        {formatCurrency(pos.average_cost, currency)}
                      </td>
                      <td className="py-3 text-right font-mono text-gray-300">
                        {formatCurrency(marketPrice || pos.average_cost, currency)}
                      </td>

                      {/* ... (SL/TP cells unchanged) ... */}
                      <td className="py-3 text-right font-mono text-xs">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editingSl.value}
                              onChange={(e) =>
                                setEditingSl({ ...editingSl, value: Number(e.target.value) })
                              }
                              className="w-16 rounded border border-white/20 bg-white/10 px-1 text-right text-white outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={updateStopLoss}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingSl(null)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() =>
                              setEditingSl({
                                symbol: pos.symbol,
                                value: sl && typeof sl === "object" ? sl.value : sl || 0,
                                type: sl && typeof sl === "object" ? sl.type : "fixed",
                              })
                            }
                            className="group/sl flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-white"
                          >
                            <span
                              className={
                                sl
                                  ? "text-red-500/70"
                                  : "text-[9px] font-bold uppercase tracking-tighter text-gray-700 opacity-30"
                              }
                            >
                              {sl ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span>
                                    {formatCurrency(
                                      sl && typeof sl === "object" ? sl.value : sl,
                                      currency,
                                    )}
                                  </span>
                                  {sl &&
                                    typeof sl === "object" &&
                                    sl.type.startsWith("trailing") && (
                                      <span className="mt-0.5 text-[9px] font-black uppercase leading-none tracking-tighter text-emerald-400">
                                        Trailing
                                      </span>
                                    )}
                                </div>
                              ) : (
                                "Set Stop"
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-xs">
                        {isTpEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editingTp.value}
                              onChange={(e) =>
                                setEditingTp({ ...editingTp, value: Number(e.target.value) })
                              }
                              className="w-16 rounded border border-white/20 bg-white/10 px-1 text-right text-white outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={updateTarget}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingTp(null)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() =>
                              setEditingTp({
                                symbol: pos.symbol,
                                value: pos.take_profit || 0,
                              })
                            }
                            className="group/sl flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-white"
                          >
                            {pos.tp_config ? (
                              <div className="group/tp relative flex cursor-pointer items-end justify-end leading-tight">
                                <span className="font-bold text-emerald-500 hover:text-emerald-400 transition-colors">
                                  {pos.tp_config.type === "scaled"
                                    ? `Scaled (${pos.tp_config.targets?.filter((t: any) => !t.triggered).length} rem)`
                                    : pos.tp_config.type === "breakeven"
                                      ? `BE at ${formatCurrency(pos.tp_config.target, currency)}`
                                      : pos.tp_config.type === "trailing"
                                        ? `Trail at ${formatCurrency(pos.tp_config.activation_price, currency)}`
                                        : "Active TP"}
                                </span>

                                {/* Tooltip for Scaled/Advanced TP */}
                                <div className="invisible group-hover/tp:visible absolute bottom-full right-0 z-[100] mb-2 w-48 scale-95 opacity-0 group-hover/tp:scale-100 group-hover/tp:opacity-100 transition-all duration-200">
                                  <div className="glass-panel overflow-hidden rounded-xl border border-white/10 bg-[#18181b]/95 p-3 shadow-2xl backdrop-blur-xl">
                                    <h5 className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5 pb-1.5">
                                      {pos.tp_config.type === "scaled" ? "Take Profit Targets" : "Target Details"}
                                    </h5>
                                    <div className="space-y-2">
                                      {pos.tp_config.type === "scaled" ? (
                                        pos.tp_config.targets.map((t: any, idx: number) => (
                                          <div key={idx} className={`flex items-center justify-between font-mono text-xs ${t.triggered ? "text-gray-600 line-through" : "text-white"}`}>
                                            <span>{formatCurrency(t.price, currency)}</span>
                                            <span className={`rounded px-1 text-[9px] font-bold ${t.triggered ? "bg-gray-800 text-gray-500" : "bg-emerald-500/20 text-emerald-400"}`}>
                                              {(t.qty_pct * 100).toFixed(0)}%
                                            </span>
                                          </div>
                                        ))
                                      ) : pos.tp_config.type === "trailing" ? (
                                        <div className="space-y-1.5 text-xs">
                                          <div className="flex justify-between text-gray-400">
                                            <span>Activation:</span>
                                            <span className="text-white font-mono">{formatCurrency(pos.tp_config.activation_price, currency)}</span>
                                          </div>
                                          <div className="flex justify-between text-gray-400">
                                            <span>Distance:</span>
                                            <span className="text-white font-mono">{formatCurrency(pos.tp_config.distance, currency)}</span>
                                          </div>
                                          <div className="mt-2 flex items-center gap-1.5">
                                            <div className={`h-1.5 w-1.5 rounded-full ${pos.tp_config.active ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}></div>
                                            <span className={pos.tp_config.active ? "text-emerald-400 font-bold" : "text-gray-500"}>
                                              {pos.tp_config.active ? "Currently Tracking" : "Inactive"}
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-white">
                                          Trigger: <span className="font-mono text-emerald-400">{formatCurrency(pos.tp_config.target, currency)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {pos.tp_config.type === "trailing" && pos.tp_config.active && (
                                  <span className="mt-0.5 text-[9px] font-black uppercase leading-none tracking-tighter text-emerald-400">
                                    Trailing Active
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className={
                                  pos.take_profit
                                    ? "text-emerald-500/70"
                                    : "text-[9px] font-bold uppercase tracking-tighter text-gray-700 opacity-30"
                                }
                              >
                                {pos.take_profit
                                  ? formatCurrency(pos.take_profit, currency)
                                  : "Set Target"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td
                        className={`py-3 text-right font-bold ${pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {isCurrent ? (
                          <div className="text-xs">
                            <div>
                              {pnlPercent > 0 ? "+" : ""}
                              {pnlPercent.toFixed(1)}%
                            </div>
                            <div className="font-mono text-[10px] font-normal opacity-70">
                              {formatCurrency(pnlValue, currency)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-800">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => deletePosition(pos.symbol)}
                          className="p-1 text-gray-600 opacity-30 transition-colors hover:text-red-400 hover:opacity-100"
                          aria-label={`Remove ${pos.symbol} position`}
                          title="Liquidate Position"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-gray-400 outline-none focus:border-blue-500/50"
              />
              {portfolio.history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[9px] font-bold uppercase tracking-wider text-red-400/50 transition-colors hover:text-red-400"
                >
                  Clear History
                </button>
              )}
            </div>

            <div className="space-y-2">
              {historyList.length === 0 ? (
                <div className="py-10 text-center text-xs italic text-gray-500">
                  No trade history.
                </div>
              ) : (
                <div className="space-y-1">
                  {historyList.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${item.side === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                        >
                          {item.side}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{item.symbol}</span>
                          <span className="text-[9px] text-gray-500">
                            {new Date(item.timestamp).toLocaleDateString()}{" "}
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {item.comment && (
                              <span className="ml-2 font-black uppercase text-blue-400/80">
                                • {item.comment}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs text-gray-300">
                            {item.qty} @ {formatCurrency(item.price, item.currency || "USD")}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            Total: {formatCurrency(item.total_usd || item.total, "USD")}
                          </span>
                        </div>
                        {item.realized_pnl != null && (
                          <div
                            className={`flex min-w-[70px] flex-col items-end ${item.realized_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                          >
                            <span className="text-xs font-bold">
                              {item.realized_pnl >= 0 ? "+" : ""}
                              {formatCurrency(item.realized_pnl_usd || item.realized_pnl, "USD")}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">
                              Profit/Loss
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="p-1.5 text-gray-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          aria-label={`Delete ${item.side} ${item.symbol} history entry`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
