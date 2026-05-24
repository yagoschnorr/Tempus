"""Retrieval por similaridade vetorial dentro do escopo de um subject_id.

Filosofia:
* O retrieval é "scoped" — só busca em chunks de documentos do usuário e da
  matéria. Isso evita vazamento entre matérias e dá retrievals mais relevantes
  com k pequeno.
* Em Postgres (produção e dev via docker) usa o operador `<=>` de pgvector
  (distância cosseno). Em SQLite (testes unitários) faz ranking em Python
  porque o operador não existe — comportamento idêntico, performance pior,
  mas o que importa é a corretude do contrato.
* Sem chunks com score acima do threshold, retorna lista vazia. O chamador
  (chat_service) trata isso respondendo sem fontes — a tela renderiza
  "resposta sem citações" sem quebrar nada.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentChunk, DocumentStatus


DEFAULT_K = 5
DEFAULT_THRESHOLD = 0.7  # similaridade cosseno mínima para entrar no contexto


@dataclass
class RetrievedChunk:
    chunk_id: UUID
    document_id: UUID
    content: str
    page_number: Optional[int]
    score: float
    rank: int


def search(
    db: Session,
    *,
    user_id: UUID,
    subject_id: UUID,
    query_embedding: list[float],
    k: int = DEFAULT_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[RetrievedChunk]:
    """Top-k chunks por similaridade cosseno, filtrados por score >= threshold.

    Resultado já vem ordenado por similaridade descendente e com `rank` atribuído
    a partir de 1.
    """
    if not query_embedding:
        return []

    dialect = db.bind.dialect.name if db.bind is not None else ""
    if dialect == "postgresql":
        return _search_pgvector(
            db, user_id, subject_id, query_embedding, k, threshold
        )
    return _search_python_fallback(
        db, user_id, subject_id, query_embedding, k, threshold
    )


# ---------------------------------------------------------------------------
# Backend Postgres (produção)
# ---------------------------------------------------------------------------
_PG_QUERY = text(
    """
    SELECT
        c.id          AS chunk_id,
        c.document_id AS document_id,
        c.content     AS content,
        c.page_number AS page_number,
        1 - (c.embedding <=> CAST(:q AS vector)) AS score
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.user_id = :user_id
      AND d.subject_id = :subject_id
      AND d.status = 'ready'
    ORDER BY c.embedding <=> CAST(:q AS vector)
    LIMIT :limit
    """
)


def _format_pg_vector(values: list[float]) -> str:
    # pgvector aceita o literal "[v1,v2,...]" via cast em texto.
    return "[" + ",".join(f"{v:.6f}" for v in values) + "]"


def _search_pgvector(
    db: Session,
    user_id: UUID,
    subject_id: UUID,
    query_embedding: list[float],
    k: int,
    threshold: float,
) -> list[RetrievedChunk]:
    rows = db.execute(
        _PG_QUERY,
        {
            "q": _format_pg_vector(query_embedding),
            "user_id": str(user_id),
            "subject_id": str(subject_id),
            "limit": k,
        },
    ).all()

    results: list[RetrievedChunk] = []
    for rank, row in enumerate(rows, start=1):
        score = float(row.score)
        if score < threshold:
            continue
        results.append(
            RetrievedChunk(
                chunk_id=row.chunk_id,
                document_id=row.document_id,
                content=row.content,
                page_number=row.page_number,
                score=score,
                rank=rank,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Fallback Python (SQLite, testes)
# ---------------------------------------------------------------------------
def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _search_python_fallback(
    db: Session,
    user_id: UUID,
    subject_id: UUID,
    query_embedding: list[float],
    k: int,
    threshold: float,
) -> list[RetrievedChunk]:
    chunks = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            Document.user_id == user_id,
            Document.subject_id == subject_id,
            Document.status == DocumentStatus.ready,
        )
        .all()
    )

    scored: list[tuple[float, DocumentChunk]] = []
    for chunk, _doc in chunks:
        embedding = list(chunk.embedding) if chunk.embedding is not None else []
        score = _cosine(query_embedding, embedding)
        if score >= threshold:
            scored.append((score, chunk))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    top = scored[:k]
    return [
        RetrievedChunk(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            content=chunk.content,
            page_number=chunk.page_number,
            score=score,
            rank=rank,
        )
        for rank, (score, chunk) in enumerate(top, start=1)
    ]
