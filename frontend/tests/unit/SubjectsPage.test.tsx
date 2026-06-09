import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import SubjectsPage from "@/features/subjects";

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectsPage />
    </MemoryRouter>
  );
}

describe("SubjectsPage", () => {
  it("renderiza título e matérias seedadas do mock", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /^Matérias$/ })
      ).toBeInTheDocument()
    );

    expect(screen.getByRole("heading", { level: 3, name: "Cálculo I" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Algoritmos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Banco de Dados" })).toBeInTheDocument();
  });

  it("abre o SubjectFormModal ao clicar em 'Nova matéria'", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: "Cálculo I" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /nova matéria/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/nome/i)).toBeInTheDocument();
  });

  it("cria uma nova matéria via formulário e ela aparece na grade", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: "Cálculo I" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /nova matéria/i }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText(/nome/i), "Física");
    await user.click(within(dialog).getByRole("button", { name: /salvar|criar/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { level: 3, name: "Física" })).toBeInTheDocument();
  });

  it("abre o DeleteSubjectDialog ao clicar em 'Excluir' em uma matéria", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: "Cálculo I" })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /excluir cálculo i/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // O dialog tem o texto "deseja excluir..." E o botão "Excluir" — assertamos o botão.
    expect(within(dialog).getByRole("button", { name: /^excluir$/i })).toBeInTheDocument();
  });
});
