"""Integração real: EmbeddingService → OpenAI → pgvector.

Valida coisas que o conftest pai (SQLite + FakeOpenAI) não consegue:
* A coluna `Vector(1536)` aceita o vetor retornado pela API real.
* A query de similaridade `<=>` (cosine distance) ranqueia consistentemente.
* O batching de 100 do `EmbeddingService` produz a mesma quantidade de vetores
  que textos de entrada quando ultrapassa o batch.
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.models.document import Document, DocumentChunk, DocumentStatus
from app.services.embedding_service import EmbeddingService


pytestmark = [pytest.mark.integration_real, pytest.mark.vcr]


def _make_document(db, user_id, filename: str = "real.pdf") -> Document:
    doc = Document(
        id=uuid4(),
        user_id=user_id,
        filename=filename,
        file_path=f"/tmp/{filename}",
        file_size_bytes=1024,
        mime_type="application/pdf",
        total_pages=1,
        total_chunks=0,
        status=DocumentStatus.processing,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def test_embeddings_persist_in_pgvector_and_cosine_ranks_semantically(
    db, test_user, openai_client
):
    """OpenAI embed() → pgvector → query por similaridade."""
    service = EmbeddingService(openai_client)
    chunks = [
        "Cálculo diferencial estuda taxas de variação e derivadas.",
        "Álgebra linear trata de vetores, matrizes e transformações lineares.",
        "Programação dinâmica resolve problemas com subestrutura ótima.",
    ]

    vectors = service.get_embeddings(chunks)
    assert len(vectors) == 3
    assert all(len(v) == 1536 for v in vectors)

    doc = _make_document(db, test_user.id)
    for idx, (content, embedding) in enumerate(zip(chunks, vectors)):
        db.add(
            DocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=content,
                embedding=embedding,
                page_number=1,
                token_count=len(content.split()),
            )
        )
    db.commit()

    query_vec = service.get_embeddings(["O que é derivada em cálculo?"])[0]

    # Cosine distance: menor = mais similar. O chunk de cálculo precisa vir 1º.
    rows = db.execute(
        text(
            """
            SELECT content, embedding <=> CAST(:q AS vector) AS distance
            FROM document_chunks
            WHERE document_id = :doc
            ORDER BY distance ASC
            """
        ),
        {"q": str(query_vec), "doc": doc.id},
    ).all()

    assert len(rows) == 3
    top_content, top_distance = rows[0][0], rows[0][1]
    assert "Cálculo" in top_content, (
        f"Esperava chunk de cálculo no topo, veio: {top_content!r}"
    )
    # Sanidade: top é estritamente mais próximo que o último.
    assert top_distance < rows[-1][1]


def test_embedding_service_batches_more_than_100(db, openai_client):
    """Batch size padrão é 100 — service deve fatiar e concatenar resultados."""
    service = EmbeddingService(openai_client, batch_size=100)
    texts = [f"frase número {i} sobre cálculo" for i in range(105)]

    vectors = service.get_embeddings(texts)

    assert len(vectors) == 105
    assert all(len(v) == 1536 for v in vectors)
