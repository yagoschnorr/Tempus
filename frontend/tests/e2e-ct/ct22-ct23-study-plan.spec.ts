/**
 * CT22 — Gerar Plano de Estudos com IA (UC22)
 * CT23 — Gerenciar Planos de Estudo (UC23)
 *
 * Página /study-plan. O modal "Criar plano de estudos" coleta título, data da
 * prova (opcional), horas/dia e matérias com prioridade. O MSW gera o plano
 * com status "active"; ele aparece em "Planos ativos".
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => loginViaStorage(page));

/** Abre o modal, preenche o mínimo (título + 1 matéria) e gera o plano. */
async function gerarPlano(page: Page, titulo: string) {
  await page.goto("/study-plan");
  await page.getByRole("button", { name: /criar plano/i }).click();
  await expect(
    page.getByRole("heading", { name: /criar plano de estudos/i })
  ).toBeVisible();

  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Matéria 1").selectOption({ label: "Cálculo I" });
  await page.getByLabel("Prioridade 1").selectOption("high");
  await page.getByRole("button", { name: /gerar plano/i }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
}

// ---------------------------------------------------------------------------
// CT22 — Gerar Plano de Estudos
// ---------------------------------------------------------------------------

test.describe("CT22 — Gerar Plano de Estudos", () => {
  test("CT22-1: gerar plano cria um card em 'Planos ativos'", async ({
    page,
  }) => {
    const titulo = `Plano CT22 ${Date.now()}`;
    await gerarPlano(page, titulo);

    const card = page.getByRole("article").filter({ hasText: titulo });
    await expect(card).toBeVisible();
    await expect(card.getByText("Ativo", { exact: true })).toBeVisible();
  });

  test("CT22-2: sem matéria selecionada exibe erro de validação", async ({
    page,
  }) => {
    await page.goto("/study-plan");
    await page.getByRole("button", { name: /criar plano/i }).click();

    await page.getByLabel("Título").fill("Plano sem matéria");
    // Nenhuma matéria selecionada na linha 1.
    await page.getByRole("button", { name: /gerar plano/i }).click();

    await expect(
      page.getByText(/selecione pelo menos uma matéria/i)
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT23 — Gerenciar Planos de Estudo
// ---------------------------------------------------------------------------

test.describe("CT23 — Gerenciar Planos de Estudo", () => {
  test("CT23-1: abrir um plano exibe o conteúdo gerado", async ({ page }) => {
    const titulo = `Plano CT23 ${Date.now()}`;
    await gerarPlano(page, titulo);

    await page
      .getByRole("button", { name: `Ver detalhes de ${titulo}` })
      .click();

    // Diálogo de conteúdo com o plano em markdown.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/divisão de matérias sugerida/i)
    ).toBeVisible();
  });

  test("CT23-2: concluir um plano atualiza o status", async ({ page }) => {
    const titulo = `Plano para concluir ${Date.now()}`;
    await gerarPlano(page, titulo);

    const card = page.getByRole("article").filter({ hasText: titulo });
    // Nome exato: o título contém "concluir", que casaria com "Ver detalhes de…".
    await card.getByRole("button", { name: "Concluir", exact: true }).click();

    // Confirmação.
    await expect(
      page.getByRole("heading", { name: /marcar como concluído/i })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /concluir/i })
      .click();

    await expect(
      page.getByText(/plano marcado como concluído/i)
    ).toBeVisible();
    // Passa para "Planos anteriores" com status "Concluído".
    await expect(page.getByText(/planos anteriores/i)).toBeVisible();
    await expect(page.getByText("Concluído", { exact: true })).toBeVisible();
  });
});
