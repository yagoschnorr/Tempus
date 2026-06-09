# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

Tempus is a study-routine platform: focus timer, subject/goal organization, and an OpenAI-powered assistant (chat with RAG, quiz generator, study-plan generator, note summarizer). Project documentation, code comments, and commit messages are in **Brazilian Portuguese** — keep that convention when adding/editing comments and docstrings.

## Common commands

### Backend (`backend/`)

```bash
# Setup
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # then fill DATABASE_URL, OPENAI_API_KEY, SECRET_KEY

# Run dev server
uvicorn app.main:app --reload   # http://localhost:8000 ; docs at /docs

# Tests
pytest                                            # unit + integration (SQLite in-memory + FakeOpenAI)
pytest tests/unit/test_quiz_service.py            # single file
pytest tests/integration -k auth_endpoint         # single test by keyword
pytest --cov=app --cov-report=html                # coverage report

# "Real" integration tests — Docker required (Postgres+pgvector container) + VCR cassettes
pytest tests/integration_real -m integration_real                       # replay mode (default, no network)
pytest tests/integration_real -m integration_real --record-mode=once    # re-record cassettes (needs real OPENAI_API_KEY)
```

There is no lint/format configured for the backend. The project has no Alembic migrations checked in yet — schemas are created from `Base.metadata` (production setup is still TBD).

### Frontend (`frontend/`)

```bash
npm install
npm run dev            # http://localhost:5173 (proxies /api → :8000)
npm run build          # tsc -b && vite build
npm run lint           # tsc --noEmit (type-check only)

# Unit tests (Vitest + jsdom + MSW)
npm test                                       # one-shot
npm run test:watch
npx vitest run tests/unit/auth-api.test.ts     # single file

# E2E (Playwright) — boots Vite with VITE_USE_MOCKS=true and VITE_E2E=true,
# so MSW handles every /api call. No backend required.
npm run e2e:install    # first time only
npm run e2e            # headed Chromium
npx playwright test tests/e2e/auth.spec.ts     # single spec

# Regenerate API types from the running backend
npm run gen:api        # writes src/lib/api/types.ts from http://localhost:8000/openapi.json
```

## Architecture

### Backend (FastAPI + SQLAlchemy + PostgreSQL/pgvector)

- **Entry point**: `backend/app/main.py` registers every router under `/api/<feature>`.
- **Layered structure** per feature: `routers/` (HTTP) → `services/` (business logic) → `models/` (SQLAlchemy) + `schemas/` (Pydantic I/O). Add new features by following this split — keep routers thin.
- **Auth**: JWT bearer. `app/core/deps.py::get_current_user` is the single dependency that validates the token, loads the `User`, and returns it. All authenticated routes depend on it.
- **Config**: `app/core/config.py` uses `pydantic-settings` reading from `.env`. Add new env vars by extending the `Settings` class.
- **OpenAI integration is the most important architectural seam.** `app/integrations/openai_client.py` defines a `OpenAIClient` Protocol (`chat`, `embed`) with three implementations:
  - `RealOpenAIClient` — production.
  - `FakeDemoClient` — activated when `OPENAI_FAKE=true` env is set; returns deterministic hashes, no network.
  - `FakeOpenAI` (in `tests/conftest.py`) — used by every unit/integration test via `app.dependency_overrides[get_openai]`.

  **Every service that touches OpenAI must accept the client via `Depends(get_openai)` — never instantiate `OpenAI(...)` directly.** This is what makes the test suite deterministic.
- **RAG**: `services/rag_service.py` does dialect-aware retrieval — pgvector's `<=>` cosine operator in PostgreSQL, Python fallback over `DocumentChunk.embedding` in SQLite (so tests work). When changing retrieval, update both paths.
- **PDF ingestion**: `services/pdf_processor.py` → `services/text_splitter.py` → `services/embedding_service.py` populate `DocumentChunk` with embeddings. `Document.status` (`processing` → `ready` / `failed`) gates retrieval.

### Frontend (React 18 + Vite + Tailwind + React Router)

- **Feature-folder layout**: `src/features/<feature>/` contains `api.ts`, `hooks/`, `components/`, and the page entry (`index.tsx`). Shared primitives live in `src/components/`. Auth/route guards and the HTTP client live in `src/lib/`.
- **Routing**: `src/routes.tsx` — public auth pages outside, everything else wrapped in `<RequireAuth>` + `<App />` shell.
- **HTTP client**: `src/lib/api/client.ts::api<T>()` is the only fetch wrapper. It reads the JWT from `localStorage["tempus.auth"]`, injects `Authorization: Bearer`, and throws `ApiError` on non-2xx. `BASE_URL` defaults to `/api` (relative), so Vite's proxy / MSW intercepts.
- **Generated API types**: `src/lib/api/types.ts` is generated from the backend's OpenAPI schema via `npm run gen:api`. Don't hand-edit.
- **MSW dual-mode setup** — important when adding new endpoints:
  - `src/lib/mocks/handlers.ts` mocks endpoints whose backend isn't ready yet.
  - `src/lib/mocks/browser.ts` lists `passthrough()` routes for endpoints whose backend **is** ready — those bypass MSW and hit Vite's `/api` proxy → real backend on `:8000`.
  - In E2E (`VITE_E2E=true`), passthroughs are disabled and everything goes through handlers (no backend running). When you implement a new backend route, **add it to the passthrough list** in `browser.ts`, otherwise the dev UI will still see mocked data.
  - MSW only activates when `VITE_USE_MOCKS=true` (set by Playwright; opt-in in dev).

## Testing conventions

- Backend unit tests use **SQLite in-memory** with `@compiles` shims in `tests/conftest.py` mapping `pgvector.Vector → BLOB` and `PG_UUID → CHAR(36)`. Don't write tests that depend on real pgvector operators — put those in `tests/integration_real/` instead.
- `FakeOpenAI` requires scripting: push expected responses with `fake_openai.chat_responses.append({...})` before invoking the code under test; an unscripted `chat()` call raises `AssertionError`. `embed()` returns a deterministic vector if none is scripted.
- `tests/integration_real/conftest.py` redefines `db`, `client`, `test_user`, `auth_headers` by name — those tests use a real Postgres container and the real OpenAI client wrapped in VCR cassettes (`tests/integration_real/cassettes/`).
- Frontend tests use MSW handlers from the same `src/lib/mocks/handlers.ts` shared with the dev/e2e setup.
