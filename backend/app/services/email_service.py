"""Serviço de envio de email transacional.

Interface única `send_email()` que faz dispatch baseado em `settings.EMAIL_PROVIDER`:
* `console` — não envia, só loga (default em dev/teste).
* `resend`  — usa a API do resend.com via SDK oficial.

Erros do provedor sobem como `EmailDeliveryError`. Falta de API key quando
o provedor exige é considerada erro de configuração e levanta na própria
chamada (fail-fast).
"""
from __future__ import annotations

import logging

import resend

from app.core.config import settings

logger = logging.getLogger("tempus.email")


class EmailDeliveryError(RuntimeError):
    """Falha ao entregar um email via provedor externo."""


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> None:
    """Envia um email via provedor configurado em `settings.EMAIL_PROVIDER`.

    Args:
        to: destinatário (1 endereço).
        subject: assunto.
        html: corpo HTML.
        text: corpo texto/plano opcional. Recomendado quando disponível —
            alguns clientes priorizam ou caem pra texto quando o HTML falha.
    """
    provider = settings.EMAIL_PROVIDER
    if provider == "console":
        _send_via_console(to=to, subject=subject, html=html, text=text)
    elif provider == "resend":
        _send_via_resend(to=to, subject=subject, html=html, text=text)
    else:
        raise EmailDeliveryError(f"Provedor de email desconhecido: {provider!r}")


def _send_via_console(*, to: str, subject: str, html: str, text: str | None) -> None:
    """Modo dev: imprime o conteúdo no log em vez de enviar."""
    logger.info(
        "[email:console] from=%s → to=%s | subject=%r",
        settings.EMAIL_FROM,
        to,
        subject,
    )
    if text:
        logger.info("[email:console] text body:\n%s", text)
    logger.info("[email:console] html body (%d chars):\n%s", len(html), html)


def _send_via_resend(*, to: str, subject: str, html: str, text: str | None) -> None:
    """Modo prod: envia via Resend. Falha se a API key não estiver configurada."""
    if not settings.RESEND_API_KEY:
        raise EmailDeliveryError(
            "EMAIL_PROVIDER=resend mas RESEND_API_KEY não está configurada"
        )

    resend.api_key = settings.RESEND_API_KEY
    params: dict[str, object] = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        params["text"] = text

    try:
        result = resend.Emails.send(params)
    except Exception as e:
        raise EmailDeliveryError(f"Falha ao enviar email via Resend: {e}") from e

    logger.info("[email:resend] enviado id=%s to=%s", result.get("id"), to)
