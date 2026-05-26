import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type {
  CreateStudyPlanInput,
  StudyPlan,
  StudyPlanStatus,
  UUID,
} from "@/lib/api/types";

const mock = vi.hoisted(() => {
  const state = { plans: [] as StudyPlan[], counter: 0 };
  return {
    state,
    api: {
      list: async () => state.plans.map((p) => ({ ...p })),
      get: async (id: UUID) => {
        const p = state.plans.find((x) => x.id === id);
        if (!p) throw new Error("not found");
        return { ...p };
      },
      generate: async (input: CreateStudyPlanInput) => {
        state.counter += 1;
        const stamp = new Date().toISOString();
        const plan: StudyPlan = {
          id: `sp-${state.counter}`,
          user_id: "u-1",
          title: input.title,
          exam_date: input.exam_date ?? null,
          daily_hours_available: input.daily_hours_available,
          plan_content: `# ${input.title}`,
          status: "active",
          generated_at: stamp,
          created_at: stamp,
          subjects: input.subjects.map((s) => ({ ...s })),
        };
        state.plans.unshift(plan);
        return { ...plan };
      },
      updateStatus: async (id: UUID, status: StudyPlanStatus) => {
        const p = state.plans.find((x) => x.id === id);
        if (!p) throw new Error("not found");
        p.status = status;
        return { ...p };
      },
    },
  };
});

vi.mock("@/features/study-plan/api", () => ({
  studyPlansApi: mock.api,
}));

import { useStudyPlans } from "@/features/study-plan/hooks/useStudyPlans";

beforeEach(() => {
  mock.state.plans = [];
  mock.state.counter = 0;
});

function baseInput(overrides: Partial<CreateStudyPlanInput> = {}): CreateStudyPlanInput {
  return {
    title: "Plano teste",
    daily_hours_available: 4,
    subjects: [{ subject_id: "s-1", priority: "high" }],
    ...overrides,
  };
}

describe("useStudyPlans", () => {
  it("carrega lista vazia no mount", async () => {
    const { result } = renderHook(() => useStudyPlans());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plans).toEqual([]);
    expect(result.current.activePlan).toBeNull();
  });

  it("generate adiciona como active e vira activePlan", async () => {
    const { result } = renderHook(() => useStudyPlans());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.generate(baseInput());
    });

    expect(result.current.plans).toHaveLength(1);
    expect(result.current.activePlan?.title).toBe("Plano teste");
    expect(result.current.activePlan?.status).toBe("active");
  });

  it("updateStatus para archived substitui o plano e zera activePlan", async () => {
    const { result } = renderHook(() => useStudyPlans());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id: string;
    await act(async () => {
      const created = await result.current.generate(baseInput());
      id = created.id;
    });
    expect(result.current.activePlan?.id).toBe(id!);

    await act(async () => {
      await result.current.updateStatus(id!, "archived");
    });

    expect(result.current.activePlan).toBeNull();
    expect(result.current.plans[0].status).toBe("archived");
  });

  it("com múltiplos planos, activePlan é o primeiro ativo (mais recente)", async () => {
    const { result } = renderHook(() => useStudyPlans());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.generate(baseInput({ title: "Antigo" }));
    });
    let secondId = "";
    await act(async () => {
      const second = await result.current.generate(baseInput({ title: "Novo" }));
      secondId = second.id;
    });

    expect(result.current.activePlan?.id).toBe(secondId);
    expect(result.current.activePlan?.title).toBe("Novo");
  });
});
