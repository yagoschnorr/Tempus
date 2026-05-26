import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDocumentModal } from "@/features/documents/components/UploadDocumentModal";
import type { Document, Subject } from "@/lib/api/types";

const subjects: Subject[] = [
  {
    id: "s-1",
    name: "Cálculo I",
    color: "#3b82f6",
    description: null,
    weekly_goal_minutes: 600,
    created_at: new Date().toISOString(),
  },
];

function makePdf(name = "aula.pdf", size = 1024, type = "application/pdf") {
  return new File(["x".repeat(size)], name, { type });
}

function makeDocResponse(): Document {
  return {
    id: "doc-1",
    user_id: "u-1",
    subject_id: null,
    filename: "aula.pdf",
    file_size_bytes: 1024,
    mime_type: "application/pdf",
    total_pages: null,
    total_chunks: 0,
    status: "processing",
    error_message: null,
    uploaded_at: new Date().toISOString(),
    processed_at: null,
  };
}

let onSubmit: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onSubmit = vi.fn().mockResolvedValue(makeDocResponse());
  onClose = vi.fn();
});

function renderModal() {
  return render(
    <UploadDocumentModal
      open={true}
      onClose={onClose}
      subjects={subjects}
      onSubmit={onSubmit}
    />,
  );
}

describe("UploadDocumentModal", () => {
  it("rejeita arquivo nao-PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderModal();

    const input = screen.getByLabelText(/Arquivo/i) as HTMLInputElement;
    await user.upload(input, makePdf("img.png", 100, "image/png"));
    await user.click(screen.getByRole("button", { name: /Enviar/ }));

    expect(
      await screen.findByText(/Apenas arquivos PDF são aceitos/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejeita arquivo maior que 25 MB", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(/Arquivo/i) as HTMLInputElement;
    await user.upload(input, makePdf("grande.pdf", 26 * 1024 * 1024));
    await user.click(screen.getByRole("button", { name: /Enviar/ }));

    expect(
      await screen.findByText(/Arquivo muito grande/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envia PDF valido com subject_id selecionado e fecha modal", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(/Arquivo/i) as HTMLInputElement;
    await user.upload(input, makePdf());
    await user.selectOptions(screen.getByLabelText(/Matéria/i), "s-1");
    await user.click(screen.getByRole("button", { name: /Enviar/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.file.name).toBe("aula.pdf");
    expect(arg.subject_id).toBe("s-1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("nao envia subject_id quando 'Sem materia' está selecionado", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(/Arquivo/i) as HTMLInputElement;
    await user.upload(input, makePdf());
    await user.click(screen.getByRole("button", { name: /Enviar/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.subject_id).toBeUndefined();
  });

  it("mostra erro inline quando onSubmit rejeita", async () => {
    onSubmit.mockRejectedValueOnce(new Error("Falha de servidor"));
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByLabelText(/Arquivo/i) as HTMLInputElement;
    await user.upload(input, makePdf());
    await user.click(screen.getByRole("button", { name: /Enviar/ }));

    expect(
      await screen.findByText(/Não foi possível enviar o documento/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
