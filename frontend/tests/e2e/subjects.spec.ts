import { test, expect } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginViaStorage(page);
});

test("cria uma matéria nova e ela aparece na lista", async ({ page }) => {
  // Nome único pra não colidir com outros testes na mesma sessão MSW.
  const nome = `Matéria E2E ${Date.now()}`;

  await page.goto("/subjects");
  await expect(page.getByRole("heading", { name: "Matérias" })).toBeVisible();

  await page.getByRole("button", { name: /nova matéria/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Meta semanal (horas)").fill("4");
  await page.getByRole("button", { name: /criar matéria/i }).click();

  // Modal fecha + card aparece + toast aparece
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  await expect(page.getByText(/matéria criada/i)).toBeVisible();
});

test("mostra erro quando o nome é duplicado", async ({ page }) => {
  await page.goto("/subjects");
  await page.getByRole("button", { name: /nova matéria/i }).click();

  // "Cálculo I" já existe no seed do MSW
  await page.getByLabel("Nome").fill("Cálculo I");
  await page.getByRole("button", { name: /criar matéria/i }).click();

  await expect(page.getByText(/já existe matéria com esse nome/i)).toBeVisible();
});
