import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateStudyPlanInput,
  StudyPlan,
  StudyPlanStatus,
  UUID,
} from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { studyPlansApi } from "../api";

interface UseStudyPlans {
  plans: StudyPlan[];
  activePlan: StudyPlan | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  generate: (input: CreateStudyPlanInput) => Promise<StudyPlan>;
  updateStatus: (id: UUID, status: StudyPlanStatus) => Promise<StudyPlan>;
}

export function useStudyPlans(): UseStudyPlans {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await studyPlansApi.list();
      setPlans(list);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar planos"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generate = useCallback(async (input: CreateStudyPlanInput) => {
    const created = await studyPlansApi.generate(input);
    setPlans((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateStatus = useCallback(
    async (id: UUID, status: StudyPlanStatus) => {
      const updated = await studyPlansApi.updateStatus(id, status);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    },
    [],
  );

  // Backend retorna ordenado desc por created_at, então o primeiro com status
  // active é o mais recente — coerente quando há mais de um ativo.
  const activePlan = useMemo(
    () => plans.find((p) => p.status === "active") ?? null,
    [plans],
  );

  return {
    plans,
    activePlan,
    loading,
    error,
    refresh,
    generate,
    updateStatus,
  };
}
