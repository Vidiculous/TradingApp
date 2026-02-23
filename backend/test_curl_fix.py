
from curl_cffi import requests

def test_curl_cffi():
    print("Testing connectivity with curl_cffi (verify=False)...")
    try:
        # Use impersonate to look like a browser
        response = requests.get("https://duckduckgo.com", impersonate="chrome", verify=False)
        print(f"Success! Status code: {response.status_code}")
        print(f"Content length: {len(response.text)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_curl_cffi()
