import pytest
from unittest.mock import MagicMock
from services.paper_trading import execute_order

@pytest.fixture
def mock_portfolio_io(monkeypatch):
    """Mocks load/save portfolio functions."""
    # Start with default portfolio
    portfolio = {"cash": 100000.0, "holdings": {}, "history": []}
    
    # We use side_effect to simulate state changes if needed, 
    # but for simple tests, just returning the object is often enough 
    # IF the code modifies it in place.
    # However, _load_portfolio returns a new dict usually? 
    # Let's mock it to return a COPY of our local portfolio dict to track changes?
    
    # Actually, paper_trading implementation likely loads, modifies, saves.
    # If we mock _load to return 'portfolio', and code modifies it, 'portfolio' updates.
    
    mock_load = MagicMock(return_value=portfolio)
    mock_save = MagicMock()
    
    monkeypatch.setattr("services.paper_trading._load_portfolio", mock_load)
    monkeypatch.setattr("services.paper_trading._save_portfolio", mock_save)
    
    return portfolio, mock_save

@pytest.fixture
def mock_market_functions(monkeypatch):
    """Mocks get_ticker_data and get_exchange_rate."""
    mock_get_ticker = MagicMock(return_value={"price": {"current": 100.0}})
    monkeypatch.setattr("services.paper_trading.get_ticker_data", mock_get_ticker)
    
    mock_get_rate = MagicMock(return_value=1.0) # USD conversion
    monkeypatch.setattr("services.paper_trading.get_exchange_rate", mock_get_rate)
    
    return mock_get_ticker

def test_execute_buy_order_success(mock_portfolio_io, mock_market_functions):
    portfolio, mock_save = mock_portfolio_io
    
    # Execute BUY 10 AAPL @ 100
    res = execute_order("AAPL", "buy", 10, 100.0)
    
    # Check Result
    assert res["cash"] == 99000.0
    assert "AAPL" in res["holdings"]
    assert res["holdings"]["AAPL"]["quantity"] == 10
    
    # Check Save called
    mock_save.assert_called_once()
    
    # Check portfolio object updated (since execute_order modifies the loaded dict)
    assert portfolio["cash"] == 99000.0

def test_execute_sell_order_short_failure(mock_portfolio_io, mock_market_functions):
    portfolio, _ = mock_portfolio_io
    
    # Try to SELL AAPL without owning it
    with pytest.raises(ValueError) as exc:
        execute_order("AAPL", "sell", 10, 100.0)
    
    assert "Insufficient shares" in str(exc.value)

def test_execute_sell_order_success(mock_portfolio_io, mock_market_functions):
    portfolio, mock_save = mock_portfolio_io
    
    # Setup: Own 20 AAPL
    portfolio["holdings"]["AAPL"] = {"quantity": 20, "average_cost": 90.0}
    portfolio["cash"] = 5000.0
    
    # Execute SELL 10 AAPL @ 110
    res = execute_order("AAPL", "sell", 10, 110.0)
    
    # Cash should increase by 1100 -> 6100
    assert res["cash"] == 6100.0
    assert res["holdings"]["AAPL"]["quantity"] == 10
    
    mock_save.assert_called_once()
