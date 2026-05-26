import { api } from "@/lib/api/client";
import type { Document, UploadDocumentInput, UUID } from "@/lib/api/types";

export const documentsApi = {
  list(subjectId?: UUID) {
    const qs = subjectId
      ? `?${new URLSearchParams({ subject_id: subjectId })}`
      : "";
    return api<Document[]>(`/documents${qs}`);
  },

  get(id: UUID) {
    return api<Document>(`/documents/${id}`);
  },

  upload(input: UploadDocumentInput) {
    const formData = new FormData();
    formData.append("file", input.file);
    if (input.subject_id) {
      formData.append("subject_id", input.subject_id);
    }
    return api<Document>("/documents", { method: "POST", body: formData });
  },

  remove(id: UUID) {
    return api<void>(`/documents/${id}`, { method: "DELETE" });
  },
};
