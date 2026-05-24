import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSessionDetail, UUID } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { chatApi } from "../api";

interface UseChat {
  session: ChatSessionDetail | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  ask: (
    question: string,
    opts: { subjectId?: UUID | null }
  ) => Promise<{ sessionId: UUID } | null>;
  clear: () => void;
}

interface Options {
  sessionId: UUID | null;
  onSessionCreated?: (sessionId: UUID) => void;
}

/**
 * Gerencia a sessão ativa do chat. Quando `sessionId` muda, recarrega
 * histórico do backend. `ask()` faz envio otimista: insere a mensagem do
 * usuário imediatamente, dispara a request, e substitui pela resposta real.
 */
export function useChat({ sessionId, onSessionCreated }: Options): UseChat {
  const [session, setSession] = useState<ChatSessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guarda o sessionId "vivo" pra evitar race entre troca de sessão e resposta.
  const activeIdRef = useRef<UUID | null>(sessionId);
  activeIdRef.current = sessionId;

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setMessages([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    chatApi
      .getSession(sessionId)
      .then((detail) => {
        if (cancelled || activeIdRef.current !== sessionId) return;
        setSession(detail);
        setMessages(detail.messages ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Não foi possível abrir a conversa"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const ask = useCallback(
    async (
      question: string,
      opts: { subjectId?: UUID | null }
    ): Promise<{ sessionId: UUID } | null> => {
      const trimmed = question.trim();
      if (!trimmed) return null;

      setError(null);
      setSending(true);

      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-${Date.now()}` as UUID,
        session_id: (sessionId ?? "pending") as UUID,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
        sources: [],
      };
      setMessages((prev) => [...prev, optimisticUserMessage]);

      try {
        const response = sessionId
          ? await chatApi.askInSession(sessionId, { question: trimmed })
          : await chatApi.askNew({
              subject_id: opts.subjectId ?? undefined,
              question: trimmed,
            });

        // Se o usuário trocou de sessão enquanto a resposta vinha, descarta.
        if (sessionId && activeIdRef.current !== sessionId) return null;

        setMessages((prev) => {
          // Conserta o session_id da mensagem otimista (caso tenha sido criada agora).
          const fixed = prev.map((m) =>
            m.id === optimisticUserMessage.id
              ? { ...m, session_id: response.session_id }
              : m
          );
          return [...fixed, response.message];
        });

        if (!sessionId) onSessionCreated?.(response.session_id);
        return { sessionId: response.session_id };
      } catch (err) {
        // Rollback da mensagem otimista
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticUserMessage.id)
        );
        setError(getErrorMessage(err, "Não foi possível enviar a pergunta"));
        return null;
      } finally {
        setSending(false);
      }
    },
    [sessionId, onSessionCreated]
  );

  const clear = useCallback(() => {
    setSession(null);
    setMessages([]);
    setError(null);
  }, []);

  return { session, messages, loading, sending, error, ask, clear };
}
