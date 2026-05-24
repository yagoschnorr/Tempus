import { api } from "@/lib/api/client";
import type {
  CreateNoteInput,
  CreateNotebookInput,
  Note,
  NoteSummary,
  Notebook,
  UpdateNoteInput,
  UpdateNotebookInput,
  UUID,
} from "@/lib/api/types";

// Cliente das rotas /api/notebooks. O prefixo `/notebooks` aqui é resolvido
// pelo `api()` que prefixa com VITE_API_BASE_URL (default `/api`).
//
// Pin/unpin reutiliza o PATCH /notebooks/{id} mandando `{ pinned: bool }` —
// decidido no Bloco 2 do plano para evitar criar rota dedicada.
export const notebooksApi = {
  list() {
    return api<Notebook[]>("/notebooks");
  },

  create(input: CreateNotebookInput) {
    return api<Notebook>("/notebooks", { method: "POST", json: input });
  },

  update(id: UUID, input: UpdateNotebookInput) {
    return api<Notebook>(`/notebooks/${id}`, { method: "PATCH", json: input });
  },

  remove(id: UUID) {
    return api<void>(`/notebooks/${id}`, { method: "DELETE" });
  },

  listNotes(notebookId: UUID) {
    return api<Note[]>(`/notebooks/${notebookId}/notes`);
  },

  createNote(notebookId: UUID, input: CreateNoteInput) {
    return api<Note>(`/notebooks/${notebookId}/notes`, {
      method: "POST",
      json: input,
    });
  },

  // PATCH/DELETE de note batem em /notebooks/notes/{id} (rota definida assim
  // no backend pra agrupar tudo sob o mesmo router; ver routers/notebook.py).
  updateNote(noteId: UUID, input: UpdateNoteInput) {
    return api<Note>(`/notebooks/notes/${noteId}`, {
      method: "PATCH",
      json: input,
    });
  },

  removeNote(noteId: UUID) {
    return api<void>(`/notebooks/notes/${noteId}`, { method: "DELETE" });
  },

  summarizeNote(noteId: UUID) {
    return api<NoteSummary>(`/notebooks/notes/${noteId}/summary`, {
      method: "POST",
    });
  },
};
