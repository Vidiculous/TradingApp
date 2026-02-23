"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  onSearch: (symbol: string) => void;
  isLoading?: boolean;
}

interface Match {
  symbol: string;
  name: string;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Match[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(`/api/search?q=${query}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.matches || []);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  const handleSelect = (symbol: string) => {
    setQuery(symbol);
    onSearch(symbol);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative mx-auto w-full max-w-lg">
      <form onSubmit={handleSubmit} className="relative">
        <div className="group relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 opacity-20 blur transition duration-500 group-hover:opacity-30"></div>
          <div className="relative flex items-center rounded-2xl border border-white/10 bg-black/40 shadow-lg backdrop-blur-xl">
            <Search
              className="ml-4 text-gray-400 transition-colors group-focus-within:text-emerald-400"
              size={20}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search active ticker (e.g. AAPL)..."
              className="w-full rounded-2xl bg-transparent px-4 py-2.5 font-medium text-white placeholder-gray-500 focus:outline-none"
              disabled={isLoading}
            />
            {isLoading && (
              <div className="mr-4 h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/50 border-t-emerald-400"></div>
            )}
          </div>
        </div>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="animation-in slide-in-from-top-2 fade-in absolute z-[9999] mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#000000] text-left shadow-2xl duration-200">
          <ul className="custom-scrollbar max-h-64 overflow-y-auto">
            {suggestions.map((match) => (
              <li
                key={match.symbol}
                onClick={() => handleSelect(match.symbol)}
                className="group flex cursor-pointer items-center justify-between border-b border-white/5 px-5 py-3 transition-colors last:border-0 hover:bg-white/5"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-gray-200 transition-colors group-hover:text-emerald-400">
                    {match.symbol}
                  </span>
                  <span className="text-xs text-gray-500">{match.name}</span>
                </div>
                <span className="text-xs text-gray-600 group-hover:text-gray-400">Select</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
