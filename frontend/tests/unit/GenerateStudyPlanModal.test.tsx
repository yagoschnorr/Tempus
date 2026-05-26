import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateStudyPlanModal } from "@/features/study-plan/components/GenerateStudyPlanModal";
import type { StudyPlan, Subject } from "@/lib/api/types";

const subjects: Subject[] = [
  {
    id: "s-1",
    name: "Cálculo I",
    color: "#3b82f6",
    description: null,
    weekly_goal_minutes: 600,
    created_at: new Date().toISOString(),
  },
  {
    id: "s-2",
    name: "Algoritmos",
    color: "#a855f7",
    description: null,
    weekly_goal_minutes: 480,
    created_at: new Date().toISOString(),
  },
];

function makePlanResponse(): StudyPlan {
  return {
    id: "sp-1",
    user_id: "u-1",
    title: "Plano teste",
    exam_date: null,
    daily_hours_available: 4,
    plan_content: "# Plano teste",
    status: "active",
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    subjects: [{ subject_id: "s-1", priority: "high" }],
  };
}

let onSubmit: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onSubmit = vi.fn().mockResolvedValue(makePlanResponse());
  onClose = vi.fn();
});

function renderModal() {
  return render(
    <GenerateStudyPlanModal
      open={true}
      onClose={onClose}
      subjects={subjects}
      onSubmit={onSubmit}
    />,
  );
}

describe("GenerateStudyPlanModal", () => {
  it("rejeita titulo vazio", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));
    expect(
      await screen.findByText(/Título é obrigatório/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejeita horas/dia <= 0", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Título/i), "Plano X");
    const hoursInput = screen.getByLabelText(/Horas por dia/i);
    await user.clear(hoursInput);
    await user.type(hoursInput, "0");
    await user.selectOptions(screen.getByLabelText(/Matéria 1/i), "s-1");
    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));
    expect(
      await screen.findByText(/Horas\/dia deve ser maior que zero/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejeita 0 matérias selecionadas", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Título/i), "Plano X");
    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));
    expect(
      await screen.findByText(/Selecione pelo menos uma matéria/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejeita matéria duplicada", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Título/i), "Plano X");
    await user.selectOptions(screen.getByLabelText(/Matéria 1/i), "s-1");
    await user.click(screen.getByRole("button", { name: /Adicionar/i }));
    await user.selectOptions(screen.getByLabelText(/Matéria 2/i), "s-1");
    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));
    expect(
      await screen.findByText(/Matéria duplicada/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit valido envia payload completo e fecha modal", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Título/i), "Plano para Cálculo");
    await user.type(screen.getByLabelText(/Data da prova/i), "2026-06-30");
    await user.selectOptions(screen.getByLabelText(/Matéria 1/i), "s-1");
    await user.selectOptions(screen.getByLabelText(/Prioridade 1/i), "high");

    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.title).toBe("Plano para Cálculo");
    expect(arg.exam_date).toBe("2026-06-30");
    expect(arg.daily_hours_available).toBe(4);
    expect(arg.subjects).toEqual([{ subject_id: "s-1", priority: "high" }]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("mostra erro inline quando onSubmit rejeita", async () => {
    onSubmit.mockRejectedValueOnce(new Error("Falha"));
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/Título/i), "Plano X");
    await user.selectOptions(screen.getByLabelText(/Matéria 1/i), "s-1");
    await user.click(screen.getByRole("button", { name: /Gerar plano/i }));
    expect(
      await screen.findByText(/Não foi possível gerar o plano/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
