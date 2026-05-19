import type { Page } from "@playwright/test";

/**
 * Injeta uma sessão "logada" no localStorage antes do page carregar,
 * pulando a tela de login. Útil em testes que não testam auth em si.
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
          created_at: new Date().toISOString(),
        },
        token: "fake-token",
      })
    );
  });
}
