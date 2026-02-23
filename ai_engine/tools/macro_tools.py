from ai_engine.utils.web_search import search_general
import asyncio
from typing import Dict, Any, List

async def get_macro_events(date_range: str = "this week") -> Dict[str, Any]:
    """
    Search for major upcoming economic events (Fed meetings, CPI, Jobs reports) 
    that could impact market volatility.
    """
    try:
        query = f"major economic calendar events {date_range} FOMC CPI Jobs report macro catalysts"
        search_results = await search_general(query, max_results=5)
        
        events = []
        if search_results:
            for res in search_results:
                events.append({
                    "event": res.get("title", "N/A"),
                    "details": res.get("body", "N/A")[:300] + "...",
                    "url": res.get("url", "N/A")
                })
                
        return {
            "timeframe": date_range,
            "major_macro_events": events
        }
    except Exception as e:
        return {"error": f"Failed to fetch macro events: {str(e)}"}

# JSON Schema
GET_MACRO_EVENTS_SCHEMA = {
    "name": "get_macro_events",
    "description": "Discover upcoming economic catalysts (Fed speeches, CPI prints, jobs data) that may affect markets.",
    "parameters": {
        "type": "object",
        "properties": {
            "date_range": {"type": "string", "description": "The timeframe to search for (e.g., 'this week', 'next month')."}
        }
    }
}
