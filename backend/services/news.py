from datetime import datetime, timedelta
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser

# Using a mock for now to avoid API key requirements for the MVP unless user provides one
# or we can use yfinance news if available, yfinance Ticker object has .news
import yfinance as yf

from .sentiment import analyze_sentiment

# Expanded RSS Feeds with Swedish and European Focus
RSS_FEEDS = {
    # Swedish Financial News
    "Dagens Industri": "https://www.di.se/rss",
    "Affärsvärlden": "https://www.affarsvarlden.se/rss/nyheter",
    "Breakit (Swedish Tech)": "https://www.breakit.se/feed",
    "SVT Ekonomi": "https://www.svt.se/nyheter/ekonomi/rss.xml",
    # European Markets
    "Financial Times Europe": "https://www.ft.com/europe?format=rss",
    "Euronews Business": "https://www.euronews.com/rss?level=theme&name=business",
    "The Local Sweden": "https://www.thelocal.se/feed/",
    "Reuters Europe": "https://www.reutersagency.com/feed/?best-regions=europe&post_type=best",
    # Major Financial Outlets
    "Bloomberg Markets": "https://feeds.bloomberg.com/markets/news.rss",
    "CNBC Top News": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    "MarketWatch": "http://feeds.marketwatch.com/marketwatch/topstories/",
    "Financial Times": "https://www.ft.com/?format=rss",
    # Global Business
    "BBC Business": "http://feeds.bbci.co.uk/news/business/rss.xml",
    "Reuters Business": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
    "BBC World": "http://feeds.bbci.co.uk/news/world/rss.xml",
}


def get_general_news_rss() -> list[dict[str, Any]]:
    """Fetches world/general news from RSS feeds."""
    all_news = []
    for source, url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:3]:  # Top 3 per feed
                all_news.append(
                    {
                        "source": source,
                        "headline": entry.title,
                        "url": entry.link,
                        "publishedAt": datetime.now().isoformat(),  # RSS dates format varies widely, using now() for simplicity in MVP
                    }
                )
        except Exception as e:
            print(f"Error fetching RSS from {source}: {e}")

    return all_news


def parse_rss_date(date_str: str) -> str:
    """
    Parse RSS feed date string to ISO format.
    Handles multiple date formats from different RSS feeds.
    """
    if not date_str:
        return ""

    try:
        # Try parsing RFC 822 format (most common in RSS)
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except Exception:
        pass

    try:
        # Try parsing ISO format directly
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.isoformat()
    except Exception:
        pass

    try:
        # Try feedparser's parsed date
        import time

        dt = datetime.fromtimestamp(time.mktime(feedparser._parse_date(date_str)))
        return dt.isoformat()
    except Exception:
        pass

    # If all parsing fails, return empty string (will be handled later)
    return ""


def get_ticker_news(symbol: str) -> list[dict[str, Any]]:
    """Get ticker news from yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        news_data = ticker.news

        formatted_news = []
        for i, item in enumerate(news_data):
            # Fallback logic for different yfinance versions/structures
            title = item.get("title") or item.get("headline")
            if not title and "content" in item:
                title = item["content"].get("title")

            publisher = item.get("publisher")
            if not publisher and "content" in item:
                # specific to some ynews structures
                publisher = item["content"].get("provider", {}).get("displayName")

            link = item.get("link") or item.get("url")
            if not link and "clickThroughUrl" in item:
                link = item["clickThroughUrl"]
            if not link and "content" in item and "clickThroughUrl" in item["content"]:
                link = item["content"]["clickThroughUrl"]

            # Fix for when link/clickThroughUrl is a dictionary
            if isinstance(link, dict):
                link = link.get("url")

            # Extract timestamp from nested content object (yfinance API structure changed)
            pub_date = None
            if "content" in item:
                # Try pubDate first, then displayTime
                pub_date = item["content"].get("pubDate") or item["content"].get("displayTime")

            # Fallback to top-level fields if content doesn't exist
            if not pub_date:
                provider_time = item.get("providerPublishTime")
                if provider_time:
                    pub_date = datetime.fromtimestamp(provider_time).isoformat()

            # If still no date, skip this article
            if not pub_date:
                print(f"Article {i+1}: No valid timestamp found, skipping")
                continue

            formatted_news.append(
                {
                    "source": publisher or "Market News",
                    "headline": title or "Market Update",
                    "url": link or "#",
                    "publishedAt": pub_date,
                    "sentiment": analyze_sentiment(title or "", ""),
                }
            )

        return formatted_news[:5]  # Limit to 5
    except Exception as e:
        print(f"Error fetching yfinance news: {e}")
        return []


def get_ticker_from_rss_feeds(symbol: str, max_per_source: int = 2) -> list[dict[str, Any]]:
    """Search RSS feeds for ticker-specific news."""
    news = []
    for source, url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            source_count = 0
            for entry in feed.entries:
                # Check if ticker symbol appears in title or summary
                text = f"{entry.title} {entry.get('summary', '')}".upper()
                if symbol.upper() in text or symbol.replace(".", " ").upper() in text:
                    # Parse the publication date
                    pub_date = parse_rss_date(entry.get("published", ""))
                    if not pub_date:
                        # Try other date fields
                        pub_date = parse_rss_date(entry.get("updated", ""))
                    if not pub_date:
                        # Skip articles without valid dates
                        continue

                    news.append(
                        {
                            "source": source,
                            "headline": entry.title,
                            "url": entry.link,
                            "publishedAt": pub_date,
                            "summary": entry.get("summary", "")[:200],
                            "sentiment": analyze_sentiment(
                                entry.title, entry.get("summary", "")[:200]
                            ),
                        }
                    )
                    source_count += 1
                    if source_count >= max_per_source:
                        break
        except Exception as e:
            print(f"Error fetching from {source}: {e}")
    return news


def deduplicate_news(news_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate news based on headline similarity."""
    unique = []
    for item in news_list:
        is_duplicate = False
        for existing in unique:
            similarity = SequenceMatcher(
                None, item["headline"].lower(), existing["headline"].lower()
            ).ratio()
            if similarity > 0.8:  # 80% similar = duplicate
                is_duplicate = True
                break
        if not is_duplicate:
            unique.append(item)
    return unique


# Simple in-memory cache for news results
_news_cache: dict[str, dict] = {}
CACHE_DURATION_MINUTES = 5


async def get_multi_source_ticker_news(symbol: str, max_per_source: int = 3) -> list[dict[str, Any]]:
    """
    Aggregate news from multiple sources for a ticker.
    Combines yfinance, DuckDuckGo web search, and RSS feeds.
    Results are cached for 5 minutes to improve performance.
    """
    # Check cache first
    cache_key = f"{symbol}_{max_per_source}"
    if cache_key in _news_cache:
        cached_data = _news_cache[cache_key]
        cache_time = cached_data.get("timestamp")
        if cache_time and datetime.now() - cache_time < timedelta(minutes=CACHE_DURATION_MINUTES):
            return cached_data["news"]

    all_news = []

    # Source 1: yfinance (existing)
    yf_news = get_ticker_news(symbol)
    all_news.extend(yf_news)

    # Source 2: DuckDuckGo web search
    try:
        import os
        import sys

        # Add ai_engine to path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        ai_engine_path = os.path.join(parent_dir, "ai_engine")
        if ai_engine_path not in sys.path:
            sys.path.append(ai_engine_path)

        from utils.web_search import search_stock_news

        ddg_news = await search_stock_news(symbol, max_results=5)
        all_news.extend(
            [
                {
                    "source": item.get("source", "Web Search"),
                    "headline": item["title"],
                    "url": item["url"],
                    "publishedAt": item.get("date", ""),
                    "summary": item.get("body", ""),
                    "sentiment": analyze_sentiment(item["title"], item.get("body", "")),
                }
                for item in ddg_news
            ]
        )
    except Exception as e:
        print(f"Error fetching DuckDuckGo news: {e}")

    # Source 3: RSS feeds filtered by ticker symbol
    rss_news = get_ticker_from_rss_feeds(symbol, max_per_source)
    all_news.extend(rss_news)

    # Deduplicate by headline similarity
    unique_news = deduplicate_news(all_news)

    # Sort by recency (handle missing dates)
    unique_news.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)

    result = unique_news[:15]  # Top 15 from all sources

    # Cache the result
    _news_cache[cache_key] = {"news": result, "timestamp": datetime.now()}

    return result
