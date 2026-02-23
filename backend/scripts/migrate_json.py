import json
import os
import sys
from datetime import datetime
from sqlmodel import Session, SQLModel, create_engine

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_models.db import AnalysisResult, Position, WatchlistItem, Alert
from services.db_service import engine as db_engine

def migrate():
    # Ensure tables exist
    SQLModel.metadata.create_all(db_engine)
    
    with Session(db_engine) as session:
        # 1. Migrate Analysis History
        history_file = "data/analysis_history.json"
        if os.path.exists(history_file):
            print(f"Migrating {history_file}...")
            with open(history_file, "r") as f:
                history_data = json.load(f)
                for item in history_data:
                    ts = item.get("timestamp")
                    if isinstance(ts, str):
                        try:
                            ts = datetime.fromisoformat(ts)
                        except:
                            ts = datetime.utcnow()
                    
                    record = AnalysisResult(
                        ticker=item.get("ticker", "UNKNOWN"),
                        horizon=item.get("horizon", "N/A"),
                        timestamp=ts or datetime.utcnow(),
                        signal=item.get("action", "HOLD"),
                        confidence=item.get("confidence", 0.0),
                        summary=item.get("summary", "") or item.get("reasoning_summary", ""),
                        action=item.get("action", "HOLD"),
                        reasoning=item.get("reasoning", ""),
                        price_at_analysis=item.get("price_at_analysis", 0.0),
                        squad_results=item.get("squad_results", {})
                    )
                    session.add(record)
            print("Analysis History migration complete.")

        # 2. Migrate Portfolio Positions
        portfolio_file = "data/portfolio.json"
        if os.path.exists(portfolio_file):
            print(f"Migrating {portfolio_file}...")
            with open(portfolio_file, "r") as f:
                data = json.load(f)
                holdings = data.get("holdings", {}) # Old structure used 'holdings'
                # Check for new structure too
                if not holdings and "positions" in data:
                    holdings = data["positions"]
                
                for symbol, pos in holdings.items():
                    # Handle both dict-based and list-based (if it was converted)
                    if isinstance(pos, dict):
                        p = Position(
                            symbol=symbol.upper(),
                            qty=pos.get("quantity", pos.get("qty", 0.0)),
                            avg_price=pos.get("average_cost", pos.get("avg_price", 0.0)),
                            current_price=pos.get("current_price", 0.0),
                            stop_loss=pos.get("stop_loss"),
                            sl_type=pos.get("sl_type", "fixed"),
                            take_profit=pos.get("take_profit"),
                            tp_config=pos.get("tp_config", {}),
                            last_updated=datetime.utcnow()
                        )
                        session.add(p)
            print("Portfolio positions migration complete.")

        # 3. Migrate Watchlist
        watchlist_file = "data/watchlist.json"
        if os.path.exists(watchlist_file):
            print(f"Migrating {watchlist_file}...")
            with open(watchlist_file, "r") as f:
                watchlist_data = json.load(f)
                # Structure: ["AAPL", "TSLA", ...] or [{"symbol": "..."}]
                for entry in watchlist_data:
                    symbol = entry if isinstance(entry, str) else entry.get("symbol")
                    if symbol:
                        w = WatchlistItem(symbol=symbol.upper())
                        session.add(w)
            print("Watchlist migration complete.")

        # 4. Migrate Alerts
        alerts_file = "data/alerts.json"
        if os.path.exists(alerts_file):
            print(f"Migrating {alerts_file}...")
            with open(alerts_file, "r") as f:
                alerts_data = json.load(f)
                for alert_id, alert_info in alerts_data.items():
                    a = Alert(
                        id=alert_id,
                        symbol=alert_info.get("symbol", "UNKNOWN").upper(),
                        target_price=alert_info.get("target_price", 0.0),
                        condition=alert_info.get("condition", "above"),
                        created_at=datetime.utcnow(),
                        is_active=True
                    )
                    session.add(a)
            print("Alerts migration complete.")

        session.commit()
        print("TOTAL MIGRATION SUCCESSFUL.")

if __name__ == "__main__":
    migrate()
