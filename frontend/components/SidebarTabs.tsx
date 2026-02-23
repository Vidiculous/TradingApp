import { BarChart3, DollarSign, FileText, List, Newspaper, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

interface SidebarTabsProps {
  tradeContent: React.ReactNode;
  bookContent: React.ReactNode;
  moversContent: React.ReactNode;
  tapeContent: React.ReactNode;
  watchlistContent: React.ReactNode;
  newsContent: React.ReactNode;
  docsContent: React.ReactNode;
}

export const SidebarTabs = ({
  tradeContent,
  bookContent,
  moversContent,
  tapeContent,
  watchlistContent,
  newsContent,
  docsContent,
}: SidebarTabsProps) => {
  const [activeTab, setActiveTab] = useState<
    "TRADE" | "BOOK" | "TAPE" | "MOVERS" | "WATCH" | "NEWS" | "DOCS"
  >("TRADE");

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Tab Header - Scrollable for safety */}
      <div className="custom-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1">
        <button
          onClick={() => setActiveTab("TRADE")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "TRADE" ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <DollarSign size={14} />
          TRADE
        </button>
        <button
          onClick={() => setActiveTab("NEWS")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "NEWS" ? "border border-indigo-500/20 bg-indigo-500/20 text-indigo-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <Newspaper size={14} />
          NEWS
        </button>
        <button
          onClick={() => setActiveTab("DOCS")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "DOCS" ? "border border-blue-500/20 bg-blue-500/20 text-blue-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <FileText size={14} />
          DOCS
        </button>
        <button
          onClick={() => setActiveTab("BOOK")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "BOOK" ? "border border-purple-500/20 bg-purple-500/20 text-purple-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <BarChart3 size={14} />
          L2
        </button>
        <button
          onClick={() => setActiveTab("TAPE")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "TAPE" ? "border border-orange-500/20 bg-orange-500/20 text-orange-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <List size={14} />
          TAPE
        </button>
        <button
          onClick={() => setActiveTab("WATCH")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "WATCH" ? "border border-yellow-500/20 bg-yellow-500/20 text-yellow-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <Star size={14} />
          WATCH
        </button>
        <button
          onClick={() => setActiveTab("MOVERS")}
          className={`flex min-w-[60px] flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-all ${activeTab === "MOVERS" ? "border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-gray-400 hover:text-white"}`}
        >
          <TrendingUp size={14} />
          HOT
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "TRADE" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 custom-scrollbar h-full overflow-y-auto duration-300">
            {tradeContent}
          </div>
        )}
        {activeTab === "NEWS" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 custom-scrollbar h-full overflow-y-auto duration-300">
            {newsContent}
          </div>
        )}
        {activeTab === "DOCS" && (
          <div className="glass-panel animate-in fade-in slide-in-from-bottom-2 h-full overflow-hidden rounded-3xl p-0 duration-300">
            {docsContent}
          </div>
        )}
        {activeTab === "BOOK" && (
          <div className="glass-panel animate-in fade-in slide-in-from-bottom-2 h-full overflow-hidden rounded-3xl p-4 duration-300">
            {bookContent}
          </div>
        )}
        {activeTab === "TAPE" && (
          <div className="glass-panel animate-in fade-in slide-in-from-bottom-2 h-full overflow-hidden rounded-3xl p-4 duration-300">
            {tapeContent}
          </div>
        )}
        {activeTab === "WATCH" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 custom-scrollbar h-full overflow-y-auto duration-300">
            {watchlistContent}
          </div>
        )}
        {activeTab === "MOVERS" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 custom-scrollbar h-full overflow-y-auto duration-300">
            {moversContent}
          </div>
        )}
      </div>
    </div>
  );
};
