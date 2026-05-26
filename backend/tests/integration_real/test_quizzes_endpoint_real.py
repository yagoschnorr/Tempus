"""Ponta-a-ponta: HTTP → quiz_service → OpenAI real → Postgres+pgvector.

Diferente de `tests/integration/test_quizzes_endpoint.py`, aqui tudo é real
exceto a OpenAI (que vem por VCR cassette). O objetivo é detectar regressões
de contrato com o banco real: tipos `UUID`, `CHECK`s, `UNIQUE`s, defaults de
servidor, enums nativos do PG, etc.
"""
from __future__ import annotations

import pytest

from app.models.subject import Subject


pytestmark = [pytest.mark.integration_real, pytest.mark.vcr]


@pytest.fixture
def subject(db, test_user):
    s = Subject(user_id=test_user.id, name="Cálculo I", weekly_goal_minutes=600)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def test_generate_quiz_persists_questions_in_postgres(
    client, auth_headers, subject
):
    response = client.post(
        "/api/quizzes/generate",
        json={
            "subject_id": str(subject.id),
            "source_type": "general_topic",
            "topic_description": "Integral definida e Teorema Fundamental do Cálculo",
            "total_questions": 2,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    quiz = response.json()

    assert quiz["status"] == "pending"
    assert quiz["total_questions"] == 2
    assert len(quiz["questions"]) == 2

    # Garante que cada pergunta foi indexada 0..N-1 (UNIQUE quiz_id+question_index)
    indexes = sorted(q["question_index"] for q in quiz["questions"])
    assert indexes == [0, 1]

    # E que sobrevive a um GET (de novo, contra Postgres real)
    fetched = client.get(f"/api/quizzes/{quiz['id']}", headers=auth_headers).json()
    assert fetched["id"] == quiz["id"]
    assert len(fetched["questions"]) == 2
