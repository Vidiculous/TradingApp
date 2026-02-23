
import asyncio
import sys
import os

# Add parent directory to path to allow importing ai_engine
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(os.path.join(parent_dir, "ai_engine"))

from utils.web_search import search_stock_news

async def test_utility():
    print("Testing patched web_search utility...")
    try:
        results = await search_stock_news("SAAB-B.ST", max_results=2)
        if results:
            print(f"Success! Found {len(results)} results.")
            for r in results:
                print(f"- {r.get('title')}")
        else:
            print("No results found or search failed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_utility())
