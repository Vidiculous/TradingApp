"""
Analysis History Service
Persists AI analysis results in the database so agents can reference past decisions.
"""

from datetime import datetime
from typing import Any, List, Optional
from sqlmodel import Session, select, desc
from db_models.db import AnalysisResult
from services.db_service import engine

def save_analysis(ticker: str, horizon: str, result: dict[str, Any]) -> AnalysisResult:
    """
    Saves the final analysis result for a ticker into the database.
    """
    with Session(engine) as session:
        decision = result.get("decision", {})
        risk = result.get("risk_validation", {})
        
        db_result = AnalysisResult(
            ticker=ticker.upper(),
            horizon=horizon,
            timestamp=datetime.utcnow(),
            signal=result.get("action", "HOLD"),
            confidence=decision.get("confidence", 0.0),
            summary=decision.get("conclusion", "") or decision.get("reasoning", "")[:300],
            action=result.get("action", "HOLD"),
            reasoning=decision.get("reasoning", ""),
            price_at_analysis=decision.get("current_price") or result.get("decision", {}).get("current_price") or 0.0,
            squad_results=decision.get("squad_consensus", {})
        )
        session.add(db_result)
        session.commit()
        session.refresh(db_result)
        return db_result

def get_history(ticker: str, limit: int = 5, offset: int = 0) -> List[dict]:
    """
    Returns the most recent analysis records for a specific ticker.
    Supports offset-based pagination.
    """
    with Session(engine) as session:
        statement = (
            select(AnalysisResult)
            .where(AnalysisResult.ticker == ticker.upper())
            .order_by(desc(AnalysisResult.timestamp))
            .offset(offset)
            .limit(limit)
        )
        results = session.exec(statement).all()
        return [r.dict() for r in results]

def get_all_history(limit: int = 20, offset: int = 0) -> List[dict]:
    """
    Returns the most recent analysis records across all tickers.
    Supports offset-based pagination.
    """
    with Session(engine) as session:
        statement = (
            select(AnalysisResult)
            .order_by(desc(AnalysisResult.timestamp))
            .offset(offset)
            .limit(limit)
        )
        results = session.exec(statement).all()
        return [r.dict() for r in results]

def format_history_for_prompt(history: List[dict]) -> str:
    """
    Format analysis history into a text block for injection into agent prompts.
    """
    if not history:
        return "No previous analyses available for this ticker."

    lines = [f"=== PREVIOUS ANALYSIS DECISIONS ({len(history)} records) ==="]

    for i, record in enumerate(history):
        timestamp = record.get("timestamp", "Unknown")
        action = record.get("action", "Unknown")
        confidence = record.get("confidence")
        price = record.get("price_at_analysis")
        reasoning = record.get("summary", "")
        horizon = record.get("horizon", "")
        consensus = record.get("squad_results", {})

        lines.append(f"\n--- Analysis #{i + 1} ({timestamp}) ---")
        lines.append(f"Action: {action} | Horizon: {horizon}")

        if confidence:
            lines.append(f"Confidence: {confidence}")
        if price:
            lines.append(f"Price at Analysis: ${price}")

        # Note: Some fields like entry_zone, target, stop_loss are often inside consensus or 
        # result objects. For simplicity in the history list we show the summary.
        
        if consensus:
            consensus_text = ", ".join(f"{k}: {v}" for k, v in consensus.items())
            lines.append(f"Squad Consensus: {consensus_text}")

        if reasoning:
            lines.append(f"Reasoning Summary: {reasoning}")

    lines.append("\n=== END PREVIOUS DECISIONS ===")
    return "\n".join(lines)
