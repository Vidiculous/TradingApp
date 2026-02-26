"use client";

import { LayoutDashboard, LayoutGrid, Moon, Sun } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import type { AIAnalysis, TickerData } from "@/types/api";
import { useTheme } from "@/contexts/ThemeContext";
import { AgentAnalysisView } from "@/components/AgentAnalysisView";
import { AlertsCenter } from "@/components/AlertsCenter";
import { ChartSection } from "@/components/ChartSection";
import { DashboardRightPanel } from "@/components/DashboardRightPanel";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { FavoritesGrid } from "@/components/FavoritesGrid";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { GlobalContextBar } from "@/components/GlobalContextBar";
import { GridDashboard } from "@/components/GridDashboard";
import { LandingDashboard } from "@/components/LandingDashboard";
import { RecentSearches } from "@/components/RecentSearches";
import { SearchBar } from "@/components/SearchBar";
import { TickerHeader } from "@/components/TickerHeader";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "grid">("standard");
  const [refreshPositions, setRefreshPositions] = useState(0);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // URL Sync: Read ticker from URL on mount and navigation
  useEffect(() => {
    const tickerFromUrl = searchParams.get("ticker");
    const currentTicker = tickerData?.meta?.symbol;

    if (tickerFromUrl && tickerFromUrl !== currentTicker) {
      // URL has a ticker, fetch it
      fetchTickerDataWithParams(tickerFromUrl.toUpperCase(), "1D", "5m");
    } else if (!tickerFromUrl && currentTicker) {
      // URL cleared (back to landing), clear ticker data
      setTickerData(null);
      setAiAnalysis(null);
      setError("");
    }
  }, [searchParams]);

  const runAiAnalysis = async (
    horizon: string = "Swing",
    autonomous: boolean = false,
    usePortfolio: boolean = true
  ) => {
    if (!tickerData?.meta?.symbol) return;
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      // 1. Start Analysis Job
      const startRes = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tickerData.meta.symbol,
          horizon,
          autonomous,
          use_portfolio: usePortfolio,
          provider: localStorage.getItem("trading_llm_provider"),
          model: localStorage.getItem("trading_llm_model"),
          api_key: localStorage.getItem("trading_llm_api_key"),
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.detail || "Failed to start analysis");

      const jobId = startData.job_id;

      // 2. Poll for Results
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes timeout

      while (attempts < maxAttempts) {
        const statusRes = await fetch(`/api/agent/status/${jobId}`);
        if (!statusRes.ok) {
          const errData = await statusRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Status check failed (${statusRes.status})`);
        }
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          setAiAnalysis(statusData.result);
          // If an autonomous trade was executed, refresh the positions table
          if (statusData.result?.execution_status?.startsWith("Successfully")) {
            setRefreshPositions((prev) => prev + 1);
          }
          return;
        } else if (statusData.status === "failed") {
          throw new Error(statusData.error || "Analysis job failed");
        }

        // Wait 1s before next poll
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
      }

      throw new Error("Analysis timed out");
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setAiLoading(false);
    }
  };

  // Independent Period and Interval configuration
  const periods = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"] as const;
  const intervals = ["1m", "5m", "15m", "30m", "1h", "1d", "1wk"] as const;

  // Map display labels to yfinance API values
  const periodToApi: Record<string, string> = {
    "1D": "1d",
    "5D": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
    "5Y": "5y",
  };

  // Compatibility matrix: which intervals are valid for each period (based on yfinance limits)
  // yfinance limits: 1m=7d, 5m/15m/30m=60d, 1h=730d, 1d/1wk=unlimited
  const intervalCompatibility: Record<string, string[]> = {
    "1D": ["1m", "5m", "15m", "30m", "1h"], // 1 day: all intraday
    "5D": ["5m", "15m", "30m", "1h"], // 5 days: no 1m (limit is 7d but too granular)
    "1M": ["15m", "30m", "1h", "1d"], // 1 month: hourly+
    "3M": ["1h", "1d"], // 3 months: hourly, daily
    "6M": ["1d", "1wk"], // 6 months: daily, weekly
    "1Y": ["1d", "1wk"], // 1 year: daily, weekly
    "5Y": ["1wk"], // 5 years: weekly only
  };

  // State for period and interval
  const [activePeriod, setActivePeriod] = useState<string>("1D");
  const [activeInterval, setActiveInterval] = useState<string>("5m");

  // Get valid intervals for current period
  const getValidIntervals = (period: string) => intervalCompatibility[period] || ["1d"];

  // When period changes, auto-select first valid interval if current is invalid
  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    const validIntervals = getValidIntervals(period);
    if (!validIntervals.includes(activeInterval)) {
      setActiveInterval(validIntervals[0]);
    }
    if (tickerData?.meta?.symbol) {
      fetchTickerDataWithParams(
        tickerData.meta.symbol,
        period,
        validIntervals.includes(activeInterval) ? activeInterval : validIntervals[0],
      );
    }
  };

  const handleIntervalChange = (interval: string) => {
    setActiveInterval(interval);
    if (tickerData?.meta?.symbol) {
      fetchTickerDataWithParams(tickerData.meta.symbol, activePeriod, interval);
    }
  };

  const fetchTickerDataWithParams = async (
    symbol: string,
    period: string,
    interval: string,
    isBackground = false,
  ) => {
    if (!isBackground && !tickerData) setLoading(true);
    setError("");

    try {
      const apiPeriod = periodToApi[period] || "1d";
      const res = await fetch(`/api/ticker/${symbol}?period=${apiPeriod}&interval=${interval}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to fetch ticker data");
      }
      const data = await res.json();
      setTickerData(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!isBackground) setError(err.message || "Could not find ticker. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Legacy function for backward compatibility
  const fetchTickerData = async (symbol: string, _tfKey: string = "1D", isBackground = false) => {
    return fetchTickerDataWithParams(symbol, activePeriod, activeInterval, isBackground);
  };

  const handleSearch = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    // Push to URL for browser history navigation
    router.push(`/?ticker=${upperSymbol}`);
    setTickerData(null);
    setActivePeriod("1D");
    setActiveInterval("5m");
    setAiAnalysis(null);
    fetchTickerDataWithParams(upperSymbol, "1D", "5m");
  };

  // Navigate back to landing page
  const handleBackToLanding = () => {
    router.push("/");
    setTickerData(null);
    setAiAnalysis(null);
    setError("");
  };

  const handleOrderPlaced = () => {
    setRefreshPositions((prev) => prev + 1);
  };

  // Polling effect
  useEffect(() => {
    if (!tickerData?.meta?.symbol) return;

    const intervalId = setInterval(() => {
      fetchTickerDataWithParams(tickerData.meta.symbol, activePeriod, activeInterval, true);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [tickerData?.meta?.symbol, activePeriod, activeInterval]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090b]">
      <GlobalContextBar />
      <header className="sticky top-2 z-[1000] mx-3 mt-2 flex items-center justify-between rounded-2xl border border-emerald-500/10 bg-gradient-to-r from-emerald-950/60 via-[#18181b]/80 to-[#18181b]/80 px-6 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl md:mx-6 md:px-8">
            {/* Left Header Area: Logo */}
            <div className="flex flex-1 items-center gap-4">
              <div className="glass-panel rounded-2xl border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 p-2 shadow-lg shadow-emerald-500/5">
                <LayoutDashboard className="text-emerald-400" size={20} />
              </div>
              <div className="flex flex-col justify-center">
                <a href="/" onClick={(e) => { e.preventDefault(); handleBackToLanding(); }} className="group block text-left">
                  <h1 className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-lg font-black tracking-tighter text-transparent transition-all duration-300 group-hover:from-emerald-400 group-hover:to-white">
                    MARKET<span className="text-emerald-500">DASH</span>
                  </h1>
                </a>
              </div>
            </div>

            {/* Central Search Section */}
            <div className="hidden w-full max-w-md flex-[2] md:block">
              <div className="group relative w-full">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 opacity-10 blur transition-opacity group-hover:opacity-20"></div>
                <div className="relative">
                  <SearchBar onSearch={handleSearch} isLoading={loading} />
                </div>
              </div>
            </div>

            {/* Right Header Area: View Switcher */}
            <div className="flex flex-1 items-center justify-end gap-4">
              <AlertsCenter />
              <button
                onClick={toggleTheme}
                className="rounded-lg border border-white/5 bg-white/5 p-1.5 text-gray-500 transition-all hover:text-white"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>
              <div className="flex rounded-xl border border-white/5 bg-white/5 p-1" role="tablist" aria-label="Dashboard view mode">
                <button
                  onClick={() => setViewMode("standard")}
                  className={`rounded-lg p-1.5 transition-all ${viewMode === "standard" ? "bg-emerald-500/20 text-emerald-400 shadow-xl" : "text-gray-500 hover:text-white"}`}
                  role="tab"
                  aria-selected={viewMode === "standard"}
                  aria-label="Portfolio View"
                >
                  <LayoutDashboard size={16} aria-hidden="true" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-lg p-1.5 transition-all ${viewMode === "grid" ? "bg-emerald-500/20 text-emerald-400 shadow-xl" : "text-gray-500 hover:text-white"}`}
                  role="tab"
                  aria-selected={viewMode === "grid"}
                  aria-label="Grid Terminal"
                >
                  <LayoutGrid size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
      </header>

      <div className="p-4 pb-20 md:p-6">
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-500/10 blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-500/5 blur-[150px]" />
          <div className="absolute left-[20%] top-[20%] h-[30%] w-[30%] rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>

        <div className="relative w-full space-y-6 px-4 md:px-8">
          {/* Sub-header Context (Recent Searches / Mobile Search) */}
          <div className="relative z-40 flex flex-col gap-4">
            <div className="lg:hidden">
              <SearchBar onSearch={handleSearch} isLoading={loading} />
            </div>
            {!tickerData && (
              <div className="flex flex-col gap-2">
                <RecentSearches onSelect={handleSearch} />
              </div>
            )}
          </div>

          {/* Favorites Grid (Landing Page) */}
          {!tickerData && !loading && !error && <LandingDashboard onSelect={handleSearch} />}
        </div>

        {/* Error State */}
        {error && (
          <ErrorDisplay
            message={error}
            onRetry={() => handleSearch(tickerData?.meta?.symbol || "")}
          />
        )}

        {/* Loading State */}
        {loading && !tickerData && <DashboardSkeleton />}

        {/* Grid View */}
        {viewMode === "grid" && (
          <GridDashboard
            initialTickers={tickerData?.meta?.symbol ? [tickerData.meta.symbol] : ["AAPL"]}
            onMaximize={(symbol) => {
              handleSearch(symbol);
              setViewMode("standard");
            }}
          />
        )}

        {/* Standard Dashboard Content */}
        {viewMode === "standard" && tickerData && !loading && !error && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left Column: Chart & Fundamentals */}
            <div className="space-y-6 lg:col-span-8">
              <TickerHeader tickerData={tickerData} />

              <ChartSection
                data={tickerData.price.history}
                activePeriod={activePeriod}
                activeInterval={activeInterval}
                onPeriodChange={handlePeriodChange}
                onIntervalChange={handleIntervalChange}
                symbol={tickerData.meta.symbol}
                periods={periods}
                intervals={intervals}
                getValidIntervals={getValidIntervals}
              />

              {/* AI Squad Section - Moved to Main Column */}
              <div className="glass-panel relative overflow-hidden rounded-3xl p-6">
                <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/5 blur-[50px]"></div>
                <div className="relative z-10 mb-4 flex items-center gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/20 p-2">
                    <LayoutDashboard className="text-emerald-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold leading-none text-white">AI Squad</h3>
                    <p className="text-xs font-medium text-emerald-400">Multi-Agent Analysis</p>
                  </div>
                </div>
                <AgentAnalysisView
                  symbol={tickerData.meta.symbol}
                  analysis={aiAnalysis}
                  loading={aiLoading}
                  onRunAnalysis={runAiAnalysis}
                  onHorizonChange={(h) => {
                    const map: Record<string, string> = { Scalp: "1D", Swing: "5D", Invest: "1Y" };
                    if (map[h]) handlePeriodChange(map[h]);
                  }}
                />
              </div>

              <FundamentalsGrid
                fundamentals={tickerData.fundamentals}
                symbol={tickerData.meta.symbol}
                currency={tickerData.meta.currency}
              />
            </div>

            {/* Right Column: AI & News */}
            <DashboardRightPanel
              tickerData={tickerData}
              setTickerData={setTickerData}
              onSelectTicker={handleSearch}
              onOrderPlaced={handleOrderPlaced}
              lastUpdated={lastUpdated}
              refreshTrigger={refreshPositions}
              aiAnalysis={aiAnalysis}
              aiLoading={aiLoading}
              onRunAi={() => runAiAnalysis("Swing")}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#09090b] text-white">
          Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
