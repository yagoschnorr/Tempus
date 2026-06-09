/**
 * CT01 — Cadastro de Usuário (UC01)
 * CT02 — Login (UC02)
 *
 * Cobre os cenários de cadastro e autenticação descritos em
 * docs/casos-de-teste.md.
 *
 * Notas de infraestrutura:
 *   - Em E2E o MSW intercepta /api e o handler de /auth/register SEMPRE
 *     responde sucesso. Por isso CT01-2 (e-mail duplicado) usa page.route
 *     com o service worker bloqueado para simular o 409 do backend.
 *   - CT01-3 e parte do CT02 validam regras de cliente (sem rede).
 */
import { test, expect } from "@playwright/test";
import { jsonResponse } from "./helpers";

// ---------------------------------------------------------------------------
// CT01 — Cadastro de Usuário
// ---------------------------------------------------------------------------

test.describe("CT01 — Cadastro de Usuário", () => {
  test("CT01-1: cadastro bem-sucedido redireciona ao dashboard", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByLabel("Nome completo").fill("Maria Estudante");
    await page.getByLabel("Email").fill(`maria.${Date.now()}@tempus.dev`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: /criar minha conta/i }).click();

    // Autenticado → dashboard com a navegação autenticada visível.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
  });

  test("CT01-3: senhas divergentes bloqueiam o envio (validação)", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByLabel("Nome completo").fill("Maria Estudante");
    await page.getByLabel("Email").fill("maria@tempus.dev");
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("outra-senha-456");
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: /criar minha conta/i }).click();

    await expect(page.getByText(/senhas não conferem/i)).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test("CT01-3b: sem aceitar os termos o envio é bloqueado (validação)", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByLabel("Nome completo").fill("Maria Estudante");
    await page.getByLabel("Email").fill("maria@tempus.dev");
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    // checkbox de termos NÃO marcado

    await page.getByRole("button", { name: /criar minha conta/i }).click();

    await expect(page.getByText(/aceitar os termos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  // CT01-2 — e-mail já cadastrado. O backend responde 409; como o handler MSW
  // sempre retorna sucesso, simulamos a resposta via page.route. Bloquear o
  // service worker garante que page.route seja o único interceptador.
  test.describe("CT01-2 — e-mail já cadastrado", () => {
    test.use({ serviceWorkers: "block" });

    test("exibe erro e mantém o usuário na tela de cadastro", async ({
      page,
    }) => {
      await page.route("**/api/auth/register", (route) =>
        jsonResponse(route, { detail: "e-mail já cadastrado" }, 409)
      );

      await page.goto("/register");
      await page.getByLabel("Nome completo").fill("Maria Estudante");
      await page.getByLabel("Email").fill("existente@tempus.dev");
      await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
      await page.getByLabel("Confirmar senha").fill("senha-forte-123");
      await page.getByRole("checkbox").check();

      await page.getByRole("button", { name: /criar minha conta/i }).click();

      await expect(page.getByText(/e-mail já cadastrado/i)).toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });
  });
});

// ---------------------------------------------------------------------------
// CT02 — Login
// ---------------------------------------------------------------------------

test.describe("CT02 — Login", () => {
  test("CT02-1: login bem-sucedido redireciona ao dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("yago@tempus.dev");
    await page.getByLabel("Senha").fill("senha-de-teste");
    await page.getByRole("button", { name: /entrar no tempus/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
  });

  test("CT02-3: a sessão persiste após recarregar a página", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("yago@tempus.dev");
    await page.getByLabel("Senha").fill("senha-de-teste");
    await page.getByRole("button", { name: /entrar no tempus/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.reload();

    // Continua autenticado: não volta para /login e mantém a navegação.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
  });

  // CT02-2 — credenciais inválidas. O handler MSW de login sempre responde
  // sucesso; simulamos o 401 do backend via page.route.
  test.describe("CT02-2 — credenciais inválidas", () => {
    test.use({ serviceWorkers: "block" });

    test("exibe erro de autenticação e permanece em /login", async ({
      page,
    }) => {
      await page.route("**/api/auth/login", (route) =>
        jsonResponse(route, { detail: "Credenciais inválidas" }, 401)
      );

      await page.goto("/login");
      await page.getByLabel("Email").fill("yago@tempus.dev");
      await page.getByLabel("Senha").fill("senha-errada");
      await page.getByRole("button", { name: /entrar no tempus/i }).click();

      await expect(page.getByText(/credenciais inválidas/i)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
