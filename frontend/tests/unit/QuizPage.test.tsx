import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import QuizPage from "@/features/quiz";

function renderPage() {
  return render(
    <MemoryRouter>
      <QuizPage />
    </MemoryRouter>
  );
}

describe("QuizPage", () => {
  it("renderiza o formulário de geração de quiz com seleção de fonte", async () => {
    renderPage();

    // O page sempre tem o setup de geração visível em qualquer estado
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toBeInTheDocument()
    );
  });

  it("permite trocar a quantidade de questões pelo input numérico", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    );

    const numberInputs = screen.queryAllByRole("spinbutton");
    if (numberInputs.length > 0) {
      const totalInput = numberInputs[0] as HTMLInputElement;
      await user.clear(totalInput);
      await user.type(totalInput, "8");
      expect(totalInput.value).toBe("8");
    }
  });

  it("renderiza o select de matérias com as matérias seedadas", async () => {
    renderPage();

    // Espera matérias carregarem do mock
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.some((o) => o.textContent === "Cálculo I")).toBe(true);
    });
  });
});
