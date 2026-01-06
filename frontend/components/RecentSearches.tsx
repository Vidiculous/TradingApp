"use client";

import { Clock, X } from "lucide-react";
import { useEffect, useState } from "react";

interface RecentSearchesProps {
  onSelect: (ticker: string) => void;
  className?: string;
}

export const RecentSearches = ({ onSelect, className = "" }: RecentSearchesProps) => {
  const [recent, setRecent] = useState<string[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      setRecent(JSON.parse(saved));
    }

    // Listen for storage events to sync across tabs
    const handleStorageChange = () => {
      const updated = localStorage.getItem("recentSearches");
      if (updated) {
        setRecent(JSON.parse(updated));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // Custom event to sync within the same tab
    window.addEventListener("recentSearchesUpdated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("recentSearchesUpdated", handleStorageChange);
    };
  }, []);

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem("recentSearches");
    setRecent([]);
    window.dispatchEvent(new Event("recentSearchesUpdated"));
  };

  if (recent.length === 0) return null;

  return (
    <div className={`custom-scrollbar flex items-center gap-2 overflow-x-auto pb-2 ${className}`}>
      <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-gray-500">
        <Clock size={12} />
        Recent:
      </span>
      {recent.map((ticker) => (
        <button
          key={ticker}
          onClick={() => onSelect(ticker)}
          className="whitespace-nowrap rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white"
        >
          {ticker}
        </button>
      ))}
      <button
        onClick={clearHistory}
        className="rounded-full p-1 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
        title="Clear History"
      >
        <X size={12} />
      </button>
    </div>
  );
};

// Helper to add a search
export const addRecentSearch = (ticker: string) => {
  const saved = localStorage.getItem("recentSearches");
  let current = saved ? JSON.parse(saved) : [];

  // Remove if exists (to move to front)
  current = current.filter((t: string) => t !== ticker);

  // Add to front
  current.unshift(ticker);

  // Keep max 10
  if (current.length > 10) current.pop();

  localStorage.setItem("recentSearches", JSON.stringify(current));
  window.dispatchEvent(new Event("recentSearchesUpdated"));
};
