from sqlmodel import Session, select, delete
from db_models.db import AnalysisResult, Position, WatchlistItem, Alert, Account
from services.db_service import engine, init_db
from services.analysis_history import save_analysis, get_history
from services.paper_trading import execute_order, get_portfolio, reset_portfolio

# Ensure database and tables exist
init_db()

def test_db_connection():
    with Session(engine) as session:
        # Check if we can select from each table
        session.exec(select(AnalysisResult)).all()
        session.exec(select(Position)).all()
        session.exec(select(WatchlistItem)).all()
        session.exec(select(Alert)).all()
        session.exec(select(Account)).all()

def test_analysis_history_db():
    ticker = "TEST_DB_TICKER"
    result_data = {
        "action": "BUY",
        "decision": {
            "confidence": 0.9,
            "conclusion": "Test reasoning",
            "current_price": 150.0,
            "squad_consensus": {"scout": "bullish", "quant": "neutral"}
        }
    }
    
    # Save
    save_analysis(ticker, "Short Term", result_data)
    
    # Retrieve
    history = get_history(ticker)
    assert len(history) >= 1
    # Check if any from this specific run matches
    test_record = next((r for r in history if r["ticker"] == ticker), None)
    assert test_record is not None
    assert test_record["confidence"] == 0.9

def test_portfolio_db():
    # Clean state for this test
    reset_portfolio()
    
    symbol = "DB_POS_TEST"
    # Execute BUY
    execute_order(symbol, "BUY", 10, 100.0)
    
    portfolio = get_portfolio()
    pos = next((p for p in portfolio["positions"] if p["symbol"] == symbol), None)
    assert pos is not None
    assert pos["qty"] == 10
    
    # Execute SELL
    execute_order(symbol, "SELL", 5, 110.0)
    portfolio = get_portfolio()
    pos = next((p for p in portfolio["positions"] if p["symbol"] == symbol), None)
    assert pos["qty"] == 5
