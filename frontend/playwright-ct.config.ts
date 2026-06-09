import { defineConfig, devices } from "@playwright/test";

/**
 * Config dedicada aos testes E2E derivados dos Casos de Teste (docs/casos-de-teste.md).
 * Mantém a suíte CT isolada da suíte E2E original (tests/e2e).
 *
 * Rodar:  npx playwright test -c playwright-ct.config.ts
 */
export default defineConfig({
  testDir: "./tests/e2e-ct",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Liga MSW e desativa passthroughs — E2E não precisa do backend real.
      VITE_USE_MOCKS: "true",
      VITE_E2E: "true",
    },
  },
});
