import { ExternalLink } from "lucide-react";

interface NewsItem {
  source: string;
  headline: string;
  url: string;
  publishedAt: string;
  image?: string;
  sentiment?: "bullish" | "neutral" | "bearish";
}

interface NewsCardProps {
  news: NewsItem;
  symbol?: string; // Optional symbol to tag
}

export function NewsCard({ news, symbol }: NewsCardProps) {
  return (
    <div className="glass-card-subtle group relative rounded-xl p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {symbol && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300">
                {symbol}
              </span>
            )}
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-300">
              {news.source}
            </span>
            {news.sentiment && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                  news.sentiment === "bullish"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : news.sentiment === "bearish"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-gray-500/20 bg-gray-500/10 text-gray-400"
                }`}
              >
                {news.sentiment === "bullish"
                  ? "📈 Bullish"
                  : news.sentiment === "bearish"
                    ? "📉 Bearish"
                    : "➡️ Neutral"}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(news.publishedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <h3 className="text-sm font-medium leading-snug text-gray-200 transition-colors group-hover:text-white">
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus:outline-none"
            >
              <span className="absolute inset-0" aria-hidden="true" />
              {news.headline}
            </a>
          </h3>
        </div>
        <div className="z-10 text-gray-600 transition-colors group-hover:text-blue-400">
          <ExternalLink size={16} />
        </div>
      </div>
    </div>
  );
}
