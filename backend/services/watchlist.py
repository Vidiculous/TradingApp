import logging
from typing import List
from sqlmodel import Session, select, delete
from db_models.db import WatchlistItem
from services.db_service import engine

logger = logging.getLogger(__name__)

def get_watchlist() -> List[str]:
    """
    Returns the list of symbols in the watchlist.
    """
    with Session(engine) as session:
        statement = select(WatchlistItem)
        results = session.exec(statement).all()
        return [item.symbol for item in results]

def add_to_watchlist(symbol: str) -> bool:
    """
    Adds a symbol to the watchlist if it doesn't exist.
    """
    symbol = symbol.upper()
    with Session(engine) as session:
        # Check if exists
        statement = select(WatchlistItem).where(WatchlistItem.symbol == symbol)
        existing = session.exec(statement).first()
        if existing:
            return True
            
        new_item = WatchlistItem(symbol=symbol)
        session.add(new_item)
        session.commit()
        return True

def remove_from_watchlist(symbol: str) -> bool:
    """
    Removes a symbol from the watchlist.
    """
    symbol = symbol.upper()
    with Session(engine) as session:
        statement = delete(WatchlistItem).where(WatchlistItem.symbol == symbol)
        session.exec(statement)
        session.commit()
        return True
