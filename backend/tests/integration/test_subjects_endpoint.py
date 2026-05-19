"""Integração dos endpoints de Subjects contra TestClient.

Cobre o contrato exato consumido pelo frontend (`handlers.ts` MSW):
* GET/POST `/api/subjects`        — lista + criação (409 em duplicate)
* GET/PATCH/DELETE `/api/subjects/{id}` — leitura, edição, remoção
* 401 sem token, 404 para id inexistente / matéria de outro user.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.security import create_access_token, get_password_hash
from app.models.user import User


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def test_list_requires_auth(client):
    assert client.get("/api/subjects").status_code == 401


def test_create_requires_auth(client):
    response = client.post(
        "/api/subjects", json={"name": "Cálculo I"}
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# CRUD feliz
# ---------------------------------------------------------------------------
def test_create_and_list(client, auth_headers):
    response = client.post(
        "/api/subjects",
        json={
            "name": "Cálculo I",
            "color": "#a855f7",
            "description": "Limites e derivadas",
            "weekly_goal_minutes": 600,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Cálculo I"
    assert body["color"] == "#a855f7"
    assert body["weekly_goal_minutes"] == 600
    assert "is_active" not in body  # campo reservado, não exposto

    listed = client.get("/api/subjects", headers=auth_headers).json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_create_uses_default_color_when_omitted(client, auth_headers):
    body = client.post(
        "/api/subjects",
        json={"name": "Algoritmos"},
        headers=auth_headers,
    ).json()
    assert body["color"] == "#534AB7"
    assert body["weekly_goal_minutes"] == 0


def test_get_returns_created_subject(client, auth_headers):
    created = client.post(
        "/api/subjects", json={"name": "x"}, headers=auth_headers
    ).json()
    fetched = client.get(
        f"/api/subjects/{created['id']}", headers=auth_headers
    ).json()
    assert fetched["id"] == created["id"]


def test_patch_partial_update(client, auth_headers):
    created = client.post(
        "/api/subjects",
        json={"name": "Banco de Dados", "weekly_goal_minutes": 100},
        headers=auth_headers,
    ).json()

    updated = client.patch(
        f"/api/subjects/{created['id']}",
        json={"weekly_goal_minutes": 360},
        headers=auth_headers,
    ).json()
    assert updated["name"] == "Banco de Dados"  # não mudou
    assert updated["weekly_goal_minutes"] == 360


def test_delete_returns_204_and_removes(client, auth_headers):
    created = client.post(
        "/api/subjects", json={"name": "Estatística"}, headers=auth_headers
    ).json()

    delete_resp = client.delete(
        f"/api/subjects/{created['id']}", headers=auth_headers
    )
    assert delete_resp.status_code == 204
    assert delete_resp.content == b""

    # GET deve retornar 404
    assert (
        client.get(f"/api/subjects/{created['id']}", headers=auth_headers).status_code
        == 404
    )


# ---------------------------------------------------------------------------
# Validações de input (422 do Pydantic)
# ---------------------------------------------------------------------------
def test_create_rejects_empty_name(client, auth_headers):
    response = client.post(
        "/api/subjects", json={"name": ""}, headers=auth_headers
    )
    assert response.status_code == 422


def test_create_rejects_invalid_color(client, auth_headers):
    response = client.post(
        "/api/subjects",
        json={"name": "x", "color": "vermelho"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_rejects_negative_weekly_goal(client, auth_headers):
    response = client.post(
        "/api/subjects",
        json={"name": "x", "weekly_goal_minutes": -10},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Conflitos e ownership
# ---------------------------------------------------------------------------
def test_create_returns_409_on_duplicate_name(client, auth_headers):
    client.post("/api/subjects", json={"name": "X"}, headers=auth_headers)
    second = client.post(
        "/api/subjects", json={"name": "X"}, headers=auth_headers
    )
    assert second.status_code == 409
    assert "Já existe" in second.json()["detail"]


def test_patch_to_existing_name_returns_409(client, auth_headers):
    client.post("/api/subjects", json={"name": "A"}, headers=auth_headers)
    b = client.post(
        "/api/subjects", json={"name": "B"}, headers=auth_headers
    ).json()

    response = client.patch(
        f"/api/subjects/{b['id']}", json={"name": "A"}, headers=auth_headers
    )
    assert response.status_code == 409


def test_get_nonexistent_returns_404(client, auth_headers):
    response = client.get(f"/api/subjects/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_cannot_access_subject_from_another_user(client, auth_headers, db):
    """Subject de outro usuário retorna 404 (não 403 — não vaza existência)."""
    # Cria outro usuário com sua própria matéria
    other = User(
        name="Outro",
        email="outro@tempus.dev",
        password_hash=get_password_hash("123"),
    )
    db.add(other)
    db.commit()
    db.refresh(other)
    from app.models.subject import Subject

    foreign = Subject(user_id=other.id, name="Privada", color="#000000")
    db.add(foreign)
    db.commit()
    db.refresh(foreign)
    other_token = create_access_token(subject=other.id)

    # Usuário atual (auth_headers) não vê a matéria do `other`
    assert (
        client.get(f"/api/subjects/{foreign.id}", headers=auth_headers).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/subjects/{foreign.id}",
            json={"name": "tentativa"},
            headers=auth_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/subjects/{foreign.id}", headers=auth_headers).status_code
        == 404
    )

    # Mas o dono enxerga
    assert (
        client.get(
            f"/api/subjects/{foreign.id}",
            headers={"Authorization": f"Bearer {other_token}"},
        ).status_code
        == 200
    )


# ---------------------------------------------------------------------------
# Integração com Quiz: matéria criada aqui pode ser usada no /quizzes/generate
# ---------------------------------------------------------------------------
def test_subject_usable_as_quiz_subject_id(client, auth_headers, fake_openai):
    import json

    subject = client.post(
        "/api/subjects",
        json={"name": "Cálculo I", "weekly_goal_minutes": 600},
        headers=auth_headers,
    ).json()

    fake_openai.chat_responses.append(
        {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "questions": [
                                    {
                                        "question_text": "?",
                                        "option_a": "a",
                                        "option_b": "b",
                                        "option_c": "c",
                                        "option_d": "d",
                                        "correct_answer": "a",
                                        "explanation": "...",
                                    }
                                ]
                            }
                        )
                    }
                }
            ]
        }
    )

    response = client.post(
        "/api/quizzes/generate",
        json={
            "subject_id": subject["id"],
            "source_type": "general_topic",
            "topic_description": "Derivadas",
            "total_questions": 1,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["subject_id"] == subject["id"]
