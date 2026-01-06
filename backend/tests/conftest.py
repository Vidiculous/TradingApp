import os
import sys
from unittest.mock import MagicMock

import pytest

# Add backend to path so we can import 'main' and 'services'
# Current file is backend/tests/conftest.py, so up one level is backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

@pytest.fixture
def mock_ticker_data():
    """Returns a sample ticker data dictionary."""
    return {
        "price": {
            "current": 150.0,
            "open": 148.0,
            "high": 152.0,
            "low": 147.0,
            "change": 2.0,
            "changePercent": 1.35,
        },
        "fundamentals": {
            "marketCap": 2000000000,
            "volume": 5000000,
            "avgVolume": 4500000,
            "peRatio": 25.5,
            "eps": 5.88,
            "sector": "Technology",
        }
    }

@pytest.fixture
def mock_yf(monkeypatch):
    """Mocks yfinance module in market_data service."""
    mock = MagicMock()
    # We need to mock where it is IMPORTED
    # services.market_data imports yfinance as yf
    monkeypatch.setattr("services.market_data.yf", mock)
    return mock
