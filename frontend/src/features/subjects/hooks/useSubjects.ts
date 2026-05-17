import { useCallback, useEffect, useState } from "react";
import type {
  CreateSubjectInput,
  Subject,
  UpdateSubjectInput,
  UUID,
} from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { subjectsApi } from "../api";

interface UseSubjects {
  subjects: Subject[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSubject: (input: CreateSubjectInput) => Promise<Subject>;
  updateSubject: (id: UUID, input: UpdateSubjectInput) => Promise<Subject>;
  deleteSubject: (id: UUID) => Promise<void>;
}

export function useSubjects(): UseSubjects {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await subjectsApi.list();
      setSubjects(list);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar matérias"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSubject = useCallback(async (input: CreateSubjectInput) => {
    const created = await subjectsApi.create(input);
    setSubjects((prev) => [...prev, created]);
    return created;
  }, []);

  const updateSubject = useCallback(
    async (id: UUID, input: UpdateSubjectInput) => {
      const updated = await subjectsApi.update(id, input);
      setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    []
  );

  const deleteSubject = useCallback(async (id: UUID) => {
    await subjectsApi.remove(id);
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { subjects, loading, error, refresh, createSubject, updateSubject, deleteSubject };
}
