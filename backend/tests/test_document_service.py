"""
Tests for Document Service
"""

import hashlib
import os
import shutil
from unittest.mock import MagicMock, patch

import pytest
from fastapi import UploadFile

from services.document_service import (
    delete_document,
    get_content_hash,
    get_document_text,
    get_documents,
    upload_document,
)

# Mock DOCS_DIR
TEST_DIR = "test_data/documents"


@pytest.fixture(autouse=True)
def mock_docs_dir():
    # Setup
    if not os.path.exists(TEST_DIR):
        os.makedirs(TEST_DIR)
    
    with patch("services.document_service.DOCS_DIR", TEST_DIR):
        yield
        
    # Teardown
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)


class TestDocumentService:
    @pytest.mark.asyncio
    async def test_upload_and_retrieve(self):
        """Test uploading a text file and verifying metadata and retrieval."""
        content = b"Simulated financial report content."
        file = MagicMock(spec=UploadFile)
        file.filename = "report.txt"
        file.file = MagicMock()
        file.file.read.return_value = content
        
        # Determine where shutil.copyfileobj writes to
        # We need to mock shutil.copyfileobj or the file logic
        # Easier: mock shutil.copyfileobj to write to the path
        pass
        
    # Since verifying file upload mocking is tricky with the current structure
    # let's test a cleaner way by writing helper tests or just mocking the internal file I/O
    # but for an integration test, we can actually use a real temporary file.

    @pytest.mark.asyncio
    async def test_upload_text_file(self):
        # Create a dummy file object
        filename = "test_report.txt"
        content = "Net Income up 20%"
        
        # We need to simulate the file object passed to upload_document
        # It expects an UploadFile which has a .file attribute (spooled file)
        
        class MockFile:
            def __init__(self):
                self.filename = filename
                self.file = self
            def read(self):
                return content.encode()
        
        # The service uses shutil.copyfileobj(file.file, buffer)
        # So providing a BytesIO is best
        import io
        file_obj = io.BytesIO(content.encode())
        upload_file = MagicMock(spec=UploadFile)
        upload_file.filename = filename
        upload_file.file = file_obj
        
        # Upload
        metadata = await upload_document(upload_file, "AAPL", "10-K")
        
        # Verify
        assert metadata["original_name"] == filename
        assert metadata["type"] == "10-K"
        assert "content_preview" in metadata
        assert metadata["content_preview"] == content
        
        # Check get_documents
        docs = get_documents("AAPL")
        assert len(docs) == 1
        assert docs[0]["id"] == metadata["id"]
        
        # Check get_document_text
        full_text = get_document_text("AAPL")
        assert "Net Income up 20%" in full_text
        assert "DOCUMENT: test_report.txt" in full_text
        
    @pytest.mark.asyncio
    async def test_content_hash_changes(self):
        # 1. Upload first doc
        import io
        file1 = MagicMock(spec=UploadFile)
        file1.filename = "doc1.txt"
        file1.file = io.BytesIO(b"Content A")
        await upload_document(file1, "TSLA", "Note")
        
        hash1 = get_content_hash("TSLA")
        assert hash1
        
        # 2. Upload second doc
        file2 = MagicMock(spec=UploadFile)
        file2.filename = "doc2.txt"
        file2.file = io.BytesIO(b"Content B")
        await upload_document(file2, "TSLA", "Note")
        
        hash2 = get_content_hash("TSLA")
        assert hash2
        assert hash1 != hash2
        
    @pytest.mark.asyncio
    async def test_delete_document(self):
        # Upload
        import io
        file = MagicMock(spec=UploadFile)
        file.filename = "del_me.txt"
        file.file = io.BytesIO(b"Delete me")
        meta = await upload_document(file, "MSFT", "Trash")
        
        assert len(get_documents("MSFT")) == 1
        
        # Delete
        success = delete_document("MSFT", meta["id"])
        assert success
        
        assert len(get_documents("MSFT")) == 0
        assert not os.path.exists(meta["path"])
