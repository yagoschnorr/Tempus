from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Form, UploadFile, BackgroundTasks, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.integrations.openai_client import OpenAIClient, get_openai
from app.models.user import User
from app.schemas.document import DocumentOut
from app.services import document_service
from app.services.pdf_processor import process_pdf

router = APIRouter()

@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    subject_id: Optional[UUID] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    """Realiza o upload de um documento PDF e dispara o pipeline de processamento em background."""
    try:
        content = await file.read()
        doc = document_service.upload_document(
            db=db,
            user=current_user,
            file_content=content,
            filename=file.filename,
            mime_type=file.content_type,
            subject_id=subject_id
        )
        background_tasks.add_task(process_pdf, db, doc.id, openai)
        return doc
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("", response_model=List[DocumentOut])
def list_documents(
    subject_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os documentos do usuário logado, com filtro opcional por matéria (subject_id)."""
    return document_service.list_user_documents(db, current_user, subject_id)

@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Busca os detalhes de um documento do usuário."""
    try:
        return document_service.get_user_document(db, current_user, document_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deleta um documento do usuário."""
    try:
        document_service.delete_document(db, current_user, document_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
