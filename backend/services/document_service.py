"""
Document Service
Handles uploading, storing, and retrieving financial documents for AI analysis.
"""

import hashlib
import json
import logging
import os
import shutil
from datetime import datetime
from typing import List, Optional

import PyPDF2

logger = logging.getLogger(__name__)

DOCS_DIR = "data/documents"


def _ensure_docs_dir(ticker: str):
    """Ensure the directory exists for a specific ticker."""
    path = os.path.join(DOCS_DIR, ticker.upper())
    if not os.path.exists(path):
        os.makedirs(path)
    return path


def _get_metadata_path(ticker: str) -> str:
    return os.path.join(DOCS_DIR, ticker.upper(), "metadata.json")


def _load_metadata(ticker: str) -> List[dict]:
    path = _get_metadata_path(ticker)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load metadata for {ticker}: {e}")
        return []


def _save_metadata(ticker: str, metadata: List[dict]):
    path = _get_metadata_path(ticker)
    try:
        with open(path, "w") as f:
            json.dump(metadata, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save metadata for {ticker}: {e}")


MAX_PDF_TEXT_LENGTH = 50_000


def _extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                if len(text) >= MAX_PDF_TEXT_LENGTH:
                    break
    except Exception as e:
        logger.error(f"PDF extraction failed for {file_path}: {e}")
        return ""
    if len(text) > MAX_PDF_TEXT_LENGTH:
        logger.warning(
            f"PDF text truncated from {len(text)} to {MAX_PDF_TEXT_LENGTH} chars: {file_path}"
        )
        text = text[:MAX_PDF_TEXT_LENGTH]
    return text


async def upload_document(file, ticker: str, doc_type: str) -> dict:
    """
    Save an uploaded file and extract its text.
    Returns the metadata of the saved document.
    """
    ticker = ticker.upper()
    docs_path = _ensure_docs_dir(ticker)
    
    # Sanitize filename
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
    filename = f"{int(datetime.now().timestamp())}_{safe_filename}"
    file_path = os.path.join(docs_path, filename)
    
    # Save original file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save file {filename}: {e}")
        raise e

    # Extract text
    content = ""
    if filename.lower().endswith(".pdf"):
        content = _extract_text_from_pdf(file_path)
    else:
        # Assume text/markdown
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            content = "Could not read file content."

    # Create metadata entry
    doc_id = hashlib.md5(filename.encode()).hexdigest()
    entry = {
        "id": doc_id,
        "filename": filename,
        "original_name": file.filename,
        "type": doc_type,
        "upload_date": datetime.now().isoformat(),
        "path": file_path,
        "content_preview": content[:200] if content else "",
        "content_length": len(content)
    }

    # Save extracted text separately to avoid bloating metadata
    text_path = file_path + ".txt"
    try:
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save extracted text for {filename}: {e}")

    metadata = _load_metadata(ticker)
    if not isinstance(metadata, list):
        metadata = []
    metadata.append(entry)
    _save_metadata(ticker, metadata)

    return entry


def get_documents(ticker: str) -> List[dict]:
    """List all documents for a ticker."""
    return _load_metadata(ticker.upper())


def get_document_text(ticker: str) -> str:
    """
    Combine text from ALL documents for a ticker.
    Used for AI analysis context.
    """
    ticker = ticker.upper()
    metadata = _load_metadata(ticker)
    full_text = ""

    for doc in metadata:
        text_path = doc["path"] + ".txt"
        if os.path.exists(text_path):
            with open(text_path, "r", encoding="utf-8") as f:
                full_text += f"\n\n--- DOCUMENT: {doc['original_name']} ({doc['type']}) ---\n"
                full_text += f.read()
    
    return full_text


def get_content_hash(ticker: str) -> str:
    """
    Generate a hash of ALL document content for a ticker.
    Used for cache invalidation.
    """
    content = get_document_text(ticker)
    if not content:
        return ""
    return hashlib.sha256(content.encode()).hexdigest()


def delete_document(ticker: str, doc_id: str) -> bool:
    """Delete a document and its metadata."""
    ticker = ticker.upper()
    metadata = _load_metadata(ticker)
    
    updated_metadata = []
    found = False
    
    for doc in metadata:
        if doc["id"] == doc_id:
            found = True
            # Try delete files
            try:
                if os.path.exists(doc["path"]):
                    os.remove(doc["path"])
                if os.path.exists(doc["path"] + ".txt"):
                    os.remove(doc["path"] + ".txt")
            except Exception as e:
                logger.error(f"Error deleting file {doc['path']}: {e}")
        else:
            updated_metadata.append(doc)
            
    if found:
        _save_metadata(ticker, updated_metadata)
        
    return found
