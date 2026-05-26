import pytest
from unittest.mock import MagicMock, patch, mock_open
from uuid import uuid4
from app.models.user import User
from app.models.subject import Subject
from app.models.document import Document, DocumentStatus
from app.services.document_service import (
    upload_document,
    list_user_documents,
    get_user_document,
    delete_document
)

def test_upload_document_invalid_mime():
    db = MagicMock()
    user = User(id=uuid4())
    with pytest.raises(ValueError, match="Apenas arquivos PDF"):
        upload_document(db, user, b"test content", "doc.txt", "text/plain")

@patch("app.services.document_service.os.makedirs")
@patch("app.services.document_service.open", new_callable=mock_open)
def test_upload_document_success(mock_file, mock_makedirs):
    db = MagicMock()
    user = User(id=uuid4())
    subject_id = uuid4()
    
    # Mock do Subject correspondente
    subject = Subject(id=subject_id, user_id=user.id, name="Química")
    db.query().filter().first.return_value = subject

    doc = upload_document(
        db,
        user,
        b"%PDF-1.4 dummy",
        "aula1.pdf",
        "application/pdf",
        subject_id=subject_id
    )

    assert doc.filename == "aula1.pdf"
    assert doc.mime_type == "application/pdf"
    assert doc.status == DocumentStatus.processing
    assert doc.user_id == user.id
    assert doc.subject_id == subject_id
    mock_file.assert_called_once()
    mock_makedirs.assert_called_once_with("uploads", exist_ok=True)
    db.add.assert_called_once()
    db.commit.assert_called()

def test_list_user_documents():
    db = MagicMock()
    user = User(id=uuid4())
    
    # Mock da query
    mock_query = db.query().filter()
    mock_query.order_by().all.return_value = [
        Document(filename="1.pdf", user_id=user.id),
        Document(filename="2.pdf", user_id=user.id)
    ]

    docs = list_user_documents(db, user)
    assert len(docs) == 2
    assert docs[0].filename == "1.pdf"

def test_get_user_document_success():
    db = MagicMock()
    user = User(id=uuid4())
    doc_id = uuid4()
    
    expected_doc = Document(id=doc_id, user_id=user.id, filename="1.pdf")
    db.query().filter().first.return_value = expected_doc

    doc = get_user_document(db, user, doc_id)
    assert doc.id == doc_id
    assert doc.filename == "1.pdf"

def test_get_user_document_not_found():
    db = MagicMock()
    user = User(id=uuid4())
    db.query().filter().first.return_value = None

    with pytest.raises(ValueError, match="Documento não encontrado"):
        get_user_document(db, user, uuid4())

@patch("app.services.document_service.os.path.exists")
@patch("app.services.document_service.os.remove")
def test_delete_document_success(mock_remove, mock_exists):
    mock_exists.return_value = True
    db = MagicMock()
    user = User(id=uuid4())
    doc_id = uuid4()
    
    doc = Document(id=doc_id, user_id=user.id, file_path="uploads/foo.pdf")
    db.query().filter().first.return_value = doc

    delete_document(db, user, doc_id)

    mock_remove.assert_called_once_with("uploads/foo.pdf")
    db.delete.assert_called_once_with(doc)
    db.commit.assert_called()
