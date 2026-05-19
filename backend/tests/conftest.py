"""Fixtures compartilhadas para toda a suíte de testes.

Garantias:
* Nenhum teste toca a OpenAI real — `fake_openai` é injetado em todo `client`.
* Banco isolado por teste: SQLite em memória recriado a cada função.
* `auth_headers` produz um token JWT válido amarrado a um usuário recém-criado.

Compatibilidade SQLite ↔ PostgreSQL: os modelos usam `UUID` do dialeto pg e
`Vector` do pgvector. Registramos `@compiles(..., "sqlite")` para mapear esses
tipos para `CHAR(36)`/`BLOB` no SQLite. Não afeta produção (que usa o dialeto pg).
"""
from __future__ import annotations

import hashlib
from typing import Any, Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  garante que todos os modelos populem Base.metadata
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.integrations.openai_client import get_openai
from app.main import app
from app.models.user import User


# ---------------------------------------------------------------------------
# Compatibilidade SQLite com tipos específicos do PostgreSQL
# ---------------------------------------------------------------------------
# DDL: mapeia PG_UUID/Vector para tipos SQLite no CREATE TABLE.
@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(element, compiler, **kw):  # type: ignore[no-untyped-def]
    return "CHAR(36)"


try:
    from pgvector.sqlalchemy import Vector

    @compiles(Vector, "sqlite")
    def _compile_vector_sqlite(element, compiler, **kw):  # type: ignore[no-untyped-def]
        return "BLOB"

except ImportError:
    pass


# Bind/result processors: PG_UUID herda o processor genérico que faz `value.hex`
# (espera UUID object). No SQLite, queremos serializar UUID/str → str e desserializar
# str → UUID. Patch só atua quando dialect.name == "sqlite".
import uuid as _uuid

_original_uuid_bind_processor = PG_UUID.bind_processor
_original_uuid_result_processor = PG_UUID.result_processor


def _sqlite_friendly_bind_processor(self, dialect):  # type: ignore[no-untyped-def]
    if dialect.name == "sqlite":
        def process(value):
            if value is None:
                return None
            return str(value)
        return process
    return _original_uuid_bind_processor(self, dialect)


def _sqlite_friendly_result_processor(self, dialect, coltype):  # type: ignore[no-untyped-def]
    if dialect.name == "sqlite":
        def process(value):
            if value is None:
                return None
            if isinstance(value, _uuid.UUID):
                return value
            return _uuid.UUID(value)
        return process
    return _original_uuid_result_processor(self, dialect, coltype)


PG_UUID.bind_processor = _sqlite_friendly_bind_processor
PG_UUID.result_processor = _sqlite_friendly_result_processor


# ---------------------------------------------------------------------------
# Banco em memória (engine + sessão por teste)
# ---------------------------------------------------------------------------
@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignora FKs por padrão — sem isso `ON DELETE SET NULL`/`CASCADE` viram no-op.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _):  # type: ignore[no-untyped-def]
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


# ---------------------------------------------------------------------------
# Fake OpenAI — único ponto de simulação da IA em toda a suíte
# ---------------------------------------------------------------------------
class FakeOpenAI:
    """Cliente OpenAI fake. Toda chamada é registrada em `self.calls`.

    Uso típico em um teste:
        fake_openai.chat_responses.append({"choices": [{"message": {"content": "..."}}]})
        # ... invoca o serviço ...
        assert fake_openai.calls[0][0] == "chat"
    """

    def __init__(self) -> None:
        self.chat_responses: list[dict[str, Any]] = []
        self.embed_responses: list[list[list[float]]] = []
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        response_format: dict[str, Any] | None = None,
        model: str = "gpt-4o-mini",
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        self.calls.append(
            (
                "chat",
                {
                    "messages": messages,
                    "response_format": response_format,
                    "model": model,
                    "temperature": temperature,
                },
            )
        )
        if not self.chat_responses:
            raise AssertionError(
                "FakeOpenAI.chat() chamado sem resposta scriptada — "
                "popule fake_openai.chat_responses no teste"
            )
        return self.chat_responses.pop(0)

    def embed(
        self,
        texts: list[str],
        *,
        model: str = "text-embedding-3-small",
    ) -> list[list[float]]:
        self.calls.append(("embed", {"texts": texts, "model": model}))
        if self.embed_responses:
            return self.embed_responses.pop(0)
        return [_deterministic_vector(t) for t in texts]


def _deterministic_vector(text: str, dim: int = 1536) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    raw = (digest * ((dim // len(digest)) + 1))[:dim]
    return [(b - 128) / 128.0 for b in raw]


@pytest.fixture
def fake_openai() -> Iterator[FakeOpenAI]:
    fake = FakeOpenAI()
    app.dependency_overrides[get_openai] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_openai, None)


# ---------------------------------------------------------------------------
# TestClient com get_db e get_openai sobrescritos
# ---------------------------------------------------------------------------
@pytest.fixture
def client(db: Session, fake_openai: FakeOpenAI) -> Iterator[TestClient]:
    def _get_db_override() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _get_db_override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Usuário + headers de autenticação
# ---------------------------------------------------------------------------
@pytest.fixture
def test_user(db: Session) -> User:
    user = User(
        id=uuid4(),
        name="Quiz Tester",
        email=f"tester-{uuid4().hex[:8]}@tempus.dev",
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
