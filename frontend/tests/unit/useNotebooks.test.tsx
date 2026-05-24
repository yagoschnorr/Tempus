import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useNotebooks } from "@/features/notebooks/hooks/useNotebooks";
import { notebooksApi } from "@/features/notebooks/api";

describe("useNotebooks", () => {
  it("carrega lista vazia ao montar", async () => {
    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notebooks).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("create insere o novo notebook na lista", async () => {
    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ title: "Novo" });
    });
    expect(result.current.notebooks).toHaveLength(1);
    expect(result.current.notebooks[0].title).toBe("Novo");
  });

  it("update troca o item localmente sem refetch", async () => {
    const nb = await notebooksApi.create({ title: "Original" });

    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update(nb.id, { title: "Editado" });
    });
    expect(result.current.notebooks[0].title).toBe("Editado");
  });

  it("remove tira o item da lista", async () => {
    const nb = await notebooksApi.create({ title: "Vai sumir" });

    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notebooks).toHaveLength(1);

    await act(async () => {
      await result.current.remove(nb.id);
    });
    expect(result.current.notebooks).toEqual([]);
  });

  it("togglePin alterna pinned e reordena (fixado vai pro topo)", async () => {
    const a = await notebooksApi.create({ title: "A" });
    await notebooksApi.create({ title: "B" });

    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Antes de fixar, B (criado depois) vem primeiro por last_activity desc.
    expect(result.current.notebooks[0].title).toBe("B");

    await act(async () => {
      await result.current.togglePin(a.id);
    });
    // Fixados primeiro — A sobe pro topo mesmo sendo mais antigo.
    expect(result.current.notebooks[0].title).toBe("A");
    expect(result.current.notebooks[0].pinned).toBe(true);

    await act(async () => {
      await result.current.togglePin(a.id);
    });
    // Desfixou — volta pra ordem por last_activity.
    expect(result.current.notebooks[0].title).toBe("A"); // A foi mexido por último, last_activity dele é o mais recente
    expect(result.current.notebooks[0].pinned).toBe(false);
  });

  it("expõe error quando a API falha", async () => {
    const { result } = renderHook(() => useNotebooks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Tentar criar sem title dispara 422 do mock.
    await act(async () => {
      await expect(
        result.current.create({ title: "" })
      ).rejects.toBeTruthy();
    });
  });
});
