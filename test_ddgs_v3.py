import ssl
import os
from duckduckgo_search import DDGS

# Apply the bypass
ssl._create_default_https_context = ssl._create_unverified_context
os.environ["PYTHONHTTPSVERIFY"] = "0"

def test():
    print("Testing DDGS News (Default)...")
    try:
        with DDGS(verify=False) as ddgs:
            results = list(ddgs.news("SAAB stock", max_results=5))
            print(f"Found {len(results)} news results.")
            for r in results:
                print(f" - {r.get('title')}")
    except Exception as e:
        print(f"News failed: {e}")

    print("\nTesting DDGS Text (Default)...")
    try:
        with DDGS(verify=False) as ddgs:
            results = list(ddgs.text("SAAB stock", max_results=5))
            print(f"Found {len(results)} text results.")
            for r in results:
                print(f" - {r.get('title')}")
    except Exception as e:
        print(f"Text failed: {e}")

    print("\nTesting DDGS Text (Lite)...")
    try:
        with DDGS(verify=False) as ddgs:
            # Note: Older versions might not have 'backend', let's see
            results = list(ddgs.text("SAAB stock", max_results=5, backend="lite"))
            print(f"Found {len(results)} lite text results.")
    except Exception as e:
        print(f"Lite failed: {e}")

if __name__ == "__main__":
    test()
