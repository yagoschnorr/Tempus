"""Fixtures para testes de integração REAL (Postgres+pgvector + OpenAI via VCR).

Diferenças em relação ao conftest principal (`tests/conftest.py`):

* **Banco**: sobe um container `pgvector/pgvector:pg16` via `testcontainers` uma
  vez por sessão. Schema é recriado a cada teste com `Base.metadata.create_all`
  + `CREATE EXTENSION vector`. Sem shims de dialeto — `pgvector.sqlalchemy.Vector`,
  `UUID(as_uuid=True)`, índices GIN e CHECKs rodam tal qual em produção.
* **OpenAI**: usa o `RealOpenAIClient` de verdade. As chamadas HTTP saem pela
  `httpx` interna da SDK e são interceptadas pelo `vcrpy` (via `pytest-recording`).
  Cassettes ficam em `tests/integration_real/cassettes/`. Modo padrão é "none"
  (replay-only) — para regravar passe `--record-mode=once` (exige `OPENAI_API_KEY`
  real no ambiente).

Como rodar:

    # Replay (default — sem rede, sem custo, exige Docker p/ Postgres):
    pytest tests/integration_real -m integration_real

    # Regravar cassettes (precisa OPENAI_API_KEY válida):
    pytest tests/integration_real -m integration_real --record-mode=once

Os fixtures redefinem `db`, `test_user`, `auth_headers` e `client` do conftest
pai por nome — quem rodar em `tests/integration_real/` pega estes aqui.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401  popula Base.metadata
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.integrations.openai_client import RealOpenAIClient, get_openai
from app.main import app
from app.models.user import User


# ---------------------------------------------------------------------------
# Postgres+pgvector via testcontainers (sessão)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def pg_container() -> Iterator[PostgresContainer]:
    """Sobe um Postgres com extensão pgvector pré-instalada.

    A imagem `pgvector/pgvector:pg16` é a referência oficial — traz o Postgres 16
    e a extensão `vector` já compilada. Ainda assim precisamos rodar
    `CREATE EXTENSION vector` por database (feito em `pg_engine`).
    """
    container = PostgresContainer(
        image="pgvector/pgvector:pg16",
        username="tempus_test",
        password="tempus_test",
        dbname="tempus_test",
    )
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="session")
def pg_engine(pg_container: PostgresContainer) -> Iterator[Engine]:
    """Engine de sessão apontando para o container. Cria a extensão uma vez."""
    engine = create_engine(pg_container.get_connection_url(), pool_pre_ping=True)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db(pg_engine: Engine) -> Iterator[Session]:
    """Schema limpo por teste. DROP+CREATE garante isolamento sem rollback magic.

    Trade-off: ~100-300ms por teste para recriar tabelas. Aceitável para
    integração; se virar gargalo, podemos migrar para TRUNCATE em todas as
    tabelas dentro de uma transação. Mantemos a extensão `vector` (criada uma
    vez em `pg_engine`) — `drop_all` só remove tabelas do `Base.metadata`.
    """
    Base.metadata.drop_all(bind=pg_engine)
    Base.metadata.create_all(bind=pg_engine)

    TestingSessionLocal = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# OpenAI real + VCR
# ---------------------------------------------------------------------------
CASSETTE_DIR = Path(__file__).parent / "cassettes"


@pytest.fixture(scope="module")
def vcr_config() -> dict:
    """Configuração do pytest-recording.

    * `filter_headers`: remove API key e qualquer header sensível dos YAMLs.
    * `match_on`: precisamos casar método+URL+body para distinguir chats/embeds
      diferentes dentro do mesmo teste.
    * `decode_compressed_response`: deixa o JSON legível no cassette p/ inspeção.
    """
    return {
        "filter_headers": [
            ("authorization", "REDACTED"),
            ("openai-organization", "REDACTED"),
            ("openai-project", "REDACTED"),
            ("x-stainless-arch", "REDACTED"),
            ("x-stainless-os", "REDACTED"),
            ("x-stainless-runtime", "REDACTED"),
            ("x-stainless-runtime-version", "REDACTED"),
        ],
        "match_on": ["method", "scheme", "host", "port", "path", "body"],
        "decode_compressed_response": True,
    }


@pytest.fixture(scope="module")
def vcr_cassette_dir() -> str:
    return str(CASSETTE_DIR)


@pytest.fixture
def openai_client() -> RealOpenAIClient:
    """Cliente OpenAI real. Em replay (cassette presente), a chave pode ser fake.

    Quando o teste é rodado com `--record-mode=once`, exige `OPENAI_API_KEY`
    real no ambiente — falha alto e cedo se ausente.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "sk-test-replay")
    return RealOpenAIClient(api_key=api_key)


# ---------------------------------------------------------------------------
# Usuário + headers de auth (mesmo contrato do conftest pai)
# ---------------------------------------------------------------------------
@pytest.fixture
def test_user(db: Session) -> User:
    user = User(
        id=uuid4(),
        name="Integration Tester",
        email=f"int-{uuid4().hex[:8]}@tempus.dev",
        password_hash=get_password_hash("senha-de-teste"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token(subject=test_user.id)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# TestClient — DB real + OpenAI real (sob VCR)
# ---------------------------------------------------------------------------
@pytest.fixture
def client(db: Session, openai_client: RealOpenAIClient) -> Iterator[TestClient]:
    def _get_db_override() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_openai] = lambda: openai_client
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_openai, None)
