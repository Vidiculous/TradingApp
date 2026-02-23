"""
Tests for the Analysis History Service.
"""

import json
import os
import tempfile
from unittest.mock import patch

import pytest

# conftest.py ensures backend is in sys.path
from services.analysis_history import (
    format_history_for_prompt,
    get_all_history,
    get_history,
    save_analysis,
)


@pytest.fixture(autouse=True)
def use_temp_history_file(tmp_path):
    """Redirect history file to a temp location for each test."""
    temp_file = str(tmp_path / "analysis_history.json")
    with patch("services.analysis_history.HISTORY_FILE", temp_file):
        with patch("services.analysis_history._ensure_data_dir", lambda: None):
            yield temp_file


def _make_result(ticker="AAPL", action="BUY", confidence=0.85, price=150.0) -> dict:
    """Helper to create a mock analysis result."""
    return {
        "ticker": ticker,
        "timestamp": "2026-02-11T10:00:00",
        "horizon": "Swing",
        "action": action,
        "decision": {
            "action": action,
            "confidence": confidence,
            "trade_type": "LONG",
            "entry_zone": "149.00 - 151.00",
            "target": 160.0,
            "stop_loss": 145.0,
            "intended_timeframe": "3 days",
            "reasoning": "Strong bullish confluence across all agents.",
            "conclusion": f"Execute Swing Long on {ticker}.",
            "current_price": price,
            "squad_consensus": {
                "chartist": "Bullish",
                "quant": "Neutral",
                "scout": "Bullish",
                "fundamentalist": "Bullish",
            },
        },
        "risk_validation": {"approved": True, "verdict": "APPROVED"},
        "squad_details": {},
    }


class TestSaveAndGetHistory:
    def test_save_and_retrieve(self):
        """Save an analysis and retrieve it."""
        result = _make_result()
        record = save_analysis("AAPL", "Swing", result)

        assert record["ticker"] == "AAPL"
        assert record["action"] == "BUY"
        assert record["confidence"] == 0.85

        history = get_history("AAPL")
        assert len(history) == 1
        assert history[0]["ticker"] == "AAPL"

    def test_multiple_saves_ordered(self):
        """Multiple saves should be in reverse chronological order."""
        save_analysis("AAPL", "Swing", _make_result(action="BUY"))
        save_analysis("AAPL", "Swing", _make_result(action="HOLD"))
        save_analysis("AAPL", "Swing", _make_result(action="SELL"))

        history = get_history("AAPL")
        assert len(history) == 3
        # Most recent first
        assert history[0]["action"] == "SELL"
        assert history[1]["action"] == "HOLD"
        assert history[2]["action"] == "BUY"

    def test_history_limit(self):
        """get_history should respect the limit parameter."""
        for i in range(10):
            save_analysis("AAPL", "Swing", _make_result())

        history = get_history("AAPL", limit=3)
        assert len(history) == 3

    def test_history_filters_by_ticker(self):
        """get_history should only return records for the specified ticker."""
        save_analysis("AAPL", "Swing", _make_result(ticker="AAPL"))
        save_analysis("TSLA", "Swing", _make_result(ticker="TSLA"))
        save_analysis("AAPL", "Swing", _make_result(ticker="AAPL"))

        aapl_history = get_history("AAPL")
        assert len(aapl_history) == 2
        assert all(h["ticker"] == "AAPL" for h in aapl_history)

        tsla_history = get_history("TSLA")
        assert len(tsla_history) == 1

    def test_get_all_history(self):
        """get_all_history should return records across all tickers."""
        save_analysis("AAPL", "Swing", _make_result(ticker="AAPL"))
        save_analysis("TSLA", "Invest", _make_result(ticker="TSLA"))

        all_history = get_all_history()
        assert len(all_history) == 2

    def test_empty_history(self):
        """Getting history when none exists should return empty list."""
        history = get_history("AAPL")
        assert history == []


class TestFormatHistoryForPrompt:
    def test_empty_history(self):
        """Empty history should return a descriptive message."""
        result = format_history_for_prompt([])
        assert "No previous analyses" in result

    def test_formatted_output_contains_key_fields(self):
        """Formatted output should contain action, confidence, and reasoning."""
        save_analysis("AAPL", "Swing", _make_result())
        history = get_history("AAPL")
        formatted = format_history_for_prompt(history)

        assert "PREVIOUS ANALYSIS DECISIONS" in formatted
        assert "BUY" in formatted
        assert "0.85" in formatted
        assert "Swing" in formatted

    def test_multiple_records_formatted(self):
        """Multiple records should each get their own section."""
        save_analysis("AAPL", "Swing", _make_result(action="BUY"))
        save_analysis("AAPL", "Swing", _make_result(action="SELL"))
        history = get_history("AAPL")
        formatted = format_history_for_prompt(history)

        assert "Analysis #1" in formatted
        assert "Analysis #2" in formatted
