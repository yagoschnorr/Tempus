"""Integração dos endpoints de Quiz contra TestClient (FastAPI + SQLite).

Cobre o contrato exato consumido pelo frontend (`handlers.ts` do MSW):
* generate → start → answer (correto/errado) → complete (score calculado)
* erros: 401 sem token, 422 input inválido, 400 transição inválida, 404 owner errado.
"""
from __future__ import annotations

import json
from uuid import uuid4

import pytest

from app.models.subject import Subject


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _question_payload(correct: str = "a") -> dict:
    return {
        "question_text": "Qual é a derivada de x²?",
        "option_a": "2x",
        "option_b": "x",
        "option_c": "x²",
        "option_d": "0",
        "correct_answer": correct,
        "explanation": "Pela regra do expoente.",
    }


def _scripted_chat_response(n: int, correct: str = "a") -> dict:
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {"questions": [_question_payload(correct) for _ in range(n)]}
                    )
                }
            }
        ]
    }


@pytest.fixture
def subject(db, test_user):
    s = Subject(user_id=test_user.id, name="Cálculo I", weekly_goal_minutes=600)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# Fluxo feliz completo
# ---------------------------------------------------------------------------
def test_full_quiz_flow_calculates_score(client, auth_headers, fake_openai, subject):
    fake_openai.chat_responses.append(_scripted_chat_response(3, correct="a"))

    # 1. Gerar
    response = client.post(
        "/api/quizzes/generate",
        json={
            "subject_id": str(subject.id),
            "source_type": "general_topic",
            "topic_description": "Derivadas",
            "total_questions": 3,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    quiz = response.json()
    assert quiz["status"] == "pending"
    assert quiz["total_questions"] == 3
    assert len(quiz["questions"]) == 3
    quiz_id = quiz["id"]
    questions = quiz["questions"]

    # 2. Listar — deve conter o quiz
    response = client.get("/api/quizzes", headers=auth_headers)
    assert response.status_code == 200
    assert any(q["id"] == quiz_id for q in response.json())

    # 3. Get detalhado — questions embedded
    response = client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["questions"]) == 3

    # 4. Start
    response = client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    # 5. Responder 3x: 2 corretas e 1 errada. Como o quiz_generator embaralha as
    # alternativas, a letra correta varia por pergunta — escolhemos dinamicamente.
    intent = [True, False, True]
    answers_correctness = []
    for idx, should_hit in enumerate(intent):
        question = questions[idx]
        correct_letter = question["correct_answer"]
        wrong_letter = next(opt for opt in ("a", "b", "c", "d") if opt != correct_letter)
        picked = correct_letter if should_hit else wrong_letter

        response = client.post(
            f"/api/quizzes/{quiz_id}/questions/{question['id']}/answer",
            json={"user_answer": picked},
            headers=auth_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["correct_answer"] == correct_letter
        assert body["explanation"] == "Pela regra do expoente."
        answers_correctness.append(body["is_correct"])
    assert answers_correctness == intent

    # 6. Complete — score = 2/3 ≈ 67
    response = client.post(f"/api/quizzes/{quiz_id}/complete", headers=auth_headers)
    assert response.status_code == 200
    final = response.json()
    assert final["status"] == "completed"
    assert final["score"] == 67
    assert final["completed_at"] is not None


# ---------------------------------------------------------------------------
# Auth + validação de input
# ---------------------------------------------------------------------------
def test_generate_requires_auth(client):
    response = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "x",
            "total_questions": 1,
        },
    )
    assert response.status_code == 401


def test_generate_rejects_general_topic_without_description(client, auth_headers, fake_openai):
    response = client.post(
        "/api/quizzes/generate",
        json={"source_type": "general_topic", "total_questions": 3},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "topic_description" in response.text
    assert fake_openai.calls == []  # nem chega a chamar a IA


def test_generate_documents_returns_501(client, auth_headers, fake_openai):
    response = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "documents",
            "document_ids": [str(uuid4())],
            "total_questions": 3,
        },
        headers=auth_headers,
    )
    assert response.status_code == 501
    assert "Sprint 3" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Máquina de estados
# ---------------------------------------------------------------------------
def test_start_rejects_already_started_quiz(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]

    assert client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers).status_code == 200
    second = client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)
    assert second.status_code == 400
    assert "in_progress" in second.json()["detail"]


def test_answer_requires_in_progress(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    qid = gen["questions"][0]["id"]

    response = client.post(
        f"/api/quizzes/{gen['id']}/questions/{qid}/answer",
        json={"user_answer": "a"},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_answer_same_question_twice_returns_400(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    qid = gen["questions"][0]["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)

    first = client.post(
        f"/api/quizzes/{quiz_id}/questions/{qid}/answer",
        json={"user_answer": "a"},
        headers=auth_headers,
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/quizzes/{quiz_id}/questions/{qid}/answer",
        json={"user_answer": "b"},
        headers=auth_headers,
    )
    assert second.status_code == 400
    assert "já foi respondida" in second.json()["detail"]


def test_get_quiz_not_found(client, auth_headers):
    response = client.get(f"/api/quizzes/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_generate_rejects_subject_of_another_user(client, auth_headers, fake_openai):
    response = client.post(
        "/api/quizzes/generate",
        json={
            "subject_id": str(uuid4()),  # subject inexistente / de outro user
            "source_type": "general_topic",
            "topic_description": "x",
            "total_questions": 1,
        },
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "Matéria" in response.json()["detail"]
    assert fake_openai.calls == []


# ---------------------------------------------------------------------------
# Falhas adicionais (cobertura)
# ---------------------------------------------------------------------------
def test_generate_returns_502_when_ai_fails_after_retry(client, auth_headers, fake_openai):
    # 2 tentativas, ambas com JSON inválido → QuizGenerationError → 502
    fake_openai.chat_responses.append(
        {"choices": [{"message": {"content": "not-json-1"}}]}
    )
    fake_openai.chat_responses.append(
        {"choices": [{"message": {"content": "not-json-2"}}]}
    )

    response = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 2,
        },
        headers=auth_headers,
    )
    assert response.status_code == 502
    assert "Falha ao gerar quiz" in response.json()["detail"]
    assert len(fake_openai.calls) == 2  # retry esgotado


def test_answer_question_not_in_quiz_returns_404(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)

    response = client.post(
        f"/api/quizzes/{quiz_id}/questions/{uuid4()}/answer",
        json={"user_answer": "a"},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "Pergunta" in response.json()["detail"]


def test_complete_rejects_pending_quiz(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()

    response = client.post(f"/api/quizzes/{gen['id']}/complete", headers=auth_headers)
    assert response.status_code == 400
    assert "in_progress" in response.json()["detail"]


def test_complete_twice_returns_400(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)
    assert client.post(f"/api/quizzes/{quiz_id}/complete", headers=auth_headers).status_code == 200

    second = client.post(f"/api/quizzes/{quiz_id}/complete", headers=auth_headers)
    assert second.status_code == 400


# ---------------------------------------------------------------------------
# Restart — zera respostas e volta a in_progress
# ---------------------------------------------------------------------------
def _play_through(client, auth_headers, gen: dict, intent: list[bool]) -> None:
    """Inicia, responde todas as N perguntas com o gabarito de `intent` e conclui."""
    quiz_id = gen["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)
    for idx, should_hit in enumerate(intent):
        question = gen["questions"][idx]
        correct_letter = question["correct_answer"]
        wrong_letter = next(opt for opt in ("a", "b", "c", "d") if opt != correct_letter)
        picked = correct_letter if should_hit else wrong_letter
        client.post(
            f"/api/quizzes/{quiz_id}/questions/{question['id']}/answer",
            json={"user_answer": picked},
            headers=auth_headers,
        )
    client.post(f"/api/quizzes/{quiz_id}/complete", headers=auth_headers)


def test_restart_completed_quiz_resets_state_and_answers(
    client, auth_headers, fake_openai
):
    fake_openai.chat_responses.append(_scripted_chat_response(2))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 2,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    _play_through(client, auth_headers, gen, intent=[True, False])
    completed = client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers).json()
    assert completed["status"] == "completed"
    assert completed["score"] == 50

    # Restart
    response = client.post(f"/api/quizzes/{quiz_id}/restart", headers=auth_headers)
    assert response.status_code == 200, response.text
    restarted = response.json()
    assert restarted["status"] == "in_progress"
    assert restarted["score"] is None
    assert restarted["completed_at"] is None
    # Mantém as mesmas perguntas embedded para o frontend não precisar de outro fetch
    assert len(restarted["questions"]) == 2
    assert {q["id"] for q in restarted["questions"]} == {
        q["id"] for q in gen["questions"]
    }

    # As respostas anteriores foram apagadas, então a primeira pergunta pode ser
    # respondida de novo sem disparar o 400 de "já foi respondida".
    first_qid = gen["questions"][0]["id"]
    answer = client.post(
        f"/api/quizzes/{quiz_id}/questions/{first_qid}/answer",
        json={"user_answer": "a"},
        headers=auth_headers,
    )
    assert answer.status_code == 200


def test_restart_in_progress_quiz_clears_partial_answers(
    client, auth_headers, fake_openai
):
    fake_openai.chat_responses.append(_scripted_chat_response(2))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 2,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)

    first_qid = gen["questions"][0]["id"]
    client.post(
        f"/api/quizzes/{quiz_id}/questions/{first_qid}/answer",
        json={"user_answer": "a"},
        headers=auth_headers,
    )

    response = client.post(f"/api/quizzes/{quiz_id}/restart", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    # Responde a mesma pergunta de novo — deve ser permitido após o restart.
    again = client.post(
        f"/api/quizzes/{quiz_id}/questions/{first_qid}/answer",
        json={"user_answer": "b"},
        headers=auth_headers,
    )
    assert again.status_code == 200


def test_restart_quiz_not_found(client, auth_headers):
    response = client.post(f"/api/quizzes/{uuid4()}/restart", headers=auth_headers)
    assert response.status_code == 404


def test_restart_requires_auth(client):
    response = client.post(f"/api/quizzes/{uuid4()}/restart")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Delete — quiz some da lista e leva perguntas/respostas por CASCADE
# ---------------------------------------------------------------------------
def test_delete_completed_quiz_removes_from_list(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    _play_through(client, auth_headers, gen, intent=[True])

    response = client.delete(f"/api/quizzes/{quiz_id}", headers=auth_headers)
    assert response.status_code == 204
    assert response.content == b""

    listing = client.get("/api/quizzes", headers=auth_headers).json()
    assert all(q["id"] != quiz_id for q in listing)
    assert client.get(f"/api/quizzes/{quiz_id}", headers=auth_headers).status_code == 404


def test_delete_in_progress_quiz_allowed(client, auth_headers, fake_openai):
    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    client.post(f"/api/quizzes/{quiz_id}/start", headers=auth_headers)

    response = client.delete(f"/api/quizzes/{quiz_id}", headers=auth_headers)
    assert response.status_code == 204


def test_delete_cascades_questions_and_answers(
    client, auth_headers, fake_openai, db
):
    from app.models.quiz import QuizAnswer, QuizQuestion

    fake_openai.chat_responses.append(_scripted_chat_response(1))
    gen = client.post(
        "/api/quizzes/generate",
        json={
            "source_type": "general_topic",
            "topic_description": "Limites",
            "total_questions": 1,
        },
        headers=auth_headers,
    ).json()
    quiz_id = gen["id"]
    _play_through(client, auth_headers, gen, intent=[True])

    # Antes do delete: 1 pergunta + 1 resposta persistidas
    assert db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).count() == 1
    q_ids = [q.id for q in db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id)]
    assert db.query(QuizAnswer).filter(QuizAnswer.quiz_question_id.in_(q_ids)).count() == 1

    assert client.delete(f"/api/quizzes/{quiz_id}", headers=auth_headers).status_code == 204

    # Cascade levou perguntas e respostas embora
    assert db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).count() == 0
    assert db.query(QuizAnswer).filter(QuizAnswer.quiz_question_id.in_(q_ids)).count() == 0


def test_delete_quiz_not_found(client, auth_headers):
    response = client.delete(f"/api/quizzes/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_delete_requires_auth(client):
    response = client.delete(f"/api/quizzes/{uuid4()}")
    assert response.status_code == 401
