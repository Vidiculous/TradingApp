
import asyncio
import httpx

async def test_search():
    print("Testing connectivity with httpx (verify=False)...")
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get("https://duckduckgo.com")
            print(f"Success! Status code: {response.status_code}")
            print(f"Content length: {len(response.text)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_search())
