/**
 * E2E do chat (UC10).
 *
 * Estratégia de isolamento:
 *   - `page.route` intercepta /api/* antes do MSW e do backend real, com
 *     estado in-memory no próprio teste. Isso desacopla o E2E tanto do
 *     backend de pé quanto do passthrough do MSW (`browser.ts`).
 *   - Cobre o fluxo crítico (criar conversa via modal → enviar pergunta →
 *     ver resposta + sidebar atualizada) e a validação do modal.
 *   - Detalhes de borda (rename, delete, filter) já estão cobertos por
 *     unit tests do hook/api.
 */
import { test, expect, type Route } from "@playwright/test";
import { loginViaStorage } from "./helpers";

interface MockSession {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  created_at: string;
  last_message_at: string;
}

interface MockMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources: unknown[];
}

function now() {
  return new Date().toISOString();
}

function buildTitle(question: string) {
  const cleaned = question.replace(/\s+/g, " ").trim();
  return cleaned.length <= 60 ? cleaned : cleaned.slice(0, 59).trimEnd() + "…";
}

function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Monta um servidor mock totalmente in-memory para o teste corrente. */
function mountChatMockServer(): {
  bind: (page: import("@playwright/test").Page) => Promise<void>;
} {
  const subjects = [
    { id: "s-1", name: "Cálculo I", color: null, description: null, weekly_goal_minutes: 600, created_at: now() },
    { id: "s-2", name: "Algoritmos", color: null, description: null, weekly_goal_minutes: 480, created_at: now() },
  ];

  let sessions: MockSession[] = [];
  const messagesBySession = new Map<string, MockMessage[]>();
  let counter = 1;
  const nextId = (prefix: string) => `${prefix}-${counter++}`;

  function createSession(subjectId: string, question: string): {
    session: MockSession;
    assistant: MockMessage;
  } {
    const sid = nextId("cs");
    const session: MockSession = {
      id: sid,
      user_id: "u-1",
      subject_id: subjectId,
      title: buildTitle(question),
      created_at: now(),
      last_message_at: now(),
    };
    sessions.unshift(session);
    const userMsg: MockMessage = {
      id: nextId("cm"),
      session_id: sid,
      role: "user",
      content: question,
      created_at: now(),
      sources: [],
    };
    const assistant: MockMessage = {
      id: nextId("cm"),
      session_id: sid,
      role: "assistant",
      content: `Resposta E2E para: "${question}"`,
      created_at: now(),
      sources: [],
    };
    messagesBySession.set(sid, [userMsg, assistant]);
    return { session, assistant };
  }

  return {
    async bind(page) {
      await page.route("**/api/subjects", (route) =>
        jsonResponse(route, subjects)
      );

      await page.route("**/api/chat/sessions**", async (route, request) => {
        const url = new URL(request.url());
        if (request.method() === "GET") {
          const subjectId = url.searchParams.get("subject_id");
          const list = subjectId
            ? sessions.filter((s) => s.subject_id === subjectId)
            : sessions;
          return jsonResponse(route, list);
        }
        return route.continue();
      });

      await page.route("**/api/chat/sessions/*", async (route, request) => {
        const url = new URL(request.url());
        // Não capturar /sessions/:id/ask aqui — esse tem handler próprio abaixo.
        if (url.pathname.endsWith("/ask")) return route.continue();
        const id = url.pathname.split("/").pop()!;
        const session = sessions.find((s) => s.id === id);
        if (!session) return jsonResponse(route, { detail: "not found" }, 404);

        if (request.method() === "GET") {
          return jsonResponse(route, {
            ...session,
            messages: messagesBySession.get(id) ?? [],
          });
        }
        if (request.method() === "DELETE") {
          sessions = sessions.filter((s) => s.id !== id);
          messagesBySession.delete(id);
          return route.fulfill({ status: 204 });
        }
        return route.continue();
      });

      await page.route("**/api/chat/ask", async (route, request) => {
        const body = JSON.parse(request.postData() ?? "{}");
        if (!body.subject_id)
          return jsonResponse(route, { detail: "subject_id obrigatório" }, 422);
        const { session, assistant } = createSession(
          body.subject_id,
          body.question
        );
        return jsonResponse(
          route,
          { session_id: session.id, message: assistant },
          201
        );
      });

      await page.route("**/api/chat/sessions/*/ask", async (route, request) => {
        const url = new URL(request.url());
        const sid = url.pathname.split("/").slice(-2, -1)[0];
        const session = sessions.find((s) => s.id === sid);
        if (!session) return jsonResponse(route, { detail: "not found" }, 404);
        const body = JSON.parse(request.postData() ?? "{}");
        const list = messagesBySession.get(sid) ?? [];
        const userMsg: MockMessage = {
          id: nextId("cm"),
          session_id: sid,
          role: "user",
          content: body.question,
          created_at: now(),
          sources: [],
        };
        const assistant: MockMessage = {
          id: nextId("cm"),
          session_id: sid,
          role: "assistant",
          content: `Resposta E2E para: "${body.question}"`,
          created_at: now(),
          sources: [],
        };
        list.push(userMsg, assistant);
        messagesBySession.set(sid, list);
        session.last_message_at = assistant.created_at;
        return jsonResponse(route, {
          session_id: sid,
          message: assistant,
        });
      });
    },
  };
}

test.beforeEach(async ({ page }) => {
  await loginViaStorage(page);
});

test("nova conversa via modal → resposta da IA aparece + sidebar atualiza", async ({
  page,
}) => {
  const server = mountChatMockServer();
  await server.bind(page);

  await page.goto("/chat");

  // Empty state inicial
  await expect(
    page.getByRole("heading", { name: /nenhuma conversa selecionada/i })
  ).toBeVisible();

  // Abre modal de nova conversa
  await page.getByRole("button", { name: /nova conversa/i }).click();
  await expect(
    page.getByRole("dialog", { name: /nova conversa/i }).or(page.getByRole("dialog"))
  ).toBeVisible();

  // Seleciona matéria (a label associada está no <label>)
  await page
    .getByRole("dialog")
    .locator("select")
    .selectOption({ label: "Cálculo I" });
  await page.getByRole("button", { name: /iniciar conversa/i }).click();

  // Modal fechou + header da seção mostra matéria + input liberado
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/matéria:\s*cálculo i/i)).toBeVisible();

  // Envia a primeira pergunta
  const input = page.getByPlaceholder("Pergunte sobre seus documentos…");
  await input.fill("O que é uma integral imprópria?");
  await page.getByRole("button", { name: /enviar/i }).click();

  // Resposta do assistant aparece
  await expect(
    page.getByText(/Resposta E2E para: "O que é uma integral imprópria\?"/)
  ).toBeVisible();

  // Sidebar mostra a conversa nova (título truncado da pergunta)
  await expect(
    page.locator("aside").getByText(/O que é uma integral imprópria\?/)
  ).toBeVisible();
});

test("modal: sem matéria selecionada, botão fica desabilitado", async ({
  page,
}) => {
  const server = mountChatMockServer();
  await server.bind(page);

  await page.goto("/chat");
  await page.getByRole("button", { name: /nova conversa/i }).click();

  const confirm = page.getByRole("button", { name: /iniciar conversa/i });
  await expect(confirm).toBeDisabled();

  // Seleciona — o botão habilita
  await page
    .getByRole("dialog")
    .locator("select")
    .selectOption({ label: "Cálculo I" });
  await expect(confirm).toBeEnabled();
});

test("retomar conversa existente: clicar na sidebar carrega histórico", async ({
  page,
}) => {
  const server = mountChatMockServer();
  await server.bind(page);

  await page.goto("/chat");

  // Cria uma conversa primeiro
  await page.getByRole("button", { name: /nova conversa/i }).click();
  await page
    .getByRole("dialog")
    .locator("select")
    .selectOption({ label: "Algoritmos" });
  await page.getByRole("button", { name: /iniciar conversa/i }).click();
  await page
    .getByPlaceholder("Pergunte sobre seus documentos…")
    .fill("Complexidade de quicksort?");
  await page.getByRole("button", { name: /enviar/i }).click();
  await expect(
    page.getByText(/Resposta E2E para: "Complexidade de quicksort\?"/)
  ).toBeVisible();

  // Inicia uma SEGUNDA conversa em outra matéria (sai do contexto da primeira)
  await page.getByRole("button", { name: /nova conversa/i }).click();
  await page
    .getByRole("dialog")
    .locator("select")
    .selectOption({ label: "Cálculo I" });
  await page.getByRole("button", { name: /iniciar conversa/i }).click();
  await expect(page.getByText(/matéria:\s*cálculo i/i)).toBeVisible();

  // Volta na primeira conversa pela sidebar
  await page
    .locator("aside")
    .getByText(/Complexidade de quicksort\?/)
    .click();

  // O histórico antigo aparece
  await expect(
    page.getByText(/Resposta E2E para: "Complexidade de quicksort\?"/)
  ).toBeVisible();
  await expect(page.getByText(/matéria:\s*algoritmos/i)).toBeVisible();
});
