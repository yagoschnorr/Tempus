import { api } from "@/lib/api/client";
import type {
  CreateSubjectInput,
  Subject,
  UpdateSubjectInput,
  UUID,
} from "@/lib/api/types";

export const subjectsApi = {
  list() {
    return api<Subject[]>("/subjects");
  },

  get(id: UUID) {
    return api<Subject>(`/subjects/${id}`);
  },

  create(input: CreateSubjectInput) {
    return api<Subject>("/subjects", { method: "POST", json: input });
  },

  update(id: UUID, input: UpdateSubjectInput) {
    return api<Subject>(`/subjects/${id}`, { method: "PATCH", json: input });
  },

  remove(id: UUID) {
    return api<void>(`/subjects/${id}`, { method: "DELETE" });
  },
};
