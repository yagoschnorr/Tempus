import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/Input";

describe("<Input>", () => {
  it("renderiza com label", () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("mostra hint quando passado", () => {
    render(<Input label="Email" hint="Use seu email institucional" />);
    expect(screen.getByText("Use seu email institucional")).toBeInTheDocument();
  });

  it("mostra erro e ESCONDE o hint quando os dois estão presentes", () => {
    render(<Input label="Email" hint="hint" error="Email inválido" />);
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
    expect(screen.queryByText("hint")).not.toBeInTheDocument();
  });

  it("digita texto e chama onChange", async () => {
    const user = userEvent.setup();
    let value = "";
    render(
      <Input
        label="Email"
        name="email"
        value={value}
        onChange={(e) => {
          value = e.target.value;
        }}
      />
    );
    await user.type(screen.getByRole("textbox"), "abc");
    expect(value).toBe("c"); // último char (controlled sem re-render)
  });

  it("encaminha ref pro input nativo", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="X" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
