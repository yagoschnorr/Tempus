/**
 * CT09 — Iniciar Sessão de Foco (UC09)
 * CT10 — Pausar e Retomar Sessão (UC10)
 * CT11 — Concluir Sessão de Foco (UC11)
 * CT12 — Abandonar Sessão de Foco (UC12)
 * CT13 — Consultar Histórico de Sessões (UC13)  → ver nota ao final
 *
 * Tudo acontece na página /timer, que reflete a máquina de estados do timer
 * (idle → running ↔ paused → completed/abandoned) via títulos:
 *   "Pronta pra começar" / "Sessão em andamento" / "Sessão pausada" /
 *   "Sessão concluída" / "Sessão abandonada".
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => loginViaStorage(page));

/** Configura o setup mínimo (matéria + foco curto) e inicia a sessão. */
async function startSession(page: Page, opts: { subject?: string } = {}) {
  await page.goto("/timer");
  await expect(
    page.getByRole("heading", { name: /pronta pra começar/i })
  ).toBeVisible();

  if (opts.subject) {
    await page.locator("select").first().selectOption({ label: opts.subject });
  }
  // Foco curto só para deixar o teste determinístico (não chega a zerar).
  await page.getByRole("spinbutton").fill("10");

  await page.getByRole("button", { name: /iniciar sessão/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão em andamento/i })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// CT09 — Iniciar Sessão de Foco
// ---------------------------------------------------------------------------

test("CT09-1: iniciar sessão vinculada a uma matéria", async ({ page }) => {
  await startSession(page, { subject: "Cálculo I" });

  // O resumo lateral exibe a matéria escolhida.
  await expect(page.getByText(/cálculo i/i).first()).toBeVisible();
  // Os controles de sessão ativa aparecem.
  await expect(page.getByRole("button", { name: /^pausar$/i })).toBeVisible();
});

test("CT09-2: iniciar sessão sem matéria", async ({ page }) => {
  await startSession(page); // sem selecionar matéria

  await expect(
    page.getByRole("heading", { name: /sessão em andamento/i })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /concluir/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// CT10 — Pausar e Retomar
// ---------------------------------------------------------------------------

test("CT10-1: pausar e retomar a sessão", async ({ page }) => {
  await startSession(page, { subject: "Cálculo I" });

  await page.getByRole("button", { name: /^pausar$/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão pausada/i })
  ).toBeVisible();

  await page.getByRole("button", { name: /retomar/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão em andamento/i })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// CT11 — Concluir Sessão
// ---------------------------------------------------------------------------

test("CT11-1: concluir a sessão", async ({ page }) => {
  await startSession(page, { subject: "Cálculo I" });

  await page.getByRole("button", { name: /concluir/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão concluída/i })
  ).toBeVisible();
  // Após finalizar, o botão de nova sessão fica disponível.
  await expect(page.getByRole("button", { name: /nova sessão/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// CT12 — Abandonar Sessão
// ---------------------------------------------------------------------------

test("CT12-1: abandonar a sessão", async ({ page }) => {
  await startSession(page, { subject: "Cálculo I" });

  await page.getByRole("button", { name: /abandonar/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão abandonada/i })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /nova sessão/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// CT13 — Consultar Histórico de Sessões
// ---------------------------------------------------------------------------

// Não há tela de histórico de sessões na aplicação atual: GET /api/sessions é
// consumido apenas para HIDRATAR a sessão ativa no useTimer, não para listar
// sessões passadas. Sem UI correspondente, o CT13 não é testável via E2E hoje.
// Mantido como skip para preservar a rastreabilidade com docs/casos-de-teste.md.
test.skip("CT13-1: listar histórico de sessões (sem UI implementada)", () => {});
