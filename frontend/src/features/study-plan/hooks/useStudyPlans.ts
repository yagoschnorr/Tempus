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
  activePlans: StudyPlan[];
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

  // Backend retorna ordenado desc por created_at; mantém a ordem na lista.
  const activePlans = useMemo(
    () => plans.filter((p) => p.status === "active"),
    [plans],
  );

  // activePlan (singular) = primeiro ativo. Mantido para callers que só usam
  // "o plano ativo" (ex.: header do Dashboard mostrando próxima prova).
  const activePlan = activePlans[0] ?? null;

  return {
    plans,
    activePlans,
    activePlan,
    loading,
    error,
    refresh,
    generate,
    updateStatus,
  };
}
