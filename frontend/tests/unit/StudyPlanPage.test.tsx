import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import StudyPlanPage from "@/features/study-plan";

function renderPage() {
  return render(
    <MemoryRouter>
      <StudyPlanPage />
    </MemoryRouter>
  );
}

describe("StudyPlanPage", () => {
  it("renderiza o título e o badge 'Sem plano ativo' quando não há planos", async () => {
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /plano de estudos/i })
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/sem plano ativo/i)).toBeInTheDocument();
  });

  it("renderiza o empty state 'Nenhum plano ainda' quando a lista está vazia", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/nenhum plano ainda/i)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/crie um plano de estudos para organizar/i)
    ).toBeInTheDocument();
  });

  it("abre o GenerateStudyPlanModal ao clicar em 'Criar plano'", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/nenhum plano ainda/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /criar plano/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // O modal de gerar tem campos de título e duração
    expect(within(dialog).getByLabelText(/título/i)).toBeInTheDocument();
  });
});
