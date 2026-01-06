
import requests

BASE_URL = "http://localhost:8000/api/search"

test_cases = [
    "MSFT",
    "a",
    "A",
    " ",
    "%20",
    "MSFT%20",
    "!",
    "@",
    "123",
    "VERYLONGSTRING" * 10,
    "None",
    "null",
    "undefined",
    "😂",
    "ñ",
    "'",
    '"',
    "<script>",
    "../",
]

for case in test_cases:
    try:
        url = f"{BASE_URL}?q={case}"
        print(f"Testing: {case}")
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"FAILED: {response.text}")
    except Exception as e:
        print(f"Error testing {case}: {e}")

# Test missing param
try:
    print("Testing missing param")
    response = requests.get(BASE_URL)
    print(f"Status: {response.status_code}")  # Expected 422
except Exception as e:
    print(f"Error testing missing param: {e}")
