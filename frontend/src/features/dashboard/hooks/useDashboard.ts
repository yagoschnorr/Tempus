import { useCallback, useEffect, useState } from "react";
import type { RealtimeDashboard } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { dashboardApi } from "../api";

interface UseDashboard {
  data: RealtimeDashboard | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboard {
  const [data, setData] = useState<RealtimeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.realtime();
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível carregar o dashboard"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
