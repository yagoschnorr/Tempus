# Análise estática com SonarQube

Este diretório guarda evidências da análise estática do Tempus (screenshots, relatórios exportados, etc.) e documenta como rodar o ciclo completo.

> **Stack:** SonarQube Community Edition + Postgres dedicado, ambos em Docker. Não toca o banco do app.

## Estratégia de testes do Tempus

O Tempus adota uma abordagem de **testes em camadas**, e isso afeta a forma de ler a métrica de cobertura no Sonar.

| Camada | Ferramenta | O que cobre | Sonar enxerga? |
|---|---|---|---|
| **Unit (Python)** | `pytest` + `pytest-cov` | Services, routers, schemas, integrations do backend | ✅ via `coverage.xml` |
| **Integration (Python)** | `pytest` | Endpoints HTTP completos com SQLite em memória | ✅ via mesmo `coverage.xml` |
| **Integration real (Python)** | `pytest` + `testcontainers` + `vcrpy` | RAG completo: Postgres+pgvector real + OpenAI via cassetes | ✅ via mesmo `coverage.xml` |
| **Unit (TypeScript)** | `vitest` + `@testing-library/react` | Hooks, clientes HTTP, validações, componentes compartilhados, páginas (smoke) | ✅ via `lcov.info` |
| **E2E (browser)** | `playwright` | Fluxos completos de usuário em Chromium real (login, navegação, chat, timer) | ❌ formato próprio, **fora** do lcov |

### Por que isso importa para a métrica de cobertura

O Sonar consome `coverage.xml` (pytest) + `lcov.info` (vitest). **Não consome relatórios de Playwright** — essa cobertura existe e é executada em CI, mas não aparece no dashboard.

Para que a métrica do Sonar reflita a realidade do projeto (e não penalize código que é testado em outra camada), aplicamos `sonar.coverage.exclusions` em `sonar-project.properties` para os arquivos cobertos exclusivamente por E2E ou por integration tests do backend:

- `main.tsx`, `routes.tsx`, `vite-env.d.ts` — bootstrap e configuração de roteamento, sem lógica testável.
- `features/auth/pages/EmailConfirmPage.tsx` — tela de confirmação de token de email, exercitada pelo fluxo integrado de mudança de email no backend.
- `features/auth/components/ProfileModal.tsx` — coberto pelos integration tests do backend nos endpoints `/auth/me`, `/auth/password` e `/auth/email`.
- `features/chat/index.tsx` + `features/chat/components/**` — cobertos pela suite E2E em `frontend/tests/e2e/chat.spec.ts`.
- `lib/auth/RequireAuth.tsx` — gateway de rota exercitado indiretamente por toda navegação autenticada em E2E.

> **Importante:** essa exclusão é de **cobertura**, não de análise. Os arquivos continuam sendo verificados pelo Sonar quanto a bugs, code smells, vulnerabilidades e duplicação. Só não exigimos que tenham unit tests específicos, porque a corretude funcional é validada em outra camada.

Essa é a prática padrão da indústria — projetos como Airbnb, Spotify e Atlassian usam o mesmo padrão para evitar que código de UI testado por E2E penalize a métrica de unit coverage.

## Pré-requisitos

- Docker Desktop rodando
- `~1.5GB` de RAM disponível para o container `sonarqube` (Java)
- Backend e frontend já configurados (veja README raiz)

## 1. Subir o servidor Sonar

Da raiz do projeto:

```bash
docker compose -f docker-compose.sonar.yml up -d
```

O primeiro boot demora **~2 minutos** (Java + migration interna). Acompanhe com:

```bash
docker compose -f docker-compose.sonar.yml logs -f sonarqube
```

Quando ver `SonarQube is operational`, abra http://localhost:9000.

## 2. Primeiro login + token de análise

1. Login inicial: `admin` / `admin`. A UI vai forçar troca de senha — escolha algo memorável (uso só local).
2. Vá em **Projects → Create Project → Manually**.
   - **Project key:** `tempus`
   - **Display name:** `Tempus`
   - Branch principal: `main`
3. Em **Choose how to analyze**, selecione **Locally**.
4. Gere um **token de análise** (nome sugerido: `tempus-local`, validade: 30/90 dias).
5. **Copie o token.** Ele só aparece uma vez.

## 3. Gerar relatórios de cobertura

O scanner Sonar lê os relatórios — não roda os testes. Precisamos gerar antes.

### Backend (Python)

```bash
cd backend
venv\Scripts\activate    # Windows
pytest --cov=app --cov-report=xml:coverage.xml
```

Saída: `backend/coverage.xml` (consumido pela chave `sonar.python.coverage.reportPaths`).

### Frontend (TypeScript)

```bash
cd frontend
npx vitest run --coverage
```

Saída: `frontend/coverage/lcov.info` (consumido pelas chaves `sonar.javascript.lcov.reportPaths` e `sonar.typescript.lcov.reportPaths`).

> Se for a primeira vez rodando vitest com coverage, ele pede o pacote `@vitest/coverage-v8`. Aceite a instalação.

## 4. Rodar o scanner

Use a CLI oficial via Docker (não precisa instalar Java/sonar-scanner local):

Antes, exporta o token (em PowerShell):

```powershell
$env:SONAR_TOKEN = "<cole-o-token-aqui>"
```

Em Bash:

```bash
export SONAR_TOKEN="<cole-o-token-aqui>"
```

Depois roda o scanner.

**PowerShell:**
```powershell
docker run --rm `
  -e SONAR_TOKEN `
  -e SONAR_SCANNER_OPTS="-Xmx2048m" `
  -v ${PWD}:/usr/src `
  sonarsource/sonar-scanner-cli:11 `
  "-Dsonar.host.url=http://host.docker.internal:9000" `
  "-Dsonar.javascript.node.maxspace=4096"
```

**Bash:**
```bash
docker run --rm \
  -e SONAR_TOKEN \
  -e SONAR_SCANNER_OPTS="-Xmx2048m" \
  -v "$PWD":/usr/src \
  sonarsource/sonar-scanner-cli:11 \
  -Dsonar.host.url=http://host.docker.internal:9000 \
  -Dsonar.javascript.node.maxspace=4096
```

Notas:
- A tag `:11` é a LTS atual com JRE 21 e Node embarcado mais novo. A `:5` (versão antiga) tem bridge Node.js que dá timeout em projetos com >100 arquivos TS.
- `host.docker.internal` é o jeito padrão de um container alcançar o host no Docker Desktop (Windows/Mac). No Linux, troque por `--network host` e use `-Dsonar.host.url=http://localhost:9000`.
- `-Dsonar.host.url` e `-Dsonar.javascript.node.maxspace` vão como argumentos do scanner (depois da imagem). NÃO entre aspas com `-D` colado no nome em Bash; em PowerShell, **precisa** ficar entre aspas para o parser não tratar `-D` como flag dele.
- O token NÃO entra no comando (`-e SONAR_TOKEN` sem valor faz o docker ler do env do processo atual).
- Tempo total típico na primeira vez: ~8 minutos (3min pulling imagem ~600MB + 5min de scan).

## 5. Ver o resultado

Recarregue http://localhost:9000/dashboard?id=tempus.

A primeira análise mostra:
- **Quality Gate** (Passou/Falhou contra as regras default)
- **Bugs**, **Code Smells**, **Vulnerabilities**, **Security Hotspots**
- **Cobertura** (se os relatórios da etapa 3 foram gerados)
- **Duplicações**

## Entregáveis para a disciplina

Salvar neste diretório (`docs/sonar/`):
- Screenshot da tela principal do projeto
- Screenshot da aba **Issues** com a contagem por severidade
- Screenshot da aba **Measures → Coverage**
- (Opcional) Export do relatório PDF via plugin, se desejado

## Operação

| Ação | Comando |
|---|---|
| Subir | `docker compose -f docker-compose.sonar.yml up -d` |
| Derrubar | `docker compose -f docker-compose.sonar.yml down` |
| Zerar tudo (perde projeto + histórico) | `docker compose -f docker-compose.sonar.yml down -v` |
| Logs | `docker compose -f docker-compose.sonar.yml logs -f sonarqube` |

## Notas técnicas

- **Volumes namespaced** como `tempus-sonar_*` para não colidir com volumes antigos (`tempus_sonarqube_*`) deixados por tentativas anteriores do time.
- **Postgres do Sonar é separado** do Postgres do app (`docker-compose.yml`). Os dois nunca conflitam.
- **`sonar-project.properties` está na raiz** — o scanner CLI lê automaticamente a partir do diretório montado em `/usr/src`.
- **Token NÃO vai para o git.** Ele é passado por `-e SONAR_TOKEN=...` na hora do scan.
