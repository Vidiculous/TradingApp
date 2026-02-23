import os
import sys

# Try to silence warnings and ignore SSL
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['SSL_CERT_FILE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''

try:
    from duckduckgo_search import DDGS
    print("duckduckgo_search imported.")
except ImportError:
    print("duckduckgo_search not found.")
    sys.exit(1)

def test_search():
    print("Testing search with env vars and verify=False...")
    try:
        # Some versions use 'backend', let's try to be generic
        with DDGS(verify=False) as ddgs:
            results = list(ddgs.text("python", max_results=2))
            print(f"Success! Found {len(results)} results.")
            for r in results:
                print(f" - {r.get('title')}")
    except Exception as e:
        print(f"Search FAILED: {e}")

if __name__ == "__main__":
    test_search()
