"""Schemas Pydantic do módulo de Chat (UC10 — Tirar dúvida com IA via RAG).

Camadas:
* **Input**: `AskRequest`, `RenameSessionRequest`.
* **Output**: `ChatSourceOut`, `ChatMessageOut`, `ChatSessionOut`, `ChatSessionDetail`,
  `AskResponse`.

`AskResponse` carrega `session_id` porque o cliente pode iniciar uma conversa
sem ter session_id (atalho `POST /chat/ask`) — o backend cria e devolve.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat import ChatRole


# =============================================================================
# Input
# =============================================================================
class AskRequest(BaseModel):
    # subject_id obrigatório na criação de uma nova conversa; em uma sessão
    # já existente o backend ignora o campo e usa o subject_id gravado.
    subject_id: Optional[UUID] = None
    question: str = Field(min_length=1, max_length=4000)


class RenameSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


# =============================================================================
# Output
# =============================================================================
class ChatSourceOut(BaseModel):
    id: UUID
    document_id: UUID
    chunk_id: Optional[UUID]
    page_number: Optional[int]
    snippet: str
    score: Optional[Decimal]
    rank: int

    model_config = ConfigDict(from_attributes=True)


class ChatMessageOut(BaseModel):
    id: UUID
    session_id: UUID
    role: ChatRole
    content: str
    created_at: datetime
    sources: list[ChatSourceOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ChatSessionOut(BaseModel):
    """Forma usada na listagem da sidebar — sem mensagens."""

    id: UUID
    user_id: UUID
    subject_id: Optional[UUID]
    title: str
    created_at: datetime
    last_message_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionDetail(ChatSessionOut):
    """Sessão com todas as mensagens (e suas fontes) carregadas."""

    messages: list[ChatMessageOut] = Field(default_factory=list)


class AskResponse(BaseModel):
    session_id: UUID
    message: ChatMessageOut
