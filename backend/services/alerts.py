import json
import logging
import os
import uuid

logger = logging.getLogger(__name__)

ALERTS_FILE = "data/alerts.json"


def _load_alerts() -> list[dict]:
    if not os.path.exists("data"):
        os.makedirs("data")

    if not os.path.exists(ALERTS_FILE):
        return []

    try:
        with open(ALERTS_FILE) as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load alerts: {e}")
        return []


def _save_alerts(alerts: list[dict]):
    try:
        with open(ALERTS_FILE, "w") as f:
            json.dump(alerts, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save alerts: {e}")


def get_alerts(symbol: str | None = None) -> list[dict]:
    alerts = _load_alerts()
    if symbol:
        return [a for a in alerts if a["symbol"] == symbol.upper()]
    return alerts


def add_alert(symbol: str, target_price: float, condition: str):
    """
    condition: 'ABOVE' or 'BELOW'
    """
    alerts = _load_alerts()

    alert = {
        "id": str(uuid.uuid4()),
        "symbol": symbol.upper(),
        "target_price": target_price,
        "condition": condition.upper(),
        "created_at": 0,  # TODO: Timestamp
    }

    alerts.append(alert)
    _save_alerts(alerts)
    return alert


def delete_alert(alert_id: str):
    alerts = _load_alerts()
    alerts = [a for a in alerts if a["id"] != alert_id]
    _save_alerts(alerts)
    return True
