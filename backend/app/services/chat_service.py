"""Serviço de Chat: orquestra a conversa de dúvidas com RAG (UC10).

Fluxo de `ask()`:
    1. valida a sessão (existe? pertence ao user?)
    2. gera embedding da pergunta (OpenAI)
    3. retrieval no `rag_service` (filtrado por subject_id da sessão)
    4. monta prompt com contexto + histórico
    5. chama OpenAI chat completion
    6. persiste: mensagem do usuário + mensagem do assistant + fontes
    7. atualiza `last_message_at` da sessão
    8. devolve a mensagem do assistant com sources

Decisões:
* Sessão criada implicitamente em `start_session_with_question` — primeiro
  envio de pergunta sem session_id vira uma nova sessão (auto-título por
  truncamento de 60 chars + "…" se cortou).
* `subject_id` é obrigatório para iniciar uma conversa. Em uma sessão já
  existente o backend usa o subject_id gravado, ignorando o do payload.
* Histórico enviado à OpenAI: últimas 10 mensagens (5 turnos) — suficiente
  para coerência sem estourar contexto.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.integrations.openai_client import OpenAIClient
from app.models.chat import (
    ChatMessage,
    ChatMessageSource,
    ChatRole,
    ChatSession,
)
from app.models.subject import Subject
from app.models.user import User
from app.services import rag_service
from app.services.rag_service import RetrievedChunk


TITLE_MAX = 60  # limite visual da sidebar (coluna title VARCHAR(120) cabe folgado)
HISTORY_TURNS = 5  # 5 turnos = 10 mensagens (user + assistant)
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TEMPERATURE = 0.4  # mais baixo que o quiz: queremos respostas focadas

SYSTEM_PROMPT = """Você é um tutor educacional do Tempus, ajudando estudantes universitários a tirar dúvidas.

Regras:
- Responda em português do Brasil, com clareza e profundidade adequada ao nível universitário.
- Quando o usuário fornecer trechos de material de estudo como contexto, baseie sua resposta neles e mencione conceitos do contexto.
- Se o contexto não cobrir a dúvida, responda com seu conhecimento geral e seja honesto sobre essa limitação.
- Não invente citações de páginas, autores ou documentos. As citações da resposta serão construídas pelo sistema a partir dos trechos fornecidos."""


class ChatError(RuntimeError):
    """Falha irrecuperável no fluxo de chat."""


# ---------------------------------------------------------------------------
# Helpers de leitura
# ---------------------------------------------------------------------------
def _get_session_owned_by_user(
    db: Session, user_id: UUID, session_id: UUID
) -> ChatSession:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada",
        )
    return session


def _ensure_subject_owned(db: Session, user_id: UUID, subject_id: UUID) -> Subject:
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == user_id)
        .first()
    )
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Matéria não encontrada"
        )
    return subject


def _build_title(question: str) -> str:
    cleaned = " ".join(question.split())
    if len(cleaned) <= TITLE_MAX:
        return cleaned
    return cleaned[: TITLE_MAX - 1].rstrip() + "…"


def _load_messages_in_order(db: Session, session_id: UUID) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at, ChatMessage.id)
        .all()
    )


def _load_sources_for_message(
    db: Session, message_id: UUID
) -> list[ChatMessageSource]:
    return (
        db.query(ChatMessageSource)
        .filter(ChatMessageSource.message_id == message_id)
        .order_by(ChatMessageSource.rank)
        .all()
    )


# ---------------------------------------------------------------------------
# Operações de sessão (CRUD)
# ---------------------------------------------------------------------------
def list_sessions(
    db: Session, user: User, *, subject_id: Optional[UUID] = None
) -> list[ChatSession]:
    query = db.query(ChatSession).filter(ChatSession.user_id == user.id)
    if subject_id is not None:
        query = query.filter(ChatSession.subject_id == subject_id)
    return query.order_by(ChatSession.last_message_at.desc()).all()


def get_session_detail(
    db: Session, user: User, session_id: UUID
) -> tuple[ChatSession, list[tuple[ChatMessage, list[ChatMessageSource]]]]:
    session = _get_session_owned_by_user(db, user.id, session_id)
    messages = _load_messages_in_order(db, session.id)
    enriched = [(m, _load_sources_for_message(db, m.id)) for m in messages]
    return session, enriched


def rename_session(
    db: Session, user: User, session_id: UUID, title: str
) -> ChatSession:
    session = _get_session_owned_by_user(db, user.id, session_id)
    session.title = title
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: Session, user: User, session_id: UUID) -> None:
    session = _get_session_owned_by_user(db, user.id, session_id)
    db.delete(session)
    db.commit()


# ---------------------------------------------------------------------------
# Orquestração de envio de pergunta
# ---------------------------------------------------------------------------
def ask_in_new_session(
    db: Session,
    user: User,
    *,
    subject_id: UUID,
    question: str,
    openai: OpenAIClient,
) -> tuple[ChatSession, ChatMessage, list[ChatMessageSource]]:
    """Cria sessão nova com `subject_id` + processa a primeira pergunta."""
    _ensure_subject_owned(db, user.id, subject_id)

    session = ChatSession(
        user_id=user.id,
        subject_id=subject_id,
        title=_build_title(question),
    )
    db.add(session)
    db.flush()  # garante session.id antes de adicionar mensagens

    message, sources = _process_question(
        db, user=user, session=session, question=question, openai=openai
    )
    return session, message, sources


def ask_in_existing_session(
    db: Session,
    user: User,
    *,
    session_id: UUID,
    question: str,
    openai: OpenAIClient,
) -> tuple[ChatSession, ChatMessage, list[ChatMessageSource]]:
    """Anexa nova pergunta a uma sessão existente."""
    session = _get_session_owned_by_user(db, user.id, session_id)
    message, sources = _process_question(
        db, user=user, session=session, question=question, openai=openai
    )
    return session, message, sources


# ---------------------------------------------------------------------------
# Núcleo: embed → retrieval → completion → persist
# ---------------------------------------------------------------------------
def _process_question(
    db: Session,
    *,
    user: User,
    session: ChatSession,
    question: str,
    openai: OpenAIClient,
) -> tuple[ChatMessage, list[ChatMessageSource]]:
    # 1. Histórico anterior (antes de inserir a nova pergunta)
    previous = _load_messages_in_order(db, session.id)

    # 2. Persistir mensagem do usuário primeiro (mantém ordem temporal correta).
    # Atribuição manual de created_at no Python: garante precisão µs e ordenação
    # determinística mesmo em SQLite (CURRENT_TIMESTAMP tem só precisão de segundo).
    user_created_at = datetime.now(timezone.utc)
    user_msg = ChatMessage(
        session_id=session.id,
        role=ChatRole.user,
        content=question,
        created_at=user_created_at,
    )
    db.add(user_msg)
    db.flush()

    # 3. Retrieval (só se a sessão ainda tem subject_id — se a matéria foi
    #    apagada, viramos chat sem fontes).
    retrieved: list[RetrievedChunk] = []
    if session.subject_id is not None:
        try:
            query_embedding = _embed_one(openai, question)
        except ChatError:
            query_embedding = []
        if query_embedding:
            retrieved = rag_service.search(
                db,
                user_id=user.id,
                subject_id=session.subject_id,
                query_embedding=query_embedding,
            )

    # 4. Completion
    answer_text = _chat_completion(
        openai,
        previous_messages=previous,
        question=question,
        retrieved=retrieved,
    )

    # 5. Persistir resposta + fontes + atualizar timestamp
    assistant_created_at = datetime.now(timezone.utc)
    if assistant_created_at <= user_created_at:
        # FakeOpenAI em testes responde instantaneamente; força ordem > user.
        assistant_created_at = user_created_at + timedelta(microseconds=1)
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=ChatRole.assistant,
        content=answer_text,
        created_at=assistant_created_at,
    )
    db.add(assistant_msg)
    db.flush()

    sources: list[ChatMessageSource] = []
    for chunk in retrieved:
        src = ChatMessageSource(
            message_id=assistant_msg.id,
            document_id=chunk.document_id,
            chunk_id=chunk.chunk_id,
            page_number=chunk.page_number,
            snippet=_snippet(chunk.content),
            score=Decimal(f"{chunk.score:.4f}"),
            rank=chunk.rank,
        )
        db.add(src)
        sources.append(src)

    session.last_message_at = assistant_created_at
    db.commit()
    db.refresh(assistant_msg)
    return assistant_msg, sources


def _embed_one(openai: OpenAIClient, text_: str) -> list[float]:
    try:
        result = openai.embed([text_])
    except Exception as err:  # noqa: BLE001 — fail-safe; chat funciona sem RAG
        raise ChatError(f"Falha ao gerar embedding: {err}") from err
    if not result or not result[0]:
        raise ChatError("Embedding vazio")
    return list(result[0])


def _snippet(content: str, max_chars: int = 280) -> str:
    cleaned = " ".join(content.split())
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 1].rstrip() + "…"


def _chat_completion(
    openai: OpenAIClient,
    *,
    previous_messages: list[ChatMessage],
    question: str,
    retrieved: list[RetrievedChunk],
) -> str:
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Janela curta de histórico para não estourar contexto.
    window = previous_messages[-HISTORY_TURNS * 2 :]
    for m in window:
        messages.append({"role": m.role.value, "content": m.content})

    # Pergunta atual + contexto recuperado anexado.
    if retrieved:
        context_block = "\n\n".join(
            f"[Trecho {chunk.rank}] {chunk.content}" for chunk in retrieved
        )
        user_content = (
            f"{question}\n\n"
            f"Trechos relevantes do material de estudo:\n{context_block}"
        )
    else:
        user_content = question

    messages.append({"role": "user", "content": user_content})

    response = openai.chat(
        messages=messages,
        model=DEFAULT_MODEL,
        temperature=DEFAULT_TEMPERATURE,
    )
    try:
        return response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise ChatError(
            f"Estrutura inesperada de resposta da OpenAI: {err}"
        ) from err
