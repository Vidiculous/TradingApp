import { Activity, AreaChart, BarChart2, CandlestickChart, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

const TradingViewChart = dynamic(
  () => import("@/components/TradingViewChart").then((mod) => mod.TradingViewChart),
  { ssr: false },
);

interface ChartSectionProps {
  data: any[];
  activePeriod: string;
  activeInterval: string;
  onPeriodChange: (period: string) => void;
  onIntervalChange: (interval: string) => void;
  symbol: string;
  periods: readonly string[];
  intervals: readonly string[];
  getValidIntervals: (period: string) => string[];
}

type Indicator = "NONE" | "RSI" | "MACD";
type ChartType = "candles" | "line" | "area";

export const ChartSection = ({
  data,
  activePeriod,
  activeInterval,
  onPeriodChange,
  onIntervalChange,
  symbol,
  periods,
  intervals,
  getValidIntervals,
}: ChartSectionProps) => {
  const [activeIndicator, setActiveIndicator] = useState<Indicator>("NONE");
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set(["VWAP"]));
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [showMarkers, setShowMarkers] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);

  const toggleOverlay = (overlay: string) => {
    const newOverlays = new Set(activeOverlays);
    if (newOverlays.has(overlay)) {
      newOverlays.delete(overlay);
    } else {
      newOverlays.add(overlay);
    }
    setActiveOverlays(newOverlays);
  };

  const fetchTradeHistory = async () => {
    try {
      const res = await fetch("/api/paper/portfolio");
      if (res.ok) {
        const data = await res.json();
        // Filter history for current symbol only
        const symbolHistory = (data.history || []).filter(
          (h: any) => h.symbol.toUpperCase() === symbol.toUpperCase()
        );
        setTradeHistory(symbolHistory);
      }
    } catch (e) {
      console.error("Failed to fetch trade history for chart", e);
    }
  };

  // Fetch history when markers are enabled or symbol changes
  useEffect(() => {
    if (showMarkers) {
      fetchTradeHistory();
    }
  }, [showMarkers, symbol]);

  // Calculate percentage and absolute change for selected period
  const { periodChange, absoluteChange } =
    data && data.length >= 2
      ? (() => {
        const firstPrice = data[0]?.open || data[0]?.close;
        const lastPrice = data[data.length - 1]?.close;
        if (firstPrice && lastPrice && firstPrice !== 0) {
          return {
            periodChange: ((lastPrice - firstPrice) / firstPrice) * 100,
            absoluteChange: lastPrice - firstPrice,
          };
        }
        return { periodChange: 0, absoluteChange: 0 };
      })()
      : { periodChange: 0, absoluteChange: 0 };

  const chartTypeOptions: { type: ChartType; icon: React.ReactNode; label: string }[] = [
    { type: "candles", icon: <CandlestickChart size={14} />, label: "Candles" },
    { type: "line", icon: <TrendingUp size={14} />, label: "Line" },
    { type: "area", icon: <AreaChart size={14} />, label: "Area" },
  ];

  return (
    <div className="glass-panel relative min-h-[500px] rounded-3xl p-6">
      <div className="relative z-10 mb-6 flex w-full flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-300">
            <Activity size={18} className="text-emerald-400" />
            Price Action
            {data && data.length >= 2 && (
              <span
                className={`ml-2 rounded-lg px-2 py-0.5 text-sm font-bold ${periodChange >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
              >
                {absoluteChange >= 0 ? "+" : ""}
                {absoluteChange.toFixed(2)} ({periodChange >= 0 ? "+" : ""}
                {periodChange.toFixed(2)}%)
              </span>
            )}
          </h3>
          <span className="text-xs text-gray-500">
            {activePeriod} • {activeInterval} candles
          </span>
        </div>

        {/* Chart Controls - Reorganized into 2 rows */}
        <div className="flex flex-col gap-2">
          {/* Row 1: Primary Time Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Type Selector */}
            <div className="flex rounded-xl border border-white/5 bg-white/5 p-1 backdrop-blur-md">
              {chartTypeOptions.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${chartType === type
                    ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  title={label}
                >
                  {icon}
                </button>
              ))}
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Period Selectors */}
            <div className="custom-scrollbar flex overflow-x-auto rounded-xl border border-white/5 bg-white/5 p-1 backdrop-blur-md">
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => onPeriodChange(period)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${activePeriod === period
                    ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Interval Selectors */}
            <div className="custom-scrollbar flex overflow-x-auto rounded-xl border border-white/5 bg-white/5 p-1 backdrop-blur-md">
              {intervals.map((interval) => {
                const isValid = getValidIntervals(activePeriod).includes(interval);
                return (
                  <button
                    key={interval}
                    onClick={() => isValid && onIntervalChange(interval)}
                    disabled={!isValid}
                    className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${activeInterval === interval
                      ? "border border-amber-500/20 bg-amber-500/20 text-amber-400 shadow-sm"
                      : isValid
                        ? "text-gray-400 hover:bg-white/5 hover:text-white"
                        : "cursor-not-allowed text-gray-600 opacity-40"
                      }`}
                    title={isValid ? `${interval} candles` : `Not available for ${activePeriod}`}
                  >
                    {interval}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Technical Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Overlays Selector */}
            <div className="flex rounded-xl border border-white/5 bg-white/5 p-1 backdrop-blur-md">
              {["VWAP", "EMA9", "EMA21"].map((ov) => (
                <div key={ov} className="group relative">
                  <button
                    onClick={() => toggleOverlay(ov)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${activeOverlays.has(ov)
                      ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    {ov}
                  </button>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-white/10 bg-gray-900/95 p-2 text-center text-[10px] text-gray-300 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                    {ov === "VWAP" && "Volume Weighted Avg Price. Institutional benchmark."}
                    {ov === "EMA9" && "9-Period EMA. Fast trend line for short-term momentum."}
                    {ov === "EMA21" && "21-Period EMA. Medium-term trend & dynamic support."}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Indicator Selector */}
            <div className="flex rounded-xl border border-white/5 bg-white/5 p-1 backdrop-blur-md">
              {(["NONE", "RSI", "MACD"] as Indicator[]).map((ind) => (
                <div key={ind} className="group relative">
                  <button
                    onClick={() => setActiveIndicator(ind)}
                    className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${activeIndicator === ind
                      ? "border border-purple-500/20 bg-purple-500/20 text-purple-400 shadow-sm"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    {ind === "NONE" ? "No Ind." : ind}
                  </button>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-48 rounded-lg border border-white/10 bg-gray-900/95 p-2 text-center text-[10px] text-gray-300 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                    {ind === "NONE" && "Hide all bottom indicators."}
                    {ind === "RSI" && "Relative Strength Index. Overbought > 70, Oversold < 30."}
                    {ind === "MACD" &&
                      "Trend Momentum. Cyan line crossing Yellow line signals entry/exit."}
                  </div>
                </div>
              ))}
            </div>

            <div className="h-6 w-px bg-white/10" />

            {/* Trade Markers Toggle */}
            <div className="group relative">
              <button
                onClick={() => setShowMarkers(!showMarkers)}
                className={`whitespace-nowrap rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-bold transition-all ${showMarkers
                  ? "border border-blue-500/30 bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/10"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
              >
                Trade Markers
              </button>
              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-42 rounded-lg border border-white/10 bg-gray-900/95 p-2 text-center text-[10px] text-gray-300 opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                Show your past entries & exits on the chart.
              </div>
            </div>
          </div>
        </div>
      </div>

      <TradingViewChart
        data={data}
        interval={`${activePeriod}-${activeInterval}`}
        symbol={symbol}
        activeIndicator={activeIndicator}
        activeOverlays={activeOverlays}
        chartType={chartType}
        showMarkers={showMarkers}
        history={tradeHistory}
      />
    </div>
  );
};
