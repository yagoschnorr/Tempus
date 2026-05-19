"""Smoke test do Bloco 1: prova que conftest+fixtures funcionam.

- `client` + `auth_headers` resolvem a dependência `get_current_user`.
- `fake_openai` substitui `get_openai` via dependency_overrides.
"""
from app.integrations.openai_client import get_openai
from app.main import app


def test_auth_me_with_fixture_token(client, auth_headers, test_user):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == test_user.email
    assert body["id"] == str(test_user.id)


def test_auth_me_without_token_is_unauthorized(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_fake_openai_is_injected(fake_openai):
    override = app.dependency_overrides[get_openai]()
    assert override is fake_openai


def test_fake_openai_records_calls_and_pops_responses(fake_openai):
    fake_openai.chat_responses.append({"choices": [{"message": {"content": "ok"}}]})
    result = fake_openai.chat(messages=[{"role": "user", "content": "hi"}])
    assert result == {"choices": [{"message": {"content": "ok"}}]}
    assert fake_openai.calls[0][0] == "chat"
    assert fake_openai.calls[0][1]["messages"] == [{"role": "user", "content": "hi"}]
