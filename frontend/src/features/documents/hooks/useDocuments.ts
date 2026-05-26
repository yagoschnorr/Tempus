import { useCallback, useEffect, useRef, useState } from "react";
import type { Document, UploadDocumentInput, UUID } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { documentsApi } from "../api";

interface UseDocuments {
  documents: Document[];
  loading: boolean;
  error: string | null;
  currentSubjectFilter: UUID | undefined;
  refresh: () => Promise<void>;
  uploadDocument: (input: UploadDocumentInput) => Promise<Document>;
  deleteDocument: (id: UUID) => Promise<void>;
  filterBySubject: (subjectId?: UUID) => void;
}

const POLL_INTERVAL_MS = 3000;

export function useDocuments(): UseDocuments {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSubjectFilter, setCurrentSubjectFilter] = useState<UUID | undefined>(undefined);

  // Espelho síncrono do filtro atual para evitar que respostas atrasadas
  // de fetches antigos sobrescrevam a lista após o usuário trocar o filtro.
  const filterRef = useRef(currentSubjectFilter);
  filterRef.current = currentSubjectFilter;

  const fetchList = useCallback(
    async (subjectId: UUID | undefined, silent: boolean) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const list = await documentsApi.list(subjectId);
        if (filterRef.current === subjectId) {
          setDocuments(list);
        }
      } catch (err) {
        if (!silent) {
          setError(getErrorMessage(err, "Não foi possível carregar documentos"));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(
    () => fetchList(filterRef.current, false),
    [fetchList],
  );

  useEffect(() => {
    void fetchList(currentSubjectFilter, false);
  }, [currentSubjectFilter, fetchList]);

  // Polling enquanto houver documentos em processing — usa setTimeout recursivo
  // (via re-render) em vez de setInterval para não enfileirar requests.
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const timeoutId = setTimeout(() => {
      void fetchList(filterRef.current, true);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timeoutId);
  }, [documents, fetchList]);

  const uploadDocument = useCallback(async (input: UploadDocumentInput) => {
    const created = await documentsApi.upload(input);
    const filter = filterRef.current;
    if (filter === undefined || created.subject_id === filter) {
      setDocuments((prev) => [created, ...prev]);
    }
    return created;
  }, []);

  const deleteDocument = useCallback(async (id: UUID) => {
    await documentsApi.remove(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const filterBySubject = useCallback((subjectId?: UUID) => {
    setCurrentSubjectFilter(subjectId);
  }, []);

  return {
    documents,
    loading,
    error,
    currentSubjectFilter,
    refresh,
    uploadDocument,
    deleteDocument,
    filterBySubject,
  };
}
