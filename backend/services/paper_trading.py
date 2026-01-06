import asyncio
import json
import logging
import os
import uuid
from datetime import datetime

from services.market_data import get_exchange_rate, get_ticker_data

# Configure logging
logger = logging.getLogger(__name__)

PORTFOLIO_FILE = "data/portfolio.json"

DEFAULT_PORTFOLIO = {
    "cash": 100000.0,
    "holdings": {},  # symbol -> { quantity, average_cost }
    "history": [],
}


def _load_portfolio():
    if not os.path.exists("data"):
        os.makedirs("data")

    if not os.path.exists(PORTFOLIO_FILE):
        _save_portfolio(DEFAULT_PORTFOLIO)
        return DEFAULT_PORTFOLIO

    try:
        with open(PORTFOLIO_FILE) as f:
            p = json.load(f)
            # Migration: Ensure all history items have an 'id'
            modified = False
            for item in p.get("history", []):
                if "id" not in item:
                    item["id"] = str(uuid.uuid4())
                    modified = True
            if modified:
                _save_portfolio(p)
            return p
    except Exception as e:
        logger.error(f"Failed to load portfolio: {e}")
        return DEFAULT_PORTFOLIO


def _save_portfolio(portfolio):
    try:
        with open(PORTFOLIO_FILE, "w") as f:
            json.dump(portfolio, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save portfolio: {e}")


def get_portfolio():
    portfolio = _load_portfolio()

    # Calculate total equity (requires current prices - simplistically handled in frontend or separate aggregation)
    # acts as a raw data fetcher
    return portfolio



def execute_order(
    symbol: str,
    side: str,
    qty: int,
    price: float,
    stop_loss: float | None = None,
    sl_type: str = "fixed",
    take_profit: float | None = None,
    tp_config: dict | None = None,
    comment: str | None = None,
):
    portfolio = _load_portfolio()
    symbol = symbol.upper()

    try:
        ticker_data = get_ticker_data(symbol)
        currency = ticker_data["meta"].get("currency", "USD")
    except Exception:
        currency = "USD"

    fx_rate = 1.0
    if currency != "USD":
        fx_rate = get_exchange_rate(currency, "USD")

    total_cost_native = qty * price
    total_cost_usd = total_cost_native * fx_rate

    pnl_usd = None
    side_upper = side.upper()

    # Get current position
    current_pos = portfolio["holdings"].get(symbol, {"quantity": 0, "average_cost": 0.0, "currency": currency})
    current_qty = current_pos["quantity"]
    current_avg = current_pos["average_cost"]

    if side_upper == "BUY":
        # Check cash (only for the cost of the shares, regardless of if we are opening long or covering short)
        if portfolio["cash"] < total_cost_usd:
            raise ValueError(
                f"Insufficient buying power. Cost: ${total_cost_usd:.2f}, Cash: ${portfolio['cash']:.2f}"
            )

        portfolio["cash"] -= total_cost_usd

        # Calculate realized PnL if covering a short
        if current_qty < 0:
            cover_qty = min(abs(current_qty), qty)
            # Short PnL = (sell_price - buy_price) * qty
            # average_cost for shorts is the price at which we sold
            pnl_native = (current_avg - price) * cover_qty
            pnl_usd = pnl_native * fx_rate
            logger.info(f"Covering short for {symbol}: Realized PnL: ${pnl_usd:.2f}")

        # Update average cost and quantity
        new_qty = current_qty + qty
        
        # If we switch from short to long, or just covering part of a short, 
        # the average cost logic changes.
        if current_qty >= 0:
            # Standard long averaging
            new_avg = ((current_qty * current_avg) + (qty * price)) / new_qty if new_qty != 0 else 0
        else:
            # Covering short
            if new_qty > 0:
                # Switched to long: average cost is just the buy price for the remaining long portion
                new_avg = price
            elif new_qty < 0:
                # Still short: average cost (sell price) remains the same
                new_avg = current_avg
            else:
                # Fully covered
                new_avg = 0

    elif side_upper == "SELL":
        # Selling adds cash to balance (liability is the negative share count)
        portfolio["cash"] += total_cost_usd

        # Calculate realized PnL if closing a long
        if current_qty > 0:
            sell_qty = min(current_qty, qty)
            pnl_native = (price - current_avg) * sell_qty
            pnl_usd = pnl_native * fx_rate
            logger.info(f"Closing long for {symbol}: Realized PnL: ${pnl_usd:.2f}")

        new_qty = current_qty - qty

        # Update average cost
        if current_qty <= 0:
            # Standard short averaging (selling more to open/increase short)
            # For shorts, avg_cost is the average price we SOLD at
            abs_curr = abs(current_qty)
            new_avg = ((abs_curr * current_avg) + (qty * price)) / abs(new_qty) if new_qty != 0 else 0
        else:
            # Closing long
            if new_qty < 0:
                # Switched to short: average cost is the sell price for the remaining short portion
                new_avg = price
            elif new_qty > 0:
                # Still long: average cost remains the same
                new_avg = current_avg
            else:
                # Fully closed
                new_avg = 0

    # Stop loss configuration (only if opening/increasing a position, otherwise keep existing)
    sl_config = None
    if stop_loss:
        sl_config = {
            "type": sl_type,
            "value": float(stop_loss),
            "initial_value": float(stop_loss),
            "initial_distance": abs(price - float(stop_loss)),
            "high_water_mark": float(price) if "trailing" in sl_type else None,
        }

    if new_qty == 0:
        if symbol in portfolio["holdings"]:
            del portfolio["holdings"][symbol]
    else:
        portfolio["holdings"][symbol] = {
            "quantity": new_qty,
            "average_cost": new_avg,
            "currency": currency,
            "stop_loss": sl_config or current_pos.get("stop_loss"),
            "take_profit": float(take_profit) if take_profit else current_pos.get("take_profit"),
            "tp_config": tp_config or current_pos.get("tp_config"),
        }

    # Log Transaction
    portfolio["history"].append(
        {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "symbol": symbol,
            "side": side,
            "qty": qty,
            "price": price,
            "currency": currency,
            "fx_rate": fx_rate,
            "total_native": total_cost_native,
            "total_usd": total_cost_usd,
            "realized_pnl_usd": pnl_usd,
            "comment": comment,
        }
    )

    _save_portfolio(portfolio)
    return portfolio


async def sync_portfolio_stops():
    """
    Lazy update for trailing stops. Fetches current prices and updates SL levels.
    """
    portfolio = _load_portfolio()
    if not portfolio["holdings"]:
        return portfolio

    modified = False
    symbols = list(portfolio["holdings"].keys())

    # Fetch current prices for all holdings
    async def get_price(s):
        try:
            data = await asyncio.to_thread(get_ticker_data, s)
            return s, data["price"]["current"]
        except Exception:
            return s, None

    price_results = await asyncio.gather(*[get_price(s) for s in symbols])
    prices = {s: p for s, p in price_results if p is not None}

    to_remove = []
    partial_sells = []

    for symbol, pos in portfolio["holdings"].items():
        current_price = prices.get(symbol)
        if current_price is None:
            continue

        is_short = pos["quantity"] < 0
        sl = pos.get("stop_loss")
        
        if sl and isinstance(sl, dict):
            sl_type = sl.get("type", "fixed")
            
            # 1. Update Trailing Stops
            if "trailing" in sl_type:
                hwm = sl.get("high_water_mark", pos["average_cost"])
                dist = sl.get("initial_distance", 1.0) # Fallback
                
                if not is_short:
                    # Long: SL moves UP if current_price > HWM
                    if current_price > hwm:
                        sl["high_water_mark"] = current_price
                        if sl_type == "trailing_fixed":
                            sl["value"] = current_price - dist
                        elif sl_type == "trailing_pct":
                            pct = sl.get("pct", dist / hwm)
                            sl["value"] = current_price * (1 - pct)
                        modified = True
                else:
                    # Short: SL moves DOWN if current_price < LWM (represented by hwm field)
                    if current_price < hwm:
                        sl["high_water_mark"] = current_price
                        if sl_type == "trailing_fixed":
                            sl["value"] = current_price + dist
                        elif sl_type == "trailing_pct":
                            pct = sl.get("pct", dist / hwm)
                            sl["value"] = current_price * (1 + pct)
                        modified = True

            # 2. Check for Trigger
            triggered = False
            if not is_short:
                if current_price <= sl["value"]:
                    triggered = True
            else:
                if current_price >= sl["value"]:
                    triggered = True
            
            if triggered:
                logger.info(f"STOP LOSS TRIGGERED for {symbol} ({'SHORT' if is_short else 'LONG'}) at {current_price}")
                to_remove.append((symbol, "STOP LOSS"))

        # 3. Check for Take Profit
        tp = pos.get("take_profit")
        tp_config = pos.get("tp_config")

        # Simple Take Profit
        if tp:
            tp_hit = (not is_short and current_price >= tp) or (is_short and current_price <= tp)
            if tp_hit:
                logger.info(f"SIMPLE TAKE PROFIT TRIGGERED for {symbol} at {current_price}")
                to_remove.append((symbol, "TAKE PROFIT"))

        # Advanced TP Config
        if tp_config and isinstance(tp_config, dict):
            tp_type = tp_config.get("type", "fixed")

            if tp_type == "scaled":
                for t in tp_config.get("targets", []):
                    if not t.get("triggered"):
                        hit = (not is_short and current_price >= t["price"]) or (is_short and current_price <= t["price"])
                        if hit:
                            logger.info(f"SCALED TP HIT for {symbol} at {t['price']}")
                            # Partial cover/sell
                            qty_to_exec = int(abs(pos["quantity"]) * t.get("qty_pct", 1.0))
                            if qty_to_exec > 0:
                                side = "BUY" if is_short else "SELL"
                                partial_sells.append((symbol, side, qty_to_exec, current_price))
                                t["triggered"] = True
                                modified = True

            elif tp_type == "breakeven":
                target = tp_config.get("target")
                if not tp_config.get("triggered") and target:
                    hit = (not is_short and current_price >= target) or (is_short and current_price <= target)
                    if hit:
                        logger.info(f"BREAKEVEN TP HIT for {symbol}")
                        if sl:
                            sl["value"] = pos["average_cost"]
                            sl["type"] = "fixed"
                            tp_config["triggered"] = True
                            modified = True

            elif tp_type == "trailing" and not tp_config.get("active"):
                activation = tp_config.get("activation_price")
                if activation:
                    hit = (not is_short and current_price >= activation) or (is_short and current_price <= activation)
                    if hit:
                        logger.info(f"TRAILING TP ACTIVATED for {symbol}")
                        dist = tp_config.get("distance", 1.0)
                        pos["stop_loss"] = {
                            "type": "trailing_fixed",
                            "value": current_price + dist if is_short else current_price - dist,
                            "initial_value": current_price + dist if is_short else current_price - dist,
                            "initial_distance": dist,
                            "high_water_mark": current_price,
                        }
                        tp_config["active"] = True
                        modified = True

    # IMPORTANT: Save local modifications (HWM updates, SL moves, Trigger flags)
    # BEFORE calling execute_order, which reloads the file.
    if modified:
        _save_portfolio(portfolio)

    # 4. Execute Sells (Partials first, then full)
    execution_triggered = False
    for symbol, side, exec_qty, s_price in partial_sells:
        execute_order(symbol, side, exec_qty, s_price, comment="TAKE PROFIT (SCALED)")
        execution_triggered = True

    for symbol, reason in to_remove:
        # Re-fetch to check if still exists after partials
        current_p = _load_portfolio()
        if symbol in current_p["holdings"]:
            side = "BUY" if current_p["holdings"][symbol]["quantity"] < 0 else "SELL"
            execute_order(symbol, side, abs(current_p["holdings"][symbol]["quantity"]), prices.get(symbol, 0), comment=reason)
            execution_triggered = True

    if execution_triggered:
        return _load_portfolio()

    return portfolio


def update_stop_loss(
    symbol: str,
    sl_config: dict | None = None,
    take_profit: float | None = None,
    tp_config: dict | None = None,
):
    portfolio = _load_portfolio()
    symbol = symbol.upper()
    if symbol in portfolio["holdings"]:
        if sl_config is not None:
            portfolio["holdings"][symbol]["stop_loss"] = sl_config
        if take_profit is not None:
            portfolio["holdings"][symbol]["take_profit"] = take_profit
        if tp_config is not None:
            portfolio["holdings"][symbol]["tp_config"] = tp_config
        _save_portfolio(portfolio)
    return portfolio


def remove_position(symbol: str):
    portfolio = _load_portfolio()
    symbol = symbol.upper()

    if symbol in portfolio["holdings"]:
        del portfolio["holdings"][symbol]
        _save_portfolio(portfolio)
        return portfolio
    else:
        # If not found, just return current portfolio (idempotent-ish) or raise error?
        # Let's just return current state to be safe.
        return portfolio


def reset_portfolio():
    _save_portfolio(DEFAULT_PORTFOLIO)
    return DEFAULT_PORTFOLIO


def clear_history():
    portfolio = _load_portfolio()
    portfolio["history"] = []
    _save_portfolio(portfolio)
    return portfolio


def remove_history_item(item_id: str):
    portfolio = _load_portfolio()
    portfolio["history"] = [h for h in portfolio["history"] if h.get("id") != item_id]
    _save_portfolio(portfolio)
    return portfolio


def set_cash(amount: float):
    portfolio = _load_portfolio()
    portfolio["cash"] = amount
    _save_portfolio(portfolio)
    return portfolio
