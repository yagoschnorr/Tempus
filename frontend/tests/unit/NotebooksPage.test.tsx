import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import NotebooksPage from "@/features/notebooks";
import { notebooksApi } from "@/features/notebooks/api";

// Página usa useNavigate() para abrir o detalhe — precisa de Router no contexto.
function renderPage() {
  return render(
    <MemoryRouter>
      <NotebooksPage />
    </MemoryRouter>
  );
}

describe("NotebooksPage", () => {
  it("mostra empty state quando não há cadernos", async () => {
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/você ainda não tem nenhum caderno/i)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /criar o primeiro/i })
    ).toBeInTheDocument();
  });

  it("renderiza a lista de cadernos não-fixados em 'Todos os cadernos'", async () => {
    await notebooksApi.create({ title: "Cálculo" });
    await notebooksApi.create({ title: "POO" });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Todos os cadernos \(2\)/)).toBeInTheDocument()
    );
    expect(screen.getByText("Cálculo")).toBeInTheDocument();
    expect(screen.getByText("POO")).toBeInTheDocument();
  });

  it("separa cadernos fixados em seção 'Fixados'", async () => {
    const a = await notebooksApi.create({ title: "Fixado" });
    await notebooksApi.create({ title: "Não fixado" });
    await notebooksApi.update(a.id, { pinned: true });

    renderPage();

    await waitFor(() => expect(screen.getByText(/^Fixados$/)).toBeInTheDocument());

    // Títulos dos cadernos aparecem como <h3> (pill "Fixado" também usa o texto,
    // por isso filtramos por role heading pra evitar match múltiplo).
    expect(
      screen.getByRole("heading", { level: 3, name: "Fixado" })
    ).toBeInTheDocument();
    expect(screen.getByText("Não fixado")).toBeInTheDocument();
  });

  it("abre modal ao clicar em 'Novo caderno' e cria via formulário", async () => {
    const user = userEvent.setup();
    renderPage();

    // Espera o loading sair (empty state já visível)
    await waitFor(() =>
      expect(
        screen.getByText(/você ainda não tem nenhum caderno/i)
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /^novo caderno$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/^novo caderno$/i)).toBeInTheDocument();
    const titleInput = within(dialog).getByLabelText(/título/i);
    await user.type(titleInput, "Diário de IA");
    await user.click(within(dialog).getByRole("button", { name: /criar caderno/i }));

    // Modal fecha + novo caderno aparece na lista
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Diário de IA")).toBeInTheDocument();
  });

  it("'Novo caderno' falha quando título está vazio (validação inline)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/você ainda não tem nenhum caderno/i)
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /novo caderno/i }));
    const dialog = await screen.findByRole("dialog");
    // Sem digitar nada, clica direto em criar
    await user.click(within(dialog).getByRole("button", { name: /criar caderno/i }));

    // O modal continua aberto (validação HTML5 required impede submit; sem error inline)
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });
});
