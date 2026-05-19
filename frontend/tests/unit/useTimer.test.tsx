import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTimer } from "@/features/timer/hooks/useTimer";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("começa em idle", () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.status).toBe("idle");
    expect(result.current.session).toBeNull();
  });

  it("start cria sessão e entra em running", async () => {
    const { result } = renderHook(() => useTimer());

    await act(async () => {
      await result.current.start({ planned_duration_seconds: 60 });
    });

    expect(result.current.status).toBe("running");
    expect(result.current.session?.status).toBe("in_progress");
    expect(result.current.secondsRemaining).toBe(60);
  });

  it("countdown decrementa a cada segundo enquanto running", async () => {
    const { result } = renderHook(() => useTimer());
    await act(async () => {
      await result.current.start({ planned_duration_seconds: 10 });
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.secondsRemaining).toBe(7);
  });

  it("pause não decrementa, resume retoma", async () => {
    const { result } = renderHook(() => useTimer());
    await act(async () => {
      await result.current.start({ planned_duration_seconds: 10 });
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsRemaining).toBe(8);

    await act(async () => {
      await result.current.pause();
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.secondsRemaining).toBe(8); // não andou

    await act(async () => {
      await result.current.resume();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsRemaining).toBe(6);
  });

  it("auto-completa quando o tempo zera", async () => {
    // Usa timers reais aqui pra que o waitFor (que usa setTimeout) funcione.
    vi.useRealTimers();
    const { result } = renderHook(() => useTimer());
    await act(async () => {
      await result.current.start({ planned_duration_seconds: 1 });
    });

    await waitFor(() => expect(result.current.status).toBe("completed"), {
      timeout: 3000,
    });
  });

  it("abandon termina a sessão sem countdown", async () => {
    const { result } = renderHook(() => useTimer());
    await act(async () => {
      await result.current.start({ planned_duration_seconds: 60 });
    });
    await act(async () => {
      await result.current.abandon();
    });
    expect(result.current.status).toBe("abandoned");
  });

  it("reset volta para idle", async () => {
    const { result } = renderHook(() => useTimer());
    await act(async () => {
      await result.current.start({ planned_duration_seconds: 10 });
    });
    await act(async () => {
      await result.current.complete();
    });

    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.session).toBeNull();
    expect(result.current.secondsRemaining).toBe(0);
  });
});
