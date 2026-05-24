import { useCallback, useEffect, useState } from "react";
import type { ChatSession, UUID } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { chatApi } from "../api";

interface UseChatSessions {
  sessions: ChatSession[];
  loading: boolean;
  error: string | null;
  filter: UUID | null;
  setFilter: (subjectId: UUID | null) => void;
  refresh: () => Promise<void>;
  rename: (id: UUID, title: string) => Promise<ChatSession>;
  remove: (id: UUID) => Promise<void>;
  /** Coloca a sessão no topo (após nova mensagem) ou insere se for nova. */
  upsertOnTop: (session: ChatSession) => void;
}

export function useChatSessions(): UseChatSessions {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<UUID | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await chatApi.listSessions(filter ?? undefined);
      setSessions(list);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar conversas"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rename = useCallback(async (id: UUID, title: string) => {
    const updated = await chatApi.rename(id, { title });
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (id: UUID) => {
    await chatApi.remove(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const upsertOnTop = useCallback((session: ChatSession) => {
    setSessions((prev) => {
      const rest = prev.filter((s) => s.id !== session.id);
      return [session, ...rest];
    });
  }, []);

  return {
    sessions,
    loading,
    error,
    filter,
    setFilter,
    refresh,
    rename,
    remove,
    upsertOnTop,
  };
}
