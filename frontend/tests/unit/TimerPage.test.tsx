import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import TimerPage from "@/features/timer";

function renderPage() {
  return render(
    <MemoryRouter>
      <TimerPage />
    </MemoryRouter>
  );
}

describe("TimerPage", () => {
  it("renderiza estado inicial 'Pronta pra começar' com botão de iniciar", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /pronta pra começar/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sessão/i })).toBeInTheDocument();
  });

  it("carrega o select de matérias com as matérias do usuário", async () => {
    renderPage();

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      // "— Sem matéria —" + as 3 seedadas
      expect(options.length).toBeGreaterThanOrEqual(4);
      expect(options.some((o) => o.textContent === "Cálculo I")).toBe(true);
    });
  });

  it("inicia uma sessão e troca para o estado 'running' com controles", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /iniciar sessão/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /iniciar sessão/i }));

    // Troca pra running: aparecem pausar / concluir / abandonar
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /pausar/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /concluir/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abandonar/i })).toBeInTheDocument();
  });
});
