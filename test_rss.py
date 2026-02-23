import feedparser

def test_rss():
    url = "https://www.di.se/rss"
    print(f"Testing RSS fetch from {url}...")
    try:
        feed = feedparser.parse(url)
        print(f"Feed title: {feed.feed.get('title', 'N/A')}")
        print(f"Found {len(feed.entries)} entries.")
        if feed.entries:
            print(f"Top entry: {feed.entries[0].title}")
    except Exception as e:
        print(f"RSS fetch FAILED: {e}")

if __name__ == "__main__":
    test_rss()
