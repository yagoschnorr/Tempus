import { api } from "@/lib/api/client";
import type { CreateSessionInput, StudySession, UUID } from "@/lib/api/types";

export const sessionsApi = {
  list() {
    return api<StudySession[]>("/sessions");
  },

  create(input: CreateSessionInput) {
    return api<StudySession>("/sessions", { method: "POST", json: input });
  },

  pause(id: UUID) {
    return api<StudySession>(`/sessions/${id}/pause`, { method: "PATCH" });
  },

  resume(id: UUID) {
    return api<StudySession>(`/sessions/${id}/resume`, { method: "PATCH" });
  },

  complete(id: UUID) {
    return api<StudySession>(`/sessions/${id}/complete`, { method: "PATCH" });
  },

  abandon(id: UUID) {
    return api<StudySession>(`/sessions/${id}/abandon`, { method: "PATCH" });
  },
};
