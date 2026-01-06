import pytest
from unittest.mock import MagicMock
from services.market_data import get_ticker_data

def test_get_ticker_data_success(mock_yf):
    # Setup mock
    mock_ticker = MagicMock()
    mock_yf.Ticker.return_value = mock_ticker
    
    # Mock history
    import pandas as pd
    mock_hist = pd.DataFrame({
        "Open": [100.0],
        "High": [105.0],
        "Low": [95.0],
        "Close": [102.0],
        "Volume": [1000]
    }, index=pd.to_datetime(["2023-01-01"]))
    mock_ticker.history.return_value = mock_hist
    
    # Mock info
    mock_ticker.info = {
        "marketCap": 1_000_000,
        "averageVolume": 5000,
        "trailingPE": 20.0,
        "trailingEps": 5.0,
        "sector": "Tech"
    }
    
    # Call function
    data = get_ticker_data("AAPL")
    
    # Assertions
    assert data["price"]["current"] == 102.0
    # assert data["price"]["open"] == 100.0 # Not in return structure
    # Note: market_data logic calculates change based on open/close or previous close
    # Logic: if 'Close' and 'Open' are available...
    
    assert data["fundamentals"]["marketCap"] == 1_000_000
    # assert data["fundamentals"]["sector"] == "Tech"

def test_get_ticker_data_no_data(mock_yf):
    # Setup mock to return empty history
    mock_ticker = MagicMock()
    mock_yf.Ticker.return_value = mock_ticker
    
    mock_ticker.info = {}
    import pandas as pd
    mock_ticker.history.return_value = pd.DataFrame() # Empty DF is fine
    
    # Call function - should raise Exception
    with pytest.raises(Exception) as excinfo:
        get_ticker_data("BADSYM")
    
    assert "No data found" in str(excinfo.value)
