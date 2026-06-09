-- =============================================================================
-- Tempus — Script de criação do banco de dados
-- PostgreSQL 15+ com extensões uuid-ossp e pgvector
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;


-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE session_status AS ENUM ('in_progress', 'paused', 'completed', 'abandoned');
CREATE TYPE document_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE quiz_source_type AS ENUM ('documents', 'general_topic');
CREATE TYPE quiz_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE quiz_option AS ENUM ('a', 'b', 'c', 'd');
CREATE TYPE study_plan_status AS ENUM ('active', 'archived', 'completed');
CREATE TYPE study_plan_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');


-- =============================================================================
-- MÓDULO 1 — NÚCLEO
-- =============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(160) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    timezone        VARCHAR(64)  NOT NULL DEFAULT 'America/Belem',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);


CREATE TABLE subjects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    VARCHAR(120) NOT NULL,
    color                   VARCHAR(7)   NOT NULL DEFAULT '#534AB7',
    description             TEXT,
    weekly_goal_minutes     INTEGER      NOT NULL DEFAULT 0 CHECK (weekly_goal_minutes >= 0),
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_subjects_user ON subjects (user_id);


CREATE TABLE study_sessions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id                  UUID REFERENCES subjects(id) ON DELETE SET NULL,
    planned_duration_seconds    INTEGER NOT NULL CHECK (planned_duration_seconds > 0),
    actual_duration_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (actual_duration_seconds >= 0),
    pause_duration_seconds      INTEGER NOT NULL DEFAULT 0 CHECK (pause_duration_seconds >= 0),
    status                      session_status NOT NULL DEFAULT 'in_progress',
    notes                       TEXT,
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                    TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON study_sessions (user_id);
CREATE INDEX idx_sessions_subject ON study_sessions (subject_id);
CREATE INDEX idx_sessions_started_at ON study_sessions (started_at);


-- =============================================================================
-- MÓDULO 2 — RAG (documentos)
-- =============================================================================

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id      UUID REFERENCES subjects(id) ON DELETE SET NULL,
    filename        VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT       NOT NULL CHECK (file_size_bytes > 0),
    mime_type       VARCHAR(80)  NOT NULL,
    total_pages     INTEGER      CHECK (total_pages >= 0),
    total_chunks    INTEGER      NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
    status          document_status NOT NULL DEFAULT 'processing',
    error_message   TEXT,
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_documents_user ON documents (user_id);
CREATE INDEX idx_documents_subject ON documents (subject_id);
CREATE INDEX idx_documents_status ON documents (status);


CREATE TABLE document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL CHECK (chunk_index >= 0),
    content         TEXT    NOT NULL,
    embedding       VECTOR(1536) NOT NULL,
    page_number     INTEGER CHECK (page_number >= 1),
    token_count     INTEGER NOT NULL CHECK (token_count > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks (document_id);

-- Índice vetorial para busca semântica (cosine distance)
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    color       VARCHAR(7)  NOT NULL DEFAULT '#1D9E75',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user ON tags (user_id);


CREATE TABLE document_tags (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_document_tags_tag ON document_tags (tag_id);


-- =============================================================================
-- MÓDULO 3 — QUIZZES
-- =============================================================================

CREATE TABLE quizzes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          UUID REFERENCES subjects(id) ON DELETE SET NULL,
    title               VARCHAR(200) NOT NULL,
    source_type         quiz_source_type NOT NULL,
    topic_description   TEXT,
    total_questions     INTEGER NOT NULL CHECK (total_questions > 0),
    score               INTEGER CHECK (score >= 0),
    status              quiz_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    CONSTRAINT chk_topic_when_general
        CHECK (source_type = 'documents' OR topic_description IS NOT NULL)
);

CREATE INDEX idx_quizzes_user ON quizzes (user_id);
CREATE INDEX idx_quizzes_subject ON quizzes (subject_id);
CREATE INDEX idx_quizzes_status ON quizzes (status);


CREATE TABLE quiz_questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id         UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_index  INTEGER NOT NULL CHECK (question_index >= 0),
    question_text   TEXT    NOT NULL,
    option_a        TEXT    NOT NULL,
    option_b        TEXT    NOT NULL,
    option_c        TEXT    NOT NULL,
    option_d        TEXT    NOT NULL,
    correct_answer  quiz_option NOT NULL,
    explanation     TEXT    NOT NULL,
    UNIQUE (quiz_id, question_index)
);

CREATE INDEX idx_questions_quiz ON quiz_questions (quiz_id);


CREATE TABLE quiz_answers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_question_id    UUID NOT NULL UNIQUE REFERENCES quiz_questions(id) ON DELETE CASCADE,
    user_answer         quiz_option NOT NULL,
    is_correct          BOOLEAN NOT NULL,
    answered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE quiz_sources (
    quiz_id     UUID NOT NULL REFERENCES quizzes(id)   ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (quiz_id, document_id)
);

CREATE INDEX idx_quiz_sources_document ON quiz_sources (document_id);


-- =============================================================================
-- MÓDULO 4 — PLANO DE ESTUDOS E ANOTAÇÕES
-- =============================================================================

CREATE TABLE study_plans (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                   VARCHAR(200) NOT NULL,
    exam_date               DATE,
    daily_hours_available   NUMERIC(4,2) NOT NULL CHECK (daily_hours_available > 0 AND daily_hours_available <= 24),
    plan_content            TEXT NOT NULL,
    status                  study_plan_status NOT NULL DEFAULT 'active',
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_plans_user ON study_plans (user_id);
CREATE INDEX idx_study_plans_status ON study_plans (status);


CREATE TABLE study_plan_subjects (
    study_plan_id   UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id)    ON DELETE CASCADE,
    priority        study_plan_priority NOT NULL DEFAULT 'medium',
    PRIMARY KEY (study_plan_id, subject_id)
);

CREATE INDEX idx_plan_subjects_subject ON study_plan_subjects (subject_id);


CREATE TABLE notebooks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    color       VARCHAR(7) NOT NULL DEFAULT '#0F6E56',
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notebooks_user ON notebooks (user_id);


CREATE TABLE notes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_notebook ON notes (notebook_id);


-- =============================================================================
-- MÓDULO 5 — PROGRESSO
-- =============================================================================

CREATE TABLE progress_reports (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start                DATE NOT NULL,
    period_end                  DATE NOT NULL,
    total_study_minutes         INTEGER NOT NULL DEFAULT 0 CHECK (total_study_minutes >= 0),
    total_sessions              INTEGER NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
    completed_sessions          INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
    avg_quiz_score              NUMERIC(5,2) CHECK (avg_quiz_score >= 0 AND avg_quiz_score <= 100),
    total_quizzes_completed     INTEGER NOT NULL DEFAULT 0 CHECK (total_quizzes_completed >= 0),
    ai_narrative                TEXT NOT NULL,
    generated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period_valid CHECK (period_end >= period_start),
    UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX idx_reports_user ON progress_reports (user_id);
CREATE INDEX idx_reports_period ON progress_reports (period_start, period_end);


CREATE TABLE progress_report_subjects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    progress_report_id      UUID NOT NULL REFERENCES progress_reports(id) ON DELETE CASCADE,
    subject_id              UUID NOT NULL REFERENCES subjects(id)         ON DELETE CASCADE,
    minutes_studied         INTEGER NOT NULL DEFAULT 0 CHECK (minutes_studied >= 0),
    sessions_count          INTEGER NOT NULL DEFAULT 0 CHECK (sessions_count >= 0),
    avg_quiz_score          NUMERIC(5,2) CHECK (avg_quiz_score >= 0 AND avg_quiz_score <= 100),
    quizzes_completed       INTEGER NOT NULL DEFAULT 0 CHECK (quizzes_completed >= 0),
    UNIQUE (progress_report_id, subject_id)
);

CREATE INDEX idx_report_subjects_report ON progress_report_subjects (progress_report_id);
CREATE INDEX idx_report_subjects_subject ON progress_report_subjects (subject_id);


-- =============================================================================
-- MÓDULO 6 — VERIFICAÇÃO DE EMAIL
-- =============================================================================

CREATE TABLE email_change_requests (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email     VARCHAR(160) NOT NULL,
    token_hash    VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex
    expires_at    TIMESTAMPTZ  NOT NULL,
    used_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice parcial: acelera a busca por pedidos ativos (used_at IS NULL).
-- Pedidos antigos ficam no banco pra auditoria mas saem do índice.
CREATE INDEX idx_email_change_pending ON email_change_requests (user_id)
    WHERE used_at IS NULL;

CREATE INDEX idx_email_change_token ON email_change_requests (token_hash);


-- =============================================================================
-- MÓDULO 7 — CHAT DE DÚVIDAS COM RAG (UC10)
-- =============================================================================

-- chat_sessions: cada "conversa" listada na sidebar. subject_id é nullable
-- com ON DELETE SET NULL para que apagar uma matéria não evapore o histórico
-- de estudo do usuário; a conversa fica "órfã" mas preservada.
CREATE TABLE chat_sessions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    subject_id        UUID          REFERENCES subjects(id) ON DELETE SET NULL,
    title             VARCHAR(120) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_message_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ordem da sidebar: por user, mais recentes primeiro.
CREATE INDEX idx_chat_sessions_user_last_msg
    ON chat_sessions (user_id, last_message_at DESC);
CREATE INDEX idx_chat_sessions_subject ON chat_sessions (subject_id);


CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        chat_role NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composto: a query "carregar mensagens de uma sessão em ordem" usa os dois.
CREATE INDEX idx_chat_messages_session
    ON chat_messages (session_id, created_at);


-- Fontes citadas por uma mensagem do assistant (1:N). Tabela própria
-- (em vez de JSONB) permite query do tipo "todas as conversas que citaram
-- esse PDF" e mantém FKs para documents/document_chunks.
CREATE TABLE chat_message_sources (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id    UUID NOT NULL REFERENCES chat_messages(id)   ON DELETE CASCADE,
    document_id   UUID NOT NULL REFERENCES documents(id)       ON DELETE CASCADE,
    chunk_id      UUID          REFERENCES document_chunks(id) ON DELETE SET NULL,
    page_number   INTEGER,
    snippet       TEXT NOT NULL,
    score         NUMERIC(5,4),
    rank          INTEGER NOT NULL
);

CREATE INDEX idx_chat_message_sources_message ON chat_message_sources (message_id);
CREATE INDEX idx_chat_message_sources_document ON chat_message_sources (document_id);
