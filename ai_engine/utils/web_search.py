"""
Web Search Utility for AI Agents
Uses DuckDuckGo to fetch recent news and information about stocks.
"""

import asyncio
import os
import ssl
from datetime import datetime

# Disable SSL verification globally for this process to handle local issuer certificate issues
try:
    if not os.environ.get("PYTHONHTTPSVERIFY", ""):
        ssl._create_default_https_context = ssl._create_unverified_context
        # Also try to set env var for sub-processes / other libraries
        os.environ["PYTHONHTTPSVERIFY"] = "0"
except Exception as e:
    print(f"Warning: Failed to disable global SSL verification: {e}")

try:
    try:
        from ddgs import DDGS
    except ImportError:
        from duckduckgo_search import DDGS

    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False
    print("Warning: ddgs/duckduckgo_search not installed. Web search disabled.")


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
            results = []

            # --- Attempt 1: news endpoint, no time restriction ---
            # Using timelimit="w" (1 week) was too narrow for non-US stocks that don't
            # have daily English coverage. We search without a time limit first so that
            # recent-but-not-this-week articles are still found.
            print(f"    [WebSearch] Attempt 1: Searching news for '{query}'")
            try:
                with DDGS(verify=False) as ddgs:
                    results = list(ddgs.news(query, max_results=max_results))
                    if results:
                        print(f"    [WebSearch] Attempt 1 success: Found {len(results)} news results.")
                        return results
                    print(f"    [WebSearch] Attempt 1 returned 0 results.")
            except Exception as e:
                print(f"    [WebSearch] Attempt 1 error: {e}")

            # --- Attempt 2: strip exchange suffix and try company name ---
            # e.g. SAAB-B.ST -> "Saab" or "SAAB-B"; VOW3.DE -> "VOW3"
            base_symbol = symbol.split(".")[0] if "." in symbol else symbol
            # Remove share-class suffixes like -B, -A (common in Nordic markets)
            plain_name = base_symbol.split("-")[0] if "-" in base_symbol else base_symbol
            alt_query = company_name if company_name else f"{plain_name} stock"
            if alt_query != query:
                print(f"    [WebSearch] Attempt 2: Searching news for '{alt_query}'")
                try:
                    with DDGS(verify=False) as ddgs:
                        results = list(ddgs.news(alt_query, max_results=max_results))
                        if results:
                            print(f"    [WebSearch] Attempt 2 success: Found {len(results)} news results.")
                            return results
                        print(f"    [WebSearch] Attempt 2 returned 0 results.")
                except Exception as e:
                    print(f"    [WebSearch] Attempt 2 error: {e}")

            # --- Fallback: general text search ---
            # The text endpoint has broader coverage than the news endpoint.
            fallback_query = company_name if company_name else f"{plain_name} {base_symbol} news"
            try:
                print(f"    [WebSearch] Fallback: General text search for '{fallback_query}'")
                with DDGS(verify=False) as ddgs:
                    results = list(ddgs.text(fallback_query, max_results=max_results))
                    if results:
                        print(f"    [WebSearch] Fallback success: Found {len(results)} text results.")
                    else:
                        print(f"    [WebSearch] Fallback returned 0 results.")
                    return results
            except Exception as e:
                print(f"    [WebSearch] Fallback error: {e}")
                return []

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
            print(f"    [WebSearch] General search: {query}")
            try:
                with DDGS(verify=False) as ddgs:
                    results = list(ddgs.text(query, max_results=max_results))
                    print(f"    [WebSearch] Found {len(results)} results.")
                    return results
            except Exception as e:
                print(f"    [WebSearch] DDGS Error: {e}")
                raise e

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
