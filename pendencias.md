# Tempus — Pendências para entrega final

> **Hoje:** 2026-05-24 · **Deadline Sprint 3:** 2026-05-26 (2 dias úteis).
> Base de comparação: `ultraplan.md` + survey de `backend/` e `frontend/` em 24/05.

## Sumário executivo

| Frente | Status | % |
|---|---|---|
| Backend core (auth/subjects/quizzes/notebooks/chat) | ✅ pronto | ~55% |
| Backend faltante (sessions/documents/study-plans/dashboard/tags) | ❌ não iniciado | 0% |
| Frontend telas implementadas (auth/subjects/timer/quiz/notebooks/chat) | ✅ pronto | ~67% |
| Frontend telas placeholder (documents/dashboard/study-plan) | ❌ mock estático | 0% |
| RAG (pdf→chunks→embeddings) | ❌ só `rag_service.search`, sem pipeline de ingest | ~25% |
| Infra (docker, alembic, CI, uploads/) | ❌ ausente | 0% |
| Docs (15 UCs, casos de teste, cobertura, sonar) | ❌ ausente | 0% |
| Testes backend | ⚠️ parcial — 167 passed, faltam módulos sem implementação | ~55% |
| Testes frontend | ✅ 130 unit + 6 E2E | ~80% |

**Risco crítico:** a entrega 26/05 exige 8 telas funcionais + RAG funcionando + dashboard + cobertura ≥70%. O gap atual em 2 dias só é viável se houver corte de escopo (ver §7 — roadmap proposto).

---

## 1. Backend — o que falta

### 1.1 Módulos não iniciados (router + service ausentes)

| Módulo | Endpoints faltando | Service | Model |
|---|---|---|---|
| **Sessions / Timer** | `POST /sessions`, `PATCH /sessions/{id}/pause`, `/resume`, `/complete`, `/abandon`, `GET /sessions`, `GET /sessions/{id}` | ❌ `session_service.py` | ✅ existe |
| **Documents** | `POST /documents` (multipart), `GET /documents` (filtros), `GET /documents/{id}`, `GET /documents/{id}/status`, `DELETE /documents/{id}`, `POST /documents/{id}/summary` | ❌ `document_service.py` | ✅ existe |
| **Tags** | `GET /tags`, `POST /tags`, `DELETE /tags/{id}` | ❌ | ❌ **model também ausente** |
| **Study Plans** | `POST /study-plans/generate`, `GET /study-plans`, `GET /study-plans/{id}`, `PATCH /study-plans/{id}` | ❌ `study_plan_generator.py` | ✅ existe |
| **Dashboard** | `GET /dashboard/realtime`, `GET /dashboard/weekly-report`, `POST /dashboard/weekly-report/generate` | ❌ `progress_service.py` | ✅ existe (progress) |

Resultado: `main.py:24` registra só `auth, notebook, chat, quizzes, subjects`. Os 5 routers acima precisam ser criados, registrados e ter cobertura.

### 1.2 Pipeline RAG — só metade pronta

- ✅ `rag_service.search(subject_id, query, k)` em `services/rag_service.py` (Postgres pgvector + fallback SQLite pra testes).
- ❌ `services/pdf_processor.py` — extração + chunking + embedding + persistência.
- ❌ `services/text_splitter.py` — `split_text(text, max_tokens=800, overlap=150)` com `tiktoken`.
- ❌ `services/embedding_service.py` — batch + retry com tenacity.
- ❌ Endpoint `POST /documents` + `BackgroundTasks` que dispara o pipeline.
- ❌ Quiz com `source_type=documents` — `quiz_generator.py` só atende `general_topic`.

Sem o pipeline, o chat funciona mas sempre devolve "resposta sem citações" (não há `document_chunks` no banco).

### 1.3 Chat — endpoint `/chat/ask` divergente

O ultraplan §3 especifica `POST /chat/ask`. O router atual implementa `POST /chat/ask` + `POST /chat/sessions/{id}/ask` (modelo de sessões persistidas). Diferença é arquitetural — sessões + histórico vs. ask stateless. Está OK, mas o **frontend Chat espera `askNew` + `askInSession`** (já implementado), então não é gap, só desvio do ultraplan que ficou bem.

### 1.4 Tags

Não existe `models/tag.py`, schema, service nem router. O `tempus_schema.sql` precisa ser verificado se já tem a tabela — provavelmente sim, mas o SQLAlchemy não a espelha. Bloqueia o filtro `tag_id` em documents e a UI de tags na tela de Documentos.

### 1.5 Testes backend faltantes

| Cobertura existente | Gap |
|---|---|
| ✅ auth_endpoint, chat_endpoint, quizzes_endpoint, subjects_endpoint (integration) | ❌ sessions, documents, study-plans, dashboard, notebooks (integration) |
| ✅ chat_service, email_service, notebook_service, quiz_generator, quiz_schemas, subject_schemas, subject_service, token_utils, fixtures_smoke (unit) | ❌ session_service, document_service, rag_service, pdf_processor, text_splitter, embedding_service, study_plan_generator, progress_service |

Total atual: **167 passed**. Para chegar a ≥70% cobertura com módulos novos entrando, será preciso ~50 testes a mais.

---

## 2. Frontend — o que falta

### 2.1 Telas placeholder (só mock estático)

| Tela | Arquivo | Status |
|---|---|---|
| **Documents** | `features/documents/index.tsx` (113 linhas) | ❌ arrays hardcoded; sem `api.ts`, sem hooks, sem upload real, sem polling de status |
| **Dashboard** (UC14) | `features/dashboard/index.tsx` (141 linhas) | ❌ métricas e gráfico de barras hardcoded; sem `api.ts`, sem relatório semanal |
| **Study Plan** | `features/study-plan/index.tsx` (112 linhas) | ❌ subjects hardcoded; sem geração via IA |

### 2.2 Telas implementadas

| Tela | Status |
|---|---|
| Auth (login/register/email-confirm/profile-modal) | ✅ |
| Subjects (CRUD + modal + delete dialog) | ✅ |
| Timer | ✅ |
| Quiz | ✅ (incl. delete dialog) |
| Notebooks (listagem + detalhe + editor + summary) | ✅ |
| Chat | ✅ |

### 2.3 Cobertura frontend

- ✅ 21 test files, 130 testes unit verdes
- ✅ E2E: auth, subjects, timer, chat, smoke (5 specs)
- ❌ E2E ausente: quiz fluxo completo, notebooks, documents (depende de implementação)

---

## 3. Infraestrutura ausente

| Item | Especificação ultraplan | Estado |
|---|---|---|
| `docker-compose.yml` | Postgres+pgvector (`ankane/pgvector:pg17`) | ❌ inexistente |
| `backend/alembic/` + `alembic.ini` | Migrations Alembic com env.py | ❌ inexistente (apesar de `alembic` em `requirements.txt`) |
| `backend/uploads/` | Diretório gitignored para PDFs | ❌ inexistente |
| `.github/workflows/` | CI com pytest --cov + vitest + ruff + tsc | ❌ inexistente |
| `pyproject.toml` | Ruff + pytest config | ❌ não verificado (provável ausente) |
| `sonar-project.properties` | SonarQube | ❌ inexistente |

### 3.1 Implicações práticas

- **Sem Alembic:** mudanças de schema (ex.: coluna `pinned` adicionada no Bloco 2 de notebooks) só vivem no `tempus_schema.sql` + SQLAlchemy model. Bancos prod já existentes precisam de `ALTER TABLE` manual.
- **Sem docker-compose:** quem entra novo no projeto precisa instalar pgvector na mão — barreira de onboarding.
- **Sem CI:** PRs sobem sem garantia de testes verdes nem cobertura mínima. Risco de regressão alto no fim de sprint.

---

## 4. Documentação ausente

| Pasta esperada | Conteúdo previsto | Estado |
|---|---|---|
| `docs/use-cases/` | UC01.md a UC15.md (template fixo, escopo Sprint 1) | ❌ inexistente |
| `docs/test-cases/` | Casos de teste por UC | ❌ inexistente |
| `docs/coverage/` | Relatório HTML de cobertura por sprint | ❌ inexistente |
| `docs/sonar/` | Relatório SonarQube | ❌ inexistente |

O ultraplan §4.1 (Sprint 1) já marca 15 UCs como entregável de hoje (13/05 original) — atrasado em ~10 dias.

---

## 5. Checklist consolidado da Sprint 3

Marcando contra `ultraplan.md` §10:

- [ ] 8 telas pós-login funcionais — **6/8** (faltam documents, dashboard, study-plan)
- [ ] 15 UCs implementados — sem rastreabilidade documentada; código cobre estimadamente 8-9 UCs
- [ ] RAG funcionando (upload PDF → chunks → retrieval → quiz/chat) — **retrieval pronto, ingest 0%**
- [ ] Dashboard com métricas realtime + relatório semanal IA — **0%**
- [ ] Suíte completa (unit + integration + E2E ≥3 fluxos críticos) — **parcial**: unit + integration sólidos para módulos prontos; E2E em 5 fluxos
- [ ] Cobertura backend ≥70% (meta 80%) com relatório HTML — **sem medição automatizada**; provável <60% considerando módulos faltantes
- [ ] Análise estática SonarQube — **0%**
- [ ] Casos de teste em `docs/test-cases/` com status — **0%**
- [ ] README final com prints — **README inicial existe**; sem prints das telas
- [ ] Roteiro de demo (10min) + slides — **0%**
- [ ] Tag `v1.0.0` + release notes — pendente

---

## 6. Riscos com 2 dias até deadline

| Risco | Impacto | Mitigação sugerida |
|---|---|---|
| Pipeline RAG não cabe em 2 dias se for completo (pdf_processor + embedding batch + retry + bg task) | Quiz `documents` e chat com fontes ficam inúteis | **Cortar escopo:** pipeline síncrono em request (sem BackgroundTasks), 1 PDF por vez, sem retry, threshold/k fixos. Aceitar fallback para o quiz `general_topic`. |
| Dashboard inteiro é trabalho de ≥1 dia (SQL agregado + IA narrativa + UI gráfica) | UC14 não entrega | **Versão mínima:** SQL agregado `realtime` retornando apenas `hours_today + hours_week + current_streak`; gráfico de barras vira lista textual; pular relatório semanal IA. |
| Documents UI precisa upload + listagem + polling | Sem isso, sem como popular o RAG | **Versão mínima:** upload form + lista + status badge polled a cada 3s, sem filtros por tag/matéria avançados. |
| Study Plan IA generator | Baixo (UC menos demandado) | **Mock determinístico** baseado em prioridades, sem chamada IA. Documentar como "modo demo". |
| Sessions/Timer backend | Timer frontend já existe — sem backend só funciona client-side | **Implementar mínimo:** `POST /sessions` + `PATCH /sessions/{id}/complete` (sem pause/resume/abandon). Frontend já tem hooks compatíveis. |
| Cobertura <70% bloqueia nota | Penaliza avaliação | Rodar `pytest --cov --cov-report=html` no estado atual pra ter número real. Priorizar testes de módulos finalizados, não cobertura mínima de tudo. |
| Sem CI + sem docker-compose | Demonstração tropeça | Pelo menos: README com `pip install -r requirements.txt` + `psql -f tempus_schema.sql` + `uvicorn ...` + `npm run dev` em 4 comandos. Sem docker. |

---

## 7. Roadmap proposto para 25/05 e 26/05

Priorização "mínimo viável para entrega" (não tudo do ultraplan):

### Dia 25/05 (sábado)

**Backend (paralelo entre 2 devs):**
1. `session_service` + router (4-6h) — usar `models/session.py` que já existe.
2. `document_service` + router de upload + pipeline RAG síncrono mínimo (`pdfplumber → split_text → embed → INSERT chunks`) (6-8h).
3. `progress_service` + router `/dashboard/realtime` (SQL agregado) (3-4h).

**Frontend (paralelo entre 2 devs):**
1. Tela Documents: upload form + listagem real + polling (4-6h).
2. Tela Dashboard: consumir `/dashboard/realtime`, manter visual mas com dados reais (3-4h).
3. Tela Study Plan: form de geração + listagem com mock determinístico (3-4h).

**Infra (paralelizar tarde):**
1. `docker-compose.yml` com Postgres+pgvector (1h).
2. README atualizado com 4 comandos (30min).
3. Cobertura HTML gerada em `docs/coverage/` (30min).

### Dia 26/05 (domingo — entrega)

**Manhã:**
1. Testes integração para sessions + documents + dashboard.
2. E2E Playwright: 1 fluxo crítico (login → matéria → timer → upload PDF → quiz). Mesmo que falhe parcial, demonstra integração.
3. Documentar 15 UCs em `docs/use-cases/` (template curto, 30min cada — 7-8h em 1 pessoa, ou paralelizar 4×).

**Tarde:**
1. Refinos visuais + screenshots no README.
2. Roteiro de demo + tag `v1.0.0`.

### Cortes explícitos sugeridos

- ❌ Tags (sem model nem UI; o filtro fica fora do MVP)
- ❌ Weekly report IA narrativa (substituir por "resumo simples" client-side)
- ❌ Study plan IA real (usar gerador determinístico mockado)
- ❌ Pause/resume/abandon de sessões (só completar)
- ❌ Documents summary endpoint (`POST /documents/{id}/summary`)
- ❌ SonarQube (relatório opcional)
- ❌ Alembic completo (manter ALTER TABLE manual + `tempus_schema.sql` como referência)

---

## 8. Arquivos críticos para referência

| Caminho | Função |
|---|---|
| `tempus_schema.sql` | Source-of-truth do schema |
| `backend/app/integrations/openai_client.py` | Injeção de IA com fake |
| `backend/app/services/rag_service.py` | Retrieval pronto (precisa de chunks pra funcionar) |
| `backend/tests/conftest.py` | Fake OpenAI + SQLite fixtures |
| `frontend/src/lib/api/client.ts` | Wrapper HTTP com bearer |
| `frontend/src/lib/api/types.ts` | Tipos (manual; openapi-typescript não rodado) |
| `frontend/src/lib/mocks/handlers.ts` | MSW handlers (importante porque telas placeholder podem ser destravadas via mock para a demo) |

---

## 9. Apêndice: o que está pronto e robusto

Para não perder de vista o que já foi bem feito:

- **Auth completo:** register, login, me, profile update, password change, email change com confirmação por token, account delete (com integração tests).
- **Subjects CRUD:** backend + frontend + E2E.
- **Timer:** state machine no frontend; falta só backend.
- **Quizzes:** geração `general_topic` end-to-end, answer + complete, delete; UI completa.
- **Chat com sessões persistidas:** rename, delete, list por subject, ask new/in-session, integração com `rag_service` (devolve sem fontes se chunks vazios).
- **Notebooks + Notes (UC do Alberto):** CRUD completo, agregados (`notes_count`, `last_activity_at`), pin/unpin, editor de folhas, summary IA. **Implementado em 5 blocos nesta sprint** — referência de qualidade alta.

Esses módulos sustentam a demo mesmo se o RAG/Dashboard ficarem mais simples.
