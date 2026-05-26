import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api/client";
import type { CreateSessionInput, StudySession } from "@/lib/api/types";
import { sessionsApi } from "../api";

export type TimerStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "abandoned";

interface UseTimer {
  status: TimerStatus;
  session: StudySession | null;
  secondsRemaining: number;
  error: string | null;
  hydrating: boolean;
  start: (input: CreateSessionInput) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  abandon: () => Promise<void>;
  reset: () => void;
}

export function useTimer(): UseTimer {
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [session, setSession] = useState<StudySession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);

  // Guard pra evitar chamar complete() duas vezes quando o tempo zera.
  const completingRef = useRef(false);
  // Tracking de pausa para enviar pause_duration_seconds no complete.
  const pauseStartedAtRef = useRef<number | null>(null);
  const pauseAccumulatedSecondsRef = useRef(0);

  function resetPauseTracking() {
    pauseStartedAtRef.current = null;
    pauseAccumulatedSecondsRef.current = 0;
  }

  // Hidrata sessão ativa (in_progress | paused) ao montar.
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const list = await sessionsApi.list();
        if (!mounted) return;
        const active = list.find(
          (s) => s.status === "in_progress" || s.status === "paused",
        );
        if (!active) return;
        const startedAtMs = new Date(active.started_at).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
        const remaining = Math.max(
          0,
          active.planned_duration_seconds - elapsedSeconds,
        );
        setSession(active);
        setSecondsRemaining(remaining);
        setStatus(active.status === "paused" ? "paused" : "running");
        if (active.status === "paused") {
          // Sem timestamp da pausa no backend; usamos agora como referência.
          pauseStartedAtRef.current = Date.now();
        }
      } catch {
        // hidratação silenciosa — falha mantém o hook em idle.
      } finally {
        if (mounted) setHydrating(false);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const start = useCallback(async (input: CreateSessionInput) => {
    setError(null);
    try {
      const created = await sessionsApi.create(input);
      setSession(created);
      setSecondsRemaining(created.planned_duration_seconds);
      resetPauseTracking();
      completingRef.current = false;
      setStatus("running");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível iniciar a sessão"));
      throw err;
    }
  }, []);

  const pause = useCallback(async () => {
    if (!session || status !== "running") return;
    try {
      const updated = await sessionsApi.pause(session.id);
      setSession(updated);
      pauseStartedAtRef.current = Date.now();
      setStatus("paused");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível pausar"));
    }
  }, [session, status]);

  const resume = useCallback(async () => {
    if (!session || status !== "paused") return;
    try {
      const updated = await sessionsApi.resume(session.id);
      setSession(updated);
      if (pauseStartedAtRef.current !== null) {
        pauseAccumulatedSecondsRef.current += Math.floor(
          (Date.now() - pauseStartedAtRef.current) / 1000,
        );
        pauseStartedAtRef.current = null;
      }
      setStatus("running");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível retomar"));
    }
  }, [session, status]);

  const complete = useCallback(async () => {
    if (!session || (status !== "running" && status !== "paused")) return;
    if (completingRef.current) return;
    completingRef.current = true;
    try {
      let pauseDuration = pauseAccumulatedSecondsRef.current;
      if (status === "paused" && pauseStartedAtRef.current !== null) {
        pauseDuration += Math.floor(
          (Date.now() - pauseStartedAtRef.current) / 1000,
        );
      }
      const actual = Math.max(
        0,
        session.planned_duration_seconds - secondsRemaining,
      );
      const updated = await sessionsApi.complete(session.id, {
        actual_duration_seconds: actual,
        pause_duration_seconds: pauseDuration,
      });
      setSession(updated);
      setStatus("completed");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível concluir"));
      completingRef.current = false;
    }
  }, [session, status, secondsRemaining]);

  const abandon = useCallback(async () => {
    if (!session || (status !== "running" && status !== "paused")) return;
    try {
      const updated = await sessionsApi.abandon(session.id);
      setSession(updated);
      setStatus("abandoned");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível abandonar"));
    }
  }, [session, status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setSession(null);
    setSecondsRemaining(0);
    setError(null);
    completingRef.current = false;
    resetPauseTracking();
  }, []);

  // Countdown: roda só enquanto status === "running"
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setSecondsRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Auto-complete quando o tempo zera
  useEffect(() => {
    if (status === "running" && secondsRemaining === 0) {
      void complete();
    }
  }, [status, secondsRemaining, complete]);

  return {
    status,
    session,
    secondsRemaining,
    error,
    hydrating,
    start,
    pause,
    resume,
    complete,
    abandon,
    reset,
  };
}
