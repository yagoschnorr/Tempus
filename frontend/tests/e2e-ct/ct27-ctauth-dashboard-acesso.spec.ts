/**
 * CT27   — Visualizar Dashboard de Progresso (UC27)
 * CT-AUTH — Controle de Acesso a Rotas Protegidas (transversal, RequireAuth)
 *
 * O dashboard (/dashboard) exibe 4 métricas agregadas vindas de
 * GET /dashboard/realtime (seed do MSW com valores não-zero).
 */
import { test, expect } from "@playwright/test";
import { loginViaStorage } from "./helpers";

// ---------------------------------------------------------------------------
// CT27 + CT-AUTH-2 — usuário autenticado
// ---------------------------------------------------------------------------

test.describe("Autenticado", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT27-1: dashboard exibe as métricas de progresso", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/horas na semana/i)).toBeVisible();
    await expect(page.getByText(/sessões hoje/i)).toBeVisible();
    await expect(page.getByText(/sequência/i)).toBeVisible();
    await expect(page.getByText(/média em quizzes/i)).toBeVisible();
  });

  test("CT27-2: a rota raiz redireciona para o dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT-AUTH-2 — logout. Loga via formulário (não usa loginViaStorage, cujo
// addInitScript re-injeta o token a cada navegação e impediria observar o
// bloqueio pós-logout).
// ---------------------------------------------------------------------------

test("CT-AUTH-2: logout encerra a sessão e bloqueia rotas protegidas", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("yago@tempus.dev");
  await page.getByLabel("Senha").fill("senha-de-teste");
  await page.getByRole("button", { name: /entrar no tempus/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByTitle("Sair").click();
  await expect(page).toHaveURL(/\/login/);

  // Rota protegida deixa de ser acessível após o logout.
  await page.goto("/subjects");
  await expect(page).toHaveURL(/\/login/);
});

// ---------------------------------------------------------------------------
// CT-AUTH-1 — sem autenticação (sem loginViaStorage)
// ---------------------------------------------------------------------------

test("CT-AUTH-1: acesso não autenticado a rota protegida vai para /login", async ({
  page,
}) => {
  await page.goto("/subjects");
  await expect(page).toHaveURL(/\/login/);
});
