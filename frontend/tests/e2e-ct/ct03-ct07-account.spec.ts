/**
 * CT03 — Visualizar Perfil (UC03)
 * CT04 — Atualizar Dados do Perfil (UC04)
 * CT05 — Alterar Senha (UC05)
 * CT06 — Alterar E-mail com Confirmação (UC06)
 * CT07 — Excluir Conta (UC07)
 *
 * O modal "Minha conta" (ProfileModal) é aberto pelo botão de perfil na
 * sidebar (title="Editar perfil") e tem as abas Perfil / Senha / Excluir conta.
 *
 * Notas de infraestrutura:
 *   - A senha "atual" no mock MSW é "senha-de-teste" (vide handlers.ts).
 *   - Os endpoints de troca de e-mail (/auth/me/email/change-request e
 *     /auth/email/confirm) NÃO têm handler MSW. Por isso os cenários de CT06
 *     usam page.route com o service worker bloqueado.
 */
import { test, expect } from "@playwright/test";
import { loginViaStorage, jsonResponse } from "./helpers";

async function openAccountModal(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.getByTitle("Editar perfil").click();
  // O Modal não define aria-label no dialog; identificamos pelo título (heading).
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /minha conta/i })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// CT03 — Visualizar Perfil
// ---------------------------------------------------------------------------

test.describe("CT03 — Visualizar Perfil", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT03-1: exibe nome e e-mail do usuário autenticado", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // A sidebar mostra nome + e-mail do usuário logado.
    await expect(page.getByText("Yago", { exact: true })).toBeVisible();
    await expect(page.getByText("yago@tempus.dev")).toBeVisible();

    // E o modal de conta carrega o nome atual no campo editável.
    await page.getByTitle("Editar perfil").click();
    await expect(page.getByLabel("Nome")).toHaveValue("Yago");
  });
});

// ---------------------------------------------------------------------------
// CT04 — Atualizar Dados do Perfil
// ---------------------------------------------------------------------------

test.describe("CT04 — Atualizar Dados do Perfil", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT04-1: atualização de nome bem-sucedida", async ({ page }) => {
    await openAccountModal(page);

    await page.getByLabel("Nome").fill("Yago Atualizado");
    await page.getByRole("button", { name: /salvar alterações/i }).click();

    await expect(page.getByText(/perfil atualizado/i)).toBeVisible();
  });

  test("CT04-2: nome vazio é bloqueado por validação", async ({ page }) => {
    await openAccountModal(page);

    const nome = page.getByLabel("Nome");
    await nome.fill("");
    await page.getByRole("button", { name: /salvar alterações/i }).click();

    // O campo é `required`: a validação nativa bloqueia o envio (valueMissing)
    // e nenhum toast de sucesso é exibido.
    expect(
      await nome.evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
    ).toBe(true);
    await expect(page.getByText(/perfil atualizado/i)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// CT05 — Alterar Senha
// ---------------------------------------------------------------------------

test.describe("CT05 — Alterar Senha", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT05-1: troca de senha bem-sucedida", async ({ page }) => {
    await openAccountModal(page);
    await page.getByRole("button", { name: "Senha", exact: true }).click();

    await page.getByLabel("Senha atual").fill("senha-de-teste");
    await page.getByLabel(/^Nova senha/).fill("nova-senha-123");
    await page.getByLabel("Confirmar nova senha").fill("nova-senha-123");
    await page.getByRole("button", { name: /alterar senha/i }).click();

    await expect(page.getByText(/senha alterada/i)).toBeVisible();
  });

  test("CT05-2: senha atual incorreta é rejeitada pelo servidor", async ({
    page,
  }) => {
    await openAccountModal(page);
    await page.getByRole("button", { name: "Senha", exact: true }).click();

    await page.getByLabel("Senha atual").fill("senha-errada");
    await page.getByLabel(/^Nova senha/).fill("nova-senha-123");
    await page.getByLabel("Confirmar nova senha").fill("nova-senha-123");
    await page.getByRole("button", { name: /alterar senha/i }).click();

    await expect(page.getByText(/senha atual incorreta/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT06 — Alterar E-mail com Confirmação
// ---------------------------------------------------------------------------

test.describe("CT06 — Alterar E-mail com Confirmação", () => {
  // Endpoints de e-mail sem handler MSW → page.route + SW bloqueado.
  test.use({ serviceWorkers: "block" });
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT06-1: solicitação de troca de e-mail dispara o envio do link", async ({
    page,
  }) => {
    // Dashboard precisa de uma resposta (SW bloqueado desliga o MSW).
    await page.route("**/api/dashboard/realtime", (route) =>
      jsonResponse(route, {
        minutes_today: 0,
        minutes_week: 0,
        sessions_today: 0,
        sessions_week: 0,
        current_streak: 0,
        avg_quiz_score_week: null,
      })
    );
    await page.route("**/api/auth/me/email/change-request", (route) =>
      route.fulfill({ status: 204 })
    );

    await openAccountModal(page);
    await page.getByRole("button", { name: /trocar email/i }).click();

    await page.getByLabel("Novo email").fill("novo@tempus.dev");
    await page.getByLabel("Senha atual").fill("senha-de-teste");
    await page.getByRole("button", { name: /enviar verificação/i }).click();

    await expect(page.getByText(/enviamos um link de confirmação/i)).toBeVisible();
  });

  test("CT06-2: confirmação com token válido efetiva a troca", async ({
    page,
  }) => {
    await page.route("**/api/auth/email/confirm", (route) =>
      route.fulfill({ status: 204 })
    );

    await page.goto("/auth/email/confirm?token=token-valido");

    await expect(page.getByText(/email alterado/i)).toBeVisible();
    // Redireciona para o login após o sucesso.
    await expect(page).toHaveURL(/\/login/);
  });

  test("CT06-3: token inválido/expirado exibe erro", async ({ page }) => {
    await page.route("**/api/auth/email/confirm", (route) =>
      jsonResponse(route, { detail: "Link inválido ou expirado" }, 400)
    );

    await page.goto("/auth/email/confirm?token=token-invalido");

    await expect(page.getByText(/não foi possível confirmar/i)).toBeVisible();
  });

  test("CT06-3b: link sem token mostra 'Link inválido'", async ({ page }) => {
    await page.goto("/auth/email/confirm");
    await expect(
      page.getByRole("heading", { name: /link inválido/i })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// CT07 — Excluir Conta
// ---------------------------------------------------------------------------

test.describe("CT07 — Excluir Conta", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT07-1: exclusão bem-sucedida encerra a sessão", async ({ page }) => {
    await openAccountModal(page);
    await page.getByRole("button", { name: /excluir conta/i }).click();

    await page.getByLabel("Confirme sua senha").fill("senha-de-teste");
    await page.getByLabel(/digite "excluir"/i).fill("EXCLUIR");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /excluir minha conta/i }).click();

    // logout() → RequireAuth redireciona para /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("CT07-2: cancelar mantém a conta e a sessão ativa", async ({ page }) => {
    await openAccountModal(page);
    await page.getByRole("button", { name: /excluir conta/i }).click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /cancelar/i })
      .click();

    // Modal fecha e o usuário continua autenticado no dashboard.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: /matérias/i })).toBeVisible();
  });
});
