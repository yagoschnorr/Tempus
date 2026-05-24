"""Testes unitários do chat_service — foco em comportamento isolado.

Os fluxos end-to-end estão em `tests/integration/test_chat_endpoint.py`.
Aqui cobrimos:
* `_build_title`: regras de truncamento e collapse de whitespace.
* `rag_service.search`: fallback Python ranqueia chunks acima do threshold.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.document import Document, DocumentChunk, DocumentStatus
from app.models.subject import Subject
from app.models.user import User
from app.core.security import get_password_hash
from app.services import rag_service
from app.services.chat_service import _build_title


# ---------------------------------------------------------------------------
# _build_title
# ---------------------------------------------------------------------------
def test_build_title_keeps_short_question_intact():
    assert _build_title("Por que pi?") == "Por que pi?"


def test_build_title_collapses_whitespace():
    assert _build_title("   Por   que     pi?  ") == "Por que pi?"


def test_build_title_truncates_long_question_with_ellipsis():
    long_q = "Pergunta longuíssima " * 10
    out = _build_title(long_q)
    assert len(out) <= 60
    assert out.endswith("…")


# ---------------------------------------------------------------------------
# rag_service.search — fallback Python (SQLite)
# ---------------------------------------------------------------------------
@pytest.fixture
def user_with_subject(db):
    user = User(
        id=uuid4(),
        name="Rag Tester",
        email=f"rag-{uuid4().hex[:6]}@tempus.dev",
        password_hash=get_password_hash("x"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    subject = Subject(user_id=user.id, name="Cálculo")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return user, subject


VECTOR_DIM = 1536  # bate com Vector(1536) declarado em models/document.py


def _basis_vector(axis: int) -> list[float]:
    """Vetor 1536-dim com 1.0 só na posição `axis`. Ótimo pra testar cosseno:
    `axis=0` é ortogonal a `axis=1` (cos=0), e idêntico a outro `axis=0` (cos=1).
    """
    v = [0.0] * VECTOR_DIM
    v[axis] = 1.0
    return v


def _add_document_with_chunk(
    db, *, user_id, subject_id, content, embedding, page=1, status=DocumentStatus.ready
):
    doc = Document(
        user_id=user_id,
        subject_id=subject_id,
        filename="x.pdf",
        file_path="/tmp/x.pdf",
        file_size_bytes=10,
        mime_type="application/pdf",
        status=status,
    )
    db.add(doc)
    db.flush()
    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content=content,
        embedding=embedding,
        page_number=page,
        token_count=10,
    )
    db.add(chunk)
    db.commit()
    return doc, chunk


def test_search_returns_empty_when_no_chunks(user_with_subject, db):
    user, subject = user_with_subject
    result = rag_service.search(
        db,
        user_id=user.id,
        subject_id=subject.id,
        query_embedding=_basis_vector(0),
    )
    assert result == []


def test_search_ranks_above_threshold_only(user_with_subject, db):
    user, subject = user_with_subject

    similar = _basis_vector(0)
    orthogonal = _basis_vector(1)

    _add_document_with_chunk(
        db,
        user_id=user.id,
        subject_id=subject.id,
        content="trecho muito similar",
        embedding=similar,
    )
    _add_document_with_chunk(
        db,
        user_id=user.id,
        subject_id=subject.id,
        content="trecho ortogonal",
        embedding=orthogonal,
    )

    result = rag_service.search(
        db,
        user_id=user.id,
        subject_id=subject.id,
        query_embedding=similar,  # cosseno=1.0 com 'similar', 0.0 com 'orthogonal'
        threshold=0.7,
    )
    assert len(result) == 1
    assert result[0].content == "trecho muito similar"
    assert result[0].rank == 1
    assert result[0].score == pytest.approx(1.0)


def test_search_filters_by_subject_and_status(user_with_subject, db):
    user, subject = user_with_subject
    other_subject = Subject(user_id=user.id, name="POO")
    db.add(other_subject)
    db.commit()
    db.refresh(other_subject)

    similar = _basis_vector(0)

    # Chunk em outra matéria — não deve voltar
    _add_document_with_chunk(
        db,
        user_id=user.id,
        subject_id=other_subject.id,
        content="POO",
        embedding=similar,
    )
    # Chunk com status=processing — não deve voltar
    _add_document_with_chunk(
        db,
        user_id=user.id,
        subject_id=subject.id,
        content="processing",
        embedding=similar,
        status=DocumentStatus.processing,
    )
    # Chunk válido
    _add_document_with_chunk(
        db,
        user_id=user.id,
        subject_id=subject.id,
        content="válido",
        embedding=similar,
    )

    result = rag_service.search(
        db,
        user_id=user.id,
        subject_id=subject.id,
        query_embedding=similar,
    )
    assert len(result) == 1
    assert result[0].content == "válido"
