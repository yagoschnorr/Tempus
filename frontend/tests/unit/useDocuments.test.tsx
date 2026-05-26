import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Document, UploadDocumentInput, UUID } from "@/lib/api/types";

const mock = vi.hoisted(() => {
  const state = { docs: [] as Document[], counter: 0 };
  const tickProcessing = () => {
    state.docs.forEach((d) => {
      if (d.status === "processing") {
        d.status = "ready";
        d.total_pages = 5;
        d.total_chunks = 3;
        d.processed_at = new Date().toISOString();
      }
    });
  };
  return {
    state,
    api: {
      list: async (subjectId?: UUID) => {
        tickProcessing();
        const filtered = subjectId
          ? state.docs.filter((d) => d.subject_id === subjectId)
          : state.docs;
        return filtered.map((d) => ({ ...d }));
      },
      get: async (id: UUID) => {
        const doc = state.docs.find((d) => d.id === id);
        if (!doc) throw new Error("not found");
        return { ...doc };
      },
      upload: async (input: UploadDocumentInput) => {
        state.counter += 1;
        const doc: Document = {
          id: `doc-${state.counter}`,
          user_id: "u-1",
          subject_id: input.subject_id ?? null,
          filename: input.file.name,
          file_size_bytes: input.file.size,
          mime_type: input.file.type || "application/pdf",
          total_pages: null,
          total_chunks: 0,
          status: "processing",
          error_message: null,
          uploaded_at: new Date().toISOString(),
          processed_at: null,
        };
        state.docs.push(doc);
        return { ...doc };
      },
      remove: async (id: UUID) => {
        const idx = state.docs.findIndex((d) => d.id === id);
        if (idx === -1) throw new Error("not found");
        state.docs.splice(idx, 1);
      },
    },
  };
});

vi.mock("@/features/documents/api", () => ({
  documentsApi: mock.api,
}));

import { useDocuments } from "@/features/documents/hooks/useDocuments";

function makeFile(name = "aula.pdf", size = 1024) {
  return new File(["x".repeat(size)], name, { type: "application/pdf" });
}

beforeEach(() => {
  mock.state.docs = [];
  mock.state.counter = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDocuments", () => {
  it("carrega lista vazia no mount", async () => {
    const { result } = renderHook(() => useDocuments());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("uploadDocument faz prepend otimista com status processing", async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.uploadDocument({ file: makeFile() });
    });

    expect(result.current.documents).toHaveLength(1);
    expect(result.current.documents[0].status).toBe("processing");
  });

  it("polling transiciona doc de processing para ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.uploadDocument({ file: makeFile() });
    });
    expect(result.current.documents[0].status).toBe("processing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    await waitFor(() =>
      expect(result.current.documents[0].status).toBe("ready"),
    );
  });

  it("deleteDocument remove do estado", async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let id: string;
    await act(async () => {
      const doc = await result.current.uploadDocument({ file: makeFile() });
      id = doc.id;
    });
    expect(result.current.documents).toHaveLength(1);

    await act(async () => {
      await result.current.deleteDocument(id!);
    });
    expect(result.current.documents).toHaveLength(0);
  });

  it("filterBySubject refaz fetch com subject_id", async () => {
    const { result } = renderHook(() => useDocuments());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.uploadDocument({
        file: makeFile("calc.pdf"),
        subject_id: "s-1",
      });
      await result.current.uploadDocument({
        file: makeFile("algo.pdf"),
        subject_id: "s-2",
      });
    });
    expect(result.current.documents).toHaveLength(2);

    await act(async () => {
      result.current.filterBySubject("s-1");
    });

    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    expect(result.current.documents[0].subject_id).toBe("s-1");
    expect(result.current.currentSubjectFilter).toBe("s-1");
  });
});
