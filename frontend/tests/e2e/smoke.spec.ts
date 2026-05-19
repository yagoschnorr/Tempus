import { test, expect } from "@playwright/test";

test("rota raiz redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
