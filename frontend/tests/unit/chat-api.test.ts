import { describe, it, expect } from "vitest";
import { chatApi } from "@/features/chat/api";
import { ApiError } from "@/lib/api/client";

describe("chatApi", () => {
  it("askNew exige subject_id (422)", async () => {
    await expect(chatApi.askNew({ question: "oi" })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("askNew cria sessão e devolve AskResponse com mensagem do assistant", async () => {
    const res = await chatApi.askNew({
      subject_id: "s-1",
      question: "Por que o Jacobiano aparece em mudança de variáveis?",
    });
    expect(res.session_id).toBeTruthy();
    expect(res.message.role).toBe("assistant");
    expect(res.message.content).toMatch(/Jacobiano/);
  });

  it("listSessions retorna a sessão recém-criada", async () => {
    await chatApi.askNew({ subject_id: "s-1", question: "Pergunta 1" });
    const list = await chatApi.listSessions();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].subject_id).toBe("s-1");
    expect(list[0].title.length).toBeGreaterThan(0);
  });

  it("listSessions filtra por subject_id", async () => {
    await chatApi.askNew({ subject_id: "s-1", question: "Sobre cálculo" });
    await chatApi.askNew({ subject_id: "s-2", question: "Sobre algoritmos" });

    const onlyS1 = await chatApi.listSessions("s-1");
    expect(onlyS1.every((s) => s.subject_id === "s-1")).toBe(true);

    const onlyS2 = await chatApi.listSessions("s-2");
    expect(onlyS2.every((s) => s.subject_id === "s-2")).toBe(true);
  });

  it("getSession retorna detail com mensagens", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "pergunta inicial",
    });
    const detail = await chatApi.getSession(session_id);
    expect(detail.messages.length).toBe(2);
    expect(detail.messages[0].role).toBe("user");
    expect(detail.messages[1].role).toBe("assistant");
  });

  it("askInSession anexa novas mensagens à mesma sessão", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "primeira",
    });
    await chatApi.askInSession(session_id, { question: "segunda" });
    const detail = await chatApi.getSession(session_id);
    expect(detail.messages.length).toBe(4);
    expect(detail.messages[2].content).toBe("segunda");
  });

  it("rename atualiza o título", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "q",
    });
    const updated = await chatApi.rename(session_id, { title: "Manual" });
    expect(updated.title).toBe("Manual");
  });

  it("remove deleta a sessão e GET retorna 404", async () => {
    const { session_id } = await chatApi.askNew({
      subject_id: "s-1",
      question: "q",
    });
    await chatApi.remove(session_id);
    await expect(chatApi.getSession(session_id)).rejects.toBeInstanceOf(
      ApiError
    );
  });
});
