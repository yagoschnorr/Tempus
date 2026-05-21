"""Testes de integração dos endpoints de Auth.

Cobre o contrato consumido pelo `ProfileModal` no frontend:
* PATCH  /api/auth/me                       — atualização de nome/timezone.
* PATCH  /api/auth/me/password              — troca de senha.
* DELETE /api/auth/me                       — exclusão da conta.
* POST   /api/auth/me/email/change-request  — pedido de troca de email.
* POST   /api/auth/email/confirm            — confirmação da troca via token.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest

from app.core.security import (
    create_access_token,
    generate_verification_token,
    get_password_hash,
    hash_verification_token,
    verify_password,
)
from app.models.email_change_request import EmailChangeRequest
from app.models.notebook import Notebook
from app.models.subject import Subject
from app.models.user import User


@pytest.fixture
def captured_emails(monkeypatch):
    """Intercepta `email_service.send_email` e devolve a lista de chamadas."""
    captured: list[dict] = []

    def fake_send(*, to, subject, html, text=None):
        captured.append({"to": to, "subject": subject, "html": html, "text": text})

    monkeypatch.setattr("app.services.email_service.send_email", fake_send)
    return captured


def _extract_token(email_text: str) -> str:
    """Extrai o token cru da query string do link no email."""
    for line in email_text.splitlines():
        if "/auth/email/confirm" in line:
            qs = parse_qs(urlparse(line.strip()).query)
            return qs["token"][0]
    raise AssertionError(f"Link de confirmação não encontrado no email:\n{email_text}")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def test_patch_me_requires_auth(client):
    assert client.patch("/api/auth/me", json={"name": "Novo"}).status_code == 401


# ---------------------------------------------------------------------------
# Atualização parcial
# ---------------------------------------------------------------------------
def test_patch_me_updates_name_only(client, auth_headers, test_user):
    response = client.patch(
        "/api/auth/me", json={"name": "Yago Atualizado"}, headers=auth_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Yago Atualizado"
    assert body["email"] == test_user.email
    assert body["timezone"] == "America/Belem"  # default não mudou


def test_patch_me_updates_timezone_only(client, auth_headers, test_user):
    response = client.patch(
        "/api/auth/me",
        json={"timezone": "Europe/Lisbon"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["timezone"] == "Europe/Lisbon"
    assert body["name"] == test_user.name  # não mudou


def test_patch_me_updates_both(client, auth_headers):
    response = client.patch(
        "/api/auth/me",
        json={"name": "Novo Nome", "timezone": "America/Sao_Paulo"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Novo Nome"
    assert body["timezone"] == "America/Sao_Paulo"


def test_patch_me_empty_body_is_noop(client, auth_headers, test_user):
    response = client.patch("/api/auth/me", json={}, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == test_user.name
    assert body["timezone"] == "America/Belem"


def test_patch_me_strips_name_whitespace(client, auth_headers):
    response = client.patch(
        "/api/auth/me",
        json={"name": "   Espaços Soltos   "},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Espaços Soltos"


# ---------------------------------------------------------------------------
# Validações (422 do Pydantic)
# ---------------------------------------------------------------------------
def test_patch_me_rejects_blank_name(client, auth_headers):
    response = client.patch(
        "/api/auth/me", json={"name": "   "}, headers=auth_headers
    )
    assert response.status_code == 422


def test_patch_me_rejects_unknown_timezone(client, auth_headers):
    response = client.patch(
        "/api/auth/me",
        json={"timezone": "America/Atlantis"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_patch_me_rejects_name_over_max_length(client, auth_headers):
    response = client.patch(
        "/api/auth/me", json={"name": "x" * 121}, headers=auth_headers
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Persistência: GET subsequente reflete a alteração
# ---------------------------------------------------------------------------
def test_patch_me_persists_for_subsequent_get(client, auth_headers):
    client.patch(
        "/api/auth/me",
        json={"name": "Persistente", "timezone": "UTC"},
        headers=auth_headers,
    )

    fetched = client.get("/api/auth/me", headers=auth_headers).json()
    assert fetched["name"] == "Persistente"
    assert fetched["timezone"] == "UTC"


# ---------------------------------------------------------------------------
# PATCH /api/auth/me/password
# ---------------------------------------------------------------------------
def test_change_password_requires_auth(client):
    response = client.patch(
        "/api/auth/me/password",
        json={"current_password": "senha-de-teste", "new_password": "nova-senha-123"},
    )
    assert response.status_code == 401


def test_change_password_success_returns_204(client, auth_headers, test_user, db):
    response = client.patch(
        "/api/auth/me/password",
        json={
            "current_password": "senha-de-teste",
            "new_password": "nova-senha-forte",
        },
        headers=auth_headers,
    )
    assert response.status_code == 204
    assert response.content == b""

    # Hash no banco foi atualizado e bate com a nova senha
    db.refresh(test_user)
    assert verify_password("nova-senha-forte", test_user.password_hash)
    assert not verify_password("senha-de-teste", test_user.password_hash)


def test_change_password_login_works_with_new_credentials(client, auth_headers, test_user):
    client.patch(
        "/api/auth/me/password",
        json={
            "current_password": "senha-de-teste",
            "new_password": "outra-senha-123",
        },
        headers=auth_headers,
    )

    # Login com senha nova → sucesso
    ok = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "outra-senha-123"},
    )
    assert ok.status_code == 200

    # Login com senha antiga → 401
    fail = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": "senha-de-teste"},
    )
    assert fail.status_code == 401


def test_change_password_wrong_current_returns_401(client, auth_headers, test_user, db):
    response = client.patch(
        "/api/auth/me/password",
        json={
            "current_password": "senha-errada",
            "new_password": "outra-senha-123",
        },
        headers=auth_headers,
    )
    assert response.status_code == 401

    # Hash continua o mesmo (senha não foi trocada)
    db.refresh(test_user)
    assert verify_password("senha-de-teste", test_user.password_hash)


def test_change_password_same_as_current_returns_400(client, auth_headers):
    response = client.patch(
        "/api/auth/me/password",
        json={
            "current_password": "senha-de-teste",
            "new_password": "senha-de-teste",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_change_password_too_short_returns_422(client, auth_headers):
    response = client.patch(
        "/api/auth/me/password",
        json={"current_password": "senha-de-teste", "new_password": "abc"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_change_password_missing_fields_returns_422(client, auth_headers):
    assert (
        client.patch(
            "/api/auth/me/password",
            json={"current_password": "senha-de-teste"},
            headers=auth_headers,
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/auth/me/password",
            json={"new_password": "nova-senha-123"},
            headers=auth_headers,
        ).status_code
        == 422
    )


# ---------------------------------------------------------------------------
# DELETE /api/auth/me
# ---------------------------------------------------------------------------
def test_delete_account_requires_auth(client):
    response = client.request(
        "DELETE", "/api/auth/me", json={"password": "senha-de-teste"}
    )
    assert response.status_code == 401


def test_delete_account_wrong_password_returns_401(client, auth_headers, test_user, db):
    response = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "senha-errada"},
        headers=auth_headers,
    )
    assert response.status_code == 401

    # User continua no banco
    db.refresh(test_user)
    assert db.query(User).filter(User.id == test_user.id).first() is not None


def test_delete_account_missing_password_returns_422(client, auth_headers):
    response = client.request(
        "DELETE", "/api/auth/me", json={}, headers=auth_headers
    )
    assert response.status_code == 422


def test_delete_account_success_returns_204(client, auth_headers, test_user, db):
    user_id = test_user.id
    response = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 204
    assert response.content == b""

    # User sumiu do banco
    assert db.query(User).filter(User.id == user_id).first() is None


def test_delete_account_invalidates_token(client, auth_headers):
    client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "senha-de-teste"},
        headers=auth_headers,
    )
    # Mesmo token agora retorna 404 (usuário não existe mais)
    assert client.get("/api/auth/me", headers=auth_headers).status_code == 404


def test_delete_account_cascade_removes_related_data(client, auth_headers, test_user, db):
    """Garante que o ON DELETE CASCADE do schema funciona: dados em tabelas
    filhas (subjects, notebooks, etc.) somem junto com o user.
    """
    # Semeia dados ligados ao usuário
    subject = Subject(user_id=test_user.id, name="Cálculo I", color="#3b82f6")
    notebook = Notebook(user_id=test_user.id, title="Anotações de Cálculo")
    db.add_all([subject, notebook])
    db.commit()
    subject_id = subject.id
    notebook_id = notebook.id

    # Confirma que existem antes
    assert db.query(Subject).filter(Subject.id == subject_id).first() is not None
    assert db.query(Notebook).filter(Notebook.id == notebook_id).first() is not None

    # Deleta a conta
    response = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Cascade pegou tudo
    db.expire_all()
    assert db.query(Subject).filter(Subject.id == subject_id).first() is None
    assert db.query(Notebook).filter(Notebook.id == notebook_id).first() is None


def test_delete_account_does_not_affect_other_users(client, auth_headers, db):
    """Conta de outro usuário e seus dados sobrevivem."""
    other = User(
        id=uuid4(),
        name="Outro",
        email=f"outro-{uuid4().hex[:8]}@tempus.dev",
        password_hash=get_password_hash("outra-senha"),
    )
    db.add(other)
    db.commit()
    other_subject = Subject(user_id=other.id, name="Privada", color="#000000")
    db.add(other_subject)
    db.commit()
    other_subject_id = other_subject.id

    response = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Outro usuário e dados intactos
    assert db.query(User).filter(User.id == other.id).first() is not None
    assert (
        db.query(Subject).filter(Subject.id == other_subject_id).first() is not None
    )


# ---------------------------------------------------------------------------
# POST /api/auth/me/email/change-request
# ---------------------------------------------------------------------------
def test_request_email_change_requires_auth(client, captured_emails):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
    )
    assert response.status_code == 401
    assert captured_emails == []


def test_request_email_change_success_creates_record_and_sends_email(
    client, auth_headers, test_user, db, captured_emails
):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 204

    # Linha foi criada no banco
    req = (
        db.query(EmailChangeRequest)
        .filter(EmailChangeRequest.user_id == test_user.id)
        .one()
    )
    assert req.new_email == "novo@tempus.dev"
    assert req.used_at is None
    assert len(req.token_hash) == 64  # SHA-256 hex

    # Email foi disparado pro novo endereço (não pro atual)
    assert len(captured_emails) == 1
    msg = captured_emails[0]
    assert msg["to"] == "novo@tempus.dev"
    assert "Confirme" in msg["subject"]
    # Email original do user NÃO foi alterado ainda
    db.refresh(test_user)
    assert test_user.email != "novo@tempus.dev"


def test_request_email_change_normalizes_to_lowercase(
    client, auth_headers, db, captured_emails
):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "NOVO@Tempus.DEV", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 204
    req = db.query(EmailChangeRequest).one()
    assert req.new_email == "novo@tempus.dev"


def test_request_email_change_wrong_password_returns_401(
    client, auth_headers, db, captured_emails
):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "errada"},
        headers=auth_headers,
    )
    assert response.status_code == 401
    assert db.query(EmailChangeRequest).count() == 0
    assert captured_emails == []


def test_request_email_change_same_as_current_returns_400(
    client, auth_headers, test_user, captured_emails
):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": test_user.email, "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert captured_emails == []


def test_request_email_change_email_in_use_returns_409(
    client, auth_headers, db, captured_emails
):
    other = User(
        id=uuid4(),
        name="Outro",
        email="tomado@tempus.dev",
        password_hash=get_password_hash("x"),
    )
    db.add(other)
    db.commit()

    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "tomado@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert captured_emails == []


def test_request_email_change_invalid_email_returns_422(client, auth_headers):
    response = client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "nao-eh-email", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_new_request_invalidates_previous_pending(
    client, auth_headers, test_user, db, captured_emails
):
    # Primeiro pedido
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "primeiro@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    # Segundo pedido — deve invalidar o primeiro
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "segundo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )

    requests = (
        db.query(EmailChangeRequest)
        .filter(EmailChangeRequest.user_id == test_user.id)
        .order_by(EmailChangeRequest.created_at)
        .all()
    )
    assert len(requests) == 2
    assert requests[0].used_at is not None  # primeiro foi invalidado
    assert requests[1].used_at is None      # segundo ainda ativo
    assert requests[1].new_email == "segundo@tempus.dev"


# ---------------------------------------------------------------------------
# POST /api/auth/email/confirm
# ---------------------------------------------------------------------------
def test_confirm_email_change_success_updates_user_and_marks_used(
    client, auth_headers, test_user, db, captured_emails
):
    # Request → captura token do email
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    token = _extract_token(captured_emails[0]["text"])

    # Confirm é público (sem auth)
    response = client.post("/api/auth/email/confirm", json={"token": token})
    assert response.status_code == 204

    # Email do user foi atualizado e a request marcada como usada
    db.refresh(test_user)
    assert test_user.email == "novo@tempus.dev"

    req = db.query(EmailChangeRequest).one()
    assert req.used_at is not None


def test_confirm_email_change_invalid_token_returns_400(client):
    response = client.post(
        "/api/auth/email/confirm", json={"token": "token-que-nao-existe"}
    )
    assert response.status_code == 400


def test_confirm_email_change_expired_token_returns_400(
    client, auth_headers, test_user, db, captured_emails
):
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    token = _extract_token(captured_emails[0]["text"])

    # Expira manualmente
    req = db.query(EmailChangeRequest).one()
    req.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    response = client.post("/api/auth/email/confirm", json={"token": token})
    assert response.status_code == 400

    # User intacto
    db.refresh(test_user)
    assert test_user.email != "novo@tempus.dev"


def test_confirm_email_change_token_only_works_once(
    client, auth_headers, db, captured_emails
):
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    token = _extract_token(captured_emails[0]["text"])

    first = client.post("/api/auth/email/confirm", json={"token": token})
    assert first.status_code == 204

    # Segunda tentativa com o mesmo token falha
    second = client.post("/api/auth/email/confirm", json={"token": token})
    assert second.status_code == 400


def test_confirm_email_change_email_taken_in_meantime_returns_409(
    client, auth_headers, test_user, db, captured_emails
):
    """Janela entre request e confirm: outro user se cadastra com o email."""
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "novo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    token = _extract_token(captured_emails[0]["text"])

    # Outro user cria conta com o email-alvo no meio do caminho
    squatter = User(
        id=uuid4(),
        name="Squatter",
        email="novo@tempus.dev",
        password_hash=get_password_hash("x"),
    )
    db.add(squatter)
    db.commit()

    response = client.post("/api/auth/email/confirm", json={"token": token})
    assert response.status_code == 409

    # Email do user original intacto
    db.refresh(test_user)
    assert test_user.email != "novo@tempus.dev"


def test_confirm_email_change_token_invalidated_after_new_request(
    client, auth_headers, db, captured_emails
):
    """Token do primeiro pedido vira inválido depois do segundo pedido."""
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "primeiro@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )
    first_token = _extract_token(captured_emails[0]["text"])

    # Faz um segundo pedido
    client.post(
        "/api/auth/me/email/change-request",
        json={"new_email": "segundo@tempus.dev", "current_password": "senha-de-teste"},
        headers=auth_headers,
    )

    # Tenta confirmar com o token antigo → 400
    response = client.post("/api/auth/email/confirm", json={"token": first_token})
    assert response.status_code == 400


def test_confirm_email_change_missing_token_returns_422(client):
    assert client.post("/api/auth/email/confirm", json={}).status_code == 422
