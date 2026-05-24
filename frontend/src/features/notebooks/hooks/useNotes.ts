import { useCallback, useEffect, useState } from "react";
import type {
  CreateNoteInput,
  Note,
  NoteSummary,
  UpdateNoteInput,
  UUID,
} from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { notebooksApi } from "../api";

interface UseNotes {
  notes: Note[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateNoteInput) => Promise<Note>;
  update: (id: UUID, input: UpdateNoteInput) => Promise<Note>;
  remove: (id: UUID) => Promise<void>;
  summarize: (id: UUID) => Promise<NoteSummary>;
}

/**
 * Gerencia as folhas (notes) de um notebook específico. Refaz o fetch sempre
 * que `notebookId` muda. Mutate operations atualizam a lista localmente sem
 * refetch; reordena por updated_at desc pra espelhar o backend.
 */
function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function useNotes(notebookId: UUID | null): UseNotes {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!notebookId) {
      setNotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await notebooksApi.listNotes(notebookId);
      setNotes(sortNotes(list));
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar as folhas"));
    } finally {
      setLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateNoteInput) => {
      if (!notebookId) throw new Error("notebookId é obrigatório");
      const note = await notebooksApi.createNote(notebookId, input);
      setNotes((prev) => sortNotes([note, ...prev]));
      return note;
    },
    [notebookId]
  );

  const update = useCallback(async (id: UUID, input: UpdateNoteInput) => {
    const updated = await notebooksApi.updateNote(id, input);
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? updated : n))));
    return updated;
  }, []);

  const remove = useCallback(async (id: UUID) => {
    await notebooksApi.removeNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const summarize = useCallback((id: UUID) => {
    return notebooksApi.summarizeNote(id);
  }, []);

  return { notes, loading, error, refresh, create, update, remove, summarize };
}
