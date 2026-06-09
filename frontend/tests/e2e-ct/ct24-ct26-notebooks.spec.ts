/**
 * CT24 — Gerenciar Cadernos (UC24)
 * CT25 — Gerenciar Anotações/Folhas (UC25)
 * CT26 — Resumir Anotação com IA (UC26)
 *
 * Páginas /notebooks e /notebooks/:id. Como o detalhe carrega o caderno via
 * GET /notebooks (lista) e o estado do MSW é por sessão de página, os testes
 * de folhas CRIAM o caderno e o abrem por navegação SPA (clique no card),
 * preservando o estado em memória.
 *
 * Para o resumo (CT26) o conteúdo precisa estar salvo no servidor — o handler
 * MSW recusa resumir folha vazia (422). Por isso salvamos antes de resumir.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => loginViaStorage(page));

/** Cria um caderno na página /notebooks. */
async function criarCaderno(page: Page, titulo: string) {
  await page.goto("/notebooks");
  await page.getByRole("button", { name: /novo caderno/i }).click();
  await expect(
    page.getByRole("heading", { name: /novo caderno/i })
  ).toBeVisible();

  await page.getByRole("dialog").getByLabel("Título").fill(titulo);
  await page.getByRole("button", { name: /criar caderno/i }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/caderno criado/i)).toBeVisible();
}

/** Cria o caderno e o abre (navegação SPA preserva o estado do MSW). */
async function abrirCaderno(page: Page, titulo: string) {
  await criarCaderno(page, titulo);
  await page.getByText(titulo).click();
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  await expect(page.getByRole("button", { name: /nova folha/i })).toBeVisible();
}

/** Cria uma folha dentro do caderno aberto. */
async function criarFolha(page: Page, titulo: string) {
  await page.getByRole("button", { name: /nova folha/i }).click();
  await expect(page.getByRole("heading", { name: /nova folha/i })).toBeVisible();
  await page.getByRole("dialog").getByLabel("Título").fill(titulo);
  await page.getByRole("button", { name: /criar folha/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(/folha criada/i)).toBeVisible();
}

// ---------------------------------------------------------------------------
// CT24 — Gerenciar Cadernos
// ---------------------------------------------------------------------------

test.describe("CT24 — Gerenciar Cadernos", () => {
  test("CT24-1: criar caderno", async ({ page }) => {
    const titulo = `Caderno CT24 ${Date.now()}`;
    await criarCaderno(page, titulo);
    await expect(page.getByText(titulo)).toBeVisible();
  });

  test("CT24-2: renomear (editar) caderno", async ({ page }) => {
    const titulo = `Caderno Original ${Date.now()}`;
    const novoTitulo = `Caderno Renomeado ${Date.now()}`;
    await criarCaderno(page, titulo);

    const row = page.getByRole("article").filter({ hasText: titulo });
    await row.hover();
    await page.getByRole("button", { name: `Editar ${titulo}` }).click();

    await expect(
      page.getByRole("heading", { name: /editar caderno/i })
    ).toBeVisible();
    await page.getByRole("dialog").getByLabel("Título").fill(novoTitulo);
    await page.getByRole("button", { name: /salvar alterações/i }).click();

    await expect(page.getByText(/caderno atualizado/i)).toBeVisible();
    await expect(page.getByText(novoTitulo)).toBeVisible();
  });

  test("CT24-3: excluir caderno", async ({ page }) => {
    const titulo = `Caderno Descartável ${Date.now()}`;
    await criarCaderno(page, titulo);

    const row = page.getByRole("article").filter({ hasText: titulo });
    await row.hover();
    await page.getByRole("button", { name: `Excluir ${titulo}` }).click();

    await expect(
      page.getByRole("heading", { name: /excluir caderno/i })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^excluir$/i })
      .click();

    await expect(page.getByText(/caderno excluído/i)).toBeVisible();
    await expect(page.getByText(titulo)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// CT25 — Gerenciar Anotações (Folhas)
// ---------------------------------------------------------------------------

test.describe("CT25 — Gerenciar Anotações", () => {
  test("CT25-1: criar folha no caderno", async ({ page }) => {
    await abrirCaderno(page, `Caderno notas ${Date.now()}`);
    await criarFolha(page, "Aula 1 — limites");

    // A folha aparece na sidebar e abre no editor.
    await expect(
      page.getByLabel("Título da folha")
    ).toHaveValue("Aula 1 — limites");
  });

  test("CT25-2: editar conteúdo da folha e salvar", async ({ page }) => {
    await abrirCaderno(page, `Caderno edição ${Date.now()}`);
    await criarFolha(page, "Folha editável");

    await page
      .getByLabel("Conteúdo da folha")
      .fill("Anotações sobre derivadas e regra da cadeia.");
    await page.getByRole("button", { name: /^salvar$/i }).click();

    await expect(page.getByText(/folha salva/i)).toBeVisible();
  });

  test("CT25-3: excluir folha", async ({ page }) => {
    await abrirCaderno(page, `Caderno exclusão ${Date.now()}`);
    await criarFolha(page, "Folha descartável");

    await page.getByRole("button", { name: /excluir folha/i }).click();
    await expect(
      page.getByRole("heading", { name: /excluir folha/i })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^excluir$/i })
      .click();

    await expect(page.getByText(/folha excluída/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT26 — Resumir Anotação com IA
// ---------------------------------------------------------------------------

test("CT26-1: resumir folha com IA exibe o resumo", async ({ page }) => {
  await abrirCaderno(page, `Caderno resumo ${Date.now()}`);
  await criarFolha(page, "Folha para resumir");

  // Conteúdo precisa estar salvo no servidor antes de resumir.
  await page
    .getByLabel("Conteúdo da folha")
    .fill("Texto base que a IA deve resumir de forma automática.");
  await page.getByRole("button", { name: /^salvar$/i }).click();
  await expect(page.getByText(/folha salva/i)).toBeVisible();

  await page.getByRole("button", { name: /resumir com ia/i }).click();

  await expect(
    page.getByRole("heading", { name: /resumo da folha/i })
  ).toBeVisible();
  await expect(page.getByText(/resumo simulado/i)).toBeVisible();
});
