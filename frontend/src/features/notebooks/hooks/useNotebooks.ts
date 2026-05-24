import { useCallback, useEffect, useState } from "react";
import type {
  CreateNotebookInput,
  Notebook,
  UpdateNotebookInput,
  UUID,
} from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { notebooksApi } from "../api";

interface UseNotebooks {
  notebooks: Notebook[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateNotebookInput) => Promise<Notebook>;
  update: (id: UUID, input: UpdateNotebookInput) => Promise<Notebook>;
  remove: (id: UUID) => Promise<void>;
  /** Alterna o pinned do notebook via PATCH (reusa o endpoint de update). */
  togglePin: (id: UUID) => Promise<Notebook>;
}

/**
 * Gerencia a lista de notebooks do usuário. Replica localmente a ordenação
 * do backend (fixados primeiro, depois por last_activity_at desc) para que
 * mudanças otimistas — pinar/desfixar, criar, atualizar — fiquem visíveis
 * imediatamente sem precisar refetch.
 */
function sortNotebooks(list: Notebook[]): Notebook[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.last_activity_at.localeCompare(a.last_activity_at);
  });
}

export function useNotebooks(): UseNotebooks {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await notebooksApi.list();
      setNotebooks(sortNotebooks(list));
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar os cadernos"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (input: CreateNotebookInput) => {
    const created = await notebooksApi.create(input);
    setNotebooks((prev) => sortNotebooks([created, ...prev]));
    return created;
  }, []);

  const update = useCallback(async (id: UUID, input: UpdateNotebookInput) => {
    const updated = await notebooksApi.update(id, input);
    setNotebooks((prev) =>
      sortNotebooks(prev.map((n) => (n.id === id ? updated : n)))
    );
    return updated;
  }, []);

  const remove = useCallback(async (id: UUID) => {
    await notebooksApi.remove(id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const togglePin = useCallback(
    async (id: UUID) => {
      const current = notebooks.find((n) => n.id === id);
      if (!current) throw new Error(`Notebook ${id} não está na lista`);
      return update(id, { pinned: !current.pinned });
    },
    [notebooks, update]
  );

  return {
    notebooks,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    togglePin,
  };
}
