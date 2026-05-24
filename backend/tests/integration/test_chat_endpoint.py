"""Integração dos endpoints de Chat contra TestClient (FastAPI + SQLite).

Cobre o contrato consumido pelo frontend:
* POST /chat/ask                           → cria sessão + responde
* POST /chat/sessions/{id}/ask             → anexa em sessão existente
* GET  /chat/sessions[?subject_id=]        → listagem da sidebar
* GET  /chat/sessions/{id}                 → detalhe com mensagens e fontes
* PATCH/DELETE /chat/sessions/{id}         → manutenção
* Erros: 401 sem token, 422 sem subject_id, 404 cross-tenant, 404 sessão inexistente
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.subject import Subject


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _scripted_chat(text: str) -> dict:
    return {"choices": [{"message": {"content": text}}]}


@pytest.fixture
def subject(db, test_user):
    s = Subject(user_id=test_user.id, name="Cálculo II", weekly_goal_minutes=300)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def other_user_subject(db):
    """Matéria pertencente a OUTRO usuário — para testar isolamento."""
    from app.core.security import get_password_hash
    from app.models.user import User

    intruder = User(
        id=uuid4(),
        name="Outro",
        email=f"outro-{uuid4().hex[:6]}@tempus.dev",
        password_hash=get_password_hash("senha"),
    )
    db.add(intruder)
    db.commit()
    s = Subject(user_id=intruder.id, name="Não te interessa")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# POST /chat/ask  (criação implícita de sessão)
# ---------------------------------------------------------------------------
def test_ask_new_requires_auth(client):
    r = client.post("/api/chat/ask", json={"question": "oi"})
    assert r.status_code == 401


def test_ask_new_requires_subject_id(client, auth_headers, fake_openai):
    r = client.post(
        "/api/chat/ask", json={"question": "oi"}, headers=auth_headers
    )
    assert r.status_code == 422
    assert "subject_id" in r.text


def test_ask_new_rejects_subject_from_other_user(
    client, auth_headers, fake_openai, other_user_subject
):
    r = client.post(
        "/api/chat/ask",
        json={
            "subject_id": str(other_user_subject.id),
            "question": "vai dar certo?",
        },
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_ask_new_creates_session_and_returns_assistant_message(
    client, auth_headers, fake_openai, subject
):
    fake_openai.chat_responses.append(
        _scripted_chat("O Jacobiano corrige a distorção de volume.")
    )

    payload = {
        "subject_id": str(subject.id),
        "question": "Por que o Jacobiano aparece em mudança de variáveis em integrais triplas?",
    }
    r = client.post("/api/chat/ask", json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text

    body = r.json()
    assert body["message"]["role"] == "assistant"
    assert body["message"]["content"] == "O Jacobiano corrige a distorção de volume."
    assert body["message"]["sources"] == []  # sem chunks ainda

    # Sessão aparece na listagem com título truncado da pergunta.
    sessions = client.get("/api/chat/sessions", headers=auth_headers).json()
    assert len(sessions) == 1
    assert sessions[0]["id"] == body["session_id"]
    assert sessions[0]["subject_id"] == str(subject.id)
    assert sessions[0]["title"].startswith("Por que o Jacobiano")


def test_ask_new_title_truncates_long_question(
    client, auth_headers, fake_openai, subject
):
    fake_openai.chat_responses.append(_scripted_chat("resposta"))
    long_q = "Pergunta muito longa " * 20  # 420 chars
    client.post(
        "/api/chat/ask",
        json={"subject_id": str(subject.id), "question": long_q},
        headers=auth_headers,
    )
    sessions = client.get("/api/chat/sessions", headers=auth_headers).json()
    assert sessions[0]["title"].endswith("…")
    assert len(sessions[0]["title"]) <= 60


# ---------------------------------------------------------------------------
# POST /chat/sessions/{id}/ask  (sessão existente)
# ---------------------------------------------------------------------------
def test_ask_in_session_appends_assistant_message(
    client, auth_headers, fake_openai, subject
):
    # primeira pergunta cria a sessão
    fake_openai.chat_responses.append(_scripted_chat("primeira resposta"))
    r1 = client.post(
        "/api/chat/ask",
        json={"subject_id": str(subject.id), "question": "primeira?"},
        headers=auth_headers,
    )
    session_id = r1.json()["session_id"]

    # segunda pergunta na mesma sessão
    fake_openai.chat_responses.append(_scripted_chat("segunda resposta"))
    r2 = client.post(
        f"/api/chat/sessions/{session_id}/ask",
        json={"question": "segunda?"},
        headers=auth_headers,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["message"]["content"] == "segunda resposta"

    # GET /sessions/{id} retorna 4 mensagens em ordem
    detail = client.get(
        f"/api/chat/sessions/{session_id}", headers=auth_headers
    ).json()
    assert [m["role"] for m in detail["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    assert detail["messages"][0]["content"] == "primeira?"
    assert detail["messages"][3]["content"] == "segunda resposta"


def test_ask_in_nonexistent_session_returns_404(
    client, auth_headers, fake_openai
):
    r = client.post(
        f"/api/chat/sessions/{uuid4()}/ask",
        json={"question": "oi"},
        headers=auth_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /chat/sessions
# ---------------------------------------------------------------------------
def test_list_sessions_filters_by_subject(
    client, auth_headers, fake_openai, subject, db, test_user
):
    other = Subject(user_id=test_user.id, name="POO")
    db.add(other)
    db.commit()
    db.refresh(other)

    # 2 sessões: 1 em cada matéria
    fake_openai.chat_responses.extend(
        [_scripted_chat("a"), _scripted_chat("b")]
    )
    client.post(
        "/api/chat/ask",
        json={"subject_id": str(subject.id), "question": "calc"},
        headers=auth_headers,
    )
    client.post(
        "/api/chat/ask",
        json={"subject_id": str(other.id), "question": "poo"},
        headers=auth_headers,
    )

    todas = client.get("/api/chat/sessions", headers=auth_headers).json()
    assert len(todas) == 2

    filtradas = client.get(
        f"/api/chat/sessions?subject_id={subject.id}", headers=auth_headers
    ).json()
    assert len(filtradas) == 1
    assert filtradas[0]["subject_id"] == str(subject.id)


# ---------------------------------------------------------------------------
# PATCH /chat/sessions/{id}
# ---------------------------------------------------------------------------
def test_rename_session_updates_title(
    client, auth_headers, fake_openai, subject
):
    fake_openai.chat_responses.append(_scripted_chat("resp"))
    r = client.post(
        "/api/chat/ask",
        json={"subject_id": str(subject.id), "question": "q"},
        headers=auth_headers,
    )
    session_id = r.json()["session_id"]

    r2 = client.patch(
        f"/api/chat/sessions/{session_id}",
        json={"title": "Renomeada manualmente"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["title"] == "Renomeada manualmente"


# ---------------------------------------------------------------------------
# DELETE /chat/sessions/{id}
# ---------------------------------------------------------------------------
def test_delete_session_removes_it_and_cascades(
    client, auth_headers, fake_openai, subject
):
    fake_openai.chat_responses.append(_scripted_chat("resp"))
    r = client.post(
        "/api/chat/ask",
        json={"subject_id": str(subject.id), "question": "q"},
        headers=auth_headers,
    )
    session_id = r.json()["session_id"]

    r2 = client.delete(
        f"/api/chat/sessions/{session_id}", headers=auth_headers
    )
    assert r2.status_code == 204

    r3 = client.get(f"/api/chat/sessions/{session_id}", headers=auth_headers)
    assert r3.status_code == 404

    sessions = client.get("/api/chat/sessions", headers=auth_headers).json()
    assert sessions == []
