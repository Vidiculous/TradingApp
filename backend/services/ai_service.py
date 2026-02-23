import json
import os

from typing import Any

from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
client = None
if api_key:
    client = genai.Client(api_key=api_key)


def generate_analysis(
    symbol: str, price_data: dict[str, Any], fundamentals: dict[str, Any], news: list[dict[str, Any]]
) -> dict[str, Any]:
    if not client:
        return {
            "sentiment": "neutral",
            "confidence": 0.0,
            "summary": "AI Analysis unavailable. Please configure GEMINI_API_KEY in backend/.env",
            "model_name": "No AI Key",
        }

    model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    try:
        # Day Trader Assistant Persona
        prompt = f"""
        You are an elite Day Trading Assistant. Analyze the data for {symbol} and generate a high-conviction trade setup.
        
        Data:
        - Price: ${price_data['current']} ({price_data['changePercent']}%)
        - 52W Range: {fundamentals.get('week52Low', 'N/A')} - {fundamentals.get('week52High', 'N/A')}
        - Headlines: {json.dumps([n.get('headline', 'No Headline') for n in news[:5]], indent=2)}
        
        Your Goal: Identify the single best IMMEDIATE trade (Intraday/Swing).
        
        Return a JSON object with this EXACT structure (no markdown):
        {{
            "signal": "LONG" | "SHORT" | "WAIT",
            "confidence": <float 0.0-1.0>,
            "entry_zone": "<specific price range, e.g. $150.00 - $150.50>",
            "stop_loss": "<specific price>",
            "take_profit": "<specific price>",
            "reasoning": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
            "summary": "<2 sentence actionable executive summary>",
            "sentiment": "bullish" | "bearish" | "neutral"
        }}
        
        Rules:
        - If data is mixed or low volatility, signal "WAIT".
        - entry_zone/stop_loss/take_profit must be numeric strings formatted as currency ($XX.XX).
        - reasoning must be short, punchy, and technical (e.g. "Breakout above EMA", "Oversold RSI").
        """

        response = client.models.generate_content(model=model_name, contents=prompt)

        # Clean up response if it wraps in markdown code blocks
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        result = json.loads(text)
        result["model_name"] = model_name

        # Ensure new fields exist (fallback for older model versions/hallucinations)
        if "signal" not in result:
            result["signal"] = "WAIT"
        if "reasoning" not in result:
            result["reasoning"] = ["Analysis generated"]

        return result

    except Exception as e:
        print(f"AI Error: {e}")
        # Print raw text if available for debugging
        if "response" in locals() and hasattr(response, "text"):
            print(f"Raw Response: {response.text}")

        return {
            "sentiment": "neutral",
            "confidence": 0.0,
            "summary": f"AI Analysis failed: {str(e)}. Please try again later.",
            "model_name": model_name,
            "signal": "WAIT",
            "entry_zone": "N/A",
            "stop_loss": "N/A",
            "take_profit": "N/A",
            "reasoning": ["Error generating analysis"],
        }


def analyze_sector_correlations(symbol: str, correlations: list[dict[str, Any]]) -> str:
    """
    Generates a 1-sentence 'Vibe Check' on how the stock relates to its sector.
    """
    if not client:
        return "AI Sector Analysis unavailable."

    model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    try:
        prompt = f"""
        You are a market analyst. specific stock: {symbol}.
        Peer Correlations (1.0 = identical moves, 0.0 = uncorrelated, -1.0 = inverse):
        {json.dumps(correlations, indent=2)}
        
        Task: Write a ONE SENTENCE summary of the stock's relationship to its peers.
        Examples:
        - "MSFT is locking step with Big Tech, showing high correlation with AAPL and NVDA."
        - "TSLA is decoupling from the sector, showing independent price action despite the broader rally."
        - "NVDA is leading the pack, significantly outperforming peers with high correlation."
        
        Keep it under 20 words. No intro.
        """

        response = client.models.generate_content(model=model_name, contents=prompt)

        return response.text.strip()
    except Exception as e:
        print(f"Sector AI Error: {e}")
        return "Sector analysis currently unavailable."
