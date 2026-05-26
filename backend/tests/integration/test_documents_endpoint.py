from uuid import uuid4
import pytest
from unittest.mock import patch, MagicMock
from app.models.document import DocumentStatus, Document
from app.models.subject import Subject

def test_list_requires_auth(client):
    assert client.get("/api/documents").status_code == 401

def test_upload_requires_auth(client):
    response = client.post(
        "/api/documents",
        files={"file": ("test.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    )
    assert response.status_code == 401

@patch("app.services.pdf_processor.pdfplumber.open")
def test_upload_and_list_documents(mock_pdf_open, client, auth_headers, db, test_user):
    # Setup mock PDF pages for the background process_pdf task
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Esta é uma página de teste para RAG."
    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page]
    mock_pdf.__enter__.return_value = mock_pdf
    mock_pdf_open.return_value = mock_pdf

    # 1. Cria uma matéria para vincular ao documento
    subject = Subject(id=uuid4(), user_id=test_user.id, name="Engenharia de Software")
    db.add(subject)
    db.commit()
    db.refresh(subject)

    # 2. Faz o upload do documento
    response = client.post(
        "/api/documents",
        data={"subject_id": str(subject.id)},
        files={"file": ("aula1.pdf", b"%PDF-1.4 dummy", "application/pdf")},
        headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "aula1.pdf"
    assert body["status"] == DocumentStatus.processing.value
    assert body["subject_id"] == str(subject.id)

    doc_id = body["id"]

    # 3. Lista documentos (filtro por subject_id)
    list_response = client.get(f"/api/documents?subject_id={subject.id}", headers=auth_headers)
    assert list_response.status_code == 200
    list_body = list_response.json()
    assert len(list_body) == 1
    assert list_body[0]["id"] == doc_id

    # 4. Obtém detalhes do documento específico
    get_response = client.get(f"/api/documents/{doc_id}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.json()["filename"] == "aula1.pdf"

@patch("app.services.pdf_processor.pdfplumber.open")
def test_delete_document(mock_pdf_open, client, auth_headers, db, test_user):
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto"
    mock_pdf = MagicMock()
    mock_pdf.pages = [mock_page]
    mock_pdf.__enter__.return_value = mock_pdf
    mock_pdf_open.return_value = mock_pdf

    # Upload
    response = client.post(
        "/api/documents",
        files={"file": ("aula2.pdf", b"%PDF-1.4 dummy", "application/pdf")},
        headers=auth_headers
    )
    doc_id = response.json()["id"]

    # Verifica se existe no banco
    assert db.query(Document).filter(Document.id == doc_id).first() is not None

    # Deleta
    delete_response = client.delete(f"/api/documents/{doc_id}", headers=auth_headers)
    assert delete_response.status_code == 204

    # Verifica se não existe mais
    assert db.query(Document).filter(Document.id == doc_id).first() is None
