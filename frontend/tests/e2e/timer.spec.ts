import { test, expect } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginViaStorage(page);
});

test("inicia, pausa, retoma e conclui uma sessão", async ({ page }) => {
  await page.goto("/timer");
  await expect(page.getByRole("heading", { name: /pronta pra começar/i })).toBeVisible();

  // Setup mínimo: matéria do seed + duração curta.
  await page.locator("select").first().selectOption({ label: "Cálculo I" });
  await page.getByRole("spinbutton").fill("1");

  await page.getByRole("button", { name: /iniciar sessão/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão em andamento/i })
  ).toBeVisible();

  // Pausa
  await page.getByRole("button", { name: /^pausar$/i }).click();
  await expect(page.getByRole("heading", { name: /sessão pausada/i })).toBeVisible();

  // Retoma
  await page.getByRole("button", { name: /retomar/i }).click();
  await expect(
    page.getByRole("heading", { name: /sessão em andamento/i })
  ).toBeVisible();

  // Conclui antes do tempo
  await page.getByRole("button", { name: /concluir/i }).click();
  await expect(page.getByRole("heading", { name: /sessão concluída/i })).toBeVisible();

  // Botão "Nova sessão" aparece
  await expect(page.getByRole("button", { name: /nova sessão/i })).toBeVisible();
});
