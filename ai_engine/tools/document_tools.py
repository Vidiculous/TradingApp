import asyncio
from typing import Dict, Any, List
from services.document_service import get_document_text
from ai_engine.utils.web_search import search_general

async def fetch_financial_docs(ticker: str) -> Dict[str, Any]:
    """
    Retrieve financial documents (10-Ks, 10-Qs, transcripts) for a ticker.
    Checks local storage first, then searches online if none found.
    """
    ticker = ticker.upper()
    try:
        # 1. Try local documents
        doc_text = await asyncio.to_thread(get_document_text, ticker)
        
        if doc_text:
            return {
                "ticker": ticker,
                "source": "local_storage",
                "content": doc_text[:30000] # Limit to 30k chars for prompt safety
            }
            
        # 2. Fallback to online search
        print(f"    [DocumentTool] No local docs for {ticker}. Searching online...")
        search_query = f"{ticker} investor relations earnings transcript annual report 10-K 2024 2025"
        search_results = await search_general(search_query, max_results=3)
        
        if search_results:
            combined_text = "ONLINE SEARCH RESULTS:\n"
            for res in search_results:
                combined_text += f"\nSOURCE: {res['url']}\nTITLE: {res['title']}\nSUMMARY: {res['body']}\n"
            return {
                "ticker": ticker,
                "source": "online_search",
                "content": combined_text
            }
        
        return {"error": f"No financial documents or online reports found for {ticker}."}
        
    except Exception as e:
        return {"error": f"Failed to retrieve documents for {ticker}: {str(e)}"}

# JSON Schema for the tool
FETCH_FINANCIAL_DOCS_SCHEMA = {
    "name": "fetch_financial_docs",
    "description": "Retrieve financial reports, earnings transcripts, and SEC filings (10-K/10-Q) for a company.",
    "parameters": {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "The stock ticker symbol."}
        },
        "required": ["ticker"]
    }
}
