import { LayoutDashboard, RefreshCw } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { AnalysisPlaceholder } from "./AnalysisPlaceholder";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { EconomicCalendar } from "./EconomicCalendar";
import { MarketMovers } from "./MarketMovers";
import { NewsCard } from "./NewsCard";
import { OrderBook } from "./OrderBook";
import { OrderEntry } from "./OrderEntry";
import { PositionsTable } from "./PositionsTable";
import { SectorCorrelation } from "./SectorCorrelation";
import { SidebarTabs } from "./SidebarTabs";
import { SignalCard } from "./SignalCard";
import { TimeAndSales } from "./TimeAndSales";
import { Watchlist } from "./Watchlist";

interface DashboardRightPanelProps {
  tickerData: any;
  setTickerData: Dispatch<SetStateAction<any>>;
  onSelectTicker: (ticker: string) => void;
  onOrderPlaced: () => void;
  lastUpdated: Date | null;
  refreshTrigger: number;
  aiAnalysis: any;
  aiLoading: boolean;
  onRunAi: () => void;
}

export const DashboardRightPanel = ({
  tickerData,
  setTickerData,
  onSelectTicker,
  onOrderPlaced,
  lastUpdated,
  refreshTrigger,
  aiAnalysis,
  aiLoading,
  onRunAi,
}: DashboardRightPanelProps) => {
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [newsFetchedAt, setNewsFetchedAt] = useState<Date | null>(null);

  const fetchNews = async () => {
    if (!tickerData?.meta?.symbol) return;

    setNewsLoading(true);
    try {
      const response = await fetch(`/api/news/${tickerData.meta.symbol}`);
      const data = await response.json();
      setNews(data.news || []);
      setNewsFetched(true);
      setNewsFetchedAt(new Date());
    } catch (error) {
      console.error("Error fetching news:", error);
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  };

  // Reset news when ticker changes
  useEffect(() => {
    setNews([]);
    setNewsFetched(false);
    setNewsFetchedAt(null);
  }, [tickerData?.meta?.symbol]);

  return (
    <div className="flex h-full flex-col space-y-3 bg-[#09090b] lg:col-span-4">
      {/* AI Squad / Insights removed from here - moved to main dash */}

      {/* Tabbed Content Area */}
      <div className="glass-panel min-h-[500px] flex-1 overflow-hidden rounded-3xl p-2">
        <SidebarTabs
          tradeContent={
            <div className="flex h-full flex-col gap-4 p-2">
              <ConfidenceMeter analysis={aiAnalysis} loading={aiLoading} onRunAnalysis={onRunAi} />
              <OrderEntry
                symbol={tickerData.meta.symbol}
                currentPrice={tickerData.price.current}
                currency={tickerData.meta.currency}
                onOrderPlaced={onOrderPlaced}
              />
              <div className="flex flex-1 flex-col overflow-hidden border-t border-white/5 pt-4">
                <h4 className="mb-2 text-sm font-bold text-gray-400">My Positions</h4>
                <div className="custom-scrollbar flex-1 overflow-y-auto">
                  <PositionsTable
                    onRefresh={refreshTrigger}
                    currentPrice={tickerData.price.current}
                    activeSymbol={tickerData.meta.symbol}
                  />
                </div>
              </div>
            </div>
          }
          bookContent={
            <OrderBook symbol={tickerData.meta.symbol} currentPrice={tickerData.price.current} />
          }
          tapeContent={<TimeAndSales symbol={tickerData.meta.symbol} />}
          watchlistContent={
            <div className="h-full p-2">
              <Watchlist />
            </div>
          }
          newsContent={
            <div className="flex h-full flex-col">
              {!newsFetched && !newsLoading && (
                <div className="flex flex-1 items-center justify-center">
                  <button
                    onClick={fetchNews}
                    className="rounded-xl border border-indigo-500/20 bg-indigo-500/20 px-6 py-3 font-bold text-indigo-400 transition-all hover:bg-indigo-500/30"
                  >
                    Load News
                  </button>
                </div>
              )}
              {newsLoading && (
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-400" size={32} />
                    <p className="text-sm text-gray-400">Fetching news from 15+ sources...</p>
                  </div>
                </div>
              )}
              {newsFetched && !newsLoading && (
                <div className="flex h-full flex-col">
                  <div className="mb-3 flex items-center justify-between px-2">
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-sm font-bold text-gray-400">Latest News</h4>
                      {newsFetchedAt && (
                        <span className="text-[10px] text-gray-600">
                          Fetched{" "}
                          {newsFetchedAt.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={fetchNews}
                      className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/10"
                      title="Refresh news"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-2">
                    {news.length === 0 ? (
                      <p className="mt-8 text-center text-sm italic text-gray-500">
                        No news available
                      </p>
                    ) : (
                      news.map((item: any, idx: number) => <NewsCard key={idx} news={item} />)
                    )}
                  </div>
                </div>
              )}
            </div>
          }
          moversContent={
            <div className="h-full space-y-4 p-2">
              <SectorCorrelation symbol={tickerData.meta.symbol} />
              <div className="my-2 h-px bg-white/5" />
              <MarketMovers onSelect={onSelectTicker} />
              <EconomicCalendar />
            </div>
          }
        />
      </div>

      {lastUpdated && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-2 text-center text-xs text-gray-500">
          <RefreshCw size={12} />
          <span>Auto-updates live</span>
        </div>
      )}
    </div>
  );
};
