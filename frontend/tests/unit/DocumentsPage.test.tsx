import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import DocumentsPage from "@/features/documents";

function renderPage() {
  return render(
    <MemoryRouter>
      <DocumentsPage />
    </MemoryRouter>
  );
}

describe("DocumentsPage", () => {
  it("renderiza título e empty state quando não há documentos", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /sua biblioteca/i })
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/nenhum documento ainda/i)).toBeInTheDocument();
  });

  it("renderiza o painel lateral com 'Todas' e as matérias do usuário", async () => {
    renderPage();

    // useSubjects carrega async — usar findByText pra esperar.
    expect(await screen.findByText(/^Todas$/)).toBeInTheDocument();
    // Cada <li> tem o nome + um <span> filho com o count, então getByText
    // exato não casa: uso regex parcial.
    expect(await screen.findByText(/Cálculo I/)).toBeInTheDocument();
    expect(await screen.findByText(/Algoritmos/)).toBeInTheDocument();
  });

  it("abre o UploadDocumentModal ao clicar em 'Adicionar documento'", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/nenhum documento ainda/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /adicionar documento/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/adicionar documento|upload/i)).toBeInTheDocument();
  });

  it("muda a ordenação ao trocar o select de sort", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/nenhum documento ainda/i)).toBeInTheDocument()
    );

    const sortSelect = screen.getByRole("combobox");
    await user.selectOptions(sortSelect, "alpha");
    expect((sortSelect as HTMLSelectElement).value).toBe("alpha");
  });
});
