import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

# Import app. 
# conftest.py ensures 'backend' is in sys.path
from main import app

client = TestClient(app)

def test_api_config():
    response = client.get("/api/config")
    assert response.status_code == 200
    assert "demo_mode" in response.json()

def test_get_ticker_endpoint(mock_yf):
    # Setup Mock
    mock_ticker = MagicMock()
    mock_yf.Ticker.return_value = mock_ticker
    
    # Mock history
    import pandas as pd
    mock_hist = pd.DataFrame({
        "Open": [150.0],
        "High": [155.0],
        "Low": [149.0],
        "Close": [153.0],
        "Volume": [10000]
    }, index=pd.to_datetime(["2023-01-01"]))
    mock_ticker.history.return_value = mock_hist
    
    # Mock info
    mock_ticker.info = {"marketCap": 1000, "currency": "USD"}
    
    # Call Endpoint
    response = client.get("/api/ticker/AAPL")
    
    assert response.status_code == 200
    data = response.json()
    assert data["price"]["current"] == 153.0
    assert data["meta"]["symbol"] == "AAPL"

def test_get_ticker_not_found(mock_yf):
    # Setup Mock to raise or return empty
    mock_ticker = MagicMock()
    mock_yf.Ticker.return_value = mock_ticker
    
    # Return empty methods implies failure? 
    # Logic in get_ticker_data: raises Exception if history empty
    import pandas as pd
    mock_ticker.history.return_value = pd.DataFrame()
    mock_ticker.info = {} # Ensure info doesn't return Mocks
    
    response = client.get("/api/ticker/INVALID")
    
    # The endpoint catches exceptions and returns 500 (or 503/404 based on logic)
    # main.py: Exception -> 500 generally.
     # "Market data unavailable" -> 500.
    
    assert response.status_code in [404, 500]
    assert "error" in response.json().get("detail", {}) or "message" in response.json().get("detail", {})
