import json
import os
from datetime import datetime

import yfinance as yf
from dotenv import load_dotenv
from google import genai

# Load environment variables from backend/.env
# script is in ai_engine/, so we go up one level to find backend/.env
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(base_dir)
env_path = os.path.join(project_root, "backend", ".env")
load_dotenv(env_path)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
client = None
if api_key:
    client = genai.Client(api_key=api_key)


def get_stock_data(ticker):
    """Fetches the last 7 days of stock data for a given ticker."""
    try:
        stock = yf.Ticker(ticker)
        # Fetch last 7 days. Interval '1d' is standard.
        hist = stock.history(period="7d")

        # Format data for returning
        data = []
        for date, row in hist.iterrows():
            data.append(
                {"date": date.strftime("%Y-%m-%d"), "close": row["Close"], "volume": row["Volume"]}
            )
        return data
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return []


def generate_llm_insight(ticker, stock_data):
    """Generates a real LLM insight using Gemini."""
    if not client:
        return "Gemini API key not found. Please check backend/.env."

    model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    try:
        # Prepare context for the LLM
        data_summary = json.dumps(stock_data[-3:], indent=2)  # Just last 3 days for brevity

        prompt = f"""
        You are a financial analyst. Analyze the recent stock performance for {ticker}.
        Here is the data for the last few trading days:
        {data_summary}
        
        Provide a concise, 1-sentence market sentiment (Bullish/Bearish/Neutral) and the reason why.
        """

        response = client.models.generate_content(model=model_name, contents=prompt)
        text = response.text.strip()

        # Basic cleanup if it wraps in quotes
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]

        return text

    except Exception as e:
        print(f"Error generating insight for {ticker}: {e}")
        return f"Error generating insight: {str(e)}"


def analyze_tickers(tickers):
    """Analyzes a list of tickers and saves the result."""
    results = {}

    for ticker in tickers:
        print(f"Analyzing {ticker}...")
        stock_data = get_stock_data(ticker)
        # Pass stock_data to the insight generator
        insight = generate_llm_insight(ticker, stock_data)

        results[ticker] = {
            "data": stock_data,
            "insight": insight,
            "timestamp": datetime.now().isoformat(),
        }

    # Resolve path relative to this script file
    output_dir = os.path.join(project_root, "backend", "data")
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, "analysis_cache.json")

    try:
        with open(output_file, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Analysis saved to {output_file}")
    except Exception as e:
        print(f"Error saving analysis: {e}")


if __name__ == "__main__":
    # Example usage
    tickers_to_analyze = ["AAPL", "GOOGL", "MSFT"]
    analyze_tickers(tickers_to_analyze)
