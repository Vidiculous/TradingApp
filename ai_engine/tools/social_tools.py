from ai_engine.utils.web_search import search_general
import asyncio
from typing import Dict, Any, List

async def get_social_sentiment(ticker: str) -> Dict[str, Any]:
    """
    Scan social media platforms (Reddit, X) to gauge retail sentiment 
    and identifying potential 'hype' or meme-stock status.
    """
    try:
        query = f"${ticker} stock sentiment reddit wallstreetbets twitter X talk hype"
        search_results = await search_general(query, max_results=5)
        
        findings = []
        if search_results:
            for res in search_results:
                findings.append({
                    "source": res.get("url", "N/A"),
                    "snippet": res.get("body", "N/A")[:300] + "..."
                })
                
        return {
            "ticker": ticker,
            "social_mentions": findings,
            "sentiment_summary": "Perform a holistic analysis of these mentions to determine if retail interest is spiking."
        }
    except Exception as e:
        return {"error": f"Failed to fetch social sentiment for {ticker}: {str(e)}"}

# JSON Schema
GET_SOCIAL_SENTIMENT_SCHEMA = {
    "name": "get_social_sentiment",
    "description": "Scan social media (Reddit, X) to identify retail 'hype' and sentiment trends for a stock.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"]
    }
}
