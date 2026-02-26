from __future__ import annotations
import asyncio
import logging
from typing import Any

import numpy as np
import pandas as pd

try:
    import torch
    from chronos import ChronosPipeline
    _CHRONOS_AVAILABLE = True
except ImportError as _chronos_import_err:
    logging.getLogger(__name__).warning(
        f"Chronos/PyTorch not installed — predict_price_direction will be skipped. "
        f"Run: pip install torch chronos-forecasting  ({_chronos_import_err})"
    )
    _CHRONOS_AVAILABLE = False

logger = logging.getLogger(__name__)

_pipeline: ChronosPipeline | None = None  # Loaded once, cached in-process

HORIZON_STEPS = {"Scalp": 1, "Swing": 5, "Invest": 20}


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        logger.info("Loading Chronos-T5-Small (first call — downloads ~250MB if not cached)")
        _pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small",
            device_map="cpu",
            torch_dtype=torch.bfloat16,
        )
    return _pipeline


def _run_inference(closes: np.ndarray, n_steps: int) -> dict:
    pipeline = _get_pipeline()
    context = torch.tensor(closes, dtype=torch.float32).unsqueeze(0)  # [1, T]
    forecast = pipeline.predict(context, prediction_length=n_steps, num_samples=20)
    # forecast shape: [1, num_samples, n_steps]
    samples = forecast[0].numpy()       # [20, n_steps]
    final_prices = samples[:, -1]       # predicted price at step N
    current = closes[-1]
    prob_up = float(np.mean(final_prices > current))
    median_forecast = float(np.median(final_prices))
    q10 = float(np.percentile(final_prices, 10))
    q90 = float(np.percentile(final_prices, 90))
    return {
        "direction": "UP" if prob_up >= 0.5 else "DOWN",
        "probability": round(max(prob_up, 1 - prob_up), 3),
        "prob_up": round(prob_up, 3),
        "confidence": (
            "HIGH" if abs(prob_up - 0.5) >= 0.15
            else ("MEDIUM" if abs(prob_up - 0.5) >= 0.07 else "LOW")
        ),
        "median_forecast": round(median_forecast, 4),
        "range_q10_q90": [round(q10, 4), round(q90, 4)],
        "forecast_steps": n_steps,
        "note": "Zero-shot Chronos-T5-Small signal. Treat as pattern momentum, not a price target.",
    }


async def predict_price_direction(
    ticker: str, horizon: str, context: dict | None = None
) -> dict[str, Any]:
    if not _CHRONOS_AVAILABLE:
        return {"error": "Chronos/PyTorch not installed", "skipped": True}

    history: pd.DataFrame | None = context.get("history") if context else None
    if history is None or len(history) < 20:
        return {"error": "Insufficient price history for ML prediction", "skipped": True}

    closes = history["Close"].dropna().values.astype(float)
    n_steps = HORIZON_STEPS.get(horizon, 5)

    try:
        result = await asyncio.to_thread(_run_inference, closes, n_steps)
        return result
    except Exception as e:
        logger.warning(f"Chronos inference failed for {ticker}: {e}")
        return {"error": str(e), "skipped": True}


PREDICT_PRICE_DIRECTION_SCHEMA = {
    "name": "predict_price_direction",
    "description": (
        "Runs Chronos-T5-Small (pretrained time series foundation model) to estimate the "
        "probability of price going UP or DOWN over the analysis horizon. Returns direction, "
        "probability, and a forecast range."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {
                "type": "string",
                "description": "Stock ticker symbol",
            },
            "horizon": {
                "type": "string",
                "enum": ["Scalp", "Swing", "Invest"],
                "description": "Analysis horizon — determines forecast window (1/5/20 bars)",
            },
        },
        "required": ["ticker", "horizon"],
    },
}
