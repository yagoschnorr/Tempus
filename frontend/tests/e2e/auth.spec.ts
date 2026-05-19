import { test, expect } from "@playwright/test";

test("login redireciona para o dashboard e exibe a sidebar autenticada", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("yago@tempus.dev");
  await page.getByLabel("Senha").fill("qualquer-senha");
  await page.getByRole("button", { name: /entrar no tempus/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  // Item de navegação só aparece após auth
  await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
});
