import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api/client";
import type { CreateSessionInput, StudySession } from "@/lib/api/types";
import { sessionsApi } from "../api";

export type TimerStatus = "idle" | "running" | "paused" | "completed" | "abandoned";

interface UseTimer {
  status: TimerStatus;
  session: StudySession | null;
  secondsRemaining: number;
  error: string | null;
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

  // Guard pra evitar chamar complete() duas vezes quando o tempo zera.
  const completingRef = useRef(false);

  const start = useCallback(async (input: CreateSessionInput) => {
    setError(null);
    try {
      const created = await sessionsApi.create(input);
      setSession(created);
      setSecondsRemaining(created.planned_duration_seconds);
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
      const updated = await sessionsApi.complete(session.id);
      setSession(updated);
      setStatus("completed");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível concluir"));
      completingRef.current = false;
    }
  }, [session, status]);

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
    start,
    pause,
    resume,
    complete,
    abandon,
    reset,
  };
}
