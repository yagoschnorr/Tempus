import type { Page, Route } from "@playwright/test";

/**
 * Injeta uma sessão "logada" no localStorage antes da página carregar,
 * pulando a tela de login. Usado pelos CTs cuja pré-condição é "usuário
 * autenticado" (espelha tests/e2e/helpers.ts).
 */
export async function loginViaStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tempus.auth",
      JSON.stringify({
        user: {
          id: "u-1",
          name: "Yago",
          email: "yago@tempus.dev",
          timezone: "America/Belem",
          created_at: new Date().toISOString(),
        },
        token: "fake-token",
      })
    );
  });
}

/** Resposta JSON utilitária para handlers de page.route. */
export function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
