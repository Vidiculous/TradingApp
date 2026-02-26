"use client";

import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PortfolioAnalytics } from "@/types/api";

const fmt = (n: number, showSign = false) => {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!showSign) return `$${abs}`;
  return n >= 0 ? `+$${abs}` : `-$${abs}`;
};

export const PortfolioAnalyticsPanel = () => {
  const [data, setData] = useState<PortfolioAnalytics | null>(null);

  useEffect(() => {
    fetch("/api/paper/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return null;

  const isEmpty = data.trade_count === 0;
  const isPositive = data.total_realized_pnl >= 0;
  const chartColor = isPositive ? "#10b981" : "#ef4444";

  const metrics = [
    {
      label: "Total P&L",
      value: fmt(data.total_realized_pnl, true),
      color: isPositive ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Win Rate",
      value: `${data.win_rate}%`,
      color: data.win_rate >= 50 ? "text-emerald-400" : "text-amber-400",
    },
    { label: "Trades Closed", value: String(data.trade_count), color: "text-white" },
    {
      label: "Profit Factor",
      value: data.profit_factor > 0 ? data.profit_factor.toFixed(2) : "—",
      color: data.profit_factor >= 1.5 ? "text-emerald-400" : data.profit_factor > 0 ? "text-amber-400" : "text-gray-500",
    },
  ];

  return (
    <section className="glass-panel group relative overflow-hidden rounded-3xl border border-emerald-500/10 p-6">
      <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-emerald-500/5 blur-[80px]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/20 p-2.5">
            <TrendingUp className="text-emerald-400" size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold uppercase tracking-widest text-gray-400">
              Portfolio Analytics
            </h2>
            <p className="text-xs text-gray-600">Closed trades performance</p>
          </div>
        </div>

        {isEmpty ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5">
            <p className="text-sm italic text-gray-600">No closed trades yet — execute a SELL to see analytics</p>
          </div>
        ) : (
          <>
            {/* Metric chips */}
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.label} className="rounded-2xl border border-white/5 bg-white/5 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    {m.label}
                  </p>
                  <p className={`font-mono text-lg font-bold leading-none ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Equity curve */}
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.equity_curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#4b5563" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5)} // Show MM-DD
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#4b5563" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v >= 0 ? "" : "-"}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [fmt(v, true), "Cumulative P&L"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative_pnl"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#eqGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Win / Loss detail row */}
            <div className="mt-3 flex gap-4 text-xs text-gray-600">
              <span>Avg win: <span className="text-emerald-400 font-mono">{fmt(data.avg_win)}</span></span>
              <span>Avg loss: <span className="text-red-400 font-mono">{fmt(data.avg_loss)}</span></span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
