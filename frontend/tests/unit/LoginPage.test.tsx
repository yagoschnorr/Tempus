import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/features/auth/pages/LoginPage";
import { AuthProvider } from "@/lib/auth/AuthContext";

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza o formulário com campos de email e senha", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 2, name: /bem-vinda de volta/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar no tempus/i })).toBeInTheDocument();
  });

  it("renderiza o link para a tela de cadastro", () => {
    renderPage();

    const link = screen.getByRole("link", { name: /criar conta/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/register");
  });

  it("submete o formulário com email e senha, persistindo o token", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "yago@tempus.dev");
    await user.type(screen.getByLabelText(/senha/i), "senha-de-teste");
    await user.click(screen.getByRole("button", { name: /entrar no tempus/i }));

    // O handler MSW de /api/auth/login devolve um token; o AuthProvider grava
    // em localStorage no callback `login()`.
    await waitFor(() => {
      const stored = localStorage.getItem("tempus.auth");
      expect(stored).not.toBeNull();
    });
  });
});
