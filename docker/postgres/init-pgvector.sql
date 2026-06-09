-- Extensoes exigidas pelo schema do Tempus (ver tempus_schema.sql linhas 7-8).
-- Executado pelo entrypoint do Postgres na primeira inicializacao do volume.
-- "IF NOT EXISTS" deixa o script idempotente caso o volume seja reutilizado.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
