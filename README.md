# Tempus

Plataforma web de gestão de rotina de estudos com assistente de IA integrado.

O Tempus combina timer de foco, organização de matérias e metas semanais com um agente alimentado pela API da OpenAI — que tira dúvidas, gera quizzes para auxiliar no aprendizado e faz resumos no contexto da matéria em andamento.

---

## Stack

- **Backend** — Python 3.11 + FastAPI
- **Frontend** — React + Vite
- **Banco de dados** — PostgreSQL
- **IA** — OpenAI API (GPT-4o)
- **Testes** — Pytest · Playwright

---

## Pré-requisitos

Certifique-se de ter instalado:

- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — sobe o Postgres com pgvector já configurado
- [Git](https://git-scm.com/)

---

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/tempus.git
cd tempus
```

### 2. Configure o backend

```bash
cd backend

# Crie e ative o ambiente virtual
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# Instale as dependências
pip install -r requirements.txt

# Copie o arquivo de variáveis de ambiente
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/tempus
OPENAI_API_KEY=sua_chave_aqui
SECRET_KEY=sua_secret_key_aqui
```

### 3. Suba o banco de dados (Postgres + pgvector)

Na raiz do projeto:

```bash
docker compose up -d
```

Isso baixa a imagem `pgvector/pgvector:pg16`, sobe o container `tempus-db` na porta `5433` do host (mapeada para `5432` dentro do container) e cria as extensões `uuid-ossp` e `vector` automaticamente. A porta `5433` é usada para evitar conflito caso você já tenha Postgres nativo instalado escutando na `5432`.

> As tabelas do schema são criadas no primeiro boot do backend (lifespan do FastAPI chama `Base.metadata.create_all`). Não há migrations.

Para parar: `docker compose down`. Para zerar todos os dados: `docker compose down -v`.

### 4. Configure o frontend

```bash
cd ../frontend

# Instale as dependências
npm install

# Copie o arquivo de variáveis de ambiente
cp .env.example .env
```

Edite o `.env` do frontend:

```env
VITE_API_URL=http://localhost:8000
```

---

## Executando o projeto

### Backend

```bash
cd backend
source venv/bin/activate   # Linux/macOS
uvicorn app.main:app --reload
```

A API estará disponível em `http://localhost:8000`.  
Documentação automática: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm run dev
```

O frontend estará disponível em `http://localhost:5173`.

---

## Executando os testes

```bash
# Testes unitários e de integração
cd backend
pytest

# Testes com relatório de cobertura
pytest --cov=app --cov-report=html

# Testes end-to-end
cd frontend
npx playwright test
```

---

## Estrutura do projeto

```
tempus/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   └── schemas/
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── timer/          # timer de sessões e modo pomodoro
│   │   │   ├── subjects/       # matérias e metas semanais
│   │   │   ├── notes/          # biblioteca de notas e materiais
│   │   │   ├── quiz/           # quizzes gerados pela IA
│   │   │   ├── chat/           # agente de dúvidas (OpenAI)
│   │   │   └── dashboard/      # progresso e relatórios semanais
│   │   ├── components/         # componentes compartilhados entre features
│   │   └── lib/                # api client, configurações e utilitários
│   ├── tests/
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Equipe

<!-- Adicione os membros da equipe aqui -->

| Nome | GitHub |
|------|--------|
| Alberto Eduardo Martins Acosta | https://github.com/AlbertoGrey27 |
| Carlos Eduardo Cardoso Silva | https://github.com/CarlosEduuu0 |
| João Ricardo Silva de Almeida | https://github.com/jricass |
| Yago Patrick Schnorr Pinto | https://github.com/yagoschnorr |
