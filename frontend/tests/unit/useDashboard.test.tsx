import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { RealtimeDashboard } from "@/lib/api/types";

const mock = vi.hoisted(() => {
  const state = {
    data: {
      minutes_today: 45,
      minutes_week: 320,
      sessions_today: 1,
      sessions_week: 6,
      current_streak: 5,
      avg_quiz_score_week: 82.5,
    } as RealtimeDashboard,
    shouldThrow: false,
  };
  return {
    state,
    api: {
      realtime: async () => {
        if (state.shouldThrow) {
          throw new Error("erro simulado");
        }
        return { ...state.data };
      },
    },
  };
});

vi.mock("@/features/dashboard/api", () => ({
  dashboardApi: mock.api,
}));

import { useDashboard } from "@/features/dashboard/hooks/useDashboard";

beforeEach(() => {
  mock.state.shouldThrow = false;
  mock.state.data = {
    minutes_today: 45,
    minutes_week: 320,
    sessions_today: 1,
    sessions_week: 6,
    current_streak: 5,
    avg_quiz_score_week: 82.5,
  };
});

describe("useDashboard", () => {
  it("carrega métricas no mount", async () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.minutes_week).toBe(320);
    expect(result.current.data?.current_streak).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it("refresh re-busca dados atualizados", async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mock.state.data.minutes_week = 500;
    mock.state.data.current_streak = 7;

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data?.minutes_week).toBe(500);
    expect(result.current.data?.current_streak).toBe(7);
  });

  it("propaga erro quando a API falha", async () => {
    mock.state.shouldThrow = true;
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toMatch(/dashboard/i);
  });

  it("aceita avg_quiz_score_week null", async () => {
    mock.state.data.avg_quiz_score_week = null;
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.avg_quiz_score_week).toBeNull();
  });
});
