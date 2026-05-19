import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSubjects } from "@/features/subjects/hooks/useSubjects";

describe("useSubjects", () => {
  it("carrega matérias do seed ao montar", async () => {
    const { result } = renderHook(() => useSubjects());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subjects).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it("createSubject acrescenta na lista", async () => {
    const { result } = renderHook(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createSubject({ name: "Química" });
    });

    expect(result.current.subjects).toHaveLength(4);
    expect(result.current.subjects.some((s) => s.name === "Química")).toBe(true);
  });

  it("updateSubject substitui o item na lista", async () => {
    const { result } = renderHook(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateSubject("s-1", { name: "Cálculo Renomeado" });
    });

    const found = result.current.subjects.find((s) => s.id === "s-1");
    expect(found?.name).toBe("Cálculo Renomeado");
  });

  it("deleteSubject remove o item da lista", async () => {
    const { result } = renderHook(() => useSubjects());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteSubject("s-1");
    });

    expect(result.current.subjects.some((s) => s.id === "s-1")).toBe(false);
  });
});
