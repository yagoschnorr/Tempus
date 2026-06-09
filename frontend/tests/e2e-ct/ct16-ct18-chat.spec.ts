/**
 * CT16 — Chat com RAG (UC16)
 * CT17 — Continuar Conversa em Sessão (UC17)
 * CT18 — Gerenciar Sessões de Chat (UC18)
 *
 * Página /chat. Usa os handlers MSW de chat (completos): /chat/ask cria a
 * sessão na primeira pergunta e devolve a resposta do assistente; a sidebar é
 * recarregada após cada resposta.
 *
 * Notas:
 *   - O mock responde com texto determinístico ("Resposta simulada do mock
 *     para: …") e sources: [] — não há cartões de fonte para asserir; isso é
 *     detalhe do backend real, fora do alcance do mock.
 *   - O botão de excluir conversa dispara um window.confirm nativo (tratado
 *     via page.on("dialog")).
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "./helpers";

const ANSWER = /Resposta simulada do mock para/i;

test.beforeEach(async ({ page }) => loginViaStorage(page));

/** Abre o modal, valida o guard (botão desabilitado) e cria a conversa. */
async function newConversation(page: Page, subjectLabel: string) {
  await page.getByRole("button", { name: /nova conversa/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const confirm = page.getByRole("button", { name: /iniciar conversa/i });
  await expect(confirm).toBeDisabled(); // sem matéria selecionada
  await dialog.locator("select").selectOption({ label: subjectLabel });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();
}

async function ask(page: Page, question: string) {
  await page.getByPlaceholder("Pergunte sobre seus documentos…").fill(question);
  await page.getByRole("button", { name: /enviar/i }).click();
}

// ---------------------------------------------------------------------------
// CT16 — Chat com RAG
// ---------------------------------------------------------------------------

test.describe("CT16 — Chat com RAG", () => {
  test("CT16-1: nova conversa retorna resposta e atualiza a sidebar", async ({
    page,
  }) => {
    await page.goto("/chat");
    await expect(
      page.getByRole("heading", { name: /nenhuma conversa selecionada/i })
    ).toBeVisible();

    await newConversation(page, "Cálculo I");
    await expect(page.getByText(/matéria:\s*cálculo i/i)).toBeVisible();

    await ask(page, "O que é uma derivada?");

    // Resposta do assistente aparece...
    await expect(page.getByText(ANSWER)).toBeVisible();
    // ...e a conversa nova aparece na sidebar (título = pergunta).
    await expect(
      page.locator("aside").getByText(/o que é uma derivada\?/i)
    ).toBeVisible();
  });

  test("CT16-2: responde mesmo sem documentos cadastrados", async ({ page }) => {
    await page.goto("/chat");
    await newConversation(page, "Algoritmos");

    await ask(page, "Explique complexidade de tempo.");

    // Sem documentos no mock, ainda assim há resposta (e nenhum erro/toast).
    await expect(page.getByText(ANSWER)).toBeVisible();
    await expect(page.getByText(/falha ao/i)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// CT17 — Continuar Conversa
// ---------------------------------------------------------------------------

test("CT17-1: enviar nova mensagem mantém o histórico da conversa", async ({
  page,
}) => {
  await page.goto("/chat");
  await newConversation(page, "Cálculo I");

  await ask(page, "Primeira pergunta?");
  await expect(page.getByText(/Resposta simulada.*Primeira pergunta/i)).toBeVisible();

  await ask(page, "Segunda pergunta?");
  await expect(page.getByText(/Resposta simulada.*Segunda pergunta/i)).toBeVisible();

  // O histórico preserva ambas as perguntas (bolhas de usuário, aria-label "Pergunta").
  await expect(
    page.getByRole("article", { name: "Pergunta" }).filter({ hasText: "Primeira pergunta?" })
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Pergunta" }).filter({ hasText: "Segunda pergunta?" })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// CT18 — Gerenciar Sessões de Chat
// ---------------------------------------------------------------------------

test.describe("CT18 — Gerenciar Sessões de Chat", () => {
  test("CT18-1: abrir uma conversa carrega o histórico", async ({ page }) => {
    await page.goto("/chat");

    // Cria a 1ª conversa (Algoritmos) e pergunta.
    await newConversation(page, "Algoritmos");
    await ask(page, "Quicksort é estável?");
    await expect(page.getByText(/Resposta simulada.*Quicksort/i)).toBeVisible();

    // Inicia uma 2ª conversa (Cálculo I) — sai do contexto da primeira.
    await newConversation(page, "Cálculo I");
    await expect(page.getByText(/matéria:\s*cálculo i/i)).toBeVisible();

    // Reabre a 1ª conversa pela sidebar → histórico volta.
    await page.locator("aside").getByText(/quicksort é estável\?/i).click();
    await expect(page.getByText(/Resposta simulada.*Quicksort/i)).toBeVisible();
    await expect(page.getByText(/matéria:\s*algoritmos/i)).toBeVisible();
  });

  test("CT18-2: renomear conversa atualiza o título na sidebar", async ({
    page,
  }) => {
    await page.goto("/chat");
    await newConversation(page, "Cálculo I");
    await ask(page, "Título original?");
    await expect(
      page.locator("aside").getByText(/título original\?/i)
    ).toBeVisible();

    // Aciona o renomear (botão revelado no hover do item).
    await page.locator("aside").getByText(/título original\?/i).hover();
    await page.getByRole("button", { name: "Renomear conversa" }).click();

    const renameInput = page.locator("aside").getByRole("textbox");
    await renameInput.fill("Conversa Renomeada");
    await renameInput.press("Enter");

    await expect(
      page.locator("aside").getByText("Conversa Renomeada")
    ).toBeVisible();
  });

  test("CT18-3: excluir conversa remove da sidebar", async ({ page }) => {
    // O excluir usa window.confirm — aceitar automaticamente.
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/chat");
    await newConversation(page, "Cálculo I");
    await ask(page, "Conversa descartável?");
    await expect(
      page.locator("aside").getByText(/conversa descartável\?/i)
    ).toBeVisible();

    await page.locator("aside").getByText(/conversa descartável\?/i).hover();
    await page.getByRole("button", { name: "Excluir conversa" }).click();

    await expect(page.getByText(/conversa excluída/i)).toBeVisible();
    await expect(
      page.locator("aside").getByText(/conversa descartável\?/i)
    ).toBeHidden();
  });
});
