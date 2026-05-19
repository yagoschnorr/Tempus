"""Ponto único de integração com a OpenAI.

`OpenAIClient` é o Protocol estável consumido pelos services (`quiz_generator`,
`rag_service`, etc.). `RealOpenAIClient` é a implementação concreta que fala
com a API. `get_openai` é a dependência FastAPI — em produção devolve o cliente
real; em testes é sobrescrita pelo `FakeOpenAI` via `app.dependency_overrides`.

"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Protocol

from openai import OpenAI

from app.core.config import settings


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


@lru_cache(maxsize=1)
def _build_client() -> RealOpenAIClient:
    return RealOpenAIClient(api_key=settings.OPENAI_API_KEY)


def get_openai() -> OpenAIClient:
    """Dependência FastAPI. Sobrescrita em testes via `app.dependency_overrides`."""
    return _build_client()
