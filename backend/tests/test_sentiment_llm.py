"""
Tests for LLM-Based Sentiment Analysis.
"""

from unittest.mock import AsyncMock, patch

import pytest

from services.sentiment import analyze_sentiment_smart

# Mock headlines
HEADLINES = [
    {"title": "AAPL reported record earnings", "summary": "Revenue up 20%"},
    {"title": "Analyst downgrades TSLA", "summary": "Demand concerns cited"},
    {"title": "Market is flat today", "summary": "No major movement"},
]


class TestLLMSentiment:
    @pytest.mark.asyncio
    async def test_smart_sentiment_llm_success(self):
        """Test that LLM is used when available."""
        
        # Mock the LLM response
        mock_response = [
            {"sentiment": "BULLISH", "confidence": 0.9, "reason": "Record earnings"},
            {"sentiment": "BEARISH", "confidence": 0.8, "reason": "Downgrade"},
            {"sentiment": "NEUTRAL", "confidence": 0.5, "reason": "Flat market"},
        ]
        
        with patch("services.sentiment.call_gemini_flash_batch", new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = mock_response
            
            results = await analyze_sentiment_smart(HEADLINES)
            
            assert len(results) == 3
            assert results[0]["sentiment"] == "BULLISH"
            assert results[1]["sentiment"] == "BEARISH"
            assert "confidence" in results[0]
            mock_llm.assert_called_once()

    @pytest.mark.asyncio
    async def test_smart_sentiment_fallback(self):
        """Test fallback to keyword analysis if LLM fails."""
        
        with patch("services.sentiment.call_gemini_flash_batch", new_callable=AsyncMock) as mock_llm:
            # Simulate failure
            mock_llm.side_effect = Exception("API Error")
            
            # Should not raise, but fall back
            results = await analyze_sentiment_smart(HEADLINES)
            
            assert len(results) == 3
            # Keyword analyzer should catch these simple terms
            # "record earnings" -> Bullish
            # "downgrades" -> Bearish
            # "flat" -> Neutral
            
            assert results[0]["sentiment"] in ["BULLISH", "POSITIVE"]  # Depending on keyword dict
            assert results[1]["sentiment"] in ["BEARISH", "NEGATIVE"]
            
    @pytest.mark.asyncio
    async def test_empty_input(self):
        results = await analyze_sentiment_smart([])
        assert results == []
