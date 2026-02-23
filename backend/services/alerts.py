import logging
import uuid
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select, delete
from db_models.db import Alert
from services.db_service import engine

logger = logging.getLogger(__name__)

def get_alerts(symbol: str | None = None) -> List[dict]:
    """
    Get all alerts, optionally filtered by symbol.
    """
    with Session(engine) as session:
        statement = select(Alert)
        if symbol:
            statement = statement.where(Alert.symbol == symbol.upper())
        
        results = session.exec(statement).all()
        return [r.dict() for r in results]

def add_alert(symbol: str, target_price: float, condition: str):
    """
    condition: 'ABOVE' or 'BELOW'
    """
    with Session(engine) as session:
        alert = Alert(
            id=str(uuid.uuid4()),
            symbol=symbol.upper(),
            target_price=target_price,
            condition=condition.upper(),
            created_at=datetime.utcnow(),
            is_active=True
        )
        session.add(alert)
        session.commit()
        session.refresh(alert)
        return alert.dict()

def delete_alert(alert_id: str):
    """
    Delete an alert by its ID.
    """
    with Session(engine) as session:
        statement = delete(Alert).where(Alert.id == alert_id)
        session.exec(statement)
        session.commit()
    return True
