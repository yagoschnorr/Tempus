import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import { AuthProvider } from "@/lib/auth/AuthContext";

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza o formulário com nome, email, senha e confirmação", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 2, name: /bem-vinda ao tempus/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it("mostra o medidor de força da senha quando o usuário digita", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^senha$/i), "Abc123!@");

    // A label "Força da senha:" aparece junto com o medidor visual
    await waitFor(() =>
      expect(screen.getByText(/força da senha/i)).toBeInTheDocument()
    );
  });

  it("exibe erro 'Senhas não conferem' quando senhas divergem no submit", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/nome completo/i), "Yago");
    await user.type(screen.getByLabelText(/email/i), "yago@tempus.dev");
    await user.type(screen.getByLabelText(/^senha$/i), "Abc123!@");
    await user.type(screen.getByLabelText(/confirmar senha/i), "diferente");

    // Marca o checkbox de termos pra passar dessa validação
    await user.click(screen.getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

    expect(await screen.findByText(/senhas não conferem/i)).toBeInTheDocument();
  });

  it("exige aceitar os termos para enviar o formulário", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/nome completo/i), "Yago");
    await user.type(screen.getByLabelText(/email/i), "yago@tempus.dev");
    await user.type(screen.getByLabelText(/^senha$/i), "Abc123!@");
    await user.type(screen.getByLabelText(/confirmar senha/i), "Abc123!@");
    // Não marca termos

    await user.click(screen.getByRole("button", { name: /criar minha conta/i }));

    expect(
      await screen.findByText(/você precisa aceitar os termos/i)
    ).toBeInTheDocument();
  });
});
