import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "@/features/dashboard";
import { AuthProvider } from "@/lib/auth/AuthContext";

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("DashboardPage", () => {
  it("renderiza saudação dinâmica como heading principal", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/Bom dia|Boa tarde|Boa noite/i);
  });

  it("renderiza os 4 cards de métricas com os dados do mock", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/horas na semana/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/sessões hoje/i)).toBeInTheDocument();
    expect(screen.getByText(/sequência/i)).toBeInTheDocument();
    expect(screen.getByText(/média em quizzes/i)).toBeInTheDocument();
  });

  it("exibe a streak no header quando current_streak > 0 (mock retorna 5)", async () => {
    renderPage();

    // Mock retorna streak = 5 → header inclui "5 dias em foco"
    await waitFor(() =>
      expect(screen.getByText(/5 dias em foco/i)).toBeInTheDocument()
    );
  });
});
