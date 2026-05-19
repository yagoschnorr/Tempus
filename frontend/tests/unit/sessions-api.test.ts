import { describe, it, expect } from "vitest";
import { sessionsApi } from "@/features/timer/api";
import { ApiError } from "@/lib/api/client";

describe("sessionsApi", () => {
  it("create devolve sessão com status in_progress", async () => {
    const session = await sessionsApi.create({
      subject_id: "s-1",
      planned_duration_seconds: 1500,
    });
    expect(session.id).toBeTruthy();
    expect(session.status).toBe("in_progress");
    expect(session.planned_duration_seconds).toBe(1500);
  });

  it("pause → resume → complete passa pelos estados corretos", async () => {
    const session = await sessionsApi.create({ planned_duration_seconds: 600 });
    const paused = await sessionsApi.pause(session.id);
    expect(paused.status).toBe("paused");
    const resumed = await sessionsApi.resume(session.id);
    expect(resumed.status).toBe("in_progress");
    const completed = await sessionsApi.complete(session.id);
    expect(completed.status).toBe("completed");
    expect(completed.ended_at).not.toBeNull();
  });

  it("rejeita pause em sessão já pausada", async () => {
    const session = await sessionsApi.create({ planned_duration_seconds: 600 });
    await sessionsApi.pause(session.id);
    await expect(sessionsApi.pause(session.id)).rejects.toBeInstanceOf(ApiError);
  });

  it("abandon termina a sessão", async () => {
    const session = await sessionsApi.create({ planned_duration_seconds: 600 });
    const abandoned = await sessionsApi.abandon(session.id);
    expect(abandoned.status).toBe("abandoned");
  });
});
