import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import NotebookDetailPage from "@/features/notebooks/detail";
import { notebooksApi } from "@/features/notebooks/api";

function renderWithRoute(notebookId: string) {
  return render(
    <MemoryRouter initialEntries={[`/notebooks/${notebookId}`]}>
      <Routes>
        <Route path="/notebooks/:id" element={<NotebookDetailPage />} />
        <Route path="/notebooks" element={<div>Lista de cadernos</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NotebookDetailPage", () => {
  it("mostra erro quando notebook não existe", async () => {
    renderWithRoute("nb-inexistente");
    await waitFor(() =>
      expect(screen.getByText(/caderno não encontrado/i)).toBeInTheDocument()
    );
  });

  it("renderiza header com título e botão 'Nova folha'", async () => {
    const nb = await notebooksApi.create({ title: "Cálculo I" });
    renderWithRoute(nb.id);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Cálculo I" })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /nova folha/i })).toBeInTheDocument();
  });

  it("empty state quando notebook não tem folhas", async () => {
    const nb = await notebooksApi.create({ title: "Vazio" });
    renderWithRoute(nb.id);

    await waitFor(() =>
      expect(screen.getByText(/nenhuma folha ainda/i)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/crie sua primeira folha para começar/i)
    ).toBeInTheDocument();
  });

  it("seleciona automaticamente a primeira folha e mostra no editor", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    await notebooksApi.createNote(nb.id, {
      title: "Folha Auto",
      content: "Conteúdo inicial",
    });

    renderWithRoute(nb.id);

    // O título no editor é um input com value, não um text node
    await waitFor(() =>
      expect(screen.getByLabelText(/título da folha/i)).toHaveValue("Folha Auto")
    );
    expect(screen.getByLabelText(/conteúdo da folha/i)).toHaveValue(
      "Conteúdo inicial"
    );
  });

  it("criar folha via modal anexa à sidebar e seleciona", async () => {
    const user = userEvent.setup();
    const nb = await notebooksApi.create({ title: "Caderno" });

    renderWithRoute(nb.id);

    await waitFor(() =>
      expect(screen.getByText(/nenhuma folha ainda/i)).toBeInTheDocument()
    );

    // O botão "Nova folha" no header pode aparecer junto com o "Criar" do empty
    // state — escolho o do header (com o texto exato).
    await user.click(screen.getByRole("button", { name: /^nova folha$/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/título/i), "Aula 1");
    await user.click(within(dialog).getByRole("button", { name: /criar folha/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/título da folha/i)).toHaveValue("Aula 1")
    );
  });

  it("botão Salvar fica desabilitado sem alterações e habilita ao editar", async () => {
    const user = userEvent.setup();
    const nb = await notebooksApi.create({ title: "Caderno" });
    await notebooksApi.createNote(nb.id, { title: "Folha", content: "x" });

    renderWithRoute(nb.id);
    await waitFor(() =>
      expect(screen.getByLabelText(/título da folha/i)).toHaveValue("Folha")
    );

    const saveBtn = screen.getByRole("button", { name: /^salvar$/i });
    expect(saveBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/conteúdo da folha/i), " mais");
    expect(saveBtn).toBeEnabled();
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument();
  });

  it("Resumir com IA abre modal com summary", async () => {
    const user = userEvent.setup();
    const nb = await notebooksApi.create({ title: "Caderno" });
    await notebooksApi.createNote(nb.id, {
      title: "Folha",
      content: "Texto suficiente para resumir",
    });

    renderWithRoute(nb.id);
    await waitFor(() =>
      expect(screen.getByLabelText(/título da folha/i)).toHaveValue("Folha")
    );

    await user.click(screen.getByRole("button", { name: /resumir com ia/i }));

    await waitFor(() =>
      expect(screen.getByText(/resumo simulado/i)).toBeInTheDocument()
    );
  });
});
