"""Testes unitários do email_service — dispatch entre console e resend."""
from __future__ import annotations

import logging

import pytest

from app.services import email_service
from app.services.email_service import EmailDeliveryError, send_email


# ---------------------------------------------------------------------------
# Console provider
# ---------------------------------------------------------------------------
def test_console_provider_logs_email_content(monkeypatch, caplog):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "console")

    with caplog.at_level(logging.INFO, logger="tempus.email"):
        send_email(
            to="dest@tempus.dev",
            subject="Assunto",
            html="<p>oi</p>",
            text="oi",
        )

    msgs = " ".join(r.getMessage() for r in caplog.records)
    assert "dest@tempus.dev" in msgs
    assert "Assunto" in msgs
    assert "<p>oi</p>" in msgs
    assert "text body" in msgs


def test_console_provider_works_without_text_body(monkeypatch, caplog):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "console")

    with caplog.at_level(logging.INFO, logger="tempus.email"):
        send_email(to="x@y.com", subject="s", html="<p>h</p>")

    msgs = " ".join(r.getMessage() for r in caplog.records)
    assert "text body" not in msgs
    assert "<p>h</p>" in msgs


# ---------------------------------------------------------------------------
# Resend provider
# ---------------------------------------------------------------------------
def test_resend_provider_calls_sdk_with_correct_params(monkeypatch):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(email_service.settings, "EMAIL_FROM", "Tempus <from@x>")

    captured: dict = {}

    def fake_send(params):
        captured.update(params)
        return {"id": "fake-id-123"}

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send)

    send_email(
        to="dest@tempus.dev",
        subject="Confirme seu email",
        html="<a>link</a>",
        text="link",
    )

    assert captured["from"] == "Tempus <from@x>"
    assert captured["to"] == ["dest@tempus.dev"]
    assert captured["subject"] == "Confirme seu email"
    assert captured["html"] == "<a>link</a>"
    assert captured["text"] == "link"
    assert email_service.resend.api_key == "test-key"


def test_resend_provider_omits_text_when_not_given(monkeypatch):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "test-key")

    captured: dict = {}

    def fake_send(params):
        captured.update(params)
        return {"id": "x"}

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send)

    send_email(to="x@y.com", subject="s", html="<p>h</p>")
    assert "text" not in captured


def test_resend_without_api_key_raises(monkeypatch):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", None)

    with pytest.raises(EmailDeliveryError, match="RESEND_API_KEY"):
        send_email(to="x@y.com", subject="s", html="<p>h</p>")


def test_resend_sdk_exception_wraps_into_delivery_error(monkeypatch):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "test-key")

    def fake_send_raise(_params):
        raise RuntimeError("boom da rede")

    monkeypatch.setattr(email_service.resend.Emails, "send", fake_send_raise)

    with pytest.raises(EmailDeliveryError, match="boom da rede"):
        send_email(to="x@y.com", subject="s", html="<p>h</p>")


# ---------------------------------------------------------------------------
# Provedor desconhecido
# ---------------------------------------------------------------------------
def test_unknown_provider_raises(monkeypatch):
    monkeypatch.setattr(email_service.settings, "EMAIL_PROVIDER", "carrier-pigeon")

    with pytest.raises(EmailDeliveryError, match="Provedor de email desconhecido"):
        send_email(to="x@y.com", subject="s", html="<p>h</p>")
