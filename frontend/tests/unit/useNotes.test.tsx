import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNotes } from "@/features/notebooks/hooks/useNotes";
import { notebooksApi } from "@/features/notebooks/api";

describe("useNotes", () => {
  it("retorna lista vazia quando notebookId é null e não chama backend", async () => {
    const { result } = renderHook(() => useNotes(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toEqual([]);
  });

  it("carrega notes do notebook ao montar", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    await notebooksApi.createNote(nb.id, { title: "Folha 1" });
    await notebooksApi.createNote(nb.id, { title: "Folha 2" });

    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes).toHaveLength(2);
  });

  it("create insere a nova note no topo", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ title: "Nova" });
    });
    expect(result.current.notes[0].title).toBe("Nova");
  });

  it("update substitui a note na lista", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Original" });

    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update(note.id, { title: "Editada" });
    });
    expect(result.current.notes[0].title).toBe("Editada");
  });

  it("remove tira a note da lista", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Vai sumir" });

    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove(note.id);
    });
    expect(result.current.notes).toEqual([]);
  });

  it("summarize retorna o resumo quando há content", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, {
      title: "Com texto",
      content: "Conteúdo da folha pra resumir",
    });

    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const summary = await result.current.summarize(note.id);
    expect(summary.summary).toContain("Conteúdo");
  });

  it("summarize rejeita com 422 quando content vazio", async () => {
    const nb = await notebooksApi.create({ title: "Caderno" });
    const note = await notebooksApi.createNote(nb.id, { title: "Vazia" });

    const { result } = renderHook(() => useNotes(nb.id));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.summarize(note.id)).rejects.toMatchObject({
      status: 422,
    });
  });
});
