import asyncio
import sys

try:
    from duckduckgo_search import DDGS
    print("duckduckgo_search imported.")
except ImportError:
    print("duckduckgo_search not found.")
    sys.exit(1)

def test_search():
    print("Testing standard search...")
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text("test", max_results=1))
            print(f"Success! Found {len(results)} results.")
    except Exception as e:
        print(f"Standard search FAILED: {e}")
        
    print("\nTesting search with verify=False...")
    try:
        # Check if version supports verify parameter
        with DDGS(verify=False) as ddgs:
            results = list(ddgs.text("test", max_results=1))
            print(f"Success with verify=False! Found {len(results)} results.")
    except Exception as e:
        print(f"verify=False search FAILED: {e}")

if __name__ == "__main__":
    test_search()
