import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/Button";

describe("Button", () => {
  it("renderiza o label", () => {
    render(<Button>Entrar</Button>);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });
});
