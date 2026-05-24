import { api } from "@/lib/api/client";
import type {
  AskRequest,
  AskResponse,
  ChatSession,
  ChatSessionDetail,
  RenameSessionInput,
  UUID,
} from "@/lib/api/types";

export const chatApi = {
  listSessions(subjectId?: UUID) {
    const qs = subjectId ? `?subject_id=${subjectId}` : "";
    return api<ChatSession[]>(`/chat/sessions${qs}`);
  },

  getSession(id: UUID) {
    return api<ChatSessionDetail>(`/chat/sessions/${id}`);
  },

  rename(id: UUID, input: RenameSessionInput) {
    return api<ChatSession>(`/chat/sessions/${id}`, {
      method: "PATCH",
      json: input,
    });
  },

  remove(id: UUID) {
    return api<void>(`/chat/sessions/${id}`, { method: "DELETE" });
  },

  askNew(input: AskRequest) {
    return api<AskResponse>("/chat/ask", { method: "POST", json: input });
  },

  askInSession(sessionId: UUID, input: AskRequest) {
    return api<AskResponse>(`/chat/sessions/${sessionId}/ask`, {
      method: "POST",
      json: input,
    });
  },
};
