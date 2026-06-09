/**
 * CT14 — Upload e Processamento de Documento (UC14)
 * CT15 — Gerenciar Documentos (UC15)
 *
 * Página /documents. O modal "Adicionar documento" recebe um PDF via input
 * file; o MSW cria o doc em "processing" e o transita para "ready" no GET
 * seguinte (polling do useDocuments a cada 3s).
 *
 * Notas de infraestrutura:
 *   - O arquivo é enviado via setInputFiles com um buffer em memória (sem
 *     fixture em disco). O MSW só usa name/size/type do File.
 *   - O MSW nunca produz status "failed"; CT14-3 simula a falha com page.route
 *     (service worker bloqueado).
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaStorage, jsonResponse } from "./helpers";

/** Sobe o modal de upload e envia um PDF em memória com o nome dado. */
async function uploadPdf(page: Page, filename: string) {
  await page.getByRole("button", { name: /adicionar documento/i }).click();
  await expect(
    page.getByRole("heading", { name: /adicionar documento/i })
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% conteúdo de teste\n"),
  });
  await page.getByRole("button", { name: /^enviar$/i }).click();
}

// ---------------------------------------------------------------------------
// CT14 — Upload e Processamento
// ---------------------------------------------------------------------------

test.describe("CT14 — Upload e Processamento de Documento", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT14-1: upload de PDF aparece e fica 'pronto' após processar", async ({
    page,
  }) => {
    const filename = `apostila-${Date.now()}.pdf`;

    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { name: /sua biblioteca/i })
    ).toBeVisible();

    await uploadPdf(page, filename);

    // Modal fecha e o documento aparece na lista.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(filename)).toBeVisible();

    // Status inicial "processando" → vira "pronto" após o polling (3s) + tick MSW.
    await expect(
      page.getByText("pronto", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CT14-2: enviar sem arquivo é bloqueado por validação", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /adicionar documento/i }).click();
    await page.getByRole("button", { name: /^enviar$/i }).click();

    await expect(page.getByText(/selecione um arquivo pdf/i)).toBeVisible();
  });

  test("CT14-2b: arquivo não-PDF é rejeitado", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /adicionar documento/i }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: "anotacoes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("texto qualquer"),
    });
    await page.getByRole("button", { name: /^enviar$/i }).click();

    await expect(page.getByText(/apenas arquivos pdf são aceitos/i)).toBeVisible();
  });

  // CT14-3 — falha no processamento. O MSW só produz ready; simulamos o backend
  // respondendo um documento "failed" via page.route (SW bloqueado).
  test.describe("CT14-3 — falha no processamento", () => {
    test.use({ serviceWorkers: "block" });

    test("documento com falha aparece com status 'falhou'", async ({ page }) => {
      const failedDoc = {
        id: "doc-failed-1",
        user_id: "u-1",
        subject_id: null,
        filename: "corrompido.pdf",
        file_size_bytes: 1234,
        mime_type: "application/pdf",
        total_pages: null,
        total_chunks: 0,
        status: "failed",
        error_message: "Não foi possível extrair o texto",
        uploaded_at: new Date().toISOString(),
        processed_at: null,
      };

      await page.route("**/api/subjects", (route) => jsonResponse(route, []));
      // Lista inicial vazia; após o upload, devolve o doc com falha.
      let uploaded = false;
      await page.route("**/api/documents", (route, request) => {
        if (request.method() === "POST") {
          uploaded = true;
          return jsonResponse(route, failedDoc, 201);
        }
        return jsonResponse(route, uploaded ? [failedDoc] : []);
      });

      await page.goto("/documents");
      await uploadPdf(page, "corrompido.pdf");

      await expect(page.getByText("falhou", { exact: true })).toBeVisible();
      await expect(page.getByText("corrompido.pdf")).toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// CT15 — Gerenciar Documentos
// ---------------------------------------------------------------------------

test.describe("CT15 — Gerenciar Documentos", () => {
  test.beforeEach(async ({ page }) => loginViaStorage(page));

  test("CT15-1: documento enviado é listado com status", async ({ page }) => {
    const filename = `material-${Date.now()}.pdf`;

    await page.goto("/documents");
    // Sem documentos: estado vazio.
    await expect(page.getByText(/nenhum documento ainda/i)).toBeVisible();

    await uploadPdf(page, filename);

    const item = page.getByRole("article").filter({ hasText: filename });
    await expect(item).toBeVisible();
    // Possui um pill de status (processando ou pronto).
    await expect(item.getByText(/processando|pronto/)).toBeVisible();
  });

  test("CT15-2: excluir documento remove da lista", async ({ page }) => {
    const filename = `descartavel-${Date.now()}.pdf`;

    await page.goto("/documents");
    await uploadPdf(page, filename);
    await expect(page.getByText(filename)).toBeVisible();

    await page.getByRole("button", { name: `Excluir ${filename}` }).click();
    await expect(
      page.getByRole("heading", { name: /excluir documento/i })
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^excluir$/i })
      .click();

    await expect(page.getByText(/documento excluído/i)).toBeVisible();
    await expect(page.getByText(filename)).toBeHidden();
  });
});
