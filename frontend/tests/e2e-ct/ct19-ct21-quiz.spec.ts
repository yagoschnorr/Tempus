/**
 * CT19 — Gerar Quiz (UC19)
 * CT20 — Responder Quiz (UC20)
 * CT21 — Gerenciar Quizzes (UC21)
 *
 * Página /quiz. Fluxo: setup → "Gerar quiz" (o hook gera e já inicia o quiz)
 * → responder cada pergunta → "Concluir quiz" → tela de Resultado. O histórico
 * ("Quizzes anteriores") aparece no estado de setup (idle).
 *
 * No MSW a resposta correta da pergunta i é a letra (i % 4): a, b, c, d, a…
 * Os testes respondem sempre a alternativa A — a nota exata não importa,
 * apenas que o resultado é calculado e exibido.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "./helpers";

const TOTAL = 5;

test.beforeEach(async ({ page }) => loginViaStorage(page));

/** Preenche o tema e gera o quiz (cai direto no modo de responder). */
async function gerarQuiz(page: Page, tema = "Derivadas e limites") {
  await page.goto("/quiz");
  await expect(page.getByRole("heading", { name: /criar quiz/i })).toBeVisible();

  await page.locator("textarea").fill(tema);
  await page.getByRole("button", { name: /gerar quiz/i }).click();

  await expect(
    page.getByRole("heading", { name: new RegExp(`pergunta 1 de ${TOTAL}`, "i") })
  ).toBeVisible();
}

/** Responde todas as perguntas (alternativa A) e finaliza. */
async function responderTudo(page: Page) {
  for (let i = 0; i < TOTAL; i++) {
    await page
      .getByRole("button", { name: /Alternativa A da pergunta/ })
      .click();
    if (i < TOTAL - 1) {
      await page.getByRole("button", { name: /próxima/i }).click();
    } else {
      await page.getByRole("button", { name: /concluir quiz/i }).click();
    }
  }
  await expect(page.getByRole("heading", { name: /resultado/i })).toBeVisible();
}

// ---------------------------------------------------------------------------
// CT19 — Gerar Quiz
// ---------------------------------------------------------------------------

test.describe("CT19 — Gerar Quiz", () => {
  test("CT19-1: gerar quiz a partir de um tema", async ({ page }) => {
    await gerarQuiz(page, "Integrais por substituição");

    // Está no modo de responder: 1ª pergunta e alternativas visíveis.
    await expect(
      page.getByRole("button", { name: /Alternativa A da pergunta/ })
    ).toBeVisible();
  });

  test("CT19-2: sem tema o botão de gerar fica desabilitado", async ({
    page,
  }) => {
    await page.goto("/quiz");
    await expect(page.getByRole("heading", { name: /criar quiz/i })).toBeVisible();

    // Tema vazio → "Gerar quiz" desabilitado (validação).
    await expect(
      page.getByRole("button", { name: /gerar quiz/i })
    ).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// CT20 — Responder Quiz
// ---------------------------------------------------------------------------

test.describe("CT20 — Responder Quiz", () => {
  test("CT20-1: responder todas e finalizar exibe a nota", async ({ page }) => {
    await gerarQuiz(page);
    await responderTudo(page);

    // Resultado com porcentagem e detalhamento.
    await expect(page.getByText(/% /).or(page.getByText(/corretas/i))).toBeVisible();
    await expect(page.getByText(/corretas/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /novo quiz/i })
    ).toBeVisible();
  });

  test("CT20-2: reiniciar (refazer) um quiz concluído", async ({ page }) => {
    await gerarQuiz(page, "Quiz para refazer");
    await responderTudo(page);

    // Volta ao setup; o quiz concluído aparece no histórico.
    await page.getByRole("button", { name: /novo quiz/i }).click();
    await expect(page.getByRole("heading", { name: /criar quiz/i })).toBeVisible();

    const card = page
      .getByRole("listitem")
      .filter({ hasText: /Quiz para refazer/i });
    await expect(card).toBeVisible();

    // Refazer → volta ao modo de responder na 1ª pergunta.
    // Âncora /^Refazer/: o título contém "refazer", então /refazer/ casaria
    // também com o botão "Excluir <título>".
    await card.getByRole("button", { name: /^Refazer/ }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`pergunta 1 de ${TOTAL}`, "i") })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT21 — Gerenciar Quizzes
// ---------------------------------------------------------------------------

test.describe("CT21 — Gerenciar Quizzes", () => {
  test("CT21-1: quiz concluído é listado com status e nota", async ({
    page,
  }) => {
    await gerarQuiz(page, "Quiz no histórico");
    await responderTudo(page);
    await page.getByRole("button", { name: /novo quiz/i }).click();

    const card = page
      .getByRole("listitem")
      .filter({ hasText: /Quiz no histórico/i });
    await expect(card).toBeVisible();
    await expect(card.getByText(/concluído/i)).toBeVisible();
    await expect(card.getByText(/nota:/i)).toBeVisible();
  });

  test("CT21-2: excluir quiz remove do histórico", async ({ page }) => {
    await gerarQuiz(page, "Quiz descartável");
    await responderTudo(page);
    await page.getByRole("button", { name: /novo quiz/i }).click();

    const card = page
      .getByRole("listitem")
      .filter({ hasText: /Quiz descartável/i });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: /excluir/i }).click();
    await expect(
      page.getByRole("heading", { name: /excluir quiz/i })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^excluir$/i })
      .click();

    await expect(page.getByText(/quiz excluído/i)).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: /Quiz descartável/i })
    ).toBeHidden();
  });
});
