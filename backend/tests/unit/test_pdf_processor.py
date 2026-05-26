import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime
from app.models.document import Document, DocumentStatus, DocumentChunk
from app.services.pdf_processor import process_pdf
from app.integrations.openai_client import FakeDemoClient

@patch("app.services.pdf_processor.pdfplumber.open")
@patch("app.services.pdf_processor.os.path.exists")
def test_process_pdf_success(mock_exists, mock_pdf_open):
    mock_exists.return_value = True

    # Configura o mock do pdfplumber
    mock_page1 = MagicMock()
    mock_page1.extract_text.return_value = "Conteúdo da página um. Muito interessante."
    mock_page2 = MagicMock()
    mock_page2.extract_text.return_value = "Conteúdo da página dois. Também interessante."
    
    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page1, mock_page2]
    mock_pdf.__enter__.return_value = mock_pdf
    mock_pdf_open.return_value = mock_pdf

    # Mock do DB e do Document
    db = MagicMock()
    doc_id = uuid4()
    user_id = uuid4()
    doc = Document(
        id=doc_id,
        user_id=user_id,
        filename="teste.pdf",
        file_path="/tmp/teste.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        status=DocumentStatus.processing
    )
    db.query().filter().first.return_value = doc

    openai_client = FakeDemoClient()
    
    # Executa o pipeline
    process_pdf(db, doc_id, openai_client, chunk_size=10, chunk_overlap=1)

    # Asserts
    assert doc.status == DocumentStatus.ready
    assert doc.total_pages == 2
    assert doc.total_chunks > 0
    assert doc.error_message is None
    assert doc.processed_at is not None

    # Verifica se os chunks foram adicionados ao db
    added_objects = [call[0][0] for call in db.add.call_args_list]
    chunks = [o for o in added_objects if isinstance(o, DocumentChunk)]
    assert len(chunks) == doc.total_chunks
    assert chunks[0].document_id == doc_id
    assert chunks[0].chunk_index == 0
    assert len(chunks[0].embedding) == 1536
    db.commit.assert_called()

@patch("app.services.pdf_processor.os.path.exists")
def test_process_pdf_file_not_found(mock_exists):
    mock_exists.return_value = False

    db = MagicMock()
    doc_id = uuid4()
    doc = Document(
        id=doc_id,
        user_id=uuid4(),
        filename="teste.pdf",
        file_path="/tmp/inexistente.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        status=DocumentStatus.processing
    )
    db.query().filter().first.return_value = doc
    
    openai_client = FakeDemoClient()
    process_pdf(db, doc_id, openai_client)

    assert doc.status == DocumentStatus.failed
    assert "Arquivo não encontrado" in doc.error_message
    db.rollback.assert_called_once()
    db.commit.assert_called()
