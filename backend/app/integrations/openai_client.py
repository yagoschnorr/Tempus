"""Ponto único de integração com a OpenAI.

`OpenAIClient` é o Protocol estável consumido pelos services (`quiz_generator`,
`rag_service`, etc.). `RealOpenAIClient` é a implementação concreta que fala
com a API. `get_openai` é a dependência FastAPI — em produção devolve o cliente
real; em testes é sobrescrita pelo `FakeOpenAI` via `app.dependency_overrides`.

Modo demo de backup (ultraplan §8 — risco custo/rate limit):
    Setar `OPENAI_FAKE=true` no ambiente ativa o `FakeDemoClient` em runtime,
    sem tocar rede nem consumir créditos. Útil para demos ao vivo.
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from typing import Any, Protocol

from openai import OpenAI

from app.core.config import settings


# ---------------------------------------------------------------------------
# Protocolo público
# ---------------------------------------------------------------------------

class OpenAIClient(Protocol):
    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        response_format: dict[str, Any] | None = None,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
    ) -> dict[str, Any]: ...

    def embed(
        self,
        texts: list[str],
        *,
        model: str = "text-embedding-3-small",
    ) -> list[list[float]]: ...


# ---------------------------------------------------------------------------
# Implementação real
# ---------------------------------------------------------------------------

class RealOpenAIClient:
    def __init__(self, api_key: str) -> None:
        self._client = OpenAI(api_key=api_key)

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        response_format: dict[str, Any] | None = None,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format is not None:
            kwargs["response_format"] = response_format
        completion = self._client.chat.completions.create(**kwargs)
        return completion.model_dump()

    def embed(
        self,
        texts: list[str],
        *,
        model: str = "text-embedding-3-small",
    ) -> list[list[float]]:
        response = self._client.embeddings.create(model=model, input=texts)
        return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Implementação fake — modo demo (OPENAI_FAKE=true)
# ---------------------------------------------------------------------------

def _hash_vec(text: str) -> list[float]:
    """Vetor determinístico de 1536 floats derivado do texto via SHA-256."""
    floats: list[float] = []
    seed = list(hashlib.sha256(text.encode()).digest())
    while len(floats) < 1536:
        floats.extend((b / 127.5) - 1.0 for b in seed)
        seed = list(hashlib.sha256(bytes(seed)).digest())
    return floats[:1536]


class FakeDemoClient:
    """Client sem rede para demo ao vivo e testes de fumaça sem API key."""

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        response_format: dict[str, Any] | None = None,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps({"questions": []}),
                    }
                }
            ]
        }

    def embed(
        self,
        texts: list[str],
        *,
        model: str = "text-embedding-3-small",
    ) -> list[list[float]]:
        return [_hash_vec(t) for t in texts]


# ---------------------------------------------------------------------------
# Dependência FastAPI
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _build_client() -> RealOpenAIClient:
    return RealOpenAIClient(api_key=settings.OPENAI_API_KEY)


def get_openai() -> OpenAIClient:
    """Dependência FastAPI. Sobrescrita em testes via `app.dependency_overrides`.

    Se `OPENAI_FAKE=true` no ambiente, retorna `FakeDemoClient` (sem rede).
    """
    if getattr(settings, "OPENAI_FAKE", "").lower() == "true":
        return FakeDemoClient()
    return _build_client()