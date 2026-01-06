"""
Simple sentiment analyzer for news headlines and summaries.
Classifies news as Bullish, Neutral, or Bearish based on keywords.
"""

from typing import Literal

# Keyword lists for sentiment classification
BULLISH_KEYWORDS = [
    "surge",
    "soar",
    "rally",
    "gain",
    "rise",
    "jump",
    "climb",
    "boost",
    "upgrade",
    "beat",
    "exceed",
    "outperform",
    "strong",
    "growth",
    "profit",
    "revenue",
    "bullish",
    "positive",
    "optimistic",
    "breakthrough",
    "success",
    "record",
    "high",
    "peak",
    "momentum",
    "expansion",
    "opportunity",
    "buy",
    "upside",
]

BEARISH_KEYWORDS = [
    "fall",
    "drop",
    "plunge",
    "tumble",
    "decline",
    "loss",
    "crash",
    "slump",
    "downgrade",
    "miss",
    "underperform",
    "weak",
    "concern",
    "risk",
    "threat",
    "bearish",
    "negative",
    "pessimistic",
    "warning",
    "cut",
    "reduce",
    "low",
    "sell",
    "downside",
    "struggle",
    "challenge",
    "problem",
    "issue",
    "fear",
]


def analyze_sentiment(headline: str, summary: str = "") -> Literal["bullish", "neutral", "bearish"]:
    """
    Analyze sentiment of a news article based on headline and summary.

    Args:
        headline: Article headline
        summary: Article summary/body (optional)

    Returns:
        "bullish", "neutral", or "bearish"
    """
    text = f"{headline} {summary}".lower()

    bullish_count = sum(1 for keyword in BULLISH_KEYWORDS if keyword in text)
    bearish_count = sum(1 for keyword in BEARISH_KEYWORDS if keyword in text)

    # Determine sentiment based on keyword counts
    if bullish_count > bearish_count and bullish_count >= 2:
        return "bullish"
    elif bearish_count > bullish_count and bearish_count >= 2:
        return "bearish"
    elif bullish_count > bearish_count:
        return "bullish"
    elif bearish_count > bullish_count:
        return "bearish"
    else:
        return "neutral"


def get_sentiment_color(sentiment: str) -> str:
    """Get color code for sentiment."""
    colors = {"bullish": "emerald", "neutral": "gray", "bearish": "red"}
    return colors.get(sentiment, "gray")
