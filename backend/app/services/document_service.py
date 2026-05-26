import os
import uuid
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentStatus
from app.models.subject import Subject
from app.models.user import User

UPLOAD_DIR = "uploads"

def upload_document(
    db: Session,
    user: User,
    file_content: bytes,
    filename: str,
    mime_type: str,
    subject_id: Optional[UUID] = None
) -> Document:
    """Valida, cria o registro do documento no banco e salva o arquivo em disco."""
    # Valida mime-type e extensão
    is_pdf = mime_type == "application/pdf" or filename.lower().endswith(".pdf")
    if not is_pdf:
        raise ValueError("Apenas arquivos PDF são suportados.")

    # Se subject_id for fornecido, valida se pertence ao usuário
    if subject_id:
        subject = db.query(Subject).filter(Subject.id == subject_id, Subject.user_id == user.id).first()
        if not subject:
            raise ValueError("Matéria não encontrada ou não pertence ao usuário.")

    # Cria diretório de uploads se não existir
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    doc_id = uuid.uuid4()
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    # Salva o arquivo no disco
    with open(file_path, "wb") as f:
        f.write(file_content)

    doc = Document(
        id=doc_id,
        user_id=user.id,
        subject_id=subject_id,
        filename=filename,
        file_path=file_path,
        file_size_bytes=len(file_content),
        mime_type=mime_type,
        status=DocumentStatus.processing
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

def list_user_documents(
    db: Session,
    user: User,
    subject_id: Optional[UUID] = None
) -> List[Document]:
    """Lista todos os documentos do usuário, opcionalmente filtrando por matéria."""
    query = db.query(Document).filter(Document.user_id == user.id)
    if subject_id:
        query = query.filter(Document.subject_id == subject_id)
    return query.order_by(Document.uploaded_at.desc()).all()

def get_user_document(
    db: Session,
    user: User,
    document_id: UUID
) -> Document:
    """Busca um documento específico do usuário. Levanta ValueError se não existir."""
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user.id).first()
    if not doc:
        raise ValueError("Documento não encontrado.")
    return doc

def delete_document(
    db: Session,
    user: User,
    document_id: UUID
) -> None:
    """Remove o documento do banco (chunks caem por CASCADE) e do disco."""
    doc = get_user_document(db, user, document_id)
    
    # Remove o arquivo físico
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass  # Ignora erros físicos para não inviabilizar o delete lógico

    db.delete(doc)
    db.commit()
