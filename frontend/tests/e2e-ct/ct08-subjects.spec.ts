/**
 * CT08 — Gerenciar Matérias (UC08)
 *
 * Cobre o CRUD de matérias na página /subjects:
 *   - CT08-1 criar
 *   - CT08-2 editar
 *   - CT08-3 excluir
 *   - CT08-4 validação ao criar sem nome
 *
 * Seed do MSW: "Cálculo I", "Algoritmos", "Banco de Dados".
 * Os botões de Editar/Excluir de cada card têm aria-label
 * "Editar <nome>" / "Excluir <nome>".
 */
import { test, expect } from "@playwright/test";
import { loginViaStorage } from "./helpers";

test.beforeEach(async ({ page }) => loginViaStorage(page));

test("CT08-1: criar matéria adiciona um card na lista", async ({ page }) => {
  const nome = `Matéria CT08 ${Date.now()}`;

  await page.goto("/subjects");
  await expect(page.getByRole("heading", { name: "Matérias" })).toBeVisible();

  await page.getByRole("button", { name: /nova matéria/i }).click();
  await expect(
    page.getByRole("heading", { name: /nova matéria/i })
  ).toBeVisible();

  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Meta semanal (horas)").fill("4");
  await page.getByRole("button", { name: /criar matéria/i }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  await expect(page.getByText(/matéria criada/i)).toBeVisible();
});

test("CT08-2: editar matéria atualiza o card", async ({ page }) => {
  const novoNome = `Algoritmos Editado ${Date.now()}`;

  await page.goto("/subjects");
  await expect(page.getByRole("heading", { name: "Algoritmos" })).toBeVisible();

  // Revela e aciona o botão de editar do card "Algoritmos".
  await page.getByRole("article").filter({ hasText: "Algoritmos" }).hover();
  await page.getByRole("button", { name: "Editar Algoritmos" }).click();

  await expect(
    page.getByRole("heading", { name: /editar matéria/i })
  ).toBeVisible();
  await expect(page.getByLabel("Nome")).toHaveValue("Algoritmos");

  await page.getByLabel("Nome").fill(novoNome);
  await page.getByRole("button", { name: /salvar alterações/i }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: novoNome })).toBeVisible();
  await expect(page.getByText(/matéria atualizada/i)).toBeVisible();
});

test("CT08-3: excluir matéria remove o card", async ({ page }) => {
  await page.goto("/subjects");
  await expect(
    page.getByRole("heading", { name: "Banco de Dados" })
  ).toBeVisible();

  await page.getByRole("article").filter({ hasText: "Banco de Dados" }).hover();
  await page.getByRole("button", { name: "Excluir Banco de Dados" }).click();

  // Diálogo de confirmação.
  await expect(
    page.getByRole("heading", { name: /excluir matéria/i })
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^excluir$/i })
    .click();

  await expect(page.getByText(/matéria excluída/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Banco de Dados" })
  ).toBeHidden();
});

test("CT08-4: criar sem nome é bloqueado por validação", async ({ page }) => {
  await page.goto("/subjects");
  await page.getByRole("button", { name: /nova matéria/i }).click();

  // Campo "Nome" é `required`: submeter vazio aciona a validação nativa
  // (valueMissing) e o modal permanece aberto.
  await page.getByRole("button", { name: /criar matéria/i }).click();

  const nome = page.getByLabel("Nome");
  expect(
    await nome.evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
  ).toBe(true);
  await expect(page.getByRole("dialog")).toBeVisible();
});
