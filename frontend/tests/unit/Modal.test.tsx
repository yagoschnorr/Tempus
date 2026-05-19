import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/Modal";

describe("<Modal>", () => {
  it("não renderiza nada quando fechado", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Hi">
        conteúdo
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza title e children quando aberto", () => {
    render(
      <Modal open onClose={() => {}} title="Editar matéria">
        <p>conteúdo aqui</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar matéria")).toBeInTheDocument();
    expect(screen.getByText("conteúdo aqui")).toBeInTheDocument();
  });

  it("clicar no X chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="X">
        a
      </Modal>
    );
    await user.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicar no backdrop chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>filho</p>
      </Modal>
    );
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicar dentro do conteúdo NÃO chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>conteúdo interno</p>
      </Modal>
    );
    await user.click(screen.getByText("conteúdo interno"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
