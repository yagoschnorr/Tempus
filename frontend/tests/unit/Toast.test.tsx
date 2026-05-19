import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "@/components/Toast";

describe("<Toast>", () => {
  it("renderiza a mensagem", () => {
    render(<Toast message="Salvo com sucesso" />);
    expect(screen.getByText("Salvo com sucesso")).toBeInTheDocument();
  });

  it("aplica classe de success por padrão... err, info por padrão", () => {
    render(<Toast message="m" />);
    const el = screen.getByText("m");
    expect(el.className).toMatch(/info-500/);
  });

  it("aplica estilo de erro quando kind=error", () => {
    render(<Toast kind="error" message="boom" />);
    expect(screen.getByText("boom").className).toMatch(/danger-500/);
  });

  it("aplica estilo de sucesso quando kind=success", () => {
    render(<Toast kind="success" message="ok" />);
    expect(screen.getByText("ok").className).toMatch(/success-/);
  });
});
