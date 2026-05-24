import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChat } from "@/features/chat/hooks/useChat";
import { useChatSessions } from "@/features/chat/hooks/useChatSessions";
import { chatApi } from "@/features/chat/api";

describe("useChat", () => {
  it("envio sem sessionId cria sessão e dispara onSessionCreated", async () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() =>
      useChat({ sessionId: null, onSessionCreated: onCreated })
    );

    await act(async () => {
      await result.current.ask("Por que pi?", { subjectId: "s-1" });
    });

    expect(onCreated).toHaveBeenCalledOnce();
    const createdId = onCreated.mock.calls[0][0] as string;
    expect(createdId).toBeTruthy();
    // 2 mensagens: a otimista (user) atualizada + a assistant retornada
    expect(result.current.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("envio sem subject_id em modo nova sessão retorna null e expõe erro", async () => {
    const { result } = renderHook(() =>
      useChat({ sessionId: null })
    );

    await act(async () => {
      const outcome = await result.current.ask("oi", { subjectId: null });
      expect(outcome).toBeNull();
    });

    // Rollback da mensagem otimista
    expect(result.current.messages).toEqual([]);
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("ao trocar sessionId, recarrega histórico do backend", async () => {
    // cria sessão via api direto e ganha um id
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "pergunta inicial",
    });

    const { result } = renderHook(() => useChat({ sessionId: session_id }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session?.id).toBe(session_id);
    expect(result.current.messages.length).toBe(2);
  });

  it("envio em sessão existente anexa nova mensagem", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "primeira",
    });

    const { result } = renderHook(() => useChat({ sessionId: session_id }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.ask("segunda", { subjectId: null });
    });

    // 2 mensagens iniciais + user otimista + assistant = 4
    expect(result.current.messages.length).toBe(4);
    expect(result.current.messages[2].content).toBe("segunda");
    expect(result.current.messages[3].role).toBe("assistant");
  });
});

describe("useChatSessions", () => {
  it("carrega lista vazia ao montar", async () => {
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual([]);
  });

  it("rename atualiza o item localmente", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "q",
    });

    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions.length).toBe(1);

    await act(async () => {
      await result.current.rename(session_id, "Renomeada");
    });
    expect(result.current.sessions[0].title).toBe("Renomeada");
  });

  it("remove tira o item da lista", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "q",
    });
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove(session_id);
    });
    expect(result.current.sessions).toEqual([]);
  });

  it("filter recarrega só sessões da matéria selecionada", async () => {
    await chatApi.askNew({ subject_id: "s-1", question: "calc" });
    await chatApi.askNew({ subject_id: "s-2", question: "algo" });

    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions.length).toBe(2);

    await act(async () => {
      result.current.setFilter("s-1");
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions.every((s) => s.subject_id === "s-1")).toBe(
      true
    );
  });
});
