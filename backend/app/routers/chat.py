"""Endpoints REST do módulo de Chat (UC10).

Contrato:
* `GET    /sessions[?subject_id=]`               → lista da sidebar
* `GET    /sessions/{session_id}`                → sessão + mensagens + fontes
* `POST   /sessions/{session_id}/ask`            → envia pergunta em sessão existente
* `POST   /ask`                                  → atalho "primeira pergunta":
                                                    cria sessão implicitamente
                                                    e responde
* `PATCH  /sessions/{session_id}`                → renomear título
* `DELETE /sessions/{session_id}`                → apaga sessão (CASCADE em messages/sources)
"""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.integrations.openai_client import OpenAIClient, get_openai
from app.models.chat import ChatMessage, ChatMessageSource, ChatSession
from app.models.user import User
from app.schemas.chat import (
    AskRequest,
    AskResponse,
    ChatMessageOut,
    ChatSessionDetail,
    ChatSessionOut,
    ChatSourceOut,
    RenameSessionRequest,
)
from app.services import chat_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers de serialização
# ---------------------------------------------------------------------------
def _message_with_sources(
    message: ChatMessage, sources: list[ChatMessageSource]
) -> ChatMessageOut:
    out = ChatMessageOut.model_validate(message)
    out.sources = [ChatSourceOut.model_validate(s) for s in sources]
    return out


def _session_detail(
    session: ChatSession,
    enriched_messages: list[tuple[ChatMessage, list[ChatMessageSource]]],
) -> ChatSessionDetail:
    detail = ChatSessionDetail.model_validate(session)
    detail.messages = [_message_with_sources(m, s) for m, s in enriched_messages]
    return detail


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
@router.get("/sessions", response_model=List[ChatSessionOut])
def list_sessions(
    subject_id: Optional[UUID] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.list_sessions(db, current_user, subject_id=subject_id)


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session, enriched = chat_service.get_session_detail(
        db, current_user, session_id
    )
    return _session_detail(session, enriched)


@router.patch("/sessions/{session_id}", response_model=ChatSessionOut)
def rename_session(
    session_id: UUID,
    payload: RenameSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.rename_session(db, current_user, session_id, payload.title)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat_service.delete_session(db, current_user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Ask
# ---------------------------------------------------------------------------
@router.post(
    "/ask", response_model=AskResponse, status_code=status.HTTP_201_CREATED
)
def ask_new(
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    """Atalho 'primeira pergunta': cria sessão implicitamente.

    `subject_id` é obrigatório aqui — chat é por matéria.
    """
    if payload.subject_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="subject_id é obrigatório para iniciar uma nova conversa",
        )
    session, message, sources = chat_service.ask_in_new_session(
        db,
        current_user,
        subject_id=payload.subject_id,
        question=payload.question,
        openai=openai,
    )
    return AskResponse(
        session_id=session.id, message=_message_with_sources(message, sources)
    )


@router.post("/sessions/{session_id}/ask", response_model=AskResponse)
def ask_in_session(
    session_id: UUID,
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    session, message, sources = chat_service.ask_in_existing_session(
        db,
        current_user,
        session_id=session_id,
        question=payload.question,
        openai=openai,
    )
    return AskResponse(
        session_id=session.id, message=_message_with_sources(message, sources)
    )
