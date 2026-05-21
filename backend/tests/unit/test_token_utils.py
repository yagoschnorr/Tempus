"""Testes dos utilitários de token de verificação (troca de email, reset de senha, etc.)."""
from __future__ import annotations

import re

from app.core.security import (
    generate_verification_token,
    hash_verification_token,
)


def test_generate_returns_raw_and_matching_hash():
    raw, h = generate_verification_token()
    assert hash_verification_token(raw) == h


def test_hash_is_sha256_hex_64_chars():
    _, h = generate_verification_token()
    assert len(h) == 64
    assert re.fullmatch(r"[0-9a-f]{64}", h)


def test_hash_is_deterministic():
    raw = "qualquer-coisa-fixa"
    assert hash_verification_token(raw) == hash_verification_token(raw)


def test_raw_token_has_enough_entropy():
    raw, _ = generate_verification_token()
    # secrets.token_urlsafe(32) → ~43 chars base64-url
    assert len(raw) >= 40


def test_raw_is_url_safe():
    raw, _ = generate_verification_token()
    # base64-url usa apenas [A-Za-z0-9_-]
    assert re.fullmatch(r"[A-Za-z0-9_-]+", raw)


def test_two_tokens_are_unique():
    tokens = {generate_verification_token()[0] for _ in range(50)}
    assert len(tokens) == 50  # nenhuma colisão


def test_raw_differs_from_hash():
    raw, h = generate_verification_token()
    assert raw != h
