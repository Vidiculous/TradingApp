import logging
import uuid
from datetime import datetime
from typing import List, Optional
from sqlmodel import Session, select, delete
from db_models.db import Account, Position, OrderHistory
from services.db_service import engine

# Configure logging
logger = logging.getLogger(__name__)

def _get_or_create_account(session: Session) -> Account:
    account = session.get(Account, "default")
    if not account:
        account = Account(id="default", cash_balance=100000.0, initial_balance=100000.0)
        session.add(account)
        session.commit()
        session.refresh(account)
    return account

def get_portfolio() -> dict:
    """
    Returns the current portfolio summary including cash and positions.
    """
    with Session(engine) as session:
        account = _get_or_create_account(session)
        cash = account.cash_balance
        
        statement = select(Position)
        positions = session.exec(statement).all()
        
        pos_list = []
        for p in positions:
            d = p.dict()
            if isinstance(d.get("last_updated"), datetime):
                d["last_updated"] = d["last_updated"].isoformat()
            # Add frontend-friendly aliases
            d["quantity"] = d["qty"]
            d["average_cost"] = d["avg_price"]
            pos_list.append(d)
            
        total_market_value = sum(p.qty * p.current_price for p in positions)
        total_value = cash + total_market_value

        # Fetch order history
        history_stmt = select(OrderHistory).order_by(OrderHistory.timestamp.desc()).limit(50)
        history_entries = session.exec(history_stmt).all()
        history_list = []
        for h in history_entries:
            d = h.dict()
            if isinstance(d.get("timestamp"), datetime):
                d["timestamp"] = d["timestamp"].isoformat()
            history_list.append(d)

        # Map for frontend compatibility
        holdings = {p["symbol"]: p for p in pos_list}

        return {
            "cash": cash,
            "holdings": holdings,
            "positions": pos_list,
            "total_value": total_value,
            "history": history_list,
        }

def execute_order(
    symbol: str,
    side: str,
    qty: float,
    price: float,
    stop_loss: Optional[float] = None,
    sl_type: str = "fixed",
    take_profit: Optional[float] = None,
    tp_config: dict = None,
    reason: str = "manual",
):
    symbol = symbol.upper()
    total_cost = qty * price

    with Session(engine) as session:
        account = _get_or_create_account(session)

        statement = select(Position).where(Position.symbol == symbol)
        position = session.exec(statement).first()

        side_upper = side.upper()

        if side_upper == "BUY":
            if account.cash_balance < total_cost:
                raise ValueError(
                    f"Insufficient cash balance: ${account.cash_balance:.2f} < ${total_cost:.2f}"
                )

            account.cash_balance -= total_cost
            account.last_updated = datetime.utcnow()

            if position:
                # Update existing position
                avg_total = (position.qty * position.avg_price) + total_cost
                position.qty += qty
                position.avg_price = avg_total / position.qty
                position.current_price = price
                position.last_updated = datetime.utcnow()
            else:
                # Create new position
                position = Position(
                    symbol=symbol,
                    qty=qty,
                    avg_price=price,
                    current_price=price,
                    stop_loss=stop_loss,
                    sl_type=sl_type,
                    take_profit=take_profit,
                    tp_config=tp_config or {},
                    last_updated=datetime.utcnow(),
                )
                session.add(position)

            # Record order history
            history_entry = OrderHistory(
                symbol=symbol,
                side=side_upper,
                qty=qty,
                price=price,
                total_value=total_cost,
                realized_pnl=None,
                reason=reason,
                timestamp=datetime.utcnow(),
            )
            session.add(history_entry)

        elif side_upper == "SELL":
            if not position or position.qty < qty:
                raise ValueError(f"Insufficient position in {symbol} to sell.")

            # Capture avg_price BEFORE modifying the position for realized P&L
            realized_pnl = (price - position.avg_price) * qty

            account.cash_balance += total_cost
            account.last_updated = datetime.utcnow()

            position.qty -= qty
            position.last_updated = datetime.utcnow()

            if position.qty <= 0:
                session.delete(position)

            # Record order history
            history_entry = OrderHistory(
                symbol=symbol,
                side=side_upper,
                qty=qty,
                price=price,
                total_value=total_cost,
                realized_pnl=realized_pnl,
                reason=reason,
                timestamp=datetime.utcnow(),
            )
            session.add(history_entry)

        session.add(account)
        session.commit()

    return get_portfolio()

def update_stop_loss(symbol: str, stop_loss: Optional[float], take_profit: Optional[float] = None, tp_config: dict = None):
    symbol = symbol.upper()
    with Session(engine) as session:
        statement = select(Position).where(Position.symbol == symbol)
        position = session.exec(statement).first()
        
        if not position:
            return get_portfolio()
            
        position.stop_loss = stop_loss
        position.take_profit = take_profit
        if tp_config:
            position.tp_config = tp_config
        position.last_updated = datetime.utcnow()
        
        session.add(position)
        session.commit()
        
    return get_portfolio()

async def sync_portfolio_stops():
    """
    Syncs the portfolio with current market prices and triggers stops/take-profits.
    Also checks price alerts.
    """
    from services.market_data import get_ticker_data

    triggered_symbols = []

    with Session(engine) as session:
        statement = select(Position)
        positions = session.exec(statement).all()

        for pos in positions:
            try:
                data = get_ticker_data(pos.symbol)
                current_price = data["price"]["current"]

                pos.current_price = current_price

                # Check Stop Loss
                if pos.stop_loss and current_price <= pos.stop_loss:
                    logger.info(
                        f"STOP LOSS TRIGGERED for {pos.symbol} at {current_price} "
                        f"(SL={pos.stop_loss}). Selling {pos.qty} shares."
                    )
                    triggered_symbols.append(
                        ("SELL", pos.symbol, pos.qty, current_price, "stop_loss")
                    )

                # Check Take Profit
                elif pos.take_profit and current_price >= pos.take_profit:
                    logger.info(
                        f"TAKE PROFIT TRIGGERED for {pos.symbol} at {current_price} "
                        f"(TP={pos.take_profit}). Selling {pos.qty} shares."
                    )
                    triggered_symbols.append(
                        ("SELL", pos.symbol, pos.qty, current_price, "take_profit")
                    )

                session.add(pos)
            except Exception as e:
                logger.error(f"Failed to sync {pos.symbol}: {e}")

        session.commit()

    # Execute triggered orders outside the session to avoid nesting issues
    for side, symbol, qty, price, reason in triggered_symbols:
        try:
            execute_order(symbol=symbol, side=side, qty=qty, price=price, reason=reason)
            logger.info(f"Auto-executed {side} {qty} {symbol} @ {price} (reason: {reason})")
        except ValueError as e:
            err_msg = str(e).lower()
            if "insufficient position" in err_msg or "position not found" in err_msg:
                logger.info(
                    f"Skipping {reason} for {symbol}: position already closed (race condition) — {e}"
                )
            else:
                logger.error(f"Failed to auto-execute {reason} for {symbol}: {e}")
        except Exception as e:
            logger.error(f"Failed to auto-execute {reason} for {symbol}: {e}")

    # Check price alerts
    await _check_price_alerts()

    return get_portfolio()


async def _check_price_alerts():
    """Check all active alerts against current prices and trigger matching ones."""
    from services.market_data import get_ticker_data
    from services.alerts import get_alerts, delete_alert

    alerts = get_alerts()
    for alert in alerts:
        if not alert.get("is_active", True):
            continue
        try:
            data = get_ticker_data(alert["symbol"])
            current_price = data["price"]["current"]

            triggered = False
            if alert["condition"] == "ABOVE" and current_price >= alert["target_price"]:
                triggered = True
            elif alert["condition"] == "BELOW" and current_price <= alert["target_price"]:
                triggered = True

            if triggered:
                logger.info(
                    f"ALERT TRIGGERED: {alert['symbol']} is {alert['condition']} "
                    f"{alert['target_price']} (current: {current_price})"
                )
                # Deactivate the alert by deleting it (one-shot alerts)
                delete_alert(alert["id"])
        except Exception as e:
            logger.error(f"Failed to check alert for {alert['symbol']}: {e}")

def reset_portfolio():
    with Session(engine) as session:
        statement = delete(Position)
        session.exec(statement)
        session.commit()
    return get_portfolio()

def remove_position(symbol: str):
    symbol = symbol.upper()
    with Session(engine) as session:
        statement = delete(Position).where(Position.symbol == symbol)
        session.exec(statement)
        session.commit()
    return get_portfolio()

def get_analytics() -> dict:
    """
    Computes portfolio analytics from closed trade history.
    Returns equity curve, win rate, profit factor, and P&L summary.
    """
    with Session(engine) as session:
        statement = select(OrderHistory).where(OrderHistory.side == "SELL").order_by(OrderHistory.timestamp)
        sells = session.exec(statement).all()

    if not sells:
        return {
            "equity_curve": [],
            "total_realized_pnl": 0.0,
            "trade_count": 0,
            "win_rate": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "profit_factor": 0.0,
        }

    # Build equity curve grouped by date
    daily_pnl: dict[str, float] = {}
    wins: list[float] = []
    losses: list[float] = []

    for sell in sells:
        pnl = sell.realized_pnl or 0.0
        date_str = sell.timestamp.strftime("%Y-%m-%d") if sell.timestamp else "unknown"
        daily_pnl[date_str] = daily_pnl.get(date_str, 0.0) + pnl
        if pnl > 0:
            wins.append(pnl)
        elif pnl < 0:
            losses.append(pnl)

    # Cumulative sum for equity curve
    cumulative = 0.0
    equity_curve = []
    for date_str in sorted(daily_pnl.keys()):
        cumulative += daily_pnl[date_str]
        equity_curve.append({"date": date_str, "cumulative_pnl": round(cumulative, 2)})

    total_wins = sum(wins)
    total_losses = abs(sum(losses))
    profit_factor = round(total_wins / total_losses, 2) if total_losses > 0 else 0.0
    trade_count = len(sells)
    win_rate = round(len(wins) / trade_count * 100, 1) if trade_count > 0 else 0.0

    return {
        "equity_curve": equity_curve,
        "total_realized_pnl": round(cumulative, 2),
        "trade_count": trade_count,
        "win_rate": win_rate,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0.0,
        "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0.0,
        "profit_factor": profit_factor,
    }


def set_cash(amount: float):
    with Session(engine) as session:
        account = _get_or_create_account(session)
        account.cash_balance = amount
        account.last_updated = datetime.utcnow()
        session.add(account)
        session.commit()
    return get_portfolio()

def clear_history():
    with Session(engine) as session:
        statement = delete(OrderHistory)
        session.exec(statement)
        session.commit()
    return get_portfolio()

def remove_history_item(item_id: str):
    with Session(engine) as session:
        try:
            item_id_int = int(item_id)
        except ValueError:
            return get_portfolio()
        statement = delete(OrderHistory).where(OrderHistory.id == item_id_int)
        session.exec(statement)
        session.commit()
    return get_portfolio()
