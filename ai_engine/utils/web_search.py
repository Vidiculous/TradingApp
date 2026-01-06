"""
Web Search Utility for AI Agents
Uses DuckDuckGo to fetch recent news and information about stocks.
"""

import asyncio
from datetime import datetime

try:
    from duckduckgo_search import DDGS

    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False
    print("Warning: duckduckgo_search not installed. Web search disabled.")


async def search_stock_news(
    symbol: str, company_name: str | None = None, max_results: int = 5
) -> list[dict]:
    """
    Search for recent news about a stock.

    Args:
        symbol: Stock ticker symbol (e.g., "AAPL")
        company_name: Optional company name for better results
        max_results: Maximum number of results to return

    Returns:
        List of news results with title, body, url, and date
    """
    if not DDGS_AVAILABLE:
        return []

    try:
        # Build search query
        query = f"{symbol} stock news"
        if company_name:
            query = f"{company_name} {symbol} stock news"

        # Run search in thread to avoid blocking
        def do_search():
            with DDGS() as ddgs:
                results = list(
                    ddgs.news(query, max_results=max_results, timelimit="w")
                )  # Last week
                return results

        results = await asyncio.to_thread(do_search)

        # Format results
        formatted = []
        for r in results:
            formatted.append(
                {
                    "title": r.get("title", ""),
                    "body": (
                        r.get("body", "")[:300] + "..."
                        if len(r.get("body", "")) > 300
                        else r.get("body", "")
                    ),
                    "source": r.get("source", ""),
                    "date": r.get("date", ""),
                    "url": r.get("url", ""),
                }
            )

        return formatted
    except Exception as e:
        print(f"Web search error: {e}")
        return []


async def search_general(query: str, max_results: int = 5) -> list[dict]:
    """
    General web search.

    Args:
        query: Search query
        max_results: Maximum number of results

    Returns:
        List of search results
    """
    if not DDGS_AVAILABLE:
        return []

    try:

        def do_search():
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                return results

        results = await asyncio.to_thread(do_search)

        formatted = []
        for r in results:
            formatted.append(
                {
                    "title": r.get("title", ""),
                    "body": (
                        r.get("body", "")[:300] + "..."
                        if len(r.get("body", "")) > 300
                        else r.get("body", "")
                    ),
                    "url": r.get("href", ""),
                }
            )

        return formatted
    except Exception as e:
        print(f"Web search error: {e}")
        return []


def get_current_datetime_context() -> str:
    """
    Returns a formatted string with the current date and time for agent context.
    """
    now = datetime.now()
    return f"""
CURRENT DATE AND TIME: {now.strftime('%Y-%m-%d %H:%M:%S')}
TODAY IS: {now.strftime('%A, %B %d, %Y')}
IMPORTANT: Base ALL your analysis on this current date. Do NOT reference outdated information from your training data.
"""


def format_news_for_context(news_results: list[dict]) -> str:
    """
    Format news results into a string for agent context.
    """
    if not news_results:
        return "No recent news available."

    lines = ["RECENT NEWS (from web search):"]
    for i, article in enumerate(news_results, 1):
        lines.append(f"\n{i}. {article['title']}")
        if article.get("source"):
            lines.append(f"   Source: {article['source']}")
        if article.get("date"):
            lines.append(f"   Date: {article['date']}")
        if article.get("body"):
            lines.append(f"   Summary: {article['body']}")

    return "\n".join(lines)
