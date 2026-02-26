"""
Sentiment Analyzer Service.
Uses Google Gemini Flash for batch sentiment analysis of news headlines.
Falls back to keyword-based analysis if LLM is unavailable.
"""

import hashlib
import json
import logging
import os
from typing import Any, Dict, List, Literal, Optional

from services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

# Cache for sentiment results to avoid re-analyzing same headlines
# Key: headline_hash, Value: sentiment_dict
_SENTIMENT_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_SIZE_LIMIT = 1000

# LLM provider config — matches how agents resolve their provider
_LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
_LLM_MODEL = os.getenv(
    "LLM_MODEL",
    os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
)
_API_KEY_MAP = {
    "gemini": os.getenv("GEMINI_API_KEY", ""),
    "openai": os.getenv("OPENAI_API_KEY", ""),
    "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
}
api_key = _API_KEY_MAP.get(_LLM_PROVIDER, "")

# Keyword lists for fallback
BULLISH_KEYWORDS = [
    "surge", "soar", "rally", "gain", "rise", "jump", "climb", "boost", "upgrade",
    "beat", "exceed", "outperform", "strong", "growth", "profit", "revenue",
    "bullish", "positive", "optimistic", "breakthrough", "success", "record",
    "high", "peak", "momentum", "expansion", "opportunity", "buy", "upside"
]

BEARISH_KEYWORDS = [
    "fall", "drop", "plunge", "tumble", "decline", "loss", "crash", "slump",
    "downgrade", "miss", "underperform", "weak", "concern", "risk", "threat",
    "bearish", "negative", "pessimistic", "warning", "cut", "reduce", "low",
    "sell", "downside", "struggle", "challenge", "problem", "issue", "fear"
]


def analyze_sentiment_keyword(headline: str, summary: str = "") -> Dict[str, Any]:
    """
    Fallback keyword-based sentiment analysis.
    Returns structured dict compatible with LLM output.
    """
    text = f"{headline} {summary}".lower()
    bullish_count = sum(1 for k in BULLISH_KEYWORDS if k in text)
    bearish_count = sum(1 for k in BEARISH_KEYWORDS if k in text)

    sentiment = "NEUTRAL"
    confidence = 0.5

    if bullish_count > bearish_count:
        sentiment = "BULLISH"
        confidence = 0.6 + (0.1 * min(bullish_count, 3))
    elif bearish_count > bullish_count:
        sentiment = "BEARISH"
        confidence = 0.6 + (0.1 * min(bearish_count, 3))

    return {
        "sentiment": sentiment,
        "confidence": round(confidence, 2),
        "reason": f"Keyword match (Bullish: {bullish_count}, Bearish: {bearish_count})"
    }


def analyze_sentiment(headline: str, summary: str = "") -> str:
    """
    Backward compatibility wrapper for synchronous callers.
    Returns just the sentiment string (BULLISH, BEARISH, NEUTRAL).
    """
    result = analyze_sentiment_keyword(headline, summary)
    return result["sentiment"]


async def call_gemini_flash_batch(headlines: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Call the configured LLM provider to analyze a batch of headlines.
    """
    if not api_key:
        raise ValueError(f"API key for provider '{_LLM_PROVIDER}' not set")

    system = """
    Analyze the sentiment of the following financial news headlines.
    For each headline, determine if it is BULLISH, BEARISH, or NEUTRAL for the mentioned asset/market.
    Provide a confidence score (0.0 - 1.0) and a brief reason.
    
    Output JSON (List of objects):
    [
        {"sentiment": "BULLISH", "confidence": 0.9, "reason": "Revenue beat expectations"},
        ...
    ]
    RETURN JSON ONLY.
    """
    
    user_content = json.dumps(headlines, indent=2)

    response_text = await LLMProvider.call(
        provider=_LLM_PROVIDER,
        model_id=_LLM_MODEL,
        api_key=api_key,
        system_prompt=system,
        user_content=user_content,
        is_json=True
    )
    
    return json.loads(response_text)


async def analyze_sentiment_smart(news_items: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Smart sentiment analysis with batch LLM processing and caching.
    
    Args:
        news_items: List of dicts with 'title' and optional 'summary'
        
    Returns:
        List of sentiment dicts: {"sentiment": str, "confidence": float, "reason": str}
    """
    if not news_items:
        return []

    results = [None] * len(news_items)
    indices_to_fetch = []
    payload_to_fetch = []

    # 1. Check Cache
    for i, item in enumerate(news_items):
        # Create a stable hash for the content
        content = f"{item.get('title', '')}|{item.get('summary', '')}"
        h = hashlib.md5(content.encode()).hexdigest()
        
        if h in _SENTIMENT_CACHE:
            results[i] = _SENTIMENT_CACHE[h]
        else:
            indices_to_fetch.append(i)
            payload_to_fetch.append({
                "id": i,
                "headline": item.get("title", ""),
                "summary": item.get("summary", "")[:200]
            })

    # 2. Call LLM for missing items
    if payload_to_fetch:
        try:
            # Batch call (chunking could be added here if list is huge, e.g. >20)
            # Gemini Flash is fast, but let's limit batch size if needed. 
            # For now assume mostly < 20 items per request.
            
            llm_results = await call_gemini_flash_batch(payload_to_fetch)
            
            # Map back results
            # The LLM output logic above implies an ordered list matching input.
            # But prompt didn't explicitly enforce ID matching in output as strictly.
            # However, usually ordered list input -> ordered list output.
            
            if len(llm_results) != len(payload_to_fetch):
                logger.warning(f"LLM returned {len(llm_results)} items, expected {len(payload_to_fetch)}. Fallback for all.")
                raise ValueError("Mismatch in batch response length")
            
            for idx_in_batch, result in enumerate(llm_results):
                original_idx = indices_to_fetch[idx_in_batch]
                
                # Normalize result
                sent = result.get("sentiment", "NEUTRAL").upper()
                conf = float(result.get("confidence", 0.5))
                reason = result.get("reason", "AI Analysis")
                
                final_res = {
                    "sentiment": sent,
                    "confidence": conf,
                    "reason": reason
                }
                
                results[original_idx] = final_res
                
                # Cache it
                item = news_items[original_idx]
                h = hashlib.md5(f"{item.get('title', '')}|{item.get('summary', '')}".encode()).hexdigest()
                _SENTIMENT_CACHE[h] = final_res

        except Exception as e:
            logger.error(f"LLM Sentiment Failed: {e}. Falling back to keywords.")
            # Fallback for all pending items
            for idx in indices_to_fetch:
                item = news_items[idx]
                results[idx] = analyze_sentiment_keyword(
                    item.get("title", ""), 
                    item.get("summary", "")
                )

    # 3. Cache Maintenance — evict oldest half instead of clearing all
    if len(_SENTIMENT_CACHE) > CACHE_SIZE_LIMIT:
        keys_to_remove = list(_SENTIMENT_CACHE.keys())[: len(_SENTIMENT_CACHE) // 2]
        for k in keys_to_remove:
            del _SENTIMENT_CACHE[k]

    return results


def get_sentiment_color(sentiment: str) -> str:
    """Get color code for sentiment."""
    colors = {
        "BULLISH": "emerald",
        "POSITIVE": "emerald",
        "NEUTRAL": "gray",
        "BEARISH": "red",
        "NEGATIVE": "red"
    }
    return colors.get(sentiment.upper(), "gray")
